// =============================================================================
// CareTeam Service
// FHIR R4 CareTeam | US Core 6.1 CareTeam profile
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import {
  CareTeam,
  CareTeamStatus,
  CareTeamParticipant,
  CodeableConcept,
  Reference,
  Period,
  CODE_SYSTEMS,
} from '@tribal-ehr/shared';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

const US_CORE_CARETEAM =
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-careteam';

// Participant role code system
const CARE_TEAM_PARTICIPANT_ROLE_SYSTEM =
  'http://terminology.hl7.org/CodeSystem/data-absent-reason';

// Snomed CT for care team roles
const SNOMED_PARTICIPANT_ROLE_SYSTEM = CODE_SYSTEMS.SNOMED_CT;

// -----------------------------------------------------------------------------
// Database Row Interface
// -----------------------------------------------------------------------------

interface CareTeamRow {
  id: string;
  patient_id: string;
  status: string;
  name?: string;
  period_start?: string;
  period_end?: string;
  participant?: string; // JSON
  fhir_id?: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Search Parameters
// -----------------------------------------------------------------------------

export interface CareTeamSearchParams extends PaginationParams {
  patientId: string;
  status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class CareTeamService extends BaseService {
  constructor() {
    super('CareTeamService');
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(data: Omit<CareTeam, 'id'>): Promise<CareTeam> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      const row: CareTeamRow = {
        id,
        patient_id: data.patientId,
        status: data.status,
        name: data.name,
        period_start: data.period?.start,
        period_end: data.period?.end,
        participant: data.participant ? JSON.stringify(data.participant) : undefined,
        created_at: now,
        updated_at: now,
      };

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('care_teams').insert(row);

        const fhirResource = this.toFHIR({ ...data, id });
        const fhirResult = await this.fhirClient.create<Record<string, unknown>>(
          'CareTeam',
          fhirResource
        );
        if (fhirResult.id) {
          await trx('care_teams').where({ id }).update({ fhir_id: fhirResult.id as string });
        }
      });

