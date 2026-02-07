// =============================================================================
// Allergy / Intolerance Service
// FHIR R4 AllergyIntolerance | US Core 6.1 AllergyIntolerance profile
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import {
  AllergyIntolerance,
  AllergyClinicalStatus,
  AllergyVerificationStatus,
  AllergyType,
  AllergyCategory,
  AllergyCriticality,
  AllergyReaction,
  CodeableConcept,
  Reference,
  CODE_SYSTEMS,
} from '@tribal-ehr/shared';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

const US_CORE_ALLERGY_INTOLERANCE =
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance';

// -----------------------------------------------------------------------------
// Database Row Interface
// -----------------------------------------------------------------------------

interface AllergyRow {
  id: string;
  patient_id: string;
  clinical_status: string;
  verification_status: string;
  type?: string;
  category?: string; // JSON array
  criticality?: string;
  code_code: string;
  code_system: string;
  code_display?: string;
  onset_datetime?: string;
  recorded_date?: string;
  recorder_reference?: string;
  recorder_display?: string;
  reactions?: string; // JSON array
  fhir_id?: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Search Parameters
// -----------------------------------------------------------------------------

export interface AllergySearchParams extends PaginationParams {
  patientId: string;
  clinicalStatus?: string;
  category?: string;
  criticality?: string;
  code?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class AllergyService extends BaseService {
  constructor() {
    super('AllergyService');
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(data: Omit<AllergyIntolerance, 'id'>): Promise<AllergyIntolerance> {
    try {
      // Check for duplicate: same patient + same allergen code
      const codeValue = data.code.coding?.[0]?.code;
      if (codeValue) {
        const existing = await this.db('allergy_intolerances')
          .where('patient_id', data.patientId)
          .where('code_code', codeValue)
          .whereNot('verification_status', 'entered-in-error')
          .first();

        if (existing) {
          throw new ConflictError(
            `An allergy record for this allergen already exists for this patient`,
            { existingId: existing.id }
          );
        }
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      const row: AllergyRow = {
        id,
        patient_id: data.patientId,
        clinical_status: data.clinicalStatus,
        verification_status: data.verificationStatus,
        type: data.type,
        category: data.category ? JSON.stringify(data.category) : undefined,
        criticality: data.criticality,
        code_code: data.code.coding?.[0]?.code || '',
        code_system: data.code.coding?.[0]?.system || '',
        code_display: data.code.coding?.[0]?.display || data.code.text,
        onset_datetime: data.onsetDateTime,
        recorded_date: data.recordedDate || now,
        recorder_reference: data.recorder?.reference,
        recorder_display: data.recorder?.display,
        reactions: data.reactions ? JSON.stringify(data.reactions) : undefined,
        created_at: now,
        updated_at: now,
      };

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('allergy_intolerances').insert(row);

        const fhirResource = this.toFHIR({ ...data, id });
        const fhirResult = await this.fhirClient.create<Record<string, unknown>>(
          'AllergyIntolerance',
          fhirResource
        );
        if (fhirResult.id) {
          await trx('allergy_intolerances').where({ id }).update({ fhir_id: fhirResult.id as string });
        }
      });

      this.logger.info('AllergyIntolerance created', { allergyId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to create allergy', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get by ID
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<AllergyIntolerance> {
    try {
      const row = await this.db('allergy_intolerances').where({ id }).first<AllergyRow>();
      if (!row) {
        throw new NotFoundError('AllergyIntolerance', id);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get allergy', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(params: AllergySearchParams): Promise<PaginatedResult<AllergyIntolerance>> {
    try {
      if (!params.patientId) {
        throw new ValidationError('patientId is required for allergy search');
      }

      const query = this.db('allergy_intolerances')
        .where('patient_id', params.patientId)
        .select('*')
        .orderBy('recorded_date', 'desc');

      if (params.clinicalStatus) {
        query.where('clinical_status', params.clinicalStatus);
      }

      if (params.category) {
        query.whereRaw("category::jsonb @> ?::jsonb", [JSON.stringify([params.category])]);
      }

      if (params.criticality) {
        query.where('criticality', params.criticality);
      }

      if (params.code) {
        query.where('code_code', params.code);
      }

      const allowedSortColumns: Record<string, string> = {
        recordedDate: 'recorded_date',
        clinicalStatus: 'clinical_status',
        criticality: 'criticality',
        code: 'code_display',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      const result = await this.paginate<AllergyRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to search allergies', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(id: string, data: Partial<AllergyIntolerance>): Promise<AllergyIntolerance> {
    try {
      const existing = await this.db('allergy_intolerances').where({ id }).first<AllergyRow>();
      if (!existing) {
        throw new NotFoundError('AllergyIntolerance', id);
      }

      const now = new Date().toISOString();
      const updates: Partial<AllergyRow> = { updated_at: now };

      if (data.clinicalStatus !== undefined) updates.clinical_status = data.clinicalStatus;
      if (data.verificationStatus !== undefined) updates.verification_status = data.verificationStatus;
      if (data.type !== undefined) updates.type = data.type;
      if (data.category !== undefined) updates.category = JSON.stringify(data.category);
      if (data.criticality !== undefined) updates.criticality = data.criticality;
      if (data.code !== undefined) {
        updates.code_code = data.code.coding?.[0]?.code || '';
        updates.code_system = data.code.coding?.[0]?.system || '';
        updates.code_display = data.code.coding?.[0]?.display || data.code.text;
      }
      if (data.onsetDateTime !== undefined) updates.onset_datetime = data.onsetDateTime;
      if (data.recorder !== undefined) {
        updates.recorder_reference = data.recorder?.reference;
        updates.recorder_display = data.recorder?.display;
      }
      if (data.reactions !== undefined) updates.reactions = JSON.stringify(data.reactions);

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('allergy_intolerances').where({ id }).update(updates);

        const updated = await trx('allergy_intolerances').where({ id }).first<AllergyRow>();
        if (updated) {
          const allergy = this.fromRow(updated);
          const fhirResource = this.toFHIR(allergy);
          const fhirId = updated.fhir_id || id;
          await this.fhirClient.update('AllergyIntolerance', fhirId, fhirResource);
        }
      });

      this.logger.info('AllergyIntolerance updated', { allergyId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to update allergy', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    try {
      const existing = await this.db('allergy_intolerances').where({ id }).first<AllergyRow>();
      if (!existing) {
        throw new NotFoundError('AllergyIntolerance', id);
      }

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('allergy_intolerances').where({ id }).delete();

        if (existing.fhir_id) {
          try {
            await this.fhirClient.delete('AllergyIntolerance', existing.fhir_id);
          } catch (fhirError) {
            this.logger.warn('Failed to delete allergy from FHIR server', {
              allergyId: id,
              fhirId: existing.fhir_id,
            });
          }
        }
      });

      this.logger.info('AllergyIntolerance deleted', { allergyId: id });
    } catch (error) {
      this.handleError('Failed to delete allergy', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Reconcile (§170.315(b)(2) Clinical Information Reconciliation)
  // ---------------------------------------------------------------------------

  async reconcile(
    patientId: string,
    allergies: Array<{
      id?: string;
      action: 'continue' | 'modify' | 'remove';
      clinicalStatus?: AllergyClinicalStatus;
      verificationStatus?: AllergyVerificationStatus;
      code?: CodeableConcept;
      criticality?: AllergyCriticality;
      reactions?: AllergyReaction[];
    }>
  ): Promise<AllergyIntolerance[]> {
    try {
      const results: AllergyIntolerance[] = [];

      await this.withTransaction(async (trx: Knex.Transaction) => {
        const currentActive = await trx('allergy_intolerances')
          .where('patient_id', patientId)
          .where('clinical_status', 'active')
          .whereNot('verification_status', 'entered-in-error')
          .select<AllergyRow[]>('*');

        const reconciledIds = new Set(allergies.filter((a) => a.id).map((a) => a.id));

        // Mark unreconciled active allergies as inactive
        for (const current of currentActive) {
          if (!reconciledIds.has(current.id)) {
            await trx('allergy_intolerances').where({ id: current.id }).update({
              clinical_status: 'inactive',
              updated_at: new Date().toISOString(),
            });

            if (current.fhir_id) {
              const updated = this.fromRow({ ...current, clinical_status: 'inactive' });
              const fhirResource = this.toFHIR(updated);
              await this.fhirClient.update('AllergyIntolerance', current.fhir_id, fhirResource);
            }
          }
        }

        // Process reconciled items
        for (const allergy of allergies) {
          if (allergy.id && allergy.action === 'remove') {
            await trx('allergy_intolerances').where({ id: allergy.id }).update({
              clinical_status: 'resolved',
              updated_at: new Date().toISOString(),
            });
          } else if (allergy.id && allergy.action === 'modify') {
            const updates: Partial<AllergyRow> = { updated_at: new Date().toISOString() };
            if (allergy.clinicalStatus) updates.clinical_status = allergy.clinicalStatus;
            if (allergy.verificationStatus) updates.verification_status = allergy.verificationStatus;
            if (allergy.criticality) updates.criticality = allergy.criticality;
            if (allergy.reactions) updates.reactions = JSON.stringify(allergy.reactions);
            await trx('allergy_intolerances').where({ id: allergy.id }).update(updates);

            const row = await trx('allergy_intolerances').where({ id: allergy.id }).first<AllergyRow>();
            if (row) results.push(this.fromRow(row));
          } else if (allergy.id && allergy.action === 'continue') {
            const row = await trx('allergy_intolerances').where({ id: allergy.id }).first<AllergyRow>();
            if (row) results.push(this.fromRow(row));
          }
        }
      });

      this.logger.info('Allergy reconciliation completed', { patientId, count: allergies.length });
      return results;
    } catch (error) {
      this.handleError('Failed to reconcile allergies', error);
    }
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: Internal -> FHIR R4 AllergyIntolerance
  // ---------------------------------------------------------------------------

  toFHIR(allergy: AllergyIntolerance): Record<string, unknown> {
    const fhirAllergy: Record<string, unknown> = {
      resourceType: 'AllergyIntolerance',
      id: allergy.id,
      meta: {
        profile: [US_CORE_ALLERGY_INTOLERANCE],
      },
      clinicalStatus: {
        coding: [
          {
            system: CODE_SYSTEMS.ALLERGY_CLINICAL_STATUS,
            code: allergy.clinicalStatus,
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: CODE_SYSTEMS.ALLERGY_VERIFICATION_STATUS,
            code: allergy.verificationStatus,
          },
        ],
      },
      code: allergy.code,
      patient: {
        reference: `Patient/${allergy.patientId}`,
      },
    };

    if (allergy.type) {
      fhirAllergy.type = allergy.type;
    }

    if (allergy.category?.length) {
      fhirAllergy.category = allergy.category;
    }

    if (allergy.criticality) {
      fhirAllergy.criticality = allergy.criticality;
    }

    if (allergy.onsetDateTime) {
      fhirAllergy.onsetDateTime = allergy.onsetDateTime;
    }

    if (allergy.recordedDate) {
      fhirAllergy.recordedDate = allergy.recordedDate;
    }

    if (allergy.recorder) {
      fhirAllergy.recorder = allergy.recorder;
    }

    if (allergy.reactions?.length) {
      fhirAllergy.reaction = allergy.reactions.map((reaction) => {
        const fhirReaction: Record<string, unknown> = {
          manifestation: reaction.manifestation,
        };

        if (reaction.substance) {
          fhirReaction.substance = reaction.substance;
        }

        if (reaction.severity) {
          fhirReaction.severity = reaction.severity;
        }

        if (reaction.exposureRoute) {
          fhirReaction.exposureRoute = reaction.exposureRoute;
        }

        if (reaction.note) {
          fhirReaction.note = [{ text: reaction.note }];
        }

        return fhirReaction;
      });
    }

    return fhirAllergy;
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: FHIR R4 AllergyIntolerance -> Internal
  // ---------------------------------------------------------------------------

  fromFHIR(fhirAllergy: Record<string, unknown>): Omit<AllergyIntolerance, 'id'> {
    const clinicalStatusCoding = (
      (fhirAllergy.clinicalStatus as CodeableConcept)?.coding || []
    )[0];
    const verificationStatusCoding = (
      (fhirAllergy.verificationStatus as CodeableConcept)?.coding || []
    )[0];

    const reactions: AllergyReaction[] = (
      (fhirAllergy.reaction as Array<Record<string, unknown>>) || []
    ).map((r) => ({
      substance: r.substance as CodeableConcept | undefined,
      manifestation: r.manifestation as CodeableConcept[],
      severity: r.severity as AllergyReaction['severity'],
      exposureRoute: r.exposureRoute as CodeableConcept | undefined,
      note: ((r.note as Array<{ text: string }>) || [])[0]?.text,
    }));

    return {
      patientId: ((fhirAllergy.patient as Reference)?.reference || '').replace('Patient/', ''),
      clinicalStatus: (clinicalStatusCoding?.code || 'active') as AllergyClinicalStatus,
      verificationStatus: (verificationStatusCoding?.code || 'unconfirmed') as AllergyVerificationStatus,
      type: fhirAllergy.type as AllergyType | undefined,
      category: fhirAllergy.category as AllergyCategory[] | undefined,
      criticality: fhirAllergy.criticality as AllergyCriticality | undefined,
      code: fhirAllergy.code as CodeableConcept,
      onsetDateTime: fhirAllergy.onsetDateTime as string | undefined,
      recordedDate: fhirAllergy.recordedDate as string | undefined,
      recorder: fhirAllergy.recorder as Reference | undefined,
      reactions: reactions.length > 0 ? reactions : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private fromRow(row: AllergyRow): AllergyIntolerance {
    return {
      id: row.id,
      patientId: row.patient_id,
      clinicalStatus: row.clinical_status as AllergyClinicalStatus,
      verificationStatus: row.verification_status as AllergyVerificationStatus,
      type: row.type as AllergyType | undefined,
      category: row.category ? JSON.parse(row.category) : undefined,
      criticality: row.criticality as AllergyCriticality | undefined,
      code: {
        coding: [
          {
            system: row.code_system,
            code: row.code_code,
            display: row.code_display,
          },
        ],
        text: row.code_display,
      },
      onsetDateTime: row.onset_datetime,
      recordedDate: row.recorded_date,
      recorder: row.recorder_reference
        ? { reference: row.recorder_reference, display: row.recorder_display }
        : undefined,
      reactions: row.reactions ? JSON.parse(row.reactions) : undefined,
    };
  }
}

export const allergyService = new AllergyService();
