// =============================================================================
// Procedure Service
// FHIR R4 Procedure | US Core 6.1 Procedure profile
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import {
  Procedure,
  ProcedureStatus,
  CodeableConcept,
  Reference,
  Annotation,
  Period,
  CODE_SYSTEMS,
} from '@tribal-ehr/shared';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

const US_CORE_PROCEDURE =
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure';

// -----------------------------------------------------------------------------
// Database Row Interface
// -----------------------------------------------------------------------------

interface ProcedureRow {
  id: string;
  patient_id: string;
  encounter_id?: string;
  status: string;
  code_code: string;
  code_system: string;
  code_display?: string;
  performed_datetime?: string;
  performed_period_start?: string;
  performed_period_end?: string;
  recorder_reference?: string;
  recorder_display?: string;
  performer?: string; // JSON
  location_reference?: string;
  location_display?: string;
  reason_code?: string; // JSON
  body_site?: string; // JSON
  outcome_code?: string;
  outcome_system?: string;
  outcome_display?: string;
  report?: string; // JSON
  complication?: string; // JSON
  note?: string; // JSON
  fhir_id?: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Search Parameters
// -----------------------------------------------------------------------------

export interface ProcedureSearchParams extends PaginationParams {
  patientId: string;
  status?: string;
  code?: string;
  dateFrom?: string;
  dateTo?: string;
  encounterId?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class ProcedureService extends BaseService {
  constructor() {
    super('ProcedureService');
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(data: Omit<Procedure, 'id'> & { encounterId?: string }): Promise<Procedure> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      const row: ProcedureRow = {
        id,
        patient_id: data.patientId,
        encounter_id: data.encounterId,
        status: data.status,
        code_code: data.code.coding?.[0]?.code || '',
        code_system: data.code.coding?.[0]?.system || '',
        code_display: data.code.coding?.[0]?.display || data.code.text,
        performed_datetime: data.performedDateTime,
        performed_period_start: data.performedPeriod?.start,
        performed_period_end: data.performedPeriod?.end,
        recorder_reference: data.recorder?.reference,
        recorder_display: data.recorder?.display,
        performer: data.performer ? JSON.stringify(data.performer) : undefined,
        location_reference: data.location?.reference,
        location_display: data.location?.display,
        reason_code: data.reasonCode ? JSON.stringify(data.reasonCode) : undefined,
        body_site: data.bodySite ? JSON.stringify(data.bodySite) : undefined,
        outcome_code: data.outcome?.coding?.[0]?.code,
        outcome_system: data.outcome?.coding?.[0]?.system,
        outcome_display: data.outcome?.coding?.[0]?.display || data.outcome?.text,
        report: data.report ? JSON.stringify(data.report) : undefined,
        complication: data.complication ? JSON.stringify(data.complication) : undefined,
        note: data.note ? JSON.stringify(data.note) : undefined,
        created_at: now,
        updated_at: now,
      };

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('procedures').insert(row);

        const fhirResource = this.toFHIR({ ...data, id });
        const fhirResult = await this.fhirClient.create<Record<string, unknown>>(
          'Procedure',
          fhirResource
        );
        if (fhirResult.id) {
          await trx('procedures').where({ id }).update({ fhir_id: fhirResult.id as string });
        }
      });

