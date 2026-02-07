// =============================================================================
// Condition Service - Problems, Diagnoses, Health Concerns
// FHIR R4 Condition | US Core 6.1 Condition Encounter Diagnosis / Problems and
// Health Concerns profiles
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import {
  Condition,
  ConditionClinicalStatus,
  ConditionVerificationStatus,
  ConditionCategory,
  ConditionEvidence,
  CodeableConcept,
  Reference,
  Coding,
  CODE_SYSTEMS,
} from '@tribal-ehr/shared';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors';

// -----------------------------------------------------------------------------
// US Core Condition Profile URLs
// -----------------------------------------------------------------------------

const US_CORE_CONDITION_ENCOUNTER_DIAGNOSIS =
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-encounter-diagnosis';
const US_CORE_CONDITION_PROBLEMS_HEALTH_CONCERNS =
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns';

// -----------------------------------------------------------------------------
// Database Row Interface
// -----------------------------------------------------------------------------

interface ConditionRow {
  id: string;
  patient_id: string;
  encounter_id?: string;
  clinical_status: string;
  verification_status: string;
  category: string; // JSON array
  severity_code?: string;
  severity_system?: string;
  severity_display?: string;
  code_code: string;
  code_system: string;
  code_display?: string;
  body_site?: string; // JSON array
  onset_datetime?: string;
  abatement_datetime?: string;
  recorded_date?: string;
  recorder_reference?: string;
  recorder_display?: string;
  evidence?: string; // JSON array
  fhir_id?: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Search Parameters
// -----------------------------------------------------------------------------

export interface ConditionSearchParams extends PaginationParams {
  patientId: string;
  clinicalStatus?: string;
  verificationStatus?: string;
  category?: string;
  code?: string;
  onsetDateFrom?: string;
  onsetDateTo?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class ConditionService extends BaseService {
  constructor() {
    super('ConditionService');
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(data: Omit<Condition, 'id'> & { encounterId?: string }): Promise<Condition> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      const row: ConditionRow = {
        id,
        patient_id: data.patientId,
        encounter_id: data.encounterId,
        clinical_status: data.clinicalStatus,
        verification_status: data.verificationStatus,
        category: JSON.stringify(data.category || []),
        severity_code: data.severity?.coding?.[0]?.code,
        severity_system: data.severity?.coding?.[0]?.system,
        severity_display: data.severity?.coding?.[0]?.display,
        code_code: data.code.coding?.[0]?.code || '',
        code_system: data.code.coding?.[0]?.system || '',
        code_display: data.code.coding?.[0]?.display || data.code.text,
        body_site: data.bodySite ? JSON.stringify(data.bodySite) : undefined,
        onset_datetime: data.onsetDateTime,
        abatement_datetime: data.abatementDateTime,
        recorded_date: data.recordedDate || now,
        recorder_reference: data.recorder?.reference,
        recorder_display: data.recorder?.display,
        evidence: data.evidence ? JSON.stringify(data.evidence) : undefined,
        created_at: now,
        updated_at: now,
      };

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('conditions').insert(row);

        // Sync to FHIR server
        const fhirResource = this.toFHIR({ ...data, id });
        const fhirResult = await this.fhirClient.create<Record<string, unknown>>('Condition', fhirResource);
        if (fhirResult.id) {
          await trx('conditions').where({ id }).update({ fhir_id: fhirResult.id as string });
        }
      });