      this.logger.info('CareTeam created', { careTeamId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to create care team', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get by ID
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<CareTeam> {
    try {
      const row = await this.db('care_teams').where({ id }).first<CareTeamRow>();
      if (!row) {
        throw new NotFoundError('CareTeam', id);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get care team', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(params: CareTeamSearchParams): Promise<PaginatedResult<CareTeam>> {
    try {
      if (!params.patientId) {
        throw new ValidationError('patientId is required for care team search');
      }

      const query = this.db('care_teams')
        .where('patient_id', params.patientId)
        .select('*')
        .orderBy('created_at', 'desc');

      if (params.status) {
        query.where('status', params.status);
      }

      const allowedSortColumns: Record<string, string> = {
        name: 'name',
        status: 'status',
        date: 'created_at',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      const result = await this.paginate<CareTeamRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to search care teams', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Add Participant
  // ---------------------------------------------------------------------------

  async addParticipant(
    id: string,
    participant: CareTeamParticipant
  ): Promise<CareTeam> {
    try {
      const existing = await this.db('care_teams').where({ id }).first<CareTeamRow>();
      if (!existing) {
        throw new NotFoundError('CareTeam', id);
      }

      const participants: CareTeamParticipant[] = existing.participant
        ? JSON.parse(existing.participant)
        : [];

      // Check for duplicate participant
      const memberRef = participant.member?.reference;
      if (memberRef) {
        const duplicate = participants.find(
          (p) => p.member?.reference === memberRef
        );
        if (duplicate) {
          throw new ConflictError('This participant is already a member of the care team');
        }
      }

      participants.push(participant);

      const now = new Date().toISOString();

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('care_teams').where({ id }).update({
          participant: JSON.stringify(participants),
          updated_at: now,
        });

        const updated = await trx('care_teams').where({ id }).first<CareTeamRow>();
        if (updated) {
          const careTeam = this.fromRow(updated);
          const fhirResource = this.toFHIR(careTeam);
          const fhirId = updated.fhir_id || id;
          await this.fhirClient.update('CareTeam', fhirId, fhirResource);
        }
      });

      this.logger.info('CareTeam participant added', { careTeamId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to add participant to care team', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Remove Participant
  // ---------------------------------------------------------------------------

  async removeParticipant(
    id: string,
    memberReference: string
  ): Promise<CareTeam> {
    try {
      const existing = await this.db('care_teams').where({ id }).first<CareTeamRow>();
      if (!existing) {
        throw new NotFoundError('CareTeam', id);
      }

      const participants: CareTeamParticipant[] = existing.participant
        ? JSON.parse(existing.participant)
        : [];

      const filtered = participants.filter(
        (p) => p.member?.reference !== memberReference
      );

      if (filtered.length === participants.length) {
        throw new NotFoundError('CareTeam participant', memberReference);
      }

      const now = new Date().toISOString();

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('care_teams').where({ id }).update({
          participant: JSON.stringify(filtered),
          updated_at: now,
        });

        const updated = await trx('care_teams').where({ id }).first<CareTeamRow>();
        if (updated) {
          const careTeam = this.fromRow(updated);
          const fhirResource = this.toFHIR(careTeam);
          const fhirId = updated.fhir_id || id;
          await this.fhirClient.update('CareTeam', fhirId, fhirResource);
        }
      });

      this.logger.info('CareTeam participant removed', { careTeamId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to remove participant from care team', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(id: string, data: Partial<CareTeam>): Promise<CareTeam> {
    try {
      const existing = await this.db('care_teams').where({ id }).first<CareTeamRow>();
      if (!existing) {
        throw new NotFoundError('CareTeam', id);
      }

      const now = new Date().toISOString();
      const updates: Partial<CareTeamRow> = { updated_at: now };

      if (data.status !== undefined) updates.status = data.status;
      if (data.name !== undefined) updates.name = data.name;
      if (data.period !== undefined) {
        updates.period_start = data.period?.start;
        updates.period_end = data.period?.end;
      }
      if (data.participant !== undefined) updates.participant = JSON.stringify(data.participant);

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('care_teams').where({ id }).update(updates);

        const updated = await trx('care_teams').where({ id }).first<CareTeamRow>();
        if (updated) {
          const careTeam = this.fromRow(updated);
          const fhirResource = this.toFHIR(careTeam);
          const fhirId = updated.fhir_id || id;
          await this.fhirClient.update('CareTeam', fhirId, fhirResource);
        }
      });

      this.logger.info('CareTeam updated', { careTeamId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to update care team', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    try {
      const existing = await this.db('care_teams').where({ id }).first<CareTeamRow>();
      if (!existing) {
        throw new NotFoundError('CareTeam', id);
      }

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('care_teams').where({ id }).delete();

        if (existing.fhir_id) {
          try {
            await this.fhirClient.delete('CareTeam', existing.fhir_id);
          } catch (fhirError) {
            this.logger.warn('Failed to delete care team from FHIR server', {
              careTeamId: id,
              fhirId: existing.fhir_id,
            });
          }
        }
      });

      this.logger.info('CareTeam deleted', { careTeamId: id });
    } catch (error) {
      this.handleError('Failed to delete care team', error);
    }
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: Internal -> FHIR R4 CareTeam
  // ---------------------------------------------------------------------------

  toFHIR(careTeam: CareTeam): Record<string, unknown> {
    const fhirTeam: Record<string, unknown> = {
      resourceType: 'CareTeam',
      id: careTeam.id,
      meta: {
        profile: [US_CORE_CARETEAM],
      },
      status: careTeam.status,
      subject: {
        reference: `Patient/${careTeam.patientId}`,
      },
    };

    if (careTeam.name) {
      fhirTeam.name = careTeam.name;
    }

    if (careTeam.period) {
      fhirTeam.period = careTeam.period;
    }

    if (careTeam.participant?.length) {
      fhirTeam.participant = careTeam.participant.map((p) => {
        const fhirParticipant: Record<string, unknown> = {};
        if (p.role?.length) {
          fhirParticipant.role = p.role;
        }
        if (p.member) {
          fhirParticipant.member = p.member;
        }
        if (p.period) {
          fhirParticipant.period = p.period;
        }
        return fhirParticipant;
      });
    }

    return fhirTeam;
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: FHIR R4 CareTeam -> Internal
  // ---------------------------------------------------------------------------

  fromFHIR(fhirTeam: Record<string, unknown>): Omit<CareTeam, 'id'> {
    return {
      patientId: ((fhirTeam.subject as Reference)?.reference || '').replace('Patient/', ''),
      status: fhirTeam.status as CareTeamStatus,
      name: fhirTeam.name as string | undefined,
      period: fhirTeam.period as Period | undefined,
      participant: fhirTeam.participant as CareTeamParticipant[] | undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private fromRow(row: CareTeamRow): CareTeam {
    const period: Period | undefined =
      row.period_start || row.period_end
        ? { start: row.period_start, end: row.period_end }
        : undefined;

    return {
      id: row.id,
      patientId: row.patient_id,
      status: row.status as CareTeamStatus,
      name: row.name,
      period,
      participant: row.participant ? JSON.parse(row.participant) : undefined,
    };
  }
}

export const careTeamService = new CareTeamService();
