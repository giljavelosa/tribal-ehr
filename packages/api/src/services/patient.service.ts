// =============================================================================
// Patient Service - Full CRUD with FHIR R4 Sync and US Core Compliance
// =============================================================================

import crypto from 'crypto';
import { Knex } from 'knex';
import {
  PatientDemographics,
  Address,
  PhoneNumber,
  EmergencyContact,
  InsuranceCoverage,
  AdministrativeSex,
  AddressUse,
  AddressType,
  PhoneUse,
  PhoneSystem,
  MaritalStatus,
  SubscriberRelationship,
  InsurancePlanType,
  RaceCode,
  CommunicationPreferences,
} from '@tribal-ehr/shared';
import {
  CodeableConcept,
} from '@tribal-ehr/shared';
import {
  toFHIRHumanName,
  fromFHIRHumanName,
  toFHIRAddress,
  fromFHIRAddress,
  toFHIRContactPoint,
  fromFHIRContactPoint,
} from '@tribal-ehr/shared';
import { US_CORE_PROFILES } from '@tribal-ehr/shared';
import { BaseService, PaginatedResult } from './base.service';
import { ProvenanceService, provenanceService } from './provenance.service';
import { AuditService, auditService } from './audit.service';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import {
  CreatePatientDTO,
  UpdatePatientDTO,
  PatientSearchParams,
} from '../validators/patient.validator';
import {
  GENDER_IDENTITY_CODES,
  SEXUAL_ORIENTATION_CODES,
} from '../data/demographics-codes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MRN_PREFIX = 'TRB';
const MRN_SYSTEM = 'urn:oid:2.16.840.1.113883.19.5.1'; // Example OID for tribal facility
const RACE_EXTENSION_URL = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race';
const ETHNICITY_EXTENSION_URL = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity';
const BIRTHSEX_EXTENSION_URL = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex';
const GENDER_IDENTITY_EXTENSION_URL = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-genderIdentity';
const SEXUAL_ORIENTATION_EXTENSION_URL = 'http://hl7.org/fhir/StructureDefinition/patient-sexualOrientation';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PatientService extends BaseService {
  private provenanceService: ProvenanceService;
  private auditService: AuditService;

  constructor() {
    super('PatientService');
    this.provenanceService = provenanceService;
    this.auditService = auditService;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Create a new patient. Inserts into PostgreSQL (with related tables) and
   * syncs to the HAPI FHIR server. Returns the fully-hydrated patient.
   */
  async create(data: CreatePatientDTO, agentId?: string, agentDisplay?: string): Promise<PatientDemographics> {
    return this.withTransaction(async (trx) => {
      // Generate MRN
      const mrn = await this.generateMRN(trx);

      const patientId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Insert main patient row
      await trx('patients').insert({
        id: patientId,
        mrn,
        first_name: data.firstName,
        middle_name: data.middleName || null,
        last_name: data.lastName,
        suffix: data.suffix || null,
        date_of_birth: data.dateOfBirth,
        sex: data.sex,
        gender_identity: data.genderIdentity ? JSON.stringify(data.genderIdentity) : null,
        sexual_orientation: data.sexualOrientation ? JSON.stringify(data.sexualOrientation) : null,
        race: data.race ? JSON.stringify(data.race) : null,
        ethnicity: data.ethnicity ? JSON.stringify(data.ethnicity) : null,
        preferred_language: data.preferredLanguage || null,
        marital_status: data.maritalStatus || null,
        photo: data.photo || null,
        deceased_boolean: data.deceasedBoolean ?? false,
        deceased_date_time: data.deceasedDateTime || null,
        multiple_birth_boolean: data.multipleBirthBoolean ?? false,
        multiple_birth_integer: data.multipleBirthInteger || null,
        communication_preferences: data.communicationPreferences
          ? JSON.stringify(data.communicationPreferences)
          : null,
        active: data.active ?? true,
        created_at: now,
        updated_at: now,
      });

      // Insert related records
      await this.insertAddresses(trx, patientId, data.addresses as Address[] | undefined);
      await this.insertPhoneNumbers(trx, patientId, data.phoneNumbers as PhoneNumber[] | undefined);
      await this.insertEmails(trx, patientId, data.emails);
      await this.insertEmergencyContacts(trx, patientId, data.emergencyContacts as EmergencyContact[] | undefined);
      await this.insertInsuranceCoverage(trx, patientId, data.insuranceCoverage as InsuranceCoverage[] | undefined);

      // Build full patient object
      const patient = await this.loadPatient(trx, patientId);
      if (!patient) {
        throw new Error('Failed to load patient after creation');
      }

      // Sync to FHIR server (best-effort; do not roll back if FHIR fails)
      let fhirId: string | undefined;
      try {
        const fhirPatient = this.toFHIRPatient(patient);
        const fhirResult = await this.fhirClient.create<Record<string, unknown>>(
          'Patient',
          fhirPatient as unknown as Record<string, unknown>
        );
        fhirId = fhirResult.id as string | undefined;

        if (fhirId) {
          await trx('patients')
            .where({ id: patientId })
            .update({ fhir_id: fhirId });
        }
      } catch (fhirError) {
        const errorMessage = fhirError instanceof Error ? fhirError.message : String(fhirError);
        this.logger.warn('Failed to sync patient to FHIR server; will retry later', {
          patientId,
          error: errorMessage,
        });
      }

      // Record provenance
      if (agentId && agentDisplay) {
        this.provenanceService
          .record({
            targetType: 'Patient',
            targetId: patientId,
            action: 'CREATE',
            agentId,
            agentDisplay,
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn('Failed to record provenance for patient creation', { error: msg });
          });
      }

      this.logger.info('Patient created', { patientId, mrn });

      return patient;
    });
  }

  /**
   * Get a patient by internal UUID.
   */
  async getById(id: string): Promise<PatientDemographics | null> {
    try {
      return await this.loadPatient(this.db, id);
    } catch (error) {
      this.handleError('Failed to get patient by ID', error);
    }
  }

  /**
   * Get a patient by MRN.
   */
  async getByMRN(mrn: string): Promise<PatientDemographics | null> {
    try {
      const row = await this.db('patients').where({ mrn }).first();
      if (!row) return null;
      return this.loadPatient(this.db, row.id);
    } catch (error) {
      this.handleError('Failed to get patient by MRN', error);
    }
  }

  /**
   * Search patients with filtering, sorting, and pagination.
   */
  async search(params: PatientSearchParams): Promise<PaginatedResult<PatientDemographics>> {
    try {
      const query = this.db('patients').select('patients.*');

      // Filters
      if (params.name) {
        const nameTerm = `%${params.name.toLowerCase()}%`;
        query.where(function () {
          this.whereRaw('LOWER(first_name) LIKE ?', [nameTerm])
            .orWhereRaw('LOWER(last_name) LIKE ?', [nameTerm])
            .orWhereRaw("LOWER(first_name || ' ' || last_name) LIKE ?", [nameTerm]);
        });
      }

      if (params.mrn) {
        query.where('mrn', params.mrn);
      }

      if (params.dob) {
        query.where('date_of_birth', params.dob);
      }

      if (params.phone) {
        const phoneTerm = params.phone.replace(/[\s()+\-.]/g, '');
        query.whereExists(function () {
          this.select(1)
            .from('patient_phone_numbers')
            .whereRaw('patient_phone_numbers.patient_id = patients.id')
            .whereRaw("REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(value, ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') LIKE ?", [`%${phoneTerm}%`]);
        });
      }

      if (params.email) {
        query.whereExists(function () {
          this.select(1)
            .from('patient_emails')
            .whereRaw('patient_emails.patient_id = patients.id')
            .whereRaw('LOWER(email) = ?', [params.email!.toLowerCase()]);
        });
      }

      if (params.active !== undefined) {
        query.where('active', params.active);
      }

      // Sort
      const allowedSortColumns: Record<string, string> = {
        name: 'last_name',
        dob: 'date_of_birth',
        mrn: 'mrn',
        createdAt: 'created_at',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      // If no sort was specified, default to last_name ascending
      if (!params.sort) {
        query.orderBy('last_name', 'asc').orderBy('first_name', 'asc');
      }

      const result = await this.paginate<Record<string, unknown>>(query, {
        page: params.page,
        limit: params.limit,
      });

      // Hydrate each patient with related data
      const patients: PatientDemographics[] = [];
      for (const row of result.data) {
        const patient = await this.loadPatient(this.db, row.id as string);
        if (patient) {
          patients.push(patient);
        }
      }

      return {
        data: patients,
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to search patients', error);
    }
  }

  /**
   * Update a patient. Supports partial updates. Syncs changes to FHIR.
   */
  async update(
    id: string,
    data: UpdatePatientDTO,
    agentId?: string,
    agentDisplay?: string
  ): Promise<PatientDemographics> {
    return this.withTransaction(async (trx) => {
      // Verify patient exists
      const existing = await trx('patients').where({ id }).first();
      if (!existing) {
        throw new NotFoundError('Patient', id);
      }

      const now = new Date().toISOString();

      // Capture old values for provenance
      const oldPatient = await this.loadPatient(trx, id);

      // Build update object for the main patients table
      const updateFields: Record<string, unknown> = { updated_at: now };

      if (data.firstName !== undefined) updateFields.first_name = data.firstName;
      if (data.middleName !== undefined) updateFields.middle_name = data.middleName || null;
      if (data.lastName !== undefined) updateFields.last_name = data.lastName;
      if (data.suffix !== undefined) updateFields.suffix = data.suffix || null;
      if (data.dateOfBirth !== undefined) updateFields.date_of_birth = data.dateOfBirth;
      if (data.sex !== undefined) updateFields.sex = data.sex;
      if (data.genderIdentity !== undefined) {
        updateFields.gender_identity = data.genderIdentity
          ? JSON.stringify(data.genderIdentity)
          : null;
      }
      if (data.sexualOrientation !== undefined) {
        updateFields.sexual_orientation = data.sexualOrientation
          ? JSON.stringify(data.sexualOrientation)
          : null;
      }
      if (data.race !== undefined) {
        updateFields.race = data.race ? JSON.stringify(data.race) : null;
      }
      if (data.ethnicity !== undefined) {
        updateFields.ethnicity = data.ethnicity ? JSON.stringify(data.ethnicity) : null;
      }
      if (data.preferredLanguage !== undefined) {
        updateFields.preferred_language = data.preferredLanguage || null;
      }
      if (data.maritalStatus !== undefined) {
        updateFields.marital_status = data.maritalStatus || null;
      }
      if (data.photo !== undefined) updateFields.photo = data.photo || null;
      if (data.deceasedBoolean !== undefined) updateFields.deceased_boolean = data.deceasedBoolean;
      if (data.deceasedDateTime !== undefined) {
        updateFields.deceased_date_time = data.deceasedDateTime || null;
      }
      if (data.multipleBirthBoolean !== undefined) {
        updateFields.multiple_birth_boolean = data.multipleBirthBoolean;
      }
      if (data.multipleBirthInteger !== undefined) {
        updateFields.multiple_birth_integer = data.multipleBirthInteger || null;
      }
      if (data.communicationPreferences !== undefined) {
        updateFields.communication_preferences = data.communicationPreferences
          ? JSON.stringify(data.communicationPreferences)
          : null;
      }
      if (data.active !== undefined) updateFields.active = data.active;

      await trx('patients').where({ id }).update(updateFields);

      // Replace related records if provided
      if (data.addresses !== undefined) {
        await trx('patient_addresses').where({ patient_id: id }).del();
        await this.insertAddresses(trx, id, data.addresses as Address[] | undefined);
      }

      if (data.phoneNumbers !== undefined) {
        await trx('patient_phone_numbers').where({ patient_id: id }).del();
        await this.insertPhoneNumbers(trx, id, data.phoneNumbers as PhoneNumber[] | undefined);
      }

      if (data.emails !== undefined) {
        await trx('patient_emails').where({ patient_id: id }).del();
        await this.insertEmails(trx, id, data.emails);
      }

      if (data.emergencyContacts !== undefined) {
        await trx('emergency_contacts').where({ patient_id: id }).del();
        await this.insertEmergencyContacts(trx, id, data.emergencyContacts as EmergencyContact[] | undefined);
      }

      if (data.insuranceCoverage !== undefined) {
        await trx('insurance_coverages').where({ patient_id: id }).del();
        await this.insertInsuranceCoverage(trx, id, data.insuranceCoverage as InsuranceCoverage[] | undefined);
      }

      // Load updated patient
      const updatedPatient = await this.loadPatient(trx, id);
      if (!updatedPatient) {
        throw new Error('Failed to load patient after update');
      }

      // Sync to FHIR (best-effort)
      try {
        const fhirId = existing.fhir_id;
        const fhirPatient = this.toFHIRPatient(updatedPatient);
        if (fhirId) {
          await this.fhirClient.update(
            'Patient',
            fhirId,
            fhirPatient as unknown as Record<string, unknown>
          );
        } else {
          const fhirResult = await this.fhirClient.create<Record<string, unknown>>(
            'Patient',
            fhirPatient as unknown as Record<string, unknown>
          );
          const newFhirId = fhirResult.id as string | undefined;
          if (newFhirId) {
            await trx('patients').where({ id }).update({ fhir_id: newFhirId });
          }
        }
      } catch (fhirError) {
        const errorMessage = fhirError instanceof Error ? fhirError.message : String(fhirError);
        this.logger.warn('Failed to sync patient update to FHIR server', {
          patientId: id,
          error: errorMessage,
        });
      }

      // Record provenance with old/new values
      if (agentId && agentDisplay) {
        this.provenanceService
          .record({
            targetType: 'Patient',
            targetId: id,
            action: 'UPDATE',
            agentId,
            agentDisplay,
            detail: {
              oldValue: oldPatient,
              newValue: updatedPatient,
            },
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn('Failed to record provenance for patient update', { error: msg });
          });
      }

      this.logger.info('Patient updated', { patientId: id });

      return updatedPatient;
    });
  }

  /**
   * Soft-delete a patient (sets active = false).
   */
  async delete(id: string, agentId?: string, agentDisplay?: string): Promise<void> {
    const existing = await this.db('patients').where({ id }).first();
    if (!existing) {
      throw new NotFoundError('Patient', id);
    }

    await this.db('patients').where({ id }).update({
      active: false,
      updated_at: new Date().toISOString(),
    });

    // Mark as inactive in FHIR too
    if (existing.fhir_id) {
      try {
        const currentFhir = await this.fhirClient.read<Record<string, unknown>>(
          'Patient',
          existing.fhir_id
        );
        currentFhir.active = false;
        await this.fhirClient.update('Patient', existing.fhir_id, currentFhir);
      } catch (fhirError) {
        const errorMessage = fhirError instanceof Error ? fhirError.message : String(fhirError);
        this.logger.warn('Failed to deactivate patient in FHIR', {
          patientId: id,
          error: errorMessage,
        });
      }
    }

    if (agentId && agentDisplay) {
      this.provenanceService
        .record({
          targetType: 'Patient',
          targetId: id,
          action: 'DELETE',
          agentId,
          agentDisplay,
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn('Failed to record provenance for patient deletion', { error: msg });
        });
    }

    this.logger.info('Patient soft-deleted', { patientId: id });
  }

  /**
   * Generate the next MRN in the sequence TRB-XXXXXX.
   */
  async getMRN(): Promise<string> {
    return this.generateMRN(this.db);
  }

  // =========================================================================
  // FHIR Mapping
  // =========================================================================

  /**
   * Map an internal PatientDemographics to a FHIR R4 Patient resource
   * conforming to US Core Patient profile.
   */
  toFHIRPatient(patient: PatientDemographics): Record<string, unknown> {
    const resource: Record<string, unknown> = {
      resourceType: 'Patient',
      meta: {
        profile: [US_CORE_PROFILES.PATIENT],
      },
      active: patient.active ?? true,
    };

    // Identifier (MRN)
    resource.identifier = [
      {
        use: 'usual',
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MR',
              display: 'Medical Record Number',
            },
          ],
        },
        system: MRN_SYSTEM,
        value: patient.mrn,
      },
    ];

    // Name
    const name = toFHIRHumanName({
      firstName: patient.firstName,
      middleName: patient.middleName,
      lastName: patient.lastName,
      suffix: patient.suffix,
    });
    resource.name = [name];

    // Administrative gender
    resource.gender = patient.sex;

    // Birth date
    resource.birthDate = patient.dateOfBirth;

    // Deceased
    if (patient.deceasedDateTime) {
      resource.deceasedDateTime = patient.deceasedDateTime;
    } else if (patient.deceasedBoolean !== undefined) {
      resource.deceasedBoolean = patient.deceasedBoolean;
    }

    // Multiple birth
    if (patient.multipleBirthInteger !== undefined && patient.multipleBirthInteger !== null) {
      resource.multipleBirthInteger = patient.multipleBirthInteger;
    } else if (patient.multipleBirthBoolean !== undefined) {
      resource.multipleBirthBoolean = patient.multipleBirthBoolean;
    }

    // Marital status
    if (patient.maritalStatus) {
      resource.maritalStatus = {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
            code: patient.maritalStatus,
          },
        ],
      };
    }

    // Telecom (phones + emails)
    const telecom: Array<Record<string, unknown>> = [];

    if (patient.phoneNumbers) {
      for (const phone of patient.phoneNumbers) {
        telecom.push(toFHIRContactPoint(phone) as unknown as Record<string, unknown>);
      }
    }
    if (patient.emails) {
      for (const email of patient.emails) {
        telecom.push({
          system: 'email',
          value: email,
          use: 'home',
        });
      }
    }
    if (telecom.length > 0) {
      resource.telecom = telecom;
    }

    // Addresses
    if (patient.addresses && patient.addresses.length > 0) {
      resource.address = patient.addresses.map((addr) => toFHIRAddress(addr));
    }

    // Contact (emergency contacts)
    if (patient.emergencyContacts && patient.emergencyContacts.length > 0) {
      resource.contact = patient.emergencyContacts.map((ec) => ({
        relationship: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
                code: 'C',
                display: 'Emergency Contact',
              },
            ],
            text: ec.relationship,
          },
        ],
        name: {
          text: ec.name,
        },
        telecom: [
          {
            system: 'phone',
            value: ec.phone,
          },
        ],
        address: ec.address ? toFHIRAddress(ec.address) : undefined,
      }));
    }

    // Communication (preferred language)
    if (patient.preferredLanguage) {
      resource.communication = [
        {
          language: {
            coding: [
              {
                system: 'urn:ietf:bcp:47',
                code: patient.preferredLanguage,
              },
            ],
          },
          preferred: true,
        },
      ];
    }

    // Photo
    if (patient.photo) {
      resource.photo = [{ url: patient.photo }];
    }

    // US Core Extensions
    const extensions: Array<Record<string, unknown>> = [];

    // Race extension
    if (patient.race && patient.race.length > 0) {
      const raceExtension: Record<string, unknown> = {
        url: RACE_EXTENSION_URL,
        extension: [
          ...patient.race.map((r) => ({
            url: 'ombCategory',
            valueCoding: {
              system: r.system,
              code: r.code,
              display: r.display,
            },
          })),
          {
            url: 'text',
            valueString: patient.race.map((r) => r.display).join(', '),
          },
        ],
      };
      extensions.push(raceExtension);
    }

    // Ethnicity extension
    if (patient.ethnicity) {
      const primaryCoding = patient.ethnicity.coding?.[0];
      const ethnicityExtension: Record<string, unknown> = {
        url: ETHNICITY_EXTENSION_URL,
        extension: [],
      };
      const extEntries = ethnicityExtension.extension as Array<Record<string, unknown>>;
      if (primaryCoding) {
        extEntries.push({
          url: 'ombCategory',
          valueCoding: {
            system: primaryCoding.system || 'urn:oid:2.16.840.1.113883.6.238',
            code: primaryCoding.code,
            display: primaryCoding.display,
          },
        });
      }
      extEntries.push({
        url: 'text',
        valueString: patient.ethnicity.text || primaryCoding?.display || '',
      });
      extensions.push(ethnicityExtension);
    }

    // Birth sex extension
    if (patient.sex && patient.sex !== AdministrativeSex.UNKNOWN) {
      extensions.push({
        url: BIRTHSEX_EXTENSION_URL,
        valueCode: this.mapSexToBirthSex(patient.sex),
      });
    }

    // Gender identity extension
    if (patient.genderIdentity) {
      const giCoding = patient.genderIdentity.coding?.[0];
      if (giCoding) {
        // Resolve to known SNOMED/HL7 code if possible
        const knownGI = giCoding.code
          ? GENDER_IDENTITY_CODES.find((c) => c.code === giCoding.code)
          : undefined;
        extensions.push({
          url: GENDER_IDENTITY_EXTENSION_URL,
          valueCodeableConcept: {
            coding: [
              {
                system: knownGI?.system || giCoding.system || 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor',
                code: knownGI?.code || giCoding.code,
                display: knownGI?.display || giCoding.display,
              },
            ],
            text: patient.genderIdentity.text || knownGI?.display || giCoding.display,
          },
        });
      } else if (patient.genderIdentity.text) {
        // No coded value; use text only
        extensions.push({
          url: GENDER_IDENTITY_EXTENSION_URL,
          valueCodeableConcept: {
            text: patient.genderIdentity.text,
          },
        });
      }
    }

    // Sexual orientation extension
    if (patient.sexualOrientation) {
      const soCoding = patient.sexualOrientation.coding?.[0];
      if (soCoding) {
        const knownSO = soCoding.code
          ? SEXUAL_ORIENTATION_CODES.find((c) => c.code === soCoding.code)
          : undefined;
        extensions.push({
          url: SEXUAL_ORIENTATION_EXTENSION_URL,
          valueCodeableConcept: {
            coding: [
              {
                system: knownSO?.system || soCoding.system || 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor',
                code: knownSO?.code || soCoding.code,
                display: knownSO?.display || soCoding.display,
              },
            ],
            text: patient.sexualOrientation.text || knownSO?.display || soCoding.display,
          },
        });
      } else if (patient.sexualOrientation.text) {
        extensions.push({
          url: SEXUAL_ORIENTATION_EXTENSION_URL,
          valueCodeableConcept: {
            text: patient.sexualOrientation.text,
          },
        });
      }
    }

    if (extensions.length > 0) {
      resource.extension = extensions;
    }

    return resource;
  }

  /**
   * Map a FHIR R4 Patient resource back to an internal PatientDemographics.
   */
  fromFHIRPatient(fhirPatient: Record<string, unknown>): PatientDemographics {
    const names = fhirPatient.name as Array<Record<string, unknown>> | undefined;
    const officialName = names?.find((n) => n.use === 'official') || names?.[0];
    const parsedName = officialName ? fromFHIRHumanName(officialName as any) : { firstName: '', lastName: '' };

    // Extract MRN from identifiers
    const identifiers = fhirPatient.identifier as Array<Record<string, unknown>> | undefined;
    let mrn = '';
    if (identifiers) {
      const mrnIdentifier = identifiers.find((ident) => {
        const type = ident.type as Record<string, unknown> | undefined;
        const codings = type?.coding as Array<Record<string, unknown>> | undefined;
        return codings?.some((c) => c.code === 'MR');
      });
      mrn = (mrnIdentifier?.value as string) || '';
    }

    // Parse telecoms
    const telecoms = fhirPatient.telecom as Array<Record<string, unknown>> | undefined;
    const phoneNumbers: PhoneNumber[] = [];
    const emails: string[] = [];

    if (telecoms) {
      for (const tc of telecoms) {
        if (tc.system === 'email') {
          if (tc.value) emails.push(tc.value as string);
        } else {
          phoneNumbers.push(fromFHIRContactPoint(tc as any));
        }
      }
    }

    // Parse addresses
    const fhirAddresses = fhirPatient.address as Array<Record<string, unknown>> | undefined;
    const addresses: Address[] = fhirAddresses
      ? fhirAddresses.map((a) => fromFHIRAddress(a as any))
      : [];

    // Parse emergency contacts
    const fhirContacts = fhirPatient.contact as Array<Record<string, unknown>> | undefined;
    const emergencyContacts: EmergencyContact[] = [];
    if (fhirContacts) {
      for (const fc of fhirContacts) {
        const contactName = fc.name as Record<string, unknown> | undefined;
        const relationship = fc.relationship as Array<Record<string, unknown>> | undefined;
        const contactTelecom = fc.telecom as Array<Record<string, unknown>> | undefined;
        const contactAddress = fc.address as Record<string, unknown> | undefined;

        emergencyContacts.push({
          name: (contactName?.text as string) || '',
          relationship: (relationship?.[0]?.text as string) || '',
          phone: (contactTelecom?.[0]?.value as string) || '',
          address: contactAddress ? fromFHIRAddress(contactAddress as any) : undefined,
        });
      }
    }

    // Parse extensions
    let race: RaceCode[] | undefined;
    let ethnicity: CodeableConcept | undefined;
    let genderIdentity: CodeableConcept | undefined;
    let sexualOrientation: CodeableConcept | undefined;

    const extensions = fhirPatient.extension as Array<Record<string, unknown>> | undefined;
    if (extensions) {
      for (const ext of extensions) {
        if (ext.url === RACE_EXTENSION_URL) {
          const subExtensions = ext.extension as Array<Record<string, unknown>> | undefined;
          if (subExtensions) {
            race = subExtensions
              .filter((se) => se.url === 'ombCategory')
              .map((se) => {
                const vc = se.valueCoding as Record<string, unknown>;
                return {
                  code: (vc?.code as string) || '',
                  display: (vc?.display as string) || '',
                  system: (vc?.system as string) || '',
                };
              });
          }
        }

        if (ext.url === ETHNICITY_EXTENSION_URL) {
          const subExtensions = ext.extension as Array<Record<string, unknown>> | undefined;
          if (subExtensions) {
            const ombEntry = subExtensions.find((se) => se.url === 'ombCategory');
            const textEntry = subExtensions.find((se) => se.url === 'text');
            const vc = ombEntry?.valueCoding as Record<string, unknown> | undefined;
            ethnicity = {
              coding: vc
                ? [
                    {
                      system: (vc.system as string) || '',
                      code: (vc.code as string) || '',
                      display: (vc.display as string) || '',
                    },
                  ]
                : undefined,
              text: (textEntry?.valueString as string) || undefined,
            };
          }
        }

        if (ext.url === GENDER_IDENTITY_EXTENSION_URL) {
          genderIdentity = ext.valueCodeableConcept as CodeableConcept | undefined;
        }

        if (ext.url === SEXUAL_ORIENTATION_EXTENSION_URL) {
          sexualOrientation = ext.valueCodeableConcept as CodeableConcept | undefined;
        }
      }
    }

    // Parse preferred language
    const communications = fhirPatient.communication as Array<Record<string, unknown>> | undefined;
    const preferredComm = communications?.find((c) => c.preferred === true) || communications?.[0];
    const language = preferredComm?.language as Record<string, unknown> | undefined;
    const langCodings = language?.coding as Array<Record<string, unknown>> | undefined;
    const preferredLanguage = langCodings?.[0]?.code as string | undefined;

    // Parse marital status
    const maritalStatusFhir = fhirPatient.maritalStatus as Record<string, unknown> | undefined;
    const maritalCodings = maritalStatusFhir?.coding as Array<Record<string, unknown>> | undefined;
    const maritalStatus = maritalCodings?.[0]?.code as MaritalStatus | undefined;

    const result: PatientDemographics = {
      id: (fhirPatient.id as string) || '',
      mrn,
      firstName: parsedName.firstName,
      middleName: parsedName.middleName,
      lastName: parsedName.lastName,
      suffix: parsedName.suffix,
      dateOfBirth: (fhirPatient.birthDate as string) || '',
      sex: (fhirPatient.gender as AdministrativeSex) || AdministrativeSex.UNKNOWN,
      genderIdentity,
      sexualOrientation,
      race,
      ethnicity,
      preferredLanguage,
      maritalStatus,
      addresses: addresses.length > 0 ? addresses : undefined,
      phoneNumbers: phoneNumbers.length > 0 ? phoneNumbers : undefined,
      emails: emails.length > 0 ? emails : undefined,
      emergencyContacts: emergencyContacts.length > 0 ? emergencyContacts : undefined,
      active: (fhirPatient.active as boolean) ?? true,
      deceasedBoolean:
        typeof fhirPatient.deceasedBoolean === 'boolean'
          ? fhirPatient.deceasedBoolean
          : undefined,
      deceasedDateTime: (fhirPatient.deceasedDateTime as string) || undefined,
      multipleBirthBoolean:
        typeof fhirPatient.multipleBirthBoolean === 'boolean'
          ? fhirPatient.multipleBirthBoolean
          : undefined,
      multipleBirthInteger:
        typeof fhirPatient.multipleBirthInteger === 'number'
          ? fhirPatient.multipleBirthInteger
          : undefined,
    };

    return result;
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /**
   * Generate the next MRN in format TRB-XXXXXX.
   * Uses a database sequence or max query inside a transaction for safety.
   */
  private async generateMRN(trxOrDb: Knex | Knex.Transaction): Promise<string> {
    // Use advisory lock to prevent race conditions
    await trxOrDb.raw('SELECT pg_advisory_xact_lock(1)');

    const result = await trxOrDb('patients')
      .max('mrn as max_mrn')
      .first();

    let nextNumber = 1;

    if (result?.max_mrn) {
      const currentMax = result.max_mrn as string;
      const numericPart = currentMax.replace(`${MRN_PREFIX}-`, '');
      const parsed = parseInt(numericPart, 10);
      if (!isNaN(parsed)) {
        nextNumber = parsed + 1;
      }
    }

    const paddedNumber = String(nextNumber).padStart(6, '0');
    return `${MRN_PREFIX}-${paddedNumber}`;
  }

  /**
   * Load a patient with all related data from the database.
   */
  private async loadPatient(
    trxOrDb: Knex | Knex.Transaction,
    id: string
  ): Promise<PatientDemographics | null> {
    const row = await trxOrDb('patients').where({ id }).first();
    if (!row) return null;

    const [addressRows, phoneRows, emailRows, contactRows, insuranceRows] = await Promise.all([
      trxOrDb('patient_addresses').where({ patient_id: id }).orderBy('created_at', 'asc'),
      trxOrDb('patient_phone_numbers').where({ patient_id: id }).orderBy('created_at', 'asc'),
      trxOrDb('patient_emails').where({ patient_id: id }).orderBy('created_at', 'asc'),
      trxOrDb('emergency_contacts').where({ patient_id: id }).orderBy('created_at', 'asc'),
      trxOrDb('insurance_coverages').where({ patient_id: id }).orderBy('created_at', 'asc'),
    ]);

    return this.rowToPatient(row, addressRows, phoneRows, emailRows, contactRows, insuranceRows);
  }

  /**
   * Convert database rows to a PatientDemographics object.
   */
  private rowToPatient(
    row: Record<string, unknown>,
    addressRows: Array<Record<string, unknown>>,
    phoneRows: Array<Record<string, unknown>>,
    emailRows: Array<Record<string, unknown>>,
    contactRows: Array<Record<string, unknown>>,
    insuranceRows: Array<Record<string, unknown>>
  ): PatientDemographics {
    const addresses: Address[] = addressRows.map((a) => ({
      use: (a.use as AddressUse) || undefined,
      type: (a.type as AddressType) || undefined,
      line1: a.line1 as string,
      line2: (a.line2 as string) || undefined,
      city: a.city as string,
      state: a.state as string,
      postalCode: a.postal_code as string,
      country: (a.country as string) || undefined,
      period: a.period ? this.parseJSON(a.period) : undefined,
    }));

    const phoneNumbers: PhoneNumber[] = phoneRows.map((p) => ({
      use: (p.use as PhoneUse) || undefined,
      system: (p.system as PhoneSystem) || undefined,
      value: p.value as string,
    }));

    const emails: string[] = emailRows.map((e) => e.email as string);

    const emergencyContacts: EmergencyContact[] = contactRows.map((c) => ({
      name: c.name as string,
      relationship: c.relationship as string,
      phone: c.phone as string,
      address: c.address ? this.parseJSON(c.address) : undefined,
    }));

    const insuranceCoverage: InsuranceCoverage[] = insuranceRows.map((i) => ({
      payerId: i.payer_id as string,
      payerName: i.payer_name as string,
      memberId: i.member_id as string,
      groupNumber: (i.group_number as string) || undefined,
      planName: (i.plan_name as string) || undefined,
      planType: (i.plan_type as InsurancePlanType) || undefined,
      subscriberRelationship: (i.subscriber_relationship as SubscriberRelationship) || undefined,
      effectiveDate: i.effective_date as string,
      terminationDate: (i.termination_date as string) || undefined,
      copay: i.copay !== null && i.copay !== undefined ? Number(i.copay) : undefined,
      deductible: i.deductible !== null && i.deductible !== undefined ? Number(i.deductible) : undefined,
    }));

    const communicationPreferences: CommunicationPreferences | undefined = row.communication_preferences
      ? this.parseJSON(row.communication_preferences)
      : undefined;

    return {
      id: row.id as string,
      mrn: row.mrn as string,
      firstName: row.first_name as string,
      middleName: (row.middle_name as string) || undefined,
      lastName: row.last_name as string,
      suffix: (row.suffix as string) || undefined,
      dateOfBirth: row.date_of_birth as string,
      sex: row.sex as AdministrativeSex,
      genderIdentity: row.gender_identity ? this.parseJSON(row.gender_identity) : undefined,
      sexualOrientation: row.sexual_orientation ? this.parseJSON(row.sexual_orientation) : undefined,
      race: row.race ? this.parseJSON(row.race) : undefined,
      ethnicity: row.ethnicity ? this.parseJSON(row.ethnicity) : undefined,
      preferredLanguage: (row.preferred_language as string) || undefined,
      maritalStatus: (row.marital_status as MaritalStatus) || undefined,
      addresses: addresses.length > 0 ? addresses : undefined,
      phoneNumbers: phoneNumbers.length > 0 ? phoneNumbers : undefined,
      emails: emails.length > 0 ? emails : undefined,
      emergencyContacts: emergencyContacts.length > 0 ? emergencyContacts : undefined,
      insuranceCoverage: insuranceCoverage.length > 0 ? insuranceCoverage : undefined,
      photo: (row.photo as string) || undefined,
      deceasedBoolean: row.deceased_boolean as boolean | undefined,
      deceasedDateTime: (row.deceased_date_time as string) || undefined,
      multipleBirthBoolean: row.multiple_birth_boolean as boolean | undefined,
      multipleBirthInteger: row.multiple_birth_integer as number | undefined,
      communicationPreferences,
      active: row.active as boolean | undefined,
      createdAt: row.created_at as string | undefined,
      updatedAt: row.updated_at as string | undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Insertion helpers
  // -------------------------------------------------------------------------

  private async insertAddresses(
    trx: Knex.Transaction,
    patientId: string,
    addresses?: Address[]
  ): Promise<void> {
    if (!addresses || addresses.length === 0) return;

    const rows = addresses.map((addr) => ({
      id: crypto.randomUUID(),
      patient_id: patientId,
      use: addr.use || null,
      type: addr.type || null,
      line1: addr.line1,
      line2: addr.line2 || null,
      city: addr.city,
      state: addr.state,
      postal_code: addr.postalCode,
      country: addr.country || null,
      period: addr.period ? JSON.stringify(addr.period) : null,
      created_at: new Date().toISOString(),
    }));

    await trx('patient_addresses').insert(rows);
  }

  private async insertPhoneNumbers(
    trx: Knex.Transaction,
    patientId: string,
    phones?: PhoneNumber[]
  ): Promise<void> {
    if (!phones || phones.length === 0) return;

    const rows = phones.map((phone) => ({
      id: crypto.randomUUID(),
      patient_id: patientId,
      use: phone.use || null,
      system: phone.system || null,
      value: phone.value,
      created_at: new Date().toISOString(),
    }));

    await trx('patient_phone_numbers').insert(rows);
  }

  private async insertEmails(
    trx: Knex.Transaction,
    patientId: string,
    emails?: string[]
  ): Promise<void> {
    if (!emails || emails.length === 0) return;

    const rows = emails.map((email) => ({
      id: crypto.randomUUID(),
      patient_id: patientId,
      email,
      created_at: new Date().toISOString(),
    }));

    await trx('patient_emails').insert(rows);
  }

  private async insertEmergencyContacts(
    trx: Knex.Transaction,
    patientId: string,
    contacts?: EmergencyContact[]
  ): Promise<void> {
    if (!contacts || contacts.length === 0) return;

    const rows = contacts.map((contact) => ({
      id: crypto.randomUUID(),
      patient_id: patientId,
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone,
      address: contact.address ? JSON.stringify(contact.address) : null,
      created_at: new Date().toISOString(),
    }));

    await trx('emergency_contacts').insert(rows);
  }

  private async insertInsuranceCoverage(
    trx: Knex.Transaction,
    patientId: string,
    coverage?: InsuranceCoverage[]
  ): Promise<void> {
    if (!coverage || coverage.length === 0) return;

    const rows = coverage.map((ins) => ({
      id: crypto.randomUUID(),
      patient_id: patientId,
      payer_id: ins.payerId,
      payer_name: ins.payerName,
      member_id: ins.memberId,
      group_number: ins.groupNumber || null,
      plan_name: ins.planName || null,
      plan_type: ins.planType || null,
      subscriber_relationship: ins.subscriberRelationship || null,
      effective_date: ins.effectiveDate,
      termination_date: ins.terminationDate || null,
      copay: ins.copay ?? null,
      deductible: ins.deductible ?? null,
      created_at: new Date().toISOString(),
    }));

    await trx('insurance_coverages').insert(rows);
  }

  // -------------------------------------------------------------------------
  // Utility helpers
  // -------------------------------------------------------------------------

  private parseJSON<T>(value: unknown): T | undefined {
    if (!value) return undefined;
    if (typeof value === 'object') return value as T;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        // If JSON parsing fails, return the plain string value
        // This handles cases where data was stored as plain text instead of JSON
        return value as unknown as T;
      }
    }
    return undefined;
  }

  private mapSexToBirthSex(sex: AdministrativeSex): string {
    switch (sex) {
      case AdministrativeSex.MALE:
        return 'M';
      case AdministrativeSex.FEMALE:
        return 'F';
      case AdministrativeSex.OTHER:
        return 'OTH';
      default:
        return 'UNK';
    }
  }
}

export const patientService = new PatientService();
