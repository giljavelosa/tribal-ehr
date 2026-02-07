// =============================================================================
// CarePlan Service
// FHIR R4 CarePlan | US Core 6.1 CarePlan profile
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import {
  CarePlan,
  CarePlanStatus,
  CarePlanIntent,
  CarePlanActivity,
  CodeableConcept,
  Reference,
  Period,
  Annotation,
  CODE_SYSTEMS,
} from '@tribal-ehr/shared';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

const US_CORE_CAREPLAN =
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan';

const CARE_PLAN_CATEGORY_SYSTEM =
  'http://hl7.org/fhir/us/core/CodeSystem/careplan-category';

// -----------------------------------------------------------------------------
// Database Row Interface
// -----------------------------------------------------------------------------

interface CarePlanRow {
  id: string;
  patient_id: string;
  encounter_id?: string;
  status: string;
  intent: string;
  title?: string;
  description?: string;
  category?: string; // JSON
  period_start?: string;
  period_end?: string;
  author_reference?: string;
  author_display?: string;
  care_team?: string; // JSON
  addresses?: string; // JSON
  goal?: string; // JSON
  activity?: string; // JSON
  fhir_id?: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Search Parameters
// -----------------------------------------------------------------------------

export interface CarePlanSearchParams extends PaginationParams {
  patientId: string;
  status?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class CarePlanService extends BaseService {
  constructor() {
    super('CarePlanService');
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(data: Omit<CarePlan, 'id'> & { encounterId?: string }): Promise<CarePlan> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      const row: CarePlanRow = {
        id,
        patient_id: data.patientId,
        encounter_id: data.encounterId,
        status: data.status,
        intent: data.intent,
        title: data.title,
        description: data.description,
        period_start: data.period?.start,
        period_end: data.period?.end,
        author_reference: data.author?.reference,
        author_display: data.author?.display,
        care_team: data.careTeam ? JSON.stringify(data.careTeam) : undefined,
        addresses: data.addresses ? JSON.stringify(data.addresses) : undefined,
        goal: data.goal ? JSON.stringify(data.goal) : undefined,
        activity: data.activity ? JSON.stringify(data.activity) : undefined,
        created_at: now,
        updated_at: now,
      };

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('care_plans').insert(row);

        const fhirResource = this.toFHIR({ ...data, id });
        const fhirResult = await this.fhirClient.create<Record<string, unknown>>(
          'CarePlan',
          fhirResource
        );
        if (fhirResult.id) {
          await trx('care_plans').where({ id }).update({ fhir_id: fhirResult.id as string });
        }
      });

