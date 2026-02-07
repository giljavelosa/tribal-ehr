// =============================================================================
// Goal Service
// FHIR R4 Goal | US Core 6.1 Goal profile
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import {
  Goal,
  GoalLifecycleStatus,
  GoalAchievementStatus,
  CodeableConcept,
  Reference,
  Annotation,
  CODE_SYSTEMS,
} from '@tribal-ehr/shared';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

const US_CORE_GOAL =
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal';

const ACHIEVEMENT_STATUS_SYSTEM =
  'http://terminology.hl7.org/CodeSystem/goal-achievement';

// -----------------------------------------------------------------------------
// Database Row Interface
// -----------------------------------------------------------------------------

interface GoalRow {
  id: string;
  patient_id: string;
  lifecycle_status: string;
  achievement_status?: string;
  description_text: string;
  description_coding?: string; // JSON
  subject_reference: string;
  subject_display?: string;
  start_date?: string;
  target_date?: string;
  status_date?: string;
  expressed_by_reference?: string;
  expressed_by_display?: string;
  addresses?: string; // JSON
  note?: string; // JSON
  fhir_id?: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Search Parameters
// -----------------------------------------------------------------------------

export interface GoalSearchParams extends PaginationParams {
  patientId: string;
  lifecycleStatus?: string;
  achievementStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class GoalService extends BaseService {
  constructor() {
    super('GoalService');
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(data: Omit<Goal, 'id'>): Promise<Goal> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      const row: GoalRow = {
        id,
        patient_id: data.patientId,
        lifecycle_status: data.lifecycleStatus,
        achievement_status: data.achievementStatus,
        description_text: data.description.text || '',
        description_coding: data.description.coding
          ? JSON.stringify(data.description.coding)
          : undefined,
        subject_reference: data.subject.reference || `Patient/${data.patientId}`,
        subject_display: data.subject.display,
        start_date: data.startDate,
        target_date: data.targetDate,
        status_date: data.statusDate,
        expressed_by_reference: data.expressedBy?.reference,
        expressed_by_display: data.expressedBy?.display,
        addresses: data.addresses ? JSON.stringify(data.addresses) : undefined,
        note: data.note ? JSON.stringify(data.note) : undefined,
        created_at: now,
        updated_at: now,
      };

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('goals').insert(row);

        const fhirResource = this.toFHIR({ ...data, id });
        const fhirResult = await this.fhirClient.create<Record<string, unknown>>(
          'Goal',
          fhirResource
        );
        if (fhirResult.id) {
          await trx('goals').where({ id }).update({ fhir_id: fhirResult.id as string });
        }
      });

