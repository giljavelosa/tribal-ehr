// =============================================================================
// Family Health History Service - ONC §170.315(a)(12)
// Record, update, and retrieve family health history as FHIR FamilyMemberHistory
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService } from './base.service';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface FamilyHealthHistory {
  id: string;
  patientId: string;
  relationship: string;
  relativeName?: string;
  conditionCode?: string;
  conditionDisplay: string;
  conditionSystem?: string;
  onsetAge?: number;
  onsetRangeLow?: number;
  onsetRangeHigh?: number;
  deceased: boolean;
  deceasedAge?: number;
  causeOfDeath?: string;
  note?: string;
  status: string;
  recordedDate: string;
  recordedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FHIRFamilyMemberHistory {
  resourceType: 'FamilyMemberHistory';
  id: string;
  status: string;
  patient: { reference: string };
  relationship: {
    coding: Array<{ system: string; code: string; display: string }>;
    text: string;
  };
  name?: string;
  deceasedBoolean?: boolean;
  deceasedAge?: { value: number; unit: string; system: string; code: string };
  condition: Array<{
    code: {
      coding?: Array<{ system: string; code: string; display: string }>;
      text: string;
    };
    onsetAge?: { value: number; unit: string; system: string; code: string };
    onsetRange?: {
      low: { value: number; unit: string };
      high: { value: number; unit: string };
    };
    note?: Array<{ text: string }>;
  }>;
  date?: string;
}

const VALID_RELATIONSHIPS = [
  'mother', 'father', 'sister', 'brother',
  'maternal_grandmother', 'maternal_grandfather',
  'paternal_grandmother', 'paternal_grandfather',
  'daughter', 'son', 'aunt', 'uncle',
];

const RELATIONSHIP_DISPLAY: Record<string, string> = {
  mother: 'Mother',
  father: 'Father',
  sister: 'Sister',
  brother: 'Brother',
  maternal_grandmother: 'Maternal Grandmother',
  maternal_grandfather: 'Maternal Grandfather',
  paternal_grandmother: 'Paternal Grandmother',
  paternal_grandfather: 'Paternal Grandfather',
  daughter: 'Daughter',
  son: 'Son',
  aunt: 'Aunt',
  uncle: 'Uncle',
};

const RELATIONSHIP_V3_CODE: Record<string, string> = {
  mother: 'MTH',
  father: 'FTH',
  sister: 'SIS',
  brother: 'BRO',
  maternal_grandmother: 'MGRMTH',
  maternal_grandfather: 'MGRFTH',
  paternal_grandmother: 'PGRMTH',
  paternal_grandfather: 'PGRFTH',
  daughter: 'DAU',
  son: 'SON',
  aunt: 'AUNT',
  uncle: 'UNCLE',
};

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

class FamilyHistoryService extends BaseService {
  constructor() {
    super('FamilyHistoryService');
  }

  private toModel(row: Record<string, unknown>): FamilyHealthHistory {
    return {
      id: row.id as string,
      patientId: row.patient_id as string,
      relationship: row.relationship as string,
      relativeName: row.relative_name as string | undefined,
      conditionCode: row.condition_code as string | undefined,
      conditionDisplay: row.condition_display as string,
      conditionSystem: row.condition_system as string | undefined,
      onsetAge: row.onset_age as number | undefined,
      onsetRangeLow: row.onset_range_low as number | undefined,
      onsetRangeHigh: row.onset_range_high as number | undefined,
      deceased: row.deceased as boolean,
      deceasedAge: row.deceased_age as number | undefined,
      causeOfDeath: row.cause_of_death as string | undefined,
      note: row.note as string | undefined,
      status: row.status as string,
      recordedDate: row.recorded_date as string,
      recordedBy: row.recorded_by as string | undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  async create(data: {
    patientId: string;
    relationship: string;
    relativeName?: string;
    conditionCode?: string;
    conditionDisplay: string;
    conditionSystem?: string;
    onsetAge?: number;
    onsetRangeLow?: number;
    onsetRangeHigh?: number;
    deceased?: boolean;
    deceasedAge?: number;
    causeOfDeath?: string;
    note?: string;
    recordedBy?: string;
  }): Promise<FamilyHealthHistory> {
    if (!data.patientId || !data.relationship || !data.conditionDisplay) {
      throw new ValidationError('patientId, relationship, and conditionDisplay are required');
    }

    if (!VALID_RELATIONSHIPS.includes(data.relationship)) {
      throw new ValidationError(`Invalid relationship. Must be one of: ${VALID_RELATIONSHIPS.join(', ')}`);
    }

    const id = uuidv4();

    await this.db('family_health_histories').insert({
      id,
      patient_id: data.patientId,
      relationship: data.relationship,
      relative_name: data.relativeName || null,
      condition_code: data.conditionCode || null,
      condition_display: data.conditionDisplay,
      condition_system: data.conditionSystem || null,
      onset_age: data.onsetAge ?? null,
      onset_range_low: data.onsetRangeLow ?? null,
      onset_range_high: data.onsetRangeHigh ?? null,
      deceased: data.deceased || false,
      deceased_age: data.deceasedAge ?? null,
      cause_of_death: data.causeOfDeath || null,
      note: data.note || null,
      status: 'active',
      recorded_by: data.recordedBy || null,
    });

    this.logger.info('Family health history record created', { id, patientId: data.patientId });
    const row = await this.db('family_health_histories').where({ id }).first();
    return this.toModel(row);
  }

  async update(id: string, data: Partial<{
    relationship: string;
    relativeName: string;
    conditionCode: string;
    conditionDisplay: string;
    conditionSystem: string;
    onsetAge: number;
    onsetRangeLow: number;
    onsetRangeHigh: number;
    deceased: boolean;
    deceasedAge: number;
    causeOfDeath: string;
    note: string;
    status: string;
  }>): Promise<FamilyHealthHistory> {
    await this.requireExists('family_health_histories', id, 'FamilyHealthHistory');

    if (data.relationship && !VALID_RELATIONSHIPS.includes(data.relationship)) {
      throw new ValidationError(`Invalid relationship. Must be one of: ${VALID_RELATIONSHIPS.join(', ')}`);
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.relationship !== undefined) update.relationship = data.relationship;
    if (data.relativeName !== undefined) update.relative_name = data.relativeName;
    if (data.conditionCode !== undefined) update.condition_code = data.conditionCode;
    if (data.conditionDisplay !== undefined) update.condition_display = data.conditionDisplay;
    if (data.conditionSystem !== undefined) update.condition_system = data.conditionSystem;
    if (data.onsetAge !== undefined) update.onset_age = data.onsetAge;
    if (data.onsetRangeLow !== undefined) update.onset_range_low = data.onsetRangeLow;
    if (data.onsetRangeHigh !== undefined) update.onset_range_high = data.onsetRangeHigh;
    if (data.deceased !== undefined) update.deceased = data.deceased;
    if (data.deceasedAge !== undefined) update.deceased_age = data.deceasedAge;
    if (data.causeOfDeath !== undefined) update.cause_of_death = data.causeOfDeath;
    if (data.note !== undefined) update.note = data.note;
    if (data.status !== undefined) update.status = data.status;

    await this.db('family_health_histories').where({ id }).update(update);

    this.logger.info('Family health history record updated', { id });
    const row = await this.db('family_health_histories').where({ id }).first();
    return this.toModel(row);
  }

  async getByPatient(patientId: string): Promise<FamilyHealthHistory[]> {
    const rows = await this.db('family_health_histories')
      .where({ patient_id: patientId })
      .whereNot({ status: 'entered-in-error' })
      .orderBy('relationship', 'asc')
      .orderBy('created_at', 'desc');

    return rows.map((r: Record<string, unknown>) => this.toModel(r));
  }

  async getById(id: string): Promise<FamilyHealthHistory> {
    const row = await this.db('family_health_histories').where({ id }).first();
    if (!row) {
      throw new NotFoundError('FamilyHealthHistory', id);
    }
    return this.toModel(row);
  }

  async delete(id: string): Promise<FamilyHealthHistory> {
    await this.requireExists('family_health_histories', id, 'FamilyHealthHistory');

    await this.db('family_health_histories').where({ id }).update({
      status: 'entered-in-error',
      updated_at: new Date().toISOString(),
    });

    this.logger.info('Family health history record soft-deleted', { id });
    const row = await this.db('family_health_histories').where({ id }).first();
    return this.toModel(row);
  }

  toFHIRFamilyMemberHistory(record: FamilyHealthHistory): FHIRFamilyMemberHistory {
    const relationshipCode = RELATIONSHIP_V3_CODE[record.relationship] || record.relationship;
    const relationshipDisplay = RELATIONSHIP_DISPLAY[record.relationship] || record.relationship;

    const fhir: FHIRFamilyMemberHistory = {
      resourceType: 'FamilyMemberHistory',
      id: record.id,
      status: record.status === 'active' ? 'completed' : record.status === 'entered-in-error' ? 'entered-in-error' : 'health-unknown',
      patient: { reference: `Patient/${record.patientId}` },
      relationship: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
          code: relationshipCode,
          display: relationshipDisplay,
        }],
        text: relationshipDisplay,
      },
      condition: [{
        code: {
          coding: record.conditionCode && record.conditionSystem ? [{
            system: record.conditionSystem,
            code: record.conditionCode,
            display: record.conditionDisplay,
          }] : undefined,
          text: record.conditionDisplay,
        },
      }],
    };

    if (record.relativeName) {
      fhir.name = record.relativeName;
    }

    if (record.deceased) {
      fhir.deceasedBoolean = true;
      if (record.deceasedAge) {
        fhir.deceasedAge = {
          value: record.deceasedAge,
          unit: 'years',
          system: 'http://unitsofmeasure.org',
          code: 'a',
        };
      }
    }

    // Add onset age or range to condition
    if (record.onsetAge) {
      fhir.condition[0].onsetAge = {
        value: record.onsetAge,
        unit: 'years',
        system: 'http://unitsofmeasure.org',
        code: 'a',
      };
    } else if (record.onsetRangeLow != null && record.onsetRangeHigh != null) {
      fhir.condition[0].onsetRange = {
        low: { value: record.onsetRangeLow, unit: 'years' },
        high: { value: record.onsetRangeHigh, unit: 'years' },
      };
    }

    if (record.note) {
      fhir.condition[0].note = [{ text: record.note }];
    }

    if (record.recordedDate) {
      fhir.date = record.recordedDate;
    }

    return fhir;
  }

  toFHIRBundle(records: FamilyHealthHistory[]): {
    resourceType: 'Bundle';
    type: 'searchset';
    total: number;
    entry: Array<{ resource: FHIRFamilyMemberHistory }>;
  } {
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: records.length,
      entry: records.map((r) => ({
        resource: this.toFHIRFamilyMemberHistory(r),
      })),
    };
  }
}

export const familyHistoryService = new FamilyHistoryService();
