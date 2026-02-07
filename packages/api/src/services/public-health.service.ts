// =============================================================================
// Public Health Reporting Service
// ONC Certification: 170.315(f)(1) - Electronic Lab Reporting (ELR)
//                    170.315(f)(2) - Syndromic Surveillance
//                    170.315(f)(3) - Immunization Registry Reporting
//                    170.315(f)(5) - Electronic Case Reporting (eCR)
//                    170.315(f)(6) - Cancer Case Reporting
//                    170.315(f)(7) - Antimicrobial Use and Resistance Reporting
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError, InternalError } from '../utils/errors';
import {
  buildORU_R01,
  buildVXU_V04,
  HL7Builder,
  MSHConfig,
  PatientData,
  OrderData,
  ObservationData,
} from '@tribal-ehr/hl7-engine';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ReportResult {
  id: string;
  type: string;
  format: string;
  content: string;
  generatedAt: string;
  status: 'generated' | 'sent' | 'acknowledged' | 'error';
  destination?: string;
  error?: string;
}

interface ReportRow {
  id: string;
  type: string;
  format: string;
  content: string;
  generated_at: string;
  status: string;
  destination?: string;
  error?: string;
  patient_id?: string;
  encounter_id?: string;
  source_id?: string;
  created_at: string;
  updated_at: string;
}

interface PatientRow {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  date_of_birth?: string;
  gender?: string;
  mrn?: string;
  ssn?: string;
  race?: string;
  ethnicity?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  phone_home?: string;
}

interface LabResultRow {
  id: string;
  patient_id: string;
  encounter_id?: string;
  code_code: string;
  code_system: string;
  code_display?: string;
  value_quantity_value?: number;
  value_quantity_unit?: string;
  value_string?: string;
  effective_date_time?: string;
  status: string;
  interpretation?: string;
  reference_range?: string;
  performer?: string;
}

interface EncounterRow {
  id: string;
  patient_id: string;
  status: string;
  class_code?: string;
  type_code?: string;
  type_display?: string;
  period_start?: string;
  period_end?: string;
  reason_code?: string;
  reason_display?: string;
  chief_complaint?: string;
  discharge_disposition_code?: string;
  discharge_disposition_display?: string;
  provider_id?: string;
  facility_name?: string;
}

interface ImmunizationRow {
  id: string;
  patient_id: string;
  encounter_id?: string;
  status: string;
  vaccine_code: string;
  vaccine_system: string;
  vaccine_display?: string;
  occurrence_date_time: string;
  lot_number?: string;
  expiration_date?: string;
  site_code?: string;
  site_display?: string;
  route_code?: string;
  route_display?: string;
  dose_quantity_value?: number;
  dose_quantity_unit?: string;
  performer?: string;
}

interface DiagnosisRow {
  id: string;
  encounter_id?: string;
  patient_id: string;
  code_code: string;
  code_system: string;
  code_display?: string;
  onset_datetime?: string;
  clinical_status?: string;
}

// -----------------------------------------------------------------------------
// Reportable Conditions
// -----------------------------------------------------------------------------

const REPORTABLE_CONDITIONS: Array<{
  loincCode: string;
  condition: string;
  reportingJurisdiction: string;
}> = [
  { loincCode: '94500-6', condition: 'SARS-CoV-2 RNA', reportingJurisdiction: 'state' },
  { loincCode: '5221-7', condition: 'HIV-1 Ab', reportingJurisdiction: 'state' },
  { loincCode: '11585-7', condition: 'Chlamydia trachomatis', reportingJurisdiction: 'state' },
  { loincCode: '21415-5', condition: 'Neisseria gonorrhoeae', reportingJurisdiction: 'state' },
  { loincCode: '5292-8', condition: 'Hepatitis B surface Ag', reportingJurisdiction: 'state' },
  { loincCode: '5199-5', condition: 'Hepatitis C Ab', reportingJurisdiction: 'state' },
  { loincCode: '11477-7', condition: 'Mycobacterium tuberculosis', reportingJurisdiction: 'state' },
  { loincCode: '20507-0', condition: 'Treponema pallidum (Syphilis)', reportingJurisdiction: 'state' },
  { loincCode: '31208-2', condition: 'Salmonella', reportingJurisdiction: 'state' },
  { loincCode: '625-4', condition: 'Bacteria identified in Stool', reportingJurisdiction: 'state' },
];