      this.logger.info('CarePlan created', { carePlanId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to create care plan', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get by ID
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<CarePlan> {
    try {
      const row = await this.db('care_plans').where({ id }).first<CarePlanRow>();
      if (!row) {
        throw new NotFoundError('CarePlan', id);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get care plan', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(params: CarePlanSearchParams): Promise<PaginatedResult<CarePlan>> {
    try {
      if (!params.patientId) {
        throw new ValidationError('patientId is required for care plan search');
      }

      const query = this.db('care_plans')
        .where('patient_id', params.patientId)
        .select('*')
        .orderBy('created_at', 'desc');

      if (params.status) {
        query.where('status', params.status);
      }

      if (params.category) {
        query.whereRaw("category::jsonb @> ?::jsonb", [
          JSON.stringify([{ coding: [{ code: params.category }] }]),
        ]);
      }

      if (params.dateFrom) {
        query.where('period_start', '>=', params.dateFrom);
      }

      if (params.dateTo) {
        query.where(function () {
          this.where('period_end', '<=', params.dateTo!)
            .orWhereNull('period_end');
        });
      }

      const allowedSortColumns: Record<string, string> = {
        date: 'period_start',
        status: 'status',
        title: 'title',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      const result = await this.paginate<CarePlanRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to search care plans', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(id: string, data: Partial<CarePlan> & { encounterId?: string }): Promise<CarePlan> {
    try {
      const existing = await this.db('care_plans').where({ id }).first<CarePlanRow>();
      if (!existing) {
        throw new NotFoundError('CarePlan', id);
      }

      const now = new Date().toISOString();
      const updates: Partial<CarePlanRow> = { updated_at: now };

      if (data.status !== undefined) updates.status = data.status;
      if (data.intent !== undefined) updates.intent = data.intent;
      if (data.title !== undefined) updates.title = data.title;
      if (data.description !== undefined) updates.description = data.description;
      if (data.period !== undefined) {
        updates.period_start = data.period?.start;
        updates.period_end = data.period?.end;
      }
      if (data.author !== undefined) {
        updates.author_reference = data.author?.reference;
        updates.author_display = data.author?.display;
      }
      if (data.careTeam !== undefined) updates.care_team = JSON.stringify(data.careTeam);
      if (data.addresses !== undefined) updates.addresses = JSON.stringify(data.addresses);
      if (data.goal !== undefined) updates.goal = JSON.stringify(data.goal);
      if (data.activity !== undefined) updates.activity = JSON.stringify(data.activity);
      if (data.encounterId !== undefined) updates.encounter_id = data.encounterId;

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('care_plans').where({ id }).update(updates);

        const updated = await trx('care_plans').where({ id }).first<CarePlanRow>();
        if (updated) {
          const carePlan = this.fromRow(updated);
          const fhirResource = this.toFHIR(carePlan);
          const fhirId = updated.fhir_id || id;
          await this.fhirClient.update('CarePlan', fhirId, fhirResource);
        }
      });

      this.logger.info('CarePlan updated', { carePlanId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to update care plan', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    try {
      const existing = await this.db('care_plans').where({ id }).first<CarePlanRow>();
      if (!existing) {
        throw new NotFoundError('CarePlan', id);
      }

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('care_plans').where({ id }).delete();

        if (existing.fhir_id) {
          try {
            await this.fhirClient.delete('CarePlan', existing.fhir_id);
          } catch (fhirError) {
            this.logger.warn('Failed to delete care plan from FHIR server', {
              carePlanId: id,
              fhirId: existing.fhir_id,
            });
          }
        }
      });

      this.logger.info('CarePlan deleted', { carePlanId: id });
    } catch (error) {
      this.handleError('Failed to delete care plan', error);
    }
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: Internal -> FHIR R4 CarePlan
  // ---------------------------------------------------------------------------

  toFHIR(carePlan: CarePlan & { encounterId?: string }): Record<string, unknown> {
    const fhirPlan: Record<string, unknown> = {
      resourceType: 'CarePlan',
      id: carePlan.id,
      meta: {
        profile: [US_CORE_CAREPLAN],
      },
      status: carePlan.status,
      intent: carePlan.intent,
      category: [
        {
          coding: [
            {
              system: CARE_PLAN_CATEGORY_SYSTEM,
              code: 'assess-plan',
            },
          ],
        },
      ],
      subject: {
        reference: `Patient/${carePlan.patientId}`,
      },
    };

    if (carePlan.title) {
      fhirPlan.title = carePlan.title;
    }

    if (carePlan.description) {
      fhirPlan.description = carePlan.description;
    }

    if (carePlan.period) {
      fhirPlan.period = carePlan.period;
    }

    if (carePlan.author) {
      fhirPlan.author = carePlan.author;
    }

    if (carePlan.careTeam?.length) {
      fhirPlan.careTeam = carePlan.careTeam;
    }

    if (carePlan.addresses?.length) {
      fhirPlan.addresses = carePlan.addresses;
    }

    if (carePlan.goal?.length) {
      fhirPlan.goal = carePlan.goal;
    }

    if (carePlan.activity?.length) {
      fhirPlan.activity = carePlan.activity;
    }

    if ((carePlan as { encounterId?: string }).encounterId) {
      fhirPlan.encounter = {
        reference: `Encounter/${(carePlan as { encounterId?: string }).encounterId}`,
      };
    }

    return fhirPlan;
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: FHIR R4 CarePlan -> Internal
  // ---------------------------------------------------------------------------

  fromFHIR(fhirPlan: Record<string, unknown>): Omit<CarePlan, 'id'> {
    return {
      patientId: ((fhirPlan.subject as Reference)?.reference || '').replace('Patient/', ''),
      status: fhirPlan.status as CarePlanStatus,
      intent: fhirPlan.intent as CarePlanIntent,
      title: fhirPlan.title as string | undefined,
      description: fhirPlan.description as string | undefined,
      period: fhirPlan.period as Period | undefined,
      author: fhirPlan.author as Reference | undefined,
      careTeam: fhirPlan.careTeam as Reference[] | undefined,
      addresses: fhirPlan.addresses as Reference[] | undefined,
      goal: fhirPlan.goal as Reference[] | undefined,
      activity: fhirPlan.activity as CarePlanActivity[] | undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private fromRow(row: CarePlanRow): CarePlan {
    const period: Period | undefined =
      row.period_start || row.period_end
        ? { start: row.period_start, end: row.period_end }
        : undefined;

    return {
      id: row.id,
      patientId: row.patient_id,
      status: row.status as CarePlanStatus,
      intent: row.intent as CarePlanIntent,
      title: row.title,
      description: row.description,
      period,
      author: row.author_reference
        ? { reference: row.author_reference, display: row.author_display }
        : undefined,
      careTeam: row.care_team ? JSON.parse(row.care_team) : undefined,
      addresses: row.addresses ? JSON.parse(row.addresses) : undefined,
      goal: row.goal ? JSON.parse(row.goal) : undefined,
      activity: row.activity ? JSON.parse(row.activity) : undefined,
    };
  }
}

export const carePlanService = new CarePlanService();
