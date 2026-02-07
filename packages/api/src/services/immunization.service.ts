// =============================================================================
// Immunization Service
// FHIR R4 Immunization | US Core 6.1 Immunization profile
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import {
  Immunization,
  ImmunizationStatus,
  ImmunizationPerformer,
  ImmunizationReaction,
  ImmunizationProtocolApplied,
  CodeableConcept,
  Reference,
  Quantity,
  Annotation,
  CODE_SYSTEMS,
} from '@tribal-ehr/shared';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

const US_CORE_IMMUNIZATION =
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization';

// -----------------------------------------------------------------------------
// Database Row Interface
// -----------------------------------------------------------------------------

interface ImmunizationRow {
  id: string;
  patient_id: string;
  encounter_id?: string;
  status: string;
  vaccine_code: string;
  vaccine_system: string;
  vaccine_display?: string;
  occurrence_date_time: string;
  recorded?: string;
  primary_source?: boolean;
  lot_number?: string;
  expiration_date?: string;
  site_code?: string;
  site_system?: string;
  site_display?: string;
  route_code?: string;
  route_system?: string;
  route_display?: string;
  dose_quantity_value?: number;
  dose_quantity_unit?: string;
  dose_quantity_system?: string;
  dose_quantity_code?: string;
  performer?: string; // JSON
  note?: string; // JSON
  reaction?: string; // JSON
  protocol_applied?: string; // JSON
  fhir_id?: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Search Parameters
// -----------------------------------------------------------------------------

export interface ImmunizationSearchParams extends PaginationParams {
  patientId: string;
  vaccineCode?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class ImmunizationService extends BaseService {
  constructor() {
    super('ImmunizationService');
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(data: Omit<Immunization, 'id'> & { encounterId?: string }): Promise<Immunization> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      const row: ImmunizationRow = {
        id,
        patient_id: data.patientId,
        encounter_id: data.encounterId,
        status: data.status,
        vaccine_code: data.vaccineCode.coding?.[0]?.code || '',
        vaccine_system: data.vaccineCode.coding?.[0]?.system || CODE_SYSTEMS.CVX,
        vaccine_display: data.vaccineCode.coding?.[0]?.display || data.vaccineCode.text,
        occurrence_date_time: data.occurrenceDateTime,
        recorded: data.recorded || now,
        primary_source: data.primarySource,
        lot_number: data.lotNumber,
        expiration_date: data.expirationDate,
        site_code: data.site?.coding?.[0]?.code,
        site_system: data.site?.coding?.[0]?.system,
        site_display: data.site?.coding?.[0]?.display || data.site?.text,
        route_code: data.route?.coding?.[0]?.code,
        route_system: data.route?.coding?.[0]?.system,
        route_display: data.route?.coding?.[0]?.display || data.route?.text,
        dose_quantity_value: data.doseQuantity?.value,
        dose_quantity_unit: data.doseQuantity?.unit,
        dose_quantity_system: data.doseQuantity?.system,
        dose_quantity_code: data.doseQuantity?.code,
        performer: data.performer ? JSON.stringify(data.performer) : undefined,
        note: data.note ? JSON.stringify(data.note) : undefined,
        reaction: data.reaction ? JSON.stringify(data.reaction) : undefined,
        protocol_applied: data.protocolApplied ? JSON.stringify(data.protocolApplied) : undefined,
        created_at: now,
        updated_at: now,
      };

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('immunizations').insert(row);

        const fhirResource = this.toFHIR({ ...data, id });
        const fhirResult = await this.fhirClient.create<Record<string, unknown>>(
          'Immunization',
          fhirResource
        );
        if (fhirResult.id) {
          await trx('immunizations').where({ id }).update({ fhir_id: fhirResult.id as string });
        }
      });