      this.logger.info('Condition created', { conditionId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to create condition', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get by ID
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<Condition> {
    try {
      const row = await this.db('conditions').where({ id }).first<ConditionRow>();
      if (!row) {
        throw new NotFoundError('Condition', id);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get condition', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(params: ConditionSearchParams): Promise<PaginatedResult<Condition>> {
    try {
      if (!params.patientId) {
        throw new ValidationError('patientId is required for condition search');
      }

      const query = this.db('conditions')
        .where('patient_id', params.patientId)
        .select('*')
        .orderBy('recorded_date', 'desc');

      if (params.clinicalStatus) {
        query.where('clinical_status', params.clinicalStatus);
      }

      if (params.verificationStatus) {
        query.where('verification_status', params.verificationStatus);
      }

      if (params.category) {
        query.whereRaw("category::jsonb @> ?::jsonb", [JSON.stringify([params.category])]);
      }

      if (params.code) {
        query.where('code_code', params.code);
      }

      if (params.onsetDateFrom) {
        query.where('onset_datetime', '>=', params.onsetDateFrom);
      }

      if (params.onsetDateTo) {
        query.where('onset_datetime', '<=', params.onsetDateTo);
      }

      const allowedSortColumns: Record<string, string> = {
        recordedDate: 'recorded_date',
        onsetDate: 'onset_datetime',
        clinicalStatus: 'clinical_status',
        code: 'code_display',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      const result = await this.paginate<ConditionRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to search conditions', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(id: string, data: Partial<Condition> & { encounterId?: string }): Promise<Condition> {
    try {
      const existing = await this.db('conditions').where({ id }).first<ConditionRow>();
      if (!existing) {
        throw new NotFoundError('Condition', id);
      }

      const now = new Date().toISOString();
      const updates: Partial<ConditionRow> = { updated_at: now };

      if (data.clinicalStatus !== undefined) updates.clinical_status = data.clinicalStatus;
      if (data.verificationStatus !== undefined) updates.verification_status = data.verificationStatus;
      if (data.category !== undefined) updates.category = JSON.stringify(data.category);
      if (data.severity !== undefined) {
        updates.severity_code = data.severity?.coding?.[0]?.code;
        updates.severity_system = data.severity?.coding?.[0]?.system;
        updates.severity_display = data.severity?.coding?.[0]?.display;
      }
      if (data.code !== undefined) {
        updates.code_code = data.code.coding?.[0]?.code || '';
        updates.code_system = data.code.coding?.[0]?.system || '';
        updates.code_display = data.code.coding?.[0]?.display || data.code.text;
      }
      if (data.bodySite !== undefined) updates.body_site = JSON.stringify(data.bodySite);
      if (data.onsetDateTime !== undefined) updates.onset_datetime = data.onsetDateTime;
      if (data.abatementDateTime !== undefined) updates.abatement_datetime = data.abatementDateTime;
      if (data.recorder !== undefined) {
        updates.recorder_reference = data.recorder?.reference;
        updates.recorder_display = data.recorder?.display;
      }
      if (data.evidence !== undefined) updates.evidence = JSON.stringify(data.evidence);
      if (data.encounterId !== undefined) updates.encounter_id = data.encounterId;

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('conditions').where({ id }).update(updates);

        // Sync to FHIR server
        const updated = await trx('conditions').where({ id }).first<ConditionRow>();
        if (updated) {
          const condition = this.fromRow(updated);
          const fhirResource = this.toFHIR(condition);
          const fhirId = updated.fhir_id || id;
          await this.fhirClient.update('Condition', fhirId, fhirResource);
        }
      });

      this.logger.info('Condition updated', { conditionId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to update condition', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    try {
      const existing = await this.db('conditions').where({ id }).first<ConditionRow>();
      if (!existing) {
        throw new NotFoundError('Condition', id);
      }

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('conditions').where({ id }).delete();

        if (existing.fhir_id) {
          try {
            await this.fhirClient.delete('Condition', existing.fhir_id);
          } catch (fhirError) {
            this.logger.warn('Failed to delete condition from FHIR server', {
              conditionId: id,
              fhirId: existing.fhir_id,
            });
          }
        }
      });

      this.logger.info('Condition deleted', { conditionId: id });
    } catch (error) {
      this.handleError('Failed to delete condition', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Reconcile (§170.315(b)(2) Clinical Information Reconciliation)
  // ---------------------------------------------------------------------------

  async reconcile(
    patientId: string,
    conditions: Array<{
      id?: string;
      action: 'confirm' | 'modify' | 'resolve';
      clinicalStatus?: ConditionClinicalStatus;
      verificationStatus?: ConditionVerificationStatus;
      severity?: CodeableConcept;
      code?: CodeableConcept;
    }>
  ): Promise<Condition[]> {
    try {
      const results: Condition[] = [];

      await this.withTransaction(async (trx: Knex.Transaction) => {
        const currentActive = await trx('conditions')
          .where('patient_id', patientId)
          .where('clinical_status', 'active')
          .whereNot('verification_status', 'entered-in-error')
          .select<ConditionRow[]>('*');

        const reconciledIds = new Set(conditions.filter((c) => c.id).map((c) => c.id));

        // Mark unreconciled active conditions as inactive
        for (const current of currentActive) {
          if (!reconciledIds.has(current.id)) {
            await trx('conditions').where({ id: current.id }).update({
              clinical_status: 'inactive',
              updated_at: new Date().toISOString(),
            });

            if (current.fhir_id) {
              const updated = this.fromRow({ ...current, clinical_status: 'inactive' });
              const fhirResource = this.toFHIR(updated);
              await this.fhirClient.update('Condition', current.fhir_id, fhirResource);
            }
          }
        }

        // Process reconciled items
        for (const condition of conditions) {
          if (condition.id && condition.action === 'resolve') {
            await trx('conditions').where({ id: condition.id }).update({
              clinical_status: 'resolved',
              abatement_datetime: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          } else if (condition.id && condition.action === 'modify') {
            const updates: Partial<ConditionRow> = { updated_at: new Date().toISOString() };
            if (condition.clinicalStatus) updates.clinical_status = condition.clinicalStatus;
            if (condition.verificationStatus) updates.verification_status = condition.verificationStatus;
            if (condition.severity) {
              updates.severity_code = condition.severity.coding?.[0]?.code;
              updates.severity_system = condition.severity.coding?.[0]?.system;
              updates.severity_display = condition.severity.coding?.[0]?.display;
            }
            await trx('conditions').where({ id: condition.id }).update(updates);

            const row = await trx('conditions').where({ id: condition.id }).first<ConditionRow>();
            if (row) results.push(this.fromRow(row));
          } else if (condition.id && condition.action === 'confirm') {
            const row = await trx('conditions').where({ id: condition.id }).first<ConditionRow>();
            if (row) results.push(this.fromRow(row));
          }
        }
      });

      this.logger.info('Condition reconciliation completed', { patientId, count: conditions.length });
      return results;
    } catch (error) {
      this.handleError('Failed to reconcile conditions', error);
    }
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: Internal -> FHIR R4 Condition
  // ---------------------------------------------------------------------------

  toFHIR(condition: Condition & { encounterId?: string }): Record<string, unknown> {
    const categories = condition.category || [];
    const isEncounterDiagnosis = categories.includes(ConditionCategory.ENCOUNTER_DIAGNOSIS);

    const profile = isEncounterDiagnosis
      ? US_CORE_CONDITION_ENCOUNTER_DIAGNOSIS
      : US_CORE_CONDITION_PROBLEMS_HEALTH_CONCERNS;

    const fhirCondition: Record<string, unknown> = {
      resourceType: 'Condition',
      id: condition.id,
      meta: {
        profile: [profile],
      },
      clinicalStatus: {
        coding: [
          {
            system: CODE_SYSTEMS.CONDITION_CLINICAL_STATUS,
            code: condition.clinicalStatus,
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: CODE_SYSTEMS.CONDITION_VERIFICATION_STATUS,
            code: condition.verificationStatus,
          },
        ],
      },
      category: categories.map((cat) => ({
        coding: [
          {
            system: CODE_SYSTEMS.CONDITION_CATEGORY,
            code: cat,
            display: this.getCategoryDisplay(cat),
          },
        ],
      })),
      code: condition.code,
      subject: {
        reference: `Patient/${condition.patientId}`,
      },
    };

    if (condition.severity) {
      fhirCondition.severity = condition.severity;
    }

    if (condition.bodySite?.length) {
      fhirCondition.bodySite = condition.bodySite;
    }

    if (condition.onsetDateTime) {
      fhirCondition.onsetDateTime = condition.onsetDateTime;
    }

    if (condition.abatementDateTime) {
      fhirCondition.abatementDateTime = condition.abatementDateTime;
    }

    if (condition.recordedDate) {
      fhirCondition.recordedDate = condition.recordedDate;
    }

    if (condition.recorder) {
      fhirCondition.recorder = condition.recorder;
    }

    if (condition.evidence?.length) {
      fhirCondition.evidence = condition.evidence;
    }

    if ((condition as { encounterId?: string }).encounterId) {
      fhirCondition.encounter = {
        reference: `Encounter/${(condition as { encounterId?: string }).encounterId}`,
      };
    }

    return fhirCondition;
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: FHIR R4 Condition -> Internal
  // ---------------------------------------------------------------------------

  fromFHIR(fhirCondition: Record<string, unknown>): Omit<Condition, 'id'> {
    const clinicalStatusCoding = (
      (fhirCondition.clinicalStatus as CodeableConcept)?.coding || []
    )[0];
    const verificationStatusCoding = (
      (fhirCondition.verificationStatus as CodeableConcept)?.coding || []
    )[0];

    const categories: ConditionCategory[] = (
      (fhirCondition.category as CodeableConcept[]) || []
    )
      .map((cat) => cat.coding?.[0]?.code as ConditionCategory)
      .filter(Boolean);

    return {
      patientId: ((fhirCondition.subject as Reference)?.reference || '').replace('Patient/', ''),
      clinicalStatus: (clinicalStatusCoding?.code || 'active') as ConditionClinicalStatus,
      verificationStatus: (verificationStatusCoding?.code || 'unconfirmed') as ConditionVerificationStatus,
      category: categories,
      severity: fhirCondition.severity as CodeableConcept | undefined,
      code: fhirCondition.code as CodeableConcept,
      bodySite: fhirCondition.bodySite as CodeableConcept[] | undefined,
      onsetDateTime: fhirCondition.onsetDateTime as string | undefined,
      abatementDateTime: fhirCondition.abatementDateTime as string | undefined,
      recordedDate: fhirCondition.recordedDate as string | undefined,
      recorder: fhirCondition.recorder as Reference | undefined,
      evidence: fhirCondition.evidence as ConditionEvidence[] | undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private fromRow(row: ConditionRow): Condition {
    const severity: CodeableConcept | undefined =
      row.severity_code
        ? {
            coding: [
              {
                system: row.severity_system,
                code: row.severity_code,
                display: row.severity_display,
              },
            ],
          }
        : undefined;

    return {
      id: row.id,
      patientId: row.patient_id,
      clinicalStatus: row.clinical_status as ConditionClinicalStatus,
      verificationStatus: row.verification_status as ConditionVerificationStatus,
      category: JSON.parse(row.category || '[]'),
      severity,
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
      bodySite: row.body_site ? JSON.parse(row.body_site) : undefined,
      onsetDateTime: row.onset_datetime,
      abatementDateTime: row.abatement_datetime,
      recordedDate: row.recorded_date,
      recorder: row.recorder_reference
        ? { reference: row.recorder_reference, display: row.recorder_display }
        : undefined,
      evidence: row.evidence ? JSON.parse(row.evidence) : undefined,
    };
  }

  private getCategoryDisplay(category: string): string {
    switch (category) {
      case ConditionCategory.PROBLEM_LIST_ITEM:
        return 'Problem List Item';
      case ConditionCategory.ENCOUNTER_DIAGNOSIS:
        return 'Encounter Diagnosis';
      case ConditionCategory.HEALTH_CONCERN:
        return 'Health Concern';
      default:
        return category;
    }
  }
}

export const conditionService = new ConditionService();
