// =============================================================================
// Patient List Service - Manages personalized patient lists
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService } from './base.service';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Interfaces
// -----------------------------------------------------------------------------

export interface PatientList {
  id: string;
  userId: string;
  name: string;
  description?: string;
  listType: string;
  isDefault: boolean;
  patientCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PatientListMember {
  id: string;
  listId: string;
  patientId: string;
  patientName?: string;
  patientMrn?: string;
  addedAt: string;
  addedBy?: string;
  notes?: string;
}

// -----------------------------------------------------------------------------
// Database Row Interfaces
// -----------------------------------------------------------------------------

interface PatientListRow {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  list_type: string;
  is_default: boolean;
  patient_count?: number | string;
  created_at: string;
  updated_at: string;
}

interface PatientListMemberRow {
  id: string;
  list_id: string;
  patient_id: string;
  patient_name?: string;
  patient_mrn?: string;
  added_at: string;
  added_by?: string;
  notes?: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class PatientListService extends BaseService {
  constructor() {
    super('PatientListService');
  }

  // ---------------------------------------------------------------------------
  // Create List
  // ---------------------------------------------------------------------------

  async createList(data: {
    userId: string;
    name: string;
    description?: string;
    listType?: string;
  }): Promise<PatientList> {
    try {
      if (!data.name || data.name.trim().length === 0) {
        throw new ValidationError('List name is required');
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      await this.db('patient_lists').insert({
        id,
        user_id: data.userId,
        name: data.name.trim(),
        description: data.description,
        list_type: data.listType || 'custom',
        is_default: false,
        created_at: now,
        updated_at: now,
      });

      this.logger.info('Patient list created', { listId: id, userId: data.userId });
      return this.getListById(id);
    } catch (error) {
      this.handleError('Failed to create patient list', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Lists for User
  // ---------------------------------------------------------------------------

  async getListsForUser(userId: string): Promise<PatientList[]> {
    try {
      const rows = await this.db('patient_lists')
        .select(
          'patient_lists.*',
          this.db.raw(
            '(SELECT COUNT(*) FROM patient_list_members WHERE patient_list_members.list_id = patient_lists.id) as patient_count'
          )
        )
        .where('patient_lists.user_id', userId)
        .orderBy('patient_lists.created_at', 'desc') as PatientListRow[];

      return rows.map((row) => this.fromListRow(row));
    } catch (error) {
      this.handleError('Failed to get patient lists for user', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get List by ID
  // ---------------------------------------------------------------------------

  async getListById(listId: string): Promise<PatientList> {
    try {
      const row = await this.db('patient_lists')
        .select(
          'patient_lists.*',
          this.db.raw(
            '(SELECT COUNT(*) FROM patient_list_members WHERE patient_list_members.list_id = patient_lists.id) as patient_count'
          )
        )
        .where('patient_lists.id', listId)
        .first<PatientListRow>();

      if (!row) {
        throw new NotFoundError('Patient list', listId);
      }

      return this.fromListRow(row);
    } catch (error) {
      this.handleError('Failed to get patient list', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update List
  // ---------------------------------------------------------------------------

  async updateList(
    listId: string,
    data: { name?: string; description?: string }
  ): Promise<PatientList> {
    try {
      await this.requireExists('patient_lists', listId, 'Patient list');

      if (data.name !== undefined && data.name.trim().length === 0) {
        throw new ValidationError('List name cannot be empty');
      }

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (data.name !== undefined) {
        updates.name = data.name.trim();
      }
      if (data.description !== undefined) {
        updates.description = data.description;
      }

      await this.db('patient_lists').where({ id: listId }).update(updates);

      this.logger.info('Patient list updated', { listId });
      return this.getListById(listId);
    } catch (error) {
      this.handleError('Failed to update patient list', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete List
  // ---------------------------------------------------------------------------

  async deleteList(listId: string): Promise<void> {
    try {
      await this.requireExists('patient_lists', listId, 'Patient list');

      await this.db('patient_lists').where({ id: listId }).delete();

      this.logger.info('Patient list deleted', { listId });
    } catch (error) {
      this.handleError('Failed to delete patient list', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Add Patient to List
  // ---------------------------------------------------------------------------

  async addPatient(
    listId: string,
    patientId: string,
    addedBy: string,
    notes?: string
  ): Promise<PatientListMember> {
    try {
      await this.requireExists('patient_lists', listId, 'Patient list');
      await this.requireExists('patients', patientId, 'Patient');

      const id = uuidv4();
      const now = new Date().toISOString();

      try {
        await this.db('patient_list_members').insert({
          id,
          list_id: listId,
          patient_id: patientId,
          added_at: now,
          added_by: addedBy,
          notes,
        });
      } catch (insertError: unknown) {
        const errorMessage =
          insertError instanceof Error ? insertError.message : String(insertError);
        if (
          errorMessage.includes('unique') ||
          errorMessage.includes('duplicate') ||
          errorMessage.includes('UNIQUE') ||
          errorMessage.includes('violates unique constraint')
        ) {
          throw new ValidationError('Patient is already in this list');
        }
        throw insertError;
      }

      this.logger.info('Patient added to list', { listId, patientId });

      const member = await this.db('patient_list_members')
        .select(
          'patient_list_members.*',
          this.db.raw("CONCAT(patients.first_name, ' ', patients.last_name) as patient_name"),
          'patients.mrn as patient_mrn'
        )
        .leftJoin('patients', 'patient_list_members.patient_id', 'patients.id')
        .where('patient_list_members.id', id)
        .first<PatientListMemberRow>();

      return this.fromMemberRow(member!);
    } catch (error) {
      this.handleError('Failed to add patient to list', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Remove Patient from List
  // ---------------------------------------------------------------------------

  async removePatient(listId: string, patientId: string): Promise<void> {
    try {
      const deleted = await this.db('patient_list_members')
        .where({ list_id: listId, patient_id: patientId })
        .delete();

      if (deleted === 0) {
        throw new NotFoundError('Patient list member');
      }

      this.logger.info('Patient removed from list', { listId, patientId });
    } catch (error) {
      this.handleError('Failed to remove patient from list', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get List Members
  // ---------------------------------------------------------------------------

  async getListMembers(listId: string): Promise<PatientListMember[]> {
    try {
      await this.requireExists('patient_lists', listId, 'Patient list');

      const rows = await this.db('patient_list_members')
        .select(
          'patient_list_members.*',
          this.db.raw("CONCAT(patients.first_name, ' ', patients.last_name) as patient_name"),
          'patients.mrn as patient_mrn'
        )
        .leftJoin('patients', 'patient_list_members.patient_id', 'patients.id')
        .where('patient_list_members.list_id', listId)
        .orderBy('patient_list_members.added_at', 'desc') as PatientListMemberRow[];

      return rows.map((row) => this.fromMemberRow(row));
    } catch (error) {
      this.handleError('Failed to get list members', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Provider Patients (Dynamic List)
  // ---------------------------------------------------------------------------

  async getProviderPatients(providerId: string): Promise<PatientListMember[]> {
    try {
      const rows = await this.db('encounters')
        .select(
          'encounters.patient_id',
          'encounters.id as encounter_id',
          this.db.raw("CONCAT(patients.first_name, ' ', patients.last_name) as patient_name"),
          'patients.mrn as patient_mrn',
          'encounters.created_at as added_at'
        )
        .join('patients', 'encounters.patient_id', 'patients.id')
        .where('encounters.provider_id', providerId)
        .whereIn('encounters.status', ['planned', 'in-progress', 'arrived'])
        .groupBy(
          'encounters.patient_id',
          'encounters.id',
          'patients.first_name',
          'patients.last_name',
          'patients.mrn',
          'encounters.created_at'
        )
        .orderBy('encounters.created_at', 'desc');

      return rows.map((row: Record<string, unknown>) => ({
        id: row.encounter_id as string,
        listId: 'provider-patients',
        patientId: row.patient_id as string,
        patientName: row.patient_name as string | undefined,
        patientMrn: row.patient_mrn as string | undefined,
        addedAt: row.added_at as string,
      }));
    } catch (error) {
      this.handleError('Failed to get provider patients', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private fromListRow(row: PatientListRow): PatientList {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      listType: row.list_type,
      isDefault: row.is_default,
      patientCount: Number(row.patient_count || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private fromMemberRow(row: PatientListMemberRow): PatientListMember {
    return {
      id: row.id,
      listId: row.list_id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      patientMrn: row.patient_mrn,
      addedAt: row.added_at,
      addedBy: row.added_by,
      notes: row.notes,
    };
  }
}

export const patientListService = new PatientListService();