      this.logger.info('Immunization created', { immunizationId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to create immunization', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get by ID
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<Immunization> {
    try {
      const row = await this.db('immunizations').where({ id }).first<ImmunizationRow>();
      if (!row) {
        throw new NotFoundError('Immunization', id);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get immunization', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(params: ImmunizationSearchParams): Promise<PaginatedResult<Immunization>> {
    try {
      if (!params.patientId) {
        throw new ValidationError('patientId is required for immunization search');
      }

      const query = this.db('immunizations')
        .where('patient_id', params.patientId)
        .select('*')
        .orderBy('occurrence_date_time', 'desc');

      if (params.vaccineCode) {
        query.where('vaccine_code', params.vaccineCode);
      }

      if (params.status) {
        query.where('status', params.status);
      }

      if (params.dateFrom) {
        query.where('occurrence_date_time', '>=', params.dateFrom);
      }

      if (params.dateTo) {
        query.where('occurrence_date_time', '<=', params.dateTo);
      }

      const allowedSortColumns: Record<string, string> = {
        occurrenceDate: 'occurrence_date_time',
        vaccineCode: 'vaccine_display',
        status: 'status',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      const result = await this.paginate<ImmunizationRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to search immunizations', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Immunization History
  // ---------------------------------------------------------------------------

  async getImmunizationHistory(patientId: string): Promise<Immunization[]> {
    try {
      const rows = await this.db('immunizations')
        .where('patient_id', patientId)
        .whereNot('status', 'entered-in-error')
        .orderBy('occurrence_date_time', 'asc')
        .select<ImmunizationRow[]>('*');

      return rows.map((row) => this.fromRow(row));
    } catch (error) {
      this.handleError('Failed to get immunization history', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(id: string, data: Partial<Immunization> & { encounterId?: string }): Promise<Immunization> {
    try {
      const existing = await this.db('immunizations').where({ id }).first<ImmunizationRow>();
      if (!existing) {
        throw new NotFoundError('Immunization', id);
      }

      const now = new Date().toISOString();
      const updates: Partial<ImmunizationRow> = { updated_at: now };

      if (data.status !== undefined) updates.status = data.status;
      if (data.vaccineCode !== undefined) {
        updates.vaccine_code = data.vaccineCode.coding?.[0]?.code || '';
        updates.vaccine_system = data.vaccineCode.coding?.[0]?.system || CODE_SYSTEMS.CVX;
        updates.vaccine_display = data.vaccineCode.coding?.[0]?.display || data.vaccineCode.text;
      }
      if (data.occurrenceDateTime !== undefined) updates.occurrence_date_time = data.occurrenceDateTime;
      if (data.primarySource !== undefined) updates.primary_source = data.primarySource;
      if (data.lotNumber !== undefined) updates.lot_number = data.lotNumber;
      if (data.expirationDate !== undefined) updates.expiration_date = data.expirationDate;
      if (data.site !== undefined) {
        updates.site_code = data.site?.coding?.[0]?.code;
        updates.site_system = data.site?.coding?.[0]?.system;
        updates.site_display = data.site?.coding?.[0]?.display || data.site?.text;
      }
      if (data.route !== undefined) {
        updates.route_code = data.route?.coding?.[0]?.code;
        updates.route_system = data.route?.coding?.[0]?.system;
        updates.route_display = data.route?.coding?.[0]?.display || data.route?.text;
      }
      if (data.doseQuantity !== undefined) {
        updates.dose_quantity_value = data.doseQuantity?.value;
        updates.dose_quantity_unit = data.doseQuantity?.unit;
        updates.dose_quantity_system = data.doseQuantity?.system;
        updates.dose_quantity_code = data.doseQuantity?.code;
      }
      if (data.performer !== undefined) updates.performer = JSON.stringify(data.performer);
      if (data.note !== undefined) updates.note = JSON.stringify(data.note);
      if (data.reaction !== undefined) updates.reaction = JSON.stringify(data.reaction);
      if (data.protocolApplied !== undefined) updates.protocol_applied = JSON.stringify(data.protocolApplied);
      if (data.encounterId !== undefined) updates.encounter_id = data.encounterId;

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('immunizations').where({ id }).update(updates);

        const updated = await trx('immunizations').where({ id }).first<ImmunizationRow>();
        if (updated) {
          const immunization = this.fromRow(updated);
          const fhirResource = this.toFHIR(immunization);
          const fhirId = updated.fhir_id || id;
          await this.fhirClient.update('Immunization', fhirId, fhirResource);
        }
      });

      this.logger.info('Immunization updated', { immunizationId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to update immunization', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    try {
      const existing = await this.db('immunizations').where({ id }).first<ImmunizationRow>();
      if (!existing) {
        throw new NotFoundError('Immunization', id);
      }

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('immunizations').where({ id }).delete();

        if (existing.fhir_id) {
          try {
            await this.fhirClient.delete('Immunization', existing.fhir_id);
          } catch (fhirError) {
            this.logger.warn('Failed to delete immunization from FHIR server', {
              immunizationId: id,
              fhirId: existing.fhir_id,
            });
          }
        }
      });

      this.logger.info('Immunization deleted', { immunizationId: id });
    } catch (error) {
      this.handleError('Failed to delete immunization', error);
    }
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: Internal -> FHIR R4 Immunization
  // ---------------------------------------------------------------------------

  toFHIR(immunization: Immunization & { encounterId?: string }): Record<string, unknown> {
    const fhirImm: Record<string, unknown> = {
      resourceType: 'Immunization',
      id: immunization.id,
      meta: {
        profile: [US_CORE_IMMUNIZATION],
      },
      status: immunization.status,
      vaccineCode: immunization.vaccineCode,
      patient: {
        reference: `Patient/${immunization.patientId}`,
      },
      occurrenceDateTime: immunization.occurrenceDateTime,
    };

    if (immunization.primarySource !== undefined) {
      fhirImm.primarySource = immunization.primarySource;
    }

    if (immunization.recorded) {
      fhirImm.recorded = immunization.recorded;
    }

    if (immunization.lotNumber) {
      fhirImm.lotNumber = immunization.lotNumber;
    }

    if (immunization.expirationDate) {
      fhirImm.expirationDate = immunization.expirationDate;
    }

    if (immunization.site) {
      fhirImm.site = immunization.site;
    }

    if (immunization.route) {
      fhirImm.route = immunization.route;
    }

    if (immunization.doseQuantity) {
      fhirImm.doseQuantity = immunization.doseQuantity;
    }

    if (immunization.performer?.length) {
      fhirImm.performer = immunization.performer;
    }

    if (immunization.note?.length) {
      fhirImm.note = immunization.note;
    }

    if (immunization.reaction?.length) {
      fhirImm.reaction = immunization.reaction;
    }

    if (immunization.protocolApplied?.length) {
      fhirImm.protocolApplied = immunization.protocolApplied;
    }

    if ((immunization as { encounterId?: string }).encounterId) {
      fhirImm.encounter = {
        reference: `Encounter/${(immunization as { encounterId?: string }).encounterId}`,
      };
    }

    return fhirImm;
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: FHIR R4 Immunization -> Internal
  // ---------------------------------------------------------------------------

  fromFHIR(fhirImm: Record<string, unknown>): Omit<Immunization, 'id'> {
    return {
      patientId: ((fhirImm.patient as Reference)?.reference || '').replace('Patient/', ''),
      status: fhirImm.status as ImmunizationStatus,
      vaccineCode: fhirImm.vaccineCode as CodeableConcept,
      occurrenceDateTime: fhirImm.occurrenceDateTime as string,
      recorded: fhirImm.recorded as string | undefined,
      primarySource: fhirImm.primarySource as boolean | undefined,
      lotNumber: fhirImm.lotNumber as string | undefined,
      expirationDate: fhirImm.expirationDate as string | undefined,
      site: fhirImm.site as CodeableConcept | undefined,
      route: fhirImm.route as CodeableConcept | undefined,
      doseQuantity: fhirImm.doseQuantity as Quantity | undefined,
      performer: fhirImm.performer as ImmunizationPerformer[] | undefined,
      note: fhirImm.note as Annotation[] | undefined,
      reaction: fhirImm.reaction as ImmunizationReaction[] | undefined,
      protocolApplied: fhirImm.protocolApplied as ImmunizationProtocolApplied[] | undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private fromRow(row: ImmunizationRow): Immunization {
    const site: CodeableConcept | undefined = row.site_code
      ? {
          coding: [{ system: row.site_system, code: row.site_code, display: row.site_display }],
          text: row.site_display,
        }
      : undefined;

    const route: CodeableConcept | undefined = row.route_code
      ? {
          coding: [{ system: row.route_system, code: row.route_code, display: row.route_display }],
          text: row.route_display,
        }
      : undefined;

    const doseQuantity: Quantity | undefined =
      row.dose_quantity_value !== undefined && row.dose_quantity_value !== null
        ? {
            value: row.dose_quantity_value,
            unit: row.dose_quantity_unit,
            system: row.dose_quantity_system,
            code: row.dose_quantity_code,
          }
        : undefined;

    return {
      id: row.id,
      patientId: row.patient_id,
      status: row.status as ImmunizationStatus,
      vaccineCode: {
        coding: [
          {
            system: row.vaccine_system,
            code: row.vaccine_code,
            display: row.vaccine_display,
          },
        ],
        text: row.vaccine_display,
      },
      occurrenceDateTime: row.occurrence_date_time,
      recorded: row.recorded,
      primarySource: row.primary_source,
      lotNumber: row.lot_number,
      expirationDate: row.expiration_date,
      site,
      route,
      doseQuantity,
      performer: row.performer ? JSON.parse(row.performer) : undefined,
      note: row.note ? JSON.parse(row.note) : undefined,
      reaction: row.reaction ? JSON.parse(row.reaction) : undefined,
      protocolApplied: row.protocol_applied ? JSON.parse(row.protocol_applied) : undefined,
    };
  }
}

export const immunizationService = new ImmunizationService();