      this.logger.info('Procedure created', { procedureId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to create procedure', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get by ID
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<Procedure> {
    try {
      const row = await this.db('procedures').where({ id }).first<ProcedureRow>();
      if (!row) {
        throw new NotFoundError('Procedure', id);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get procedure', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(params: ProcedureSearchParams): Promise<PaginatedResult<Procedure>> {
    try {
      if (!params.patientId) {
        throw new ValidationError('patientId is required for procedure search');
      }

      const query = this.db('procedures')
        .where('patient_id', params.patientId)
        .select('*')
        .orderBy('performed_datetime', 'desc');

      if (params.status) {
        query.where('status', params.status);
      }

      if (params.code) {
        query.where('code_code', params.code);
      }

      if (params.dateFrom) {
        query.where(function () {
          this.where('performed_datetime', '>=', params.dateFrom!)
            .orWhere('performed_period_start', '>=', params.dateFrom!);
        });
      }

      if (params.dateTo) {
        query.where(function () {
          this.where('performed_datetime', '<=', params.dateTo!)
            .orWhere('performed_period_end', '<=', params.dateTo!);
        });
      }

      if (params.encounterId) {
        query.where('encounter_id', params.encounterId);
      }

      const allowedSortColumns: Record<string, string> = {
        performedDate: 'performed_datetime',
        status: 'status',
        code: 'code_display',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      const result = await this.paginate<ProcedureRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to search procedures', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(id: string, data: Partial<Procedure> & { encounterId?: string }): Promise<Procedure> {
    try {
      const existing = await this.db('procedures').where({ id }).first<ProcedureRow>();
      if (!existing) {
        throw new NotFoundError('Procedure', id);
      }

      const now = new Date().toISOString();
      const updates: Partial<ProcedureRow> = { updated_at: now };

      if (data.status !== undefined) updates.status = data.status;
      if (data.code !== undefined) {
        updates.code_code = data.code.coding?.[0]?.code || '';
        updates.code_system = data.code.coding?.[0]?.system || '';
        updates.code_display = data.code.coding?.[0]?.display || data.code.text;
      }
      if (data.performedDateTime !== undefined) updates.performed_datetime = data.performedDateTime;
      if (data.performedPeriod !== undefined) {
        updates.performed_period_start = data.performedPeriod?.start;
        updates.performed_period_end = data.performedPeriod?.end;
      }
      if (data.recorder !== undefined) {
        updates.recorder_reference = data.recorder?.reference;
        updates.recorder_display = data.recorder?.display;
      }
      if (data.performer !== undefined) updates.performer = JSON.stringify(data.performer);
      if (data.location !== undefined) {
        updates.location_reference = data.location?.reference;
        updates.location_display = data.location?.display;
      }
      if (data.reasonCode !== undefined) updates.reason_code = JSON.stringify(data.reasonCode);
      if (data.bodySite !== undefined) updates.body_site = JSON.stringify(data.bodySite);
      if (data.outcome !== undefined) {
        updates.outcome_code = data.outcome?.coding?.[0]?.code;
        updates.outcome_system = data.outcome?.coding?.[0]?.system;
        updates.outcome_display = data.outcome?.coding?.[0]?.display || data.outcome?.text;
      }
      if (data.report !== undefined) updates.report = JSON.stringify(data.report);
      if (data.complication !== undefined) updates.complication = JSON.stringify(data.complication);
      if (data.note !== undefined) updates.note = JSON.stringify(data.note);
      if (data.encounterId !== undefined) updates.encounter_id = data.encounterId;

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('procedures').where({ id }).update(updates);

        const updated = await trx('procedures').where({ id }).first<ProcedureRow>();
        if (updated) {
          const procedure = this.fromRow(updated);
          const fhirResource = this.toFHIR(procedure);
          const fhirId = updated.fhir_id || id;
          await this.fhirClient.update('Procedure', fhirId, fhirResource);
        }
      });

      this.logger.info('Procedure updated', { procedureId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to update procedure', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    try {
      const existing = await this.db('procedures').where({ id }).first<ProcedureRow>();
      if (!existing) {
        throw new NotFoundError('Procedure', id);
      }

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('procedures').where({ id }).delete();

        if (existing.fhir_id) {
          try {
            await this.fhirClient.delete('Procedure', existing.fhir_id);
          } catch (fhirError) {
            this.logger.warn('Failed to delete procedure from FHIR server', {
              procedureId: id,
              fhirId: existing.fhir_id,
            });
          }
        }
      });

      this.logger.info('Procedure deleted', { procedureId: id });
    } catch (error) {
      this.handleError('Failed to delete procedure', error);
    }
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: Internal -> FHIR R4 Procedure
  // ---------------------------------------------------------------------------

  toFHIR(procedure: Procedure & { encounterId?: string }): Record<string, unknown> {
    const fhirProc: Record<string, unknown> = {
      resourceType: 'Procedure',
      id: procedure.id,
      meta: {
        profile: [US_CORE_PROCEDURE],
      },
      status: procedure.status,
      code: procedure.code,
      subject: {
        reference: `Patient/${procedure.patientId}`,
      },
    };

    if (procedure.performedDateTime) {
      fhirProc.performedDateTime = procedure.performedDateTime;
    } else if (procedure.performedPeriod) {
      fhirProc.performedPeriod = procedure.performedPeriod;
    }

    if (procedure.recorder) {
      fhirProc.recorder = procedure.recorder;
    }

    if (procedure.performer?.length) {
      fhirProc.performer = procedure.performer;
    }

    if (procedure.location) {
      fhirProc.location = procedure.location;
    }

    if (procedure.reasonCode?.length) {
      fhirProc.reasonCode = procedure.reasonCode;
    }

    if (procedure.bodySite?.length) {
      fhirProc.bodySite = procedure.bodySite;
    }

    if (procedure.outcome) {
      fhirProc.outcome = procedure.outcome;
    }

    if (procedure.report?.length) {
      fhirProc.report = procedure.report;
    }

    if (procedure.complication?.length) {
      fhirProc.complication = procedure.complication;
    }

    if (procedure.note?.length) {
      fhirProc.note = procedure.note;
    }

    if ((procedure as { encounterId?: string }).encounterId) {
      fhirProc.encounter = {
        reference: `Encounter/${(procedure as { encounterId?: string }).encounterId}`,
      };
    }

    return fhirProc;
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: FHIR R4 Procedure -> Internal
  // ---------------------------------------------------------------------------

  fromFHIR(fhirProc: Record<string, unknown>): Omit<Procedure, 'id'> {
    return {
      patientId: ((fhirProc.subject as Reference)?.reference || '').replace('Patient/', ''),
      status: fhirProc.status as ProcedureStatus,
      code: fhirProc.code as CodeableConcept,
      performedDateTime: fhirProc.performedDateTime as string | undefined,
      performedPeriod: fhirProc.performedPeriod as Period | undefined,
      recorder: fhirProc.recorder as Reference | undefined,
      performer: fhirProc.performer as Procedure['performer'],
      location: fhirProc.location as Reference | undefined,
      reasonCode: fhirProc.reasonCode as CodeableConcept[] | undefined,
      bodySite: fhirProc.bodySite as CodeableConcept[] | undefined,
      outcome: fhirProc.outcome as CodeableConcept | undefined,
      report: fhirProc.report as Reference[] | undefined,
      complication: fhirProc.complication as CodeableConcept[] | undefined,
      note: fhirProc.note as Annotation[] | undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private fromRow(row: ProcedureRow): Procedure {
    const outcome: CodeableConcept | undefined = row.outcome_code
      ? {
          coding: [
            {
              system: row.outcome_system,
              code: row.outcome_code,
              display: row.outcome_display,
            },
          ],
          text: row.outcome_display,
        }
      : undefined;

    const performedPeriod: Period | undefined =
      row.performed_period_start || row.performed_period_end
        ? {
            start: row.performed_period_start,
            end: row.performed_period_end,
          }
        : undefined;

    return {
      id: row.id,
      patientId: row.patient_id,
      status: row.status as ProcedureStatus,
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
      performedDateTime: row.performed_datetime,
      performedPeriod,
      recorder: row.recorder_reference
        ? { reference: row.recorder_reference, display: row.recorder_display }
        : undefined,
      performer: row.performer ? JSON.parse(row.performer) : undefined,
      location: row.location_reference
        ? { reference: row.location_reference, display: row.location_display }
        : undefined,
      reasonCode: row.reason_code ? JSON.parse(row.reason_code) : undefined,
      bodySite: row.body_site ? JSON.parse(row.body_site) : undefined,
      outcome,
      report: row.report ? JSON.parse(row.report) : undefined,
      complication: row.complication ? JSON.parse(row.complication) : undefined,
      note: row.note ? JSON.parse(row.note) : undefined,
    };
  }
}

export const procedureService = new ProcedureService();