      this.logger.info('Goal created', { goalId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to create goal', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get by ID
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<Goal> {
    try {
      const row = await this.db('goals').where({ id }).first<GoalRow>();
      if (!row) {
        throw new NotFoundError('Goal', id);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get goal', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(params: GoalSearchParams): Promise<PaginatedResult<Goal>> {
    try {
      if (!params.patientId) {
        throw new ValidationError('patientId is required for goal search');
      }

      const query = this.db('goals')
        .where('patient_id', params.patientId)
        .select('*')
        .orderBy('created_at', 'desc');

      if (params.lifecycleStatus) {
        query.where('lifecycle_status', params.lifecycleStatus);
      }

      if (params.achievementStatus) {
        query.where('achievement_status', params.achievementStatus);
      }

      if (params.dateFrom) {
        query.where('start_date', '>=', params.dateFrom);
      }

      if (params.dateTo) {
        query.where(function () {
          this.where('target_date', '<=', params.dateTo!)
            .orWhereNull('target_date');
        });
      }

      const allowedSortColumns: Record<string, string> = {
        startDate: 'start_date',
        targetDate: 'target_date',
        lifecycleStatus: 'lifecycle_status',
        description: 'description_text',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      const result = await this.paginate<GoalRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to search goals', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(id: string, data: Partial<Goal>): Promise<Goal> {
    try {
      const existing = await this.db('goals').where({ id }).first<GoalRow>();
      if (!existing) {
        throw new NotFoundError('Goal', id);
      }

      const now = new Date().toISOString();
      const updates: Partial<GoalRow> = { updated_at: now };

      if (data.lifecycleStatus !== undefined) updates.lifecycle_status = data.lifecycleStatus;
      if (data.achievementStatus !== undefined) updates.achievement_status = data.achievementStatus;
      if (data.description !== undefined) {
        updates.description_text = data.description.text || '';
        updates.description_coding = data.description.coding
          ? JSON.stringify(data.description.coding)
          : undefined;
      }
      if (data.startDate !== undefined) updates.start_date = data.startDate;
      if (data.targetDate !== undefined) updates.target_date = data.targetDate;
      if (data.statusDate !== undefined) updates.status_date = data.statusDate;
      if (data.expressedBy !== undefined) {
        updates.expressed_by_reference = data.expressedBy?.reference;
        updates.expressed_by_display = data.expressedBy?.display;
      }
      if (data.addresses !== undefined) updates.addresses = JSON.stringify(data.addresses);
      if (data.note !== undefined) updates.note = JSON.stringify(data.note);

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('goals').where({ id }).update(updates);

        const updated = await trx('goals').where({ id }).first<GoalRow>();
        if (updated) {
          const goal = this.fromRow(updated);
          const fhirResource = this.toFHIR(goal);
          const fhirId = updated.fhir_id || id;
          await this.fhirClient.update('Goal', fhirId, fhirResource);
        }
      });

      this.logger.info('Goal updated', { goalId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to update goal', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    try {
      const existing = await this.db('goals').where({ id }).first<GoalRow>();
      if (!existing) {
        throw new NotFoundError('Goal', id);
      }

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('goals').where({ id }).delete();

        if (existing.fhir_id) {
          try {
            await this.fhirClient.delete('Goal', existing.fhir_id);
          } catch (fhirError) {
            this.logger.warn('Failed to delete goal from FHIR server', {
              goalId: id,
              fhirId: existing.fhir_id,
            });
          }
        }
      });

      this.logger.info('Goal deleted', { goalId: id });
    } catch (error) {
      this.handleError('Failed to delete goal', error);
    }
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: Internal -> FHIR R4 Goal
  // ---------------------------------------------------------------------------

  toFHIR(goal: Goal): Record<string, unknown> {
    const fhirGoal: Record<string, unknown> = {
      resourceType: 'Goal',
      id: goal.id,
      meta: {
        profile: [US_CORE_GOAL],
      },
      lifecycleStatus: goal.lifecycleStatus,
      description: goal.description,
      subject: goal.subject,
    };

    if (goal.achievementStatus) {
      fhirGoal.achievementStatus = {
        coding: [
          {
            system: ACHIEVEMENT_STATUS_SYSTEM,
            code: goal.achievementStatus,
          },
        ],
      };
    }

    if (goal.startDate) {
      fhirGoal.startDate = goal.startDate;
    }

    if (goal.targetDate) {
      fhirGoal.target = [
        {
          dueDate: goal.targetDate,
        },
      ];
    }

    if (goal.statusDate) {
      fhirGoal.statusDate = goal.statusDate;
    }

    if (goal.expressedBy) {
      fhirGoal.expressedBy = goal.expressedBy;
    }

    if (goal.addresses?.length) {
      fhirGoal.addresses = goal.addresses;
    }

    if (goal.note?.length) {
      fhirGoal.note = goal.note;
    }

    return fhirGoal;
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: FHIR R4 Goal -> Internal
  // ---------------------------------------------------------------------------

  fromFHIR(fhirGoal: Record<string, unknown>): Omit<Goal, 'id'> {
    const achievementStatusCoding = (
      (fhirGoal.achievementStatus as CodeableConcept)?.coding || []
    )[0];

    const targets = fhirGoal.target as Array<{ dueDate?: string }> | undefined;
    const targetDate = targets?.[0]?.dueDate;

    return {
      patientId: ((fhirGoal.subject as Reference)?.reference || '').replace('Patient/', ''),
      lifecycleStatus: fhirGoal.lifecycleStatus as GoalLifecycleStatus,
      achievementStatus: achievementStatusCoding?.code as GoalAchievementStatus | undefined,
      description: fhirGoal.description as CodeableConcept,
      subject: fhirGoal.subject as Reference,
      startDate: fhirGoal.startDate as string | undefined,
      targetDate,
      statusDate: fhirGoal.statusDate as string | undefined,
      expressedBy: fhirGoal.expressedBy as Reference | undefined,
      addresses: fhirGoal.addresses as Reference[] | undefined,
      note: fhirGoal.note as Annotation[] | undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private fromRow(row: GoalRow): Goal {
    const descriptionCoding = row.description_coding
      ? JSON.parse(row.description_coding)
      : undefined;

    return {
      id: row.id,
      patientId: row.patient_id,
      lifecycleStatus: row.lifecycle_status as GoalLifecycleStatus,
      achievementStatus: row.achievement_status as GoalAchievementStatus | undefined,
      description: {
        coding: descriptionCoding,
        text: row.description_text,
      },
      subject: {
        reference: row.subject_reference,
        display: row.subject_display,
      },
      startDate: row.start_date,
      targetDate: row.target_date,
      statusDate: row.status_date,
      expressedBy: row.expressed_by_reference
        ? { reference: row.expressed_by_reference, display: row.expressed_by_display }
        : undefined,
      addresses: row.addresses ? JSON.parse(row.addresses) : undefined,
      note: row.note ? JSON.parse(row.note) : undefined,
    };
  }
}

export const goalService = new GoalService();