// eCR trigger codes (SNOMED-CT) for reportable conditions
const ECR_TRIGGER_CODES: Record<string, string> = {
  '840539006': 'COVID-19',
  '186747009': 'Gonorrhea',
  '240589008': 'Chlamydia',
  '76272004': 'Hepatitis B',
  '235869004': 'Hepatitis C',
  '56717001': 'Tuberculosis',
  '76571007': 'Syphilis',
  '302812006': 'Salmonellosis',
  '86406008': 'HIV disease',
};

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class PublicHealthService extends BaseService {
  constructor() {
    super('PublicHealthService');
  }

  // ---------------------------------------------------------------------------
  // Check if a result is reportable
  // ---------------------------------------------------------------------------

  isReportableResult(loincCode: string): boolean {
    return REPORTABLE_CONDITIONS.some((c) => c.loincCode === loincCode);
  }

  // ---------------------------------------------------------------------------
  // 170.315(f)(1) - Electronic Lab Reporting (ELR)
  // Generates HL7v2.5.1 ORU^R01 messages for reportable lab results
  // ---------------------------------------------------------------------------

  async generateELR(labResultId: string): Promise<ReportResult> {
    try {
      // Fetch the lab result observation
      const labResult = await this.db('observations')
        .where({ id: labResultId })
        .first<LabResultRow>();

      if (!labResult) {
        throw new NotFoundError('Lab Result', labResultId);
      }

      // Check if this is a reportable condition
      if (!this.isReportableResult(labResult.code_code)) {
        throw new ValidationError(
          `Lab result with LOINC code ${labResult.code_code} is not a reportable condition`
        );
      }

      // Fetch patient demographics
      const patient = await this.db('patients')
        .where({ id: labResult.patient_id })
        .first<PatientRow>();

      if (!patient) {
        throw new NotFoundError('Patient', labResult.patient_id);
      }

      // Fetch the ordering provider if available
      let providerData: { id?: string; last_name?: string; first_name?: string; npi?: string } = {};
      if (labResult.performer) {
        try {
          const performers = JSON.parse(labResult.performer);
          const providerRef = performers[0]?.reference?.replace('Practitioner/', '');
          if (providerRef) {
            providerData = await this.db('practitioners')
              .where({ id: providerRef })
              .first() || {};
          }
        } catch {
          // Performer data not parseable, continue without it
        }
      }

      const now = new Date();
      const hl7Timestamp = this.formatHL7Timestamp(now);

      // Build patient data for HL7 message
      const patientData: PatientData = {
        patientId: patient.mrn || patient.id,
        assigningAuthority: 'TRIBAL-EHR',
        identifierTypeCode: 'MR',
        lastName: patient.last_name,
        firstName: patient.first_name,
        middleName: patient.middle_name,
        dateOfBirth: patient.date_of_birth
          ? this.formatHL7Date(patient.date_of_birth)
          : undefined,
        gender: this.mapGenderToHL7(patient.gender),
        race: patient.race,
        addressStreet: patient.address_street,
        addressCity: patient.address_city,
        addressState: patient.address_state,
        addressZip: patient.address_zip,
        homePhone: patient.phone_home,
        ethnicGroup: patient.ethnicity,
        ssn: patient.ssn,
      };

      // Build order data
      const orderData: OrderData = {
        setId: '1',
        placerOrderNumber: labResult.encounter_id || '',
        fillerOrderNumber: labResult.id,
        serviceCode: labResult.code_code,
        serviceText: labResult.code_display || '',
        codingSystem: 'LN',
        observationDateTime: labResult.effective_date_time
          ? this.formatHL7Timestamp(new Date(labResult.effective_date_time))
          : hl7Timestamp,
        resultStatus: 'F',
        orderingProviderId: providerData.npi || providerData.id || '',
        orderingProviderLastName: providerData.last_name || '',
        orderingProviderFirstName: providerData.first_name || '',
      };

      // Build observation data
      const observationValue = labResult.value_quantity_value !== undefined
        ? labResult.value_quantity_value.toString()
        : labResult.value_string || '';

      const valueType = labResult.value_quantity_value !== undefined ? 'NM' : 'ST';

      let abnormalFlags = '';
      if (labResult.interpretation) {
        try {
          const interp = JSON.parse(labResult.interpretation);
          const code = interp[0]?.coding?.[0]?.code;
          if (code) {
            abnormalFlags = code;
          }
        } catch {
          // Not parseable
        }
      }

      let referenceRange = '';
      if (labResult.reference_range) {
        try {
          const range = JSON.parse(labResult.reference_range);
          const low = range[0]?.low?.value;
          const high = range[0]?.high?.value;
          if (low !== undefined && high !== undefined) {
            referenceRange = `${low}-${high}`;
          }
        } catch {
          // Not parseable
        }
      }

      const observations: ObservationData[] = [
        {
          setId: '1',
          valueType,
          observationCode: labResult.code_code,
          observationText: labResult.code_display || '',
          codingSystem: 'LN',
          value: observationValue,
          units: labResult.value_quantity_unit || '',
          referenceRange,
          abnormalFlags,
          resultStatus: 'F',
          observationDateTime: labResult.effective_date_time
            ? this.formatHL7Timestamp(new Date(labResult.effective_date_time))
            : hl7Timestamp,
        },
      ];

      // Build the ORU^R01 message using the HL7 engine
      const mshConfig: MSHConfig = {
        sendingApplication: 'TRIBAL-EHR',
        sendingFacility: 'TRIBAL-HEALTH',
        receivingApplication: 'ELR',
        receivingFacility: 'STATE-PH-LAB',
        processingId: 'P',
        versionId: '2.5.1',
      };

      const hl7Message = buildORU_R01(patientData, orderData, observations, mshConfig);

      // Store the report
      const reportId = uuidv4();
      const generatedAt = now.toISOString();

      const condition = REPORTABLE_CONDITIONS.find((c) => c.loincCode === labResult.code_code);

      await this.db('public_health_reports').insert({
        id: reportId,
        type: 'ELR',
        format: 'HL7v2.5.1',
        content: hl7Message,
        generated_at: generatedAt,
        status: 'generated',
        patient_id: labResult.patient_id,
        encounter_id: labResult.encounter_id,
        source_id: labResultId,
        created_at: generatedAt,
        updated_at: generatedAt,
      });

      this.logger.info('ELR report generated', {
        reportId,
        labResultId,
        loincCode: labResult.code_code,
        condition: condition?.condition,
      });

      return {
        id: reportId,
        type: 'ELR',
        format: 'HL7v2.5.1',
        content: hl7Message,
        generatedAt,
        status: 'generated',
      };
    } catch (error) {
      this.handleError('Failed to generate ELR report', error);
    }
  }

  // ---------------------------------------------------------------------------
  // 170.315(f)(2) - Syndromic Surveillance
  // Generates ADT messages for emergency department visits
  // ---------------------------------------------------------------------------

  async generateSyndromicSurveillance(encounterId: string): Promise<ReportResult> {
    try {
      // Fetch encounter details
      const encounter = await this.db('encounters')
        .where({ id: encounterId })
        .first<EncounterRow>();

      if (!encounter) {
        throw new NotFoundError('Encounter', encounterId);
      }

      // Fetch patient demographics
      const patient = await this.db('patients')
        .where({ id: encounter.patient_id })
        .first<PatientRow>();

      if (!patient) {
        throw new NotFoundError('Patient', encounter.patient_id);
      }

      // Fetch diagnoses for this encounter
      const diagnoses = await this.db('conditions')
        .where({ encounter_id: encounterId })
        .select<DiagnosisRow[]>('*');

      const now = new Date();
      const hl7Timestamp = this.formatHL7Timestamp(now);

      // Determine ADT event type based on encounter status
      let eventType = 'A04'; // Registration
      if (encounter.status === 'finished') {
        eventType = 'A03'; // Discharge
      } else if (encounter.status === 'in-progress') {
        eventType = 'A01'; // Admit
      }

      // Build ADT message using HL7Builder directly
      const builder = new HL7Builder();
      builder
        .createMessage('ADT', eventType)
        .addMSH({
          sendingApplication: 'TRIBAL-EHR',
          sendingFacility: 'TRIBAL-HEALTH',
          receivingApplication: 'SS',
          receivingFacility: 'STATE-PH-SS',
          processingId: 'P',
          versionId: '2.5.1',
        })
        .addEVN({
          eventTypeCode: eventType,
          recordedDateTime: hl7Timestamp,
        })
        .addPID({
          patientId: patient.mrn || patient.id,
          assigningAuthority: 'TRIBAL-EHR',
          identifierTypeCode: 'MR',
          lastName: patient.last_name,
          firstName: patient.first_name,
          middleName: patient.middle_name,
          dateOfBirth: patient.date_of_birth
            ? this.formatHL7Date(patient.date_of_birth)
            : undefined,
          gender: this.mapGenderToHL7(patient.gender),
          race: patient.race,
          addressStreet: patient.address_street,
          addressCity: patient.address_city,
          addressState: patient.address_state,
          addressZip: patient.address_zip,
          homePhone: patient.phone_home,
          ethnicGroup: patient.ethnicity,
        })
        .addPV1({
          patientClass: this.mapEncounterClassToHL7(encounter.class_code),
          assignedLocation: encounter.facility_name || '',
          admissionType: encounter.class_code === 'EMER' ? 'E' : 'R',
          hospitalService: encounter.type_display || '',
          admitDateTime: encounter.period_start
            ? this.formatHL7Timestamp(new Date(encounter.period_start))
            : hl7Timestamp,
          dischargeDateTime: encounter.period_end
            ? this.formatHL7Timestamp(new Date(encounter.period_end))
            : undefined,
          dischargeDisposition: encounter.discharge_disposition_code || '',
          visitNumber: encounter.id,
        });

      // Add DG1 segments for diagnoses
      for (let i = 0; i < diagnoses.length; i++) {
        const dx = diagnoses[i];
        builder.addDG1({
          setId: (i + 1).toString(),
          codingMethod: 'I10',
          diagnosisCode: dx.code_code,
          diagnosisText: dx.code_display || '',
          codingSystem: 'ICD-10',
          diagnosisDateTime: dx.onset_datetime
            ? this.formatHL7Timestamp(new Date(dx.onset_datetime))
            : hl7Timestamp,
          diagnosisType: i === 0 ? 'A' : 'W', // First = Admitting, rest = Working
        });
      }

      // Add OBX segment for chief complaint
      if (encounter.chief_complaint || encounter.reason_display) {
        builder.addOBX({
          setId: '1',
          valueType: 'TX',
          observationCode: 'SS003',
          observationText: 'Chief Complaint',
          codingSystem: 'PHINQUESTION',
          value: encounter.chief_complaint || encounter.reason_display || '',
          resultStatus: 'F',
          observationDateTime: hl7Timestamp,
        });
      }

      const hl7Message = builder.build();

      // Store the report
      const reportId = uuidv4();
      const generatedAt = now.toISOString();

      await this.db('public_health_reports').insert({
        id: reportId,
        type: 'SYNDROMIC_SURVEILLANCE',
        format: 'HL7v2.5.1',
        content: hl7Message,
        generated_at: generatedAt,
        status: 'generated',
        patient_id: encounter.patient_id,
        encounter_id: encounterId,
        source_id: encounterId,
        created_at: generatedAt,
        updated_at: generatedAt,
      });

      this.logger.info('Syndromic surveillance report generated', {
        reportId,
        encounterId,
        eventType: `ADT^${eventType}`,
      });

      return {
        id: reportId,
        type: 'SYNDROMIC_SURVEILLANCE',
        format: 'HL7v2.5.1',
        content: hl7Message,
        generatedAt,
        status: 'generated',
      };
    } catch (error) {
      this.handleError('Failed to generate syndromic surveillance report', error);
    }
  }

  // ---------------------------------------------------------------------------
  // 170.315(f)(3) - Immunization Registry Reporting
  // Generates VXU^V04 messages for immunization registries
  // ---------------------------------------------------------------------------

  async generateImmunizationReport(immunizationId: string): Promise<ReportResult> {
    try {
      // Fetch immunization record
      const immunization = await this.db('immunizations')
        .where({ id: immunizationId })
        .first<ImmunizationRow>();

      if (!immunization) {
        throw new NotFoundError('Immunization', immunizationId);
      }

      // Fetch patient demographics
      const patient = await this.db('patients')
        .where({ id: immunization.patient_id })
        .first<PatientRow>();

      if (!patient) {
        throw new NotFoundError('Patient', immunization.patient_id);
      }

      // Build patient data for VXU message
      const patientData: PatientData = {
        patientId: patient.mrn || patient.id,
        assigningAuthority: 'TRIBAL-EHR',
        identifierTypeCode: 'MR',
        lastName: patient.last_name,
        firstName: patient.first_name,
        middleName: patient.middle_name,
        dateOfBirth: patient.date_of_birth
          ? this.formatHL7Date(patient.date_of_birth)
          : undefined,
        gender: this.mapGenderToHL7(patient.gender),
        race: patient.race,
        addressStreet: patient.address_street,
        addressCity: patient.address_city,
        addressState: patient.address_state,
        addressZip: patient.address_zip,
        homePhone: patient.phone_home,
        ethnicGroup: patient.ethnicity,
      };

      // Parse performer information
      let adminProviderId = '';
      let adminProviderLastName = '';
      let adminProviderFirstName = '';
      if (immunization.performer) {
        try {
          const performers = JSON.parse(immunization.performer);
          const actorRef = performers[0]?.actor?.reference?.replace('Practitioner/', '');
          if (actorRef) {
            const performer = await this.db('practitioners')
              .where({ id: actorRef })
              .first<{ id: string; last_name: string; first_name: string; npi?: string }>();
            if (performer) {
              adminProviderId = performer.npi || performer.id;
              adminProviderLastName = performer.last_name;
              adminProviderFirstName = performer.first_name;
            }
          }
        } catch {
          // Performer not parseable
        }
      }

      // Build VXU^V04 message
      const mshConfig: MSHConfig = {
        sendingApplication: 'TRIBAL-EHR',
        sendingFacility: 'TRIBAL-HEALTH',
        receivingApplication: 'IIS',
        receivingFacility: 'STATE-IIS',
        processingId: 'P',
        versionId: '2.5.1',
      };

      const hl7Message = buildVXU_V04(
        patientData,
        {
          adminStartDateTime: this.formatHL7Timestamp(
            new Date(immunization.occurrence_date_time)
          ),
          administeredCode: immunization.vaccine_code,
          administeredCodeText: immunization.vaccine_display || '',
          codingSystem: immunization.vaccine_system === 'http://hl7.org/fhir/sid/cvx'
            ? 'CVX'
            : 'CVX',
          administeredAmount: immunization.dose_quantity_value?.toString() || '999',
          administeredUnits: immunization.dose_quantity_unit || 'mL',
          lotNumber: immunization.lot_number || '',
          expirationDate: immunization.expiration_date
            ? this.formatHL7Date(immunization.expiration_date)
            : '',
          completionStatus: immunization.status === 'completed' ? 'CP' : 'RE',
          actionCode: 'A',
          adminProviderId,
          adminProviderLastName,
          adminProviderFirstName,
          adminLocation: '',
        },
        mshConfig
      );

      // Store the report
      const reportId = uuidv4();
      const generatedAt = new Date().toISOString();

      await this.db('public_health_reports').insert({
        id: reportId,
        type: 'IMMUNIZATION_REGISTRY',
        format: 'HL7v2.5.1',
        content: hl7Message,
        generated_at: generatedAt,
        status: 'generated',
        patient_id: immunization.patient_id,
        encounter_id: immunization.encounter_id,
        source_id: immunizationId,
        created_at: generatedAt,
        updated_at: generatedAt,
      });

      this.logger.info('Immunization registry report generated', {
        reportId,
        immunizationId,
        vaccineCode: immunization.vaccine_code,
      });

      return {
        id: reportId,
        type: 'IMMUNIZATION_REGISTRY',
        format: 'HL7v2.5.1',
        content: hl7Message,
        generatedAt,
        status: 'generated',
      };
    } catch (error) {
      this.handleError('Failed to generate immunization registry report', error);
    }
  }

  // ---------------------------------------------------------------------------
  // 170.315(f)(5) - Electronic Case Reporting (eCR)
  // Generates eICR (electronic Initial Case Report) as FHIR Bundle
  // ---------------------------------------------------------------------------

  async generateEICR(encounterId: string, conditionCode: string): Promise<ReportResult> {
    try {
      // Validate that the condition is a trigger code
      const conditionName = ECR_TRIGGER_CODES[conditionCode];
      if (!conditionName) {
        throw new ValidationError(
          `Condition code '${conditionCode}' is not a recognized eCR trigger code`
        );
      }

      // Fetch encounter
      const encounter = await this.db('encounters')
        .where({ id: encounterId })
        .first<EncounterRow>();

      if (!encounter) {
        throw new NotFoundError('Encounter', encounterId);
      }

      // Fetch patient
      const patient = await this.db('patients')
        .where({ id: encounter.patient_id })
        .first<PatientRow>();

      if (!patient) {
        throw new NotFoundError('Patient', encounter.patient_id);
      }

      // Fetch conditions for the encounter
      const conditions = await this.db('conditions')
        .where({ patient_id: encounter.patient_id })
        .select<DiagnosisRow[]>('*');

      // Fetch recent observations for the patient
      const observations = await this.db('observations')
        .where({ patient_id: encounter.patient_id })
        .orderBy('effective_date_time', 'desc')
        .limit(20)
        .select<LabResultRow[]>('*');

      // Fetch active medications
      const medications = await this.db('medication_requests')
        .where({ patient_id: encounter.patient_id })
        .whereIn('status', ['active', 'completed'])
        .select('*');

      const now = new Date().toISOString();
      const compositionId = uuidv4();

      // Build eICR as FHIR Composition resource within a Bundle
      const fhirBundle: Record<string, unknown> = {
        resourceType: 'Bundle',
        id: uuidv4(),
        type: 'document',
        timestamp: now,
        meta: {
          profile: [
            'http://hl7.org/fhir/us/ecr/StructureDefinition/eicr-document-bundle',
          ],
        },
        entry: [
          // Composition resource (the eICR)
          {
            fullUrl: `urn:uuid:${compositionId}`,
            resource: {
              resourceType: 'Composition',
              id: compositionId,
              meta: {
                profile: [
                  'http://hl7.org/fhir/us/ecr/StructureDefinition/eicr-composition',
                ],
              },
              status: 'final',
              type: {
                coding: [
                  {
                    system: 'http://loinc.org',
                    code: '55751-2',
                    display: 'Public Health Case Report',
                  },
                ],
              },
              subject: {
                reference: `Patient/${patient.id}`,
                display: `${patient.last_name}, ${patient.first_name}`,
              },
              encounter: {
                reference: `Encounter/${encounter.id}`,
              },
              date: now,
              title: `Initial Public Health Case Report - ${conditionName}`,
              author: [
                {
                  reference: encounter.provider_id
                    ? `Practitioner/${encounter.provider_id}`
                    : 'Practitioner/unknown',
                  display: encounter.facility_name || 'Tribal Health Facility',
                },
              ],
              custodian: {
                display: encounter.facility_name || 'Tribal Health Facility',
              },
              section: this.buildEICRSections(
                patient,
                encounter,
                conditions,
                observations,
                medications,
                conditionCode,
                conditionName
              ),
            },
          },
          // Patient resource
          {
            fullUrl: `Patient/${patient.id}`,
            resource: {
              resourceType: 'Patient',
              id: patient.id,
              identifier: [
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
                  value: patient.mrn || patient.id,
                },
              ],
              name: [
                {
                  use: 'official',
                  family: patient.last_name,
                  given: [patient.first_name, patient.middle_name].filter(Boolean),
                },
              ],
              gender: patient.gender || 'unknown',
              birthDate: patient.date_of_birth || undefined,
              address: patient.address_street
                ? [
                    {
                      line: [patient.address_street],
                      city: patient.address_city,
                      state: patient.address_state,
                      postalCode: patient.address_zip,
                    },
                  ]
                : undefined,
            },
          },
          // Encounter resource
          {
            fullUrl: `Encounter/${encounter.id}`,
            resource: {
              resourceType: 'Encounter',
              id: encounter.id,
              status: encounter.status,
              class: {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                code: encounter.class_code || 'AMB',
                display: encounter.class_code === 'EMER' ? 'Emergency' : 'Ambulatory',
              },
              type: encounter.type_code
                ? [
                    {
                      coding: [
                        {
                          system: 'http://snomed.info/sct',
                          code: encounter.type_code,
                          display: encounter.type_display,
                        },
                      ],
                    },
                  ]
                : undefined,
              subject: {
                reference: `Patient/${patient.id}`,
              },
              period: {
                start: encounter.period_start,
                end: encounter.period_end,
              },
            },
          },
          // Condition entries for triggered condition
          ...conditions
            .filter((c) => c.code_code === conditionCode || conditions.length <= 5)
            .map((c) => ({
              fullUrl: `Condition/${c.id}`,
              resource: {
                resourceType: 'Condition',
                id: c.id,
                clinicalStatus: {
                  coding: [
                    {
                      system:
                        'http://terminology.hl7.org/CodeSystem/condition-clinical',
                      code: c.clinical_status || 'active',
                    },
                  ],
                },
                code: {
                  coding: [
                    {
                      system: c.code_system,
                      code: c.code_code,
                      display: c.code_display,
                    },
                  ],
                },
                subject: {
                  reference: `Patient/${patient.id}`,
                },
                onsetDateTime: c.onset_datetime,
              },
            })),
          // Recent lab observations
          ...observations.slice(0, 10).map((obs) => ({
            fullUrl: `Observation/${obs.id}`,
            resource: {
              resourceType: 'Observation',
              id: obs.id,
              status: obs.status,
              code: {
                coding: [
                  {
                    system: obs.code_system,
                    code: obs.code_code,
                    display: obs.code_display,
                  },
                ],
              },
              subject: {
                reference: `Patient/${patient.id}`,
              },
              effectiveDateTime: obs.effective_date_time,
              valueQuantity:
                obs.value_quantity_value !== undefined
                  ? {
                      value: obs.value_quantity_value,
                      unit: obs.value_quantity_unit,
                    }
                  : undefined,
              valueString: obs.value_string || undefined,
            },
          })),
        ],
      };

      // Store the report
      const reportId = uuidv4();
      const generatedAt = now;

      await this.db('public_health_reports').insert({
        id: reportId,
        type: 'EICR',
        format: 'FHIR-R4',
        content: JSON.stringify(fhirBundle),
        generated_at: generatedAt,
        status: 'generated',
        patient_id: encounter.patient_id,
        encounter_id: encounterId,
        source_id: encounterId,
        created_at: generatedAt,
        updated_at: generatedAt,
      });

      this.logger.info('eICR report generated', {
        reportId,
        encounterId,
        conditionCode,
        conditionName,
      });

      return {
        id: reportId,
        type: 'EICR',
        format: 'FHIR-R4',
        content: JSON.stringify(fhirBundle),
        generatedAt,
        status: 'generated',
      };
    } catch (error) {
      this.handleError('Failed to generate eICR report', error);
    }
  }

  // ---------------------------------------------------------------------------
  // 170.315(f)(6) - Cancer Case Reporting
  // ---------------------------------------------------------------------------

  async generateCancerCaseReport(
    patientId: string,
    diagnosisId: string
  ): Promise<ReportResult> {
    try {
      // Fetch the cancer diagnosis
      const diagnosis = await this.db('conditions')
        .where({ id: diagnosisId, patient_id: patientId })
        .first<DiagnosisRow>();

      if (!diagnosis) {
        throw new NotFoundError('Cancer Diagnosis', diagnosisId);
      }

      // Fetch patient
      const patient = await this.db('patients')
        .where({ id: patientId })
        .first<PatientRow>();

      if (!patient) {
        throw new NotFoundError('Patient', patientId);
      }

      // Fetch all related procedures (surgeries, biopsies, etc.)
      const procedures = await this.db('procedures')
        .where({ patient_id: patientId })
        .select('*');

      // Fetch all related observations (staging, pathology)
      const observations = await this.db('observations')
        .where({ patient_id: patientId })
        .select('*');

      // Fetch active medications (chemotherapy, etc.)
      const medications = await this.db('medication_requests')
        .where({ patient_id: patientId })
        .whereIn('status', ['active', 'completed'])
        .select('*');

      const now = new Date().toISOString();

      // Build cancer case report as FHIR Bundle
      const fhirBundle: Record<string, unknown> = {
        resourceType: 'Bundle',
        id: uuidv4(),
        type: 'document',
        timestamp: now,
        meta: {
          profile: [
            'http://hl7.org/fhir/us/central-cancer-registry-reporting/StructureDefinition/cancer-report-bundle',
          ],
        },
        entry: [
          {
            fullUrl: `Composition/${uuidv4()}`,
            resource: {
              resourceType: 'Composition',
              status: 'final',
              type: {
                coding: [
                  {
                    system: 'http://loinc.org',
                    code: '72134-0',
                    display: 'Cancer event report',
                  },
                ],
              },
              subject: {
                reference: `Patient/${patient.id}`,
                display: `${patient.last_name}, ${patient.first_name}`,
              },
              date: now,
              title: 'Cancer Case Report',
              section: [
                {
                  title: 'Primary Cancer Condition',
                  code: {
                    coding: [
                      {
                        system: 'http://loinc.org',
                        code: '11348-0',
                        display: 'History of Past illness Narrative',
                      },
                    ],
                  },
                  entry: [{ reference: `Condition/${diagnosis.id}` }],
                },
                {
                  title: 'Treatment History',
                  code: {
                    coding: [
                      {
                        system: 'http://loinc.org',
                        code: '18776-5',
                        display: 'Plan of care note',
                      },
                    ],
                  },
                  entry: [
                    ...procedures.map((p: { id: string }) => ({
                      reference: `Procedure/${p.id}`,
                    })),
                    ...medications.map((m: { id: string }) => ({
                      reference: `MedicationRequest/${m.id}`,
                    })),
                  ],
                },
                {
                  title: 'Pathology and Staging',
                  code: {
                    coding: [
                      {
                        system: 'http://loinc.org',
                        code: '22034-3',
                        display: 'Pathology report',
                      },
                    ],
                  },
                  entry: observations.map((o: { id: string }) => ({
                    reference: `Observation/${o.id}`,
                  })),
                },
              ],
            },
          },
          {
            fullUrl: `Patient/${patient.id}`,
            resource: {
              resourceType: 'Patient',
              id: patient.id,
              name: [
                {
                  family: patient.last_name,
                  given: [patient.first_name],
                },
              ],
              gender: patient.gender || 'unknown',
              birthDate: patient.date_of_birth,
            },
          },
          {
            fullUrl: `Condition/${diagnosis.id}`,
            resource: {
              resourceType: 'Condition',
              id: diagnosis.id,
              code: {
                coding: [
                  {
                    system: diagnosis.code_system,
                    code: diagnosis.code_code,
                    display: diagnosis.code_display,
                  },
                ],
              },
              subject: { reference: `Patient/${patient.id}` },
              onsetDateTime: diagnosis.onset_datetime,
            },
          },
        ],
      };

      // Store the report
      const reportId = uuidv4();

      await this.db('public_health_reports').insert({
        id: reportId,
        type: 'CANCER_CASE',
        format: 'FHIR-R4',
        content: JSON.stringify(fhirBundle),
        generated_at: now,
        status: 'generated',
        patient_id: patientId,
        source_id: diagnosisId,
        created_at: now,
        updated_at: now,
      });

      this.logger.info('Cancer case report generated', {
        reportId,
        patientId,
        diagnosisId,
      });

      return {
        id: reportId,
        type: 'CANCER_CASE',
        format: 'FHIR-R4',
        content: JSON.stringify(fhirBundle),
        generatedAt: now,
        status: 'generated',
      };
    } catch (error) {
      this.handleError('Failed to generate cancer case report', error);
    }
  }

  // ---------------------------------------------------------------------------
  // 170.315(f)(7) - Antimicrobial Use and Resistance (AUR) Reporting
  // ---------------------------------------------------------------------------

  async generateAURReport(
    facilityId: string,
    dateRange: { start: string; end: string }
  ): Promise<ReportResult> {
    try {
      if (!dateRange.start || !dateRange.end) {
        throw new ValidationError('Date range with start and end is required for AUR reports');
      }

      // Query antimicrobial prescriptions within the date range
      const antimicrobialPrescriptions = await this.db('medication_requests')
        .join('patients', 'medication_requests.patient_id', 'patients.id')
        .where('medication_requests.authored_on', '>=', dateRange.start)
        .where('medication_requests.authored_on', '<=', dateRange.end)
        .whereIn('medication_requests.status', ['active', 'completed'])
        .select(
          'medication_requests.id',
          'medication_requests.patient_id',
          'medication_requests.medication_code',
          'medication_requests.medication_display',
          'medication_requests.authored_on',
          'medication_requests.dosage_instruction',
          'medication_requests.dispense_request',
          'patients.date_of_birth as patient_dob',
          'patients.gender as patient_gender'
        );

      // Antimicrobial drug classes for filtering
      const antimicrobialClasses = [
        'penicillin', 'amoxicillin', 'ampicillin',
        'cephalosporin', 'ceftriaxone', 'cefazolin', 'cephalexin',
        'fluoroquinolone', 'ciprofloxacin', 'levofloxacin', 'moxifloxacin',
        'macrolide', 'azithromycin', 'erythromycin', 'clarithromycin',
        'tetracycline', 'doxycycline', 'minocycline',
        'sulfonamide', 'trimethoprim', 'sulfamethoxazole',
        'vancomycin', 'linezolid', 'daptomycin',
        'metronidazole', 'clindamycin', 'nitrofurantoin',
      ];

      // Filter to antimicrobial medications only
      const filteredPrescriptions = antimicrobialPrescriptions.filter(
        (rx: { medication_display?: string }) => {
          const displayLower = (rx.medication_display || '').toLowerCase();
          return antimicrobialClasses.some((abx) => displayLower.includes(abx));
        }
      );

      // Aggregate data by medication
      const aggregated: Record<
        string,
        {
          medicationCode: string;
          medicationName: string;
          totalPrescriptions: number;
          patientCount: number;
          patients: Set<string>;
          ageGroups: Record<string, number>;
          genderDistribution: Record<string, number>;
        }
      > = {};

      for (const rx of filteredPrescriptions) {
        const key = rx.medication_code || rx.medication_display;
        if (!aggregated[key]) {
          aggregated[key] = {
            medicationCode: rx.medication_code,
            medicationName: rx.medication_display || 'Unknown',
            totalPrescriptions: 0,
            patientCount: 0,
            patients: new Set<string>(),
            ageGroups: { '0-17': 0, '18-44': 0, '45-64': 0, '65+': 0 },
            genderDistribution: { male: 0, female: 0, other: 0 },
          };
        }

        const entry = aggregated[key];
        entry.totalPrescriptions++;
        entry.patients.add(rx.patient_id);

        // Age group
        if (rx.patient_dob) {
          const age = this.calculateAge(rx.patient_dob);
          if (age < 18) entry.ageGroups['0-17']++;
          else if (age < 45) entry.ageGroups['18-44']++;
          else if (age < 65) entry.ageGroups['45-64']++;
          else entry.ageGroups['65+']++;
        }

        // Gender distribution
        const gender = (rx.patient_gender || 'other').toLowerCase();
        if (gender === 'male') entry.genderDistribution.male++;
        else if (gender === 'female') entry.genderDistribution.female++;
        else entry.genderDistribution.other++;
      }

      // Convert sets to counts
      const reportData = Object.values(aggregated).map((entry) => ({
        ...entry,
        patientCount: entry.patients.size,
        patients: undefined,
      }));

      // Build the AUR report as a FHIR MeasureReport
      const measureReport: Record<string, unknown> = {
        resourceType: 'MeasureReport',
        id: uuidv4(),
        meta: {
          profile: [
            'http://hl7.org/fhir/us/hai/StructureDefinition/hai-single-person-report-questionnaire-response',
          ],
        },
        status: 'complete',
        type: 'summary',
        measure: 'http://hl7.org/fhir/us/hai/Measure/antimicrobial-use',
        date: new Date().toISOString(),
        period: {
          start: dateRange.start,
          end: dateRange.end,
        },
        group: reportData.map((item) => ({
          code: {
            coding: [
              {
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                code: item.medicationCode,
                display: item.medicationName,
              },
            ],
          },
          population: [
            {
              code: {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/measure-population',
                    code: 'measure-population',
                  },
                ],
              },
              count: item.totalPrescriptions,
            },
          ],
          stratifier: [
            {
              code: [
                {
                  coding: [
                    {
                      system: 'http://loinc.org',
                      code: '30525-0',
                      display: 'Age',
                    },
                  ],
                },
              ],
              stratum: Object.entries(item.ageGroups).map(([group, count]) => ({
                value: { text: group },
                population: [{ count }],
              })),
            },
            {
              code: [
                {
                  coding: [
                    {
                      system: 'http://loinc.org',
                      code: '76689-9',
                      display: 'Sex assigned at birth',
                    },
                  ],
                },
              ],
              stratum: Object.entries(item.genderDistribution).map(
                ([gender, count]) => ({
                  value: { text: gender },
                  population: [{ count }],
                })
              ),
            },
          ],
        })),
      };

      const now = new Date().toISOString();
      const reportId = uuidv4();

      await this.db('public_health_reports').insert({
        id: reportId,
        type: 'AUR',
        format: 'FHIR-R4',
        content: JSON.stringify(measureReport),
        generated_at: now,
        status: 'generated',
        source_id: facilityId,
        created_at: now,
        updated_at: now,
      });

      this.logger.info('AUR report generated', {
        reportId,
        facilityId,
        dateRange,
        antimicrobialCount: reportData.length,
        totalPrescriptions: filteredPrescriptions.length,
      });

      return {
        id: reportId,
        type: 'AUR',
        format: 'FHIR-R4',
        content: JSON.stringify(measureReport),
        generatedAt: now,
        status: 'generated',
      };
    } catch (error) {
      this.handleError('Failed to generate AUR report', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get pending reports
  // ---------------------------------------------------------------------------

  async getPendingReports(): Promise<ReportResult[]> {
    try {
      const rows = await this.db('public_health_reports')
        .where({ status: 'generated' })
        .orderBy('generated_at', 'asc')
        .select<ReportRow[]>('*');

      return rows.map((row) => this.rowToReport(row));
    } catch (error) {
      this.handleError('Failed to get pending reports', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Mark report as sent
  // ---------------------------------------------------------------------------

  async markReportSent(reportId: string, destination: string): Promise<void> {
    try {
      const existing = await this.db('public_health_reports')
        .where({ id: reportId })
        .first<ReportRow>();

      if (!existing) {
        throw new NotFoundError('Public Health Report', reportId);
      }

      const now = new Date().toISOString();

      await this.db('public_health_reports')
        .where({ id: reportId })
        .update({
          status: 'sent',
          destination,
          updated_at: now,
        });

      this.logger.info('Report marked as sent', { reportId, destination });
    } catch (error) {
      this.handleError('Failed to mark report as sent', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get reporting history
  // ---------------------------------------------------------------------------

  async getReportHistory(
    type?: string,
    dateRange?: { start: string; end: string }
  ): Promise<ReportResult[]> {
    try {
      const query = this.db('public_health_reports')
        .orderBy('generated_at', 'desc')
        .select<ReportRow[]>('*');

      if (type) {
        query.where({ type });
      }

      if (dateRange?.start) {
        query.where('generated_at', '>=', dateRange.start);
      }

      if (dateRange?.end) {
        query.where('generated_at', '<=', dateRange.end);
      }

      const rows = await query;
      return rows.map((row) => this.rowToReport(row));
    } catch (error) {
      this.handleError('Failed to get report history', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private rowToReport(row: ReportRow): ReportResult {
    return {
      id: row.id,
      type: row.type,
      format: row.format,
      content: row.content,
      generatedAt: row.generated_at,
      status: row.status as ReportResult['status'],
      destination: row.destination,
      error: row.error,
    };
  }

  private buildEICRSections(
    patient: PatientRow,
    encounter: EncounterRow,
    conditions: DiagnosisRow[],
    observations: LabResultRow[],
    medications: Array<Record<string, unknown>>,
    conditionCode: string,
    conditionName: string
  ): Array<Record<string, unknown>> {
    const sections: Array<Record<string, unknown>> = [];

    // Reason for Report section
    sections.push({
      title: 'Reason for Report',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '29299-5',
            display: 'Reason for visit Narrative',
          },
        ],
      },
      text: {
        status: 'generated',
        div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>Reportable Condition: ${conditionName} (SNOMED-CT: ${conditionCode})</p></div>`,
      },
    });

    // Chief Complaint section
    if (encounter.chief_complaint || encounter.reason_display) {
      sections.push({
        title: 'Chief Complaint',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '10154-3',
              display: 'Chief complaint Narrative - Reported',
            },
          ],
        },
        text: {
          status: 'generated',
          div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${encounter.chief_complaint || encounter.reason_display}</p></div>`,
        },
      });
    }

    // Problems section
    if (conditions.length > 0) {
      sections.push({
        title: 'Problem List',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '11450-4',
              display: 'Problem list - Reported',
            },
          ],
        },
        entry: conditions.map((c) => ({
          reference: `Condition/${c.id}`,
        })),
      });
    }

    // Results section
    const labObs = observations.filter(
      (o) => o.code_system === 'http://loinc.org'
    );
    if (labObs.length > 0) {
      sections.push({
        title: 'Results',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '30954-2',
              display: 'Relevant diagnostic tests/laboratory data Narrative',
            },
          ],
        },
        entry: labObs.slice(0, 10).map((o) => ({
          reference: `Observation/${o.id}`,
        })),
      });
    }

    // Medications section
    if (medications.length > 0) {
      sections.push({
        title: 'Medications Administered',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '29549-3',
              display: 'Medication administered Narrative',
            },
          ],
        },
        entry: medications.map((m) => ({
          reference: `MedicationRequest/${m.id}`,
        })),
      });
    }

    // Social History section (placeholder for SDOH data)
    sections.push({
      title: 'Social History',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '29762-2',
            display: 'Social history Narrative',
          },
        ],
      },
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>See patient record for social history details.</p></div>',
      },
    });

    return sections;
  }

  private formatHL7Timestamp(date: Date): string {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  private formatHL7Date(dateStr: string): string {
    // Input: ISO date string like "1990-05-15" or "1990-05-15T00:00:00.000Z"
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private mapGenderToHL7(gender?: string): string {
    if (!gender) return 'U';
    switch (gender.toLowerCase()) {
      case 'male':
        return 'M';
      case 'female':
        return 'F';
      case 'other':
        return 'O';
      default:
        return 'U';
    }
  }

  private mapEncounterClassToHL7(classCode?: string): string {
    switch (classCode) {
      case 'IMP':
        return 'I'; // Inpatient
      case 'EMER':
        return 'E'; // Emergency
      case 'AMB':
        return 'O'; // Outpatient
      case 'PRENC':
        return 'P'; // Preadmit
      default:
        return 'O';
    }
  }

  private calculateAge(dateOfBirth: string): number {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }
}

export const publicHealthService = new PublicHealthService();
