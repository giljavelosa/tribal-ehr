// =============================================================================
// Encounter Service
// FHIR R4 Encounter | US Core 6.1 Encounter profile
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import {
  Encounter,
  EncounterStatus,
  EncounterClass,
  EncounterDiagnosis,
  EncounterParticipant,
  EncounterLocation,
  EncounterHospitalization,
  CodeableConcept,
  Reference,
  Period,
  CODE_SYSTEMS,
} from '@tribal-ehr/shared';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

const US_CORE_ENCOUNTER =
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter';

// v3 ActCode system for encounter class
const ACT_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ActCode';

// Valid status transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  planned: ['arrived', 'cancelled', 'entered-in-error'],
  arrived: ['triaged', 'in-progress', 'cancelled', 'entered-in-error'],
  triaged: ['in-progress', 'cancelled', 'entered-in-error'],
  'in-progress': ['onleave', 'finished', 'cancelled', 'entered-in-error'],
  onleave: ['in-progress', 'finished', 'entered-in-error'],
  finished: ['entered-in-error'],
  cancelled: ['entered-in-error'],
};

// -----------------------------------------------------------------------------
// Database Row Interface
// -----------------------------------------------------------------------------

interface EncounterRow {
  id: string;
  patient_id: string;
  status: string;
  encounter_class: string;
  type?: string; // JSON
  priority_code?: string;
  priority_system?: string;
  priority_display?: string;
  period_start?: string;
  period_end?: string;
  reason_code?: string; // JSON
  diagnosis?: string; // JSON
  participant?: string; // JSON
  location?: string; // JSON
  service_provider_reference?: string;
  service_provider_display?: string;
  hospitalization?: string; // JSON
  fhir_id?: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Search Parameters
// -----------------------------------------------------------------------------

export interface EncounterSearchParams extends PaginationParams {
  patientId: string;
  status?: string;
  encounterClass?: string;
  dateFrom?: string;
  dateTo?: string;
  provider?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class EncounterService extends BaseService {
  constructor() {
    super('EncounterService');
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(data: Omit<Encounter, 'id'>): Promise<Encounter> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      const row: EncounterRow = {
        id,
        patient_id: data.patientId,
        status: data.status,
        encounter_class: data.class,
        type: data.type ? JSON.stringify(data.type) : undefined,
        priority_code: data.priority?.coding?.[0]?.code,
        priority_system: data.priority?.coding?.[0]?.system,
        priority_display: data.priority?.coding?.[0]?.display || data.priority?.text,
        period_start: data.period?.start || now,
        period_end: data.period?.end,
        reason_code: data.reasonCode ? JSON.stringify(data.reasonCode) : undefined,
        diagnosis: data.diagnosis ? JSON.stringify(data.diagnosis) : undefined,
        participant: data.participant ? JSON.stringify(data.participant) : undefined,
        location: data.location ? JSON.stringify(data.location) : undefined,
        service_provider_reference: data.serviceProvider?.reference,
        service_provider_display: data.serviceProvider?.display,
        hospitalization: data.hospitalization ? JSON.stringify(data.hospitalization) : undefined,
        created_at: now,
        updated_at: now,
      };

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('encounters').insert(row);

        const fhirResource = this.toFHIR({ ...data, id });
        const fhirResult = await this.fhirClient.create<Record<string, unknown>>(
          'Encounter',
          fhirResource
        );
        if (fhirResult.id) {
          await trx('encounters').where({ id }).update({ fhir_id: fhirResult.id as string });
        }
      });

      this.logger.info('Encounter created', { encounterId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to create encounter', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get by ID
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<Encounter> {
    try {
      const row = await this.db('encounters').where({ id }).first<EncounterRow>();
      if (!row) {
        throw new NotFoundError('Encounter', id);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get encounter', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(params: EncounterSearchParams): Promise<PaginatedResult<Encounter>> {
    try {
      if (!params.patientId) {
        throw new ValidationError('patientId is required for encounter search');
      }

      const query = this.db('encounters')
        .where('patient_id', params.patientId)
        .select('*')
        .orderBy('period_start', 'desc');

      if (params.status) {
        query.where('status', params.status);
      }

      if (params.encounterClass) {
        query.where('encounter_class', params.encounterClass);
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

      if (params.provider) {
        query.whereRaw("participant::text LIKE ?", [`%${params.provider}%`]);
      }

      const allowedSortColumns: Record<string, string> = {
        date: 'period_start',
        status: 'status',
        class: 'encounter_class',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      const result = await this.paginate<EncounterRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to search encounters', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Current Encounter
  // ---------------------------------------------------------------------------

  async getCurrentEncounter(patientId: string): Promise<Encounter | null> {
    try {
      const activeStatuses = [
        EncounterStatus.ARRIVED,
        EncounterStatus.TRIAGED,
        EncounterStatus.IN_PROGRESS,
        EncounterStatus.ON_LEAVE,
      ];

      const row = await this.db('encounters')
        .where('patient_id', patientId)
        .whereIn('status', activeStatuses)
        .orderBy('period_start', 'desc')
        .first<EncounterRow>();

      if (!row) {
        return null;
      }

      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get current encounter', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(id: string, data: Partial<Encounter>): Promise<Encounter> {
    try {
      const existing = await this.db('encounters').where({ id }).first<EncounterRow>();
      if (!existing) {
        throw new NotFoundError('Encounter', id);
      }

      // Validate status transition
      if (data.status && data.status !== existing.status) {
        const allowed = VALID_STATUS_TRANSITIONS[existing.status];
        if (!allowed || !allowed.includes(data.status)) {
          throw new ValidationError(
            `Cannot transition encounter from '${existing.status}' to '${data.status}'`
          );
        }
      }

      const now = new Date().toISOString();
      const updates: Partial<EncounterRow> = { updated_at: now };

      if (data.status !== undefined) {
        updates.status = data.status;
        // Auto-set period end when finishing
        if (data.status === EncounterStatus.FINISHED && !existing.period_end) {
          updates.period_end = now;
        }
      }
      if (data.class !== undefined) updates.encounter_class = data.class;
      if (data.type !== undefined) updates.type = JSON.stringify(data.type);
      if (data.priority !== undefined) {
        updates.priority_code = data.priority?.coding?.[0]?.code;
        updates.priority_system = data.priority?.coding?.[0]?.system;
        updates.priority_display = data.priority?.coding?.[0]?.display || data.priority?.text;
      }
      if (data.period !== undefined) {
        updates.period_start = data.period?.start;
        updates.period_end = data.period?.end;
      }
      if (data.reasonCode !== undefined) updates.reason_code = JSON.stringify(data.reasonCode);
      if (data.diagnosis !== undefined) updates.diagnosis = JSON.stringify(data.diagnosis);
      if (data.participant !== undefined) updates.participant = JSON.stringify(data.participant);
      if (data.location !== undefined) updates.location = JSON.stringify(data.location);
      if (data.serviceProvider !== undefined) {
        updates.service_provider_reference = data.serviceProvider?.reference;
        updates.service_provider_display = data.serviceProvider?.display;
      }
      if (data.hospitalization !== undefined) {
        updates.hospitalization = JSON.stringify(data.hospitalization);
      }

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('encounters').where({ id }).update(updates);

        const updated = await trx('encounters').where({ id }).first<EncounterRow>();
        if (updated) {
          const encounter = this.fromRow(updated);
          const fhirResource = this.toFHIR(encounter);
          const fhirId = updated.fhir_id || id;
          await this.fhirClient.update('Encounter', fhirId, fhirResource);
        }
      });

      this.logger.info('Encounter updated', { encounterId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to update encounter', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    try {
      const existing = await this.db('encounters').where({ id }).first<EncounterRow>();
      if (!existing) {
        throw new NotFoundError('Encounter', id);
      }

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('encounters').where({ id }).delete();

        if (existing.fhir_id) {
          try {
            await this.fhirClient.delete('Encounter', existing.fhir_id);
          } catch (fhirError) {
            this.logger.warn('Failed to delete encounter from FHIR server', {
              encounterId: id,
              fhirId: existing.fhir_id,
            });
          }
        }
      });

      this.logger.info('Encounter deleted', { encounterId: id });
    } catch (error) {
      this.handleError('Failed to delete encounter', error);
    }
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: Internal -> FHIR R4 Encounter
  // ---------------------------------------------------------------------------

  toFHIR(encounter: Encounter): Record<string, unknown> {
    const fhirEnc: Record<string, unknown> = {
      resourceType: 'Encounter',
      id: encounter.id,
      meta: {
        profile: [US_CORE_ENCOUNTER],
      },
      status: encounter.status,
      class: {
        system: ACT_CODE_SYSTEM,
        code: encounter.class,
        display: this.getClassDisplay(encounter.class),
      },
      subject: {
        reference: `Patient/${encounter.patientId}`,
      },
    };

    if (encounter.type?.length) {
      fhirEnc.type = encounter.type;
    }

    if (encounter.priority) {
      fhirEnc.priority = encounter.priority;
    }

    if (encounter.period) {
      fhirEnc.period = encounter.period;
    }

    if (encounter.reasonCode?.length) {
      fhirEnc.reasonCode = encounter.reasonCode;
    }

    if (encounter.diagnosis?.length) {
      fhirEnc.diagnosis = encounter.diagnosis;
    }

    if (encounter.participant?.length) {
      fhirEnc.participant = encounter.participant;
    }

    if (encounter.location?.length) {
      fhirEnc.location = encounter.location;
    }

    if (encounter.serviceProvider) {
      fhirEnc.serviceProvider = encounter.serviceProvider;
    }

    if (encounter.hospitalization) {
      fhirEnc.hospitalization = encounter.hospitalization;
    }

    return fhirEnc;
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: FHIR R4 Encounter -> Internal
  // ---------------------------------------------------------------------------

  fromFHIR(fhirEnc: Record<string, unknown>): Omit<Encounter, 'id'> {
    const classObj = fhirEnc.class as { code: string } | undefined;

    return {
      patientId: ((fhirEnc.subject as Reference)?.reference || '').replace('Patient/', ''),
      status: fhirEnc.status as EncounterStatus,
      class: (classObj?.code || EncounterClass.AMBULATORY) as EncounterClass,
      type: fhirEnc.type as CodeableConcept[] | undefined,
      priority: fhirEnc.priority as CodeableConcept | undefined,
      period: fhirEnc.period as Period | undefined,
      reasonCode: fhirEnc.reasonCode as CodeableConcept[] | undefined,
      diagnosis: fhirEnc.diagnosis as EncounterDiagnosis[] | undefined,
      participant: fhirEnc.participant as EncounterParticipant[] | undefined,
      location: fhirEnc.location as EncounterLocation[] | undefined,
      serviceProvider: fhirEnc.serviceProvider as Reference | undefined,
      hospitalization: fhirEnc.hospitalization as EncounterHospitalization | undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private fromRow(row: EncounterRow): Encounter {
    const priority: CodeableConcept | undefined = row.priority_code
      ? {
          coding: [
            { system: row.priority_system, code: row.priority_code, display: row.priority_display },
          ],
          text: row.priority_display,
        }
      : undefined;

    const period: Period | undefined =
      row.period_start || row.period_end
        ? { start: row.period_start, end: row.period_end }
        : undefined;

    return {
      id: row.id,
      patientId: row.patient_id,
      status: row.status as EncounterStatus,
      class: row.encounter_class as EncounterClass,
      type: row.type ? JSON.parse(row.type) : undefined,
      priority,
      period,
      reasonCode: row.reason_code ? JSON.parse(row.reason_code) : undefined,
      diagnosis: row.diagnosis ? JSON.parse(row.diagnosis) : undefined,
      participant: row.participant ? JSON.parse(row.participant) : undefined,
      location: row.location ? JSON.parse(row.location) : undefined,
      serviceProvider: row.service_provider_reference
        ? {
            reference: row.service_provider_reference,
            display: row.service_provider_display,
          }
        : undefined,
      hospitalization: row.hospitalization ? JSON.parse(row.hospitalization) : undefined,
    };
  }

  private getClassDisplay(encounterClass: string): string {
    const displays: Record<string, string> = {
      AMB: 'ambulatory',
      EMER: 'emergency',
      FLD: 'field',
      HH: 'home health',
      IMP: 'inpatient encounter',
      ACUTE: 'inpatient acute',
      NONAC: 'inpatient non-acute',
      OBSENC: 'observation encounter',
      PRENC: 'pre-admission',
      SS: 'short stay',
      VR: 'virtual',
    };
    return displays[encounterClass] || encounterClass;
  }
}

export const encounterService = new EncounterService();
