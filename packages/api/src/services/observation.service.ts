// =============================================================================
// Observation Service - Vitals, Labs, Smoking Status, SDOH Assessments
// FHIR R4 Observation | US Core 6.1 Vital Signs / Lab Result / Smoking Status /
// Observation SDOH Assessment profiles
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import {
  Observation,
  ObservationStatus,
  ObservationComponent,
  ObservationReferenceRange,
  CodeableConcept,
  Reference,
  Quantity,
  Coding,
  CODE_SYSTEMS,
  VITAL_SIGN_CODES,
  VITAL_SIGN_UNITS,
  VITAL_SIGN_REFERENCE_RANGES,
  OBSERVATION_CATEGORIES,
  SMOKING_STATUS_CODE,
} from '@tribal-ehr/shared';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// US Core Profile URLs
// -----------------------------------------------------------------------------

const US_CORE_VITAL_SIGNS = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-vital-signs';
const US_CORE_BLOOD_PRESSURE = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-blood-pressure';
const US_CORE_BMI = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-bmi';
const US_CORE_BODY_HEIGHT = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-body-height';
const US_CORE_BODY_WEIGHT = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-body-weight';
const US_CORE_BODY_TEMPERATURE = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-body-temperature';
const US_CORE_HEART_RATE = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-heart-rate';
const US_CORE_RESPIRATORY_RATE = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-respiratory-rate';
const US_CORE_PULSE_OXIMETRY = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-pulse-oximetry';
const US_CORE_LAB_RESULT = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab';
const US_CORE_SMOKING_STATUS = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-smokingstatus';
const US_CORE_SDOH_ASSESSMENT = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-sdoh-assessment';

// -----------------------------------------------------------------------------
// Database Row Interface
// -----------------------------------------------------------------------------

interface ObservationRow {
  id: string;
  patient_id: string;
  encounter_id?: string;
  status: string;
  category: string; // JSON
  code_code: string;
  code_system: string;
  code_display?: string;
  effective_date_time?: string;
  issued?: string;
  value_quantity_value?: number;
  value_quantity_unit?: string;
  value_quantity_system?: string;
  value_quantity_code?: string;
  value_codeable_concept?: string; // JSON
  value_string?: string;
  value_boolean?: boolean;
  interpretation?: string; // JSON
  reference_range?: string; // JSON
  component?: string; // JSON
  note?: string; // JSON
  performer?: string; // JSON
  device_reference?: string;
  fhir_id?: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Vitals Input
// -----------------------------------------------------------------------------

export interface VitalsInput {
  systolicBP?: number;
  diastolicBP?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  temperatureUnit?: 'Cel' | '[degF]';
  spO2?: number;
  heightValue?: number;
  heightUnit?: 'cm' | '[in_i]';
  weightValue?: number;
  weightUnit?: 'kg' | '[lb_av]';
}

// -----------------------------------------------------------------------------
// Search Parameters
// -----------------------------------------------------------------------------

export interface ObservationSearchParams extends PaginationParams {
  patientId: string;
  category?: string;
  code?: string;
  dateFrom?: string;
  dateTo?: string;
  encounterId?: string;
  status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class ObservationService extends BaseService {
  constructor() {
    super('ObservationService');
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(data: Omit<Observation, 'id'> & { encounterId?: string }): Promise<Observation> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      const row: ObservationRow = this.toRow(id, data, now);

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('observations').insert(row);

        const fhirResource = this.toFHIR({ ...data, id });
        const fhirResult = await this.fhirClient.create<Record<string, unknown>>(
          'Observation',
          fhirResource
        );
        if (fhirResult.id) {
          await trx('observations')
            .where({ id })
            .update({ fhir_id: fhirResult.id as string });
        }
      });

      this.logger.info('Observation created', { observationId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to create observation', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Create Vital Signs (batch)
  // ---------------------------------------------------------------------------

  async createVitalSigns(
    patientId: string,
    encounterId: string | undefined,
    vitals: VitalsInput
  ): Promise<Observation[]> {
    try {
      const now = new Date().toISOString();
      const observations: Observation[] = [];
      const vitalSignCategory: CodeableConcept[] = [
        {
          coding: [
            {
              system: OBSERVATION_CATEGORIES.VITAL_SIGNS.system,
              code: OBSERVATION_CATEGORIES.VITAL_SIGNS.code,
              display: OBSERVATION_CATEGORIES.VITAL_SIGNS.display,
            },
          ],
        },
      ];

      await this.withTransaction(async (trx: Knex.Transaction) => {
        // Blood Pressure (single observation with components)
        if (vitals.systolicBP !== undefined && vitals.diastolicBP !== undefined) {
          const bpId = uuidv4();
          const bpObs: Omit<Observation, 'id'> & { encounterId?: string } = {
            patientId,
            encounterId,
            status: ObservationStatus.FINAL,
            category: vitalSignCategory,
            code: {
              coding: [
                {
                  system: VITAL_SIGN_CODES.BLOOD_PRESSURE_PANEL.system,
                  code: VITAL_SIGN_CODES.BLOOD_PRESSURE_PANEL.code,
                  display: VITAL_SIGN_CODES.BLOOD_PRESSURE_PANEL.display,
                },
              ],
              text: 'Blood Pressure',
            },
            effectiveDateTime: now,
            component: [
              {
                code: {
                  coding: [
                    {
                      system: VITAL_SIGN_CODES.BLOOD_PRESSURE_SYSTOLIC.system,
                      code: VITAL_SIGN_CODES.BLOOD_PRESSURE_SYSTOLIC.code,
                      display: VITAL_SIGN_CODES.BLOOD_PRESSURE_SYSTOLIC.display,
                    },
                  ],
                },
                valueQuantity: {
                  value: vitals.systolicBP,
                  unit: VITAL_SIGN_UNITS.BLOOD_PRESSURE.unit,
                  system: VITAL_SIGN_UNITS.BLOOD_PRESSURE.system,
                  code: VITAL_SIGN_UNITS.BLOOD_PRESSURE.code,
                },
              },
              {
                code: {
                  coding: [
                    {
                      system: VITAL_SIGN_CODES.BLOOD_PRESSURE_DIASTOLIC.system,
                      code: VITAL_SIGN_CODES.BLOOD_PRESSURE_DIASTOLIC.code,
                      display: VITAL_SIGN_CODES.BLOOD_PRESSURE_DIASTOLIC.display,
                    },
                  ],
                },
                valueQuantity: {
                  value: vitals.diastolicBP,
                  unit: VITAL_SIGN_UNITS.BLOOD_PRESSURE.unit,
                  system: VITAL_SIGN_UNITS.BLOOD_PRESSURE.system,
                  code: VITAL_SIGN_UNITS.BLOOD_PRESSURE.code,
                },
              },
            ],
          };

          const bpRow = this.toRow(bpId, bpObs, now);
          await trx('observations').insert(bpRow);

          const fhirBp = this.toFHIR({ ...bpObs, id: bpId });
          const fhirResult = await this.fhirClient.create<Record<string, unknown>>('Observation', fhirBp);
          if (fhirResult.id) {
            await trx('observations').where({ id: bpId }).update({ fhir_id: fhirResult.id as string });
          }

          observations.push({ ...bpObs, id: bpId } as Observation);
        }

        // Heart Rate
        if (vitals.heartRate !== undefined) {
          const obs = await this.createSimpleVital(
            trx,
            patientId,
            encounterId,
            VITAL_SIGN_CODES.HEART_RATE,
            vitals.heartRate,
            VITAL_SIGN_UNITS.HEART_RATE,
            vitalSignCategory,
            now
          );
          observations.push(obs);
        }

        // Respiratory Rate
        if (vitals.respiratoryRate !== undefined) {
          const obs = await this.createSimpleVital(
            trx,
            patientId,
            encounterId,
            VITAL_SIGN_CODES.RESPIRATORY_RATE,
            vitals.respiratoryRate,
            VITAL_SIGN_UNITS.RESPIRATORY_RATE,
            vitalSignCategory,
            now
          );
          observations.push(obs);
        }

        // Temperature
        if (vitals.temperature !== undefined) {
          const tempUnit = vitals.temperatureUnit === '[degF]'
            ? VITAL_SIGN_UNITS.TEMPERATURE_FAHRENHEIT
            : VITAL_SIGN_UNITS.TEMPERATURE_CELSIUS;
          const obs = await this.createSimpleVital(
            trx,
            patientId,
            encounterId,
            VITAL_SIGN_CODES.TEMPERATURE,
            vitals.temperature,
            tempUnit,
            vitalSignCategory,
            now
          );
          observations.push(obs);
        }

        // SpO2
        if (vitals.spO2 !== undefined) {
          const obs = await this.createSimpleVital(
            trx,
            patientId,
            encounterId,
            VITAL_SIGN_CODES.SPO2,
            vitals.spO2,
            VITAL_SIGN_UNITS.SPO2,
            vitalSignCategory,
            now
          );
          observations.push(obs);
        }

        // Height
        if (vitals.heightValue !== undefined) {
          const heightUnit = vitals.heightUnit === '[in_i]'
            ? VITAL_SIGN_UNITS.HEIGHT_IN
            : VITAL_SIGN_UNITS.HEIGHT_CM;
          const obs = await this.createSimpleVital(
            trx,
            patientId,
            encounterId,
            VITAL_SIGN_CODES.HEIGHT,
            vitals.heightValue,
            heightUnit,
            vitalSignCategory,
            now
          );
          observations.push(obs);
        }

        // Weight
        if (vitals.weightValue !== undefined) {
          const weightUnit = vitals.weightUnit === '[lb_av]'
            ? VITAL_SIGN_UNITS.WEIGHT_LB
            : VITAL_SIGN_UNITS.WEIGHT_KG;
          const obs = await this.createSimpleVital(
            trx,
            patientId,
            encounterId,
            VITAL_SIGN_CODES.WEIGHT,
            vitals.weightValue,
            weightUnit,
            vitalSignCategory,
            now
          );
          observations.push(obs);
        }

        // BMI auto-calculation
        if (vitals.heightValue !== undefined && vitals.weightValue !== undefined) {
          let heightMeters: number;
          if (vitals.heightUnit === '[in_i]') {
            heightMeters = vitals.heightValue * 0.0254;
          } else {
            heightMeters = vitals.heightValue / 100;
          }

          let weightKg: number;
          if (vitals.weightUnit === '[lb_av]') {
            weightKg = vitals.weightValue * 0.453592;
          } else {
            weightKg = vitals.weightValue;
          }

          if (heightMeters > 0) {
            const bmi = Math.round((weightKg / (heightMeters * heightMeters)) * 100) / 100;
            const obs = await this.createSimpleVital(
              trx,
              patientId,
              encounterId,
              VITAL_SIGN_CODES.BMI,
              bmi,
              VITAL_SIGN_UNITS.BMI,
              vitalSignCategory,
              now
            );
            observations.push(obs);
          }
        }
      });

      this.logger.info('Vital signs created', {
        patientId,
        count: observations.length,
      });
      return observations;
    } catch (error) {
      this.handleError('Failed to create vital signs', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get by ID
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<Observation> {
    try {
      const row = await this.db('observations').where({ id }).first<ObservationRow>();
      if (!row) {
        throw new NotFoundError('Observation', id);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get observation', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(params: ObservationSearchParams): Promise<PaginatedResult<Observation>> {
    try {
      if (!params.patientId) {
        throw new ValidationError('patientId is required for observation search');
      }

      const query = this.db('observations')
        .where('patient_id', params.patientId)
        .select('*')
        .orderBy('effective_date_time', 'desc');

      if (params.category) {
        query.whereRaw("category::jsonb @> ?::jsonb", [
          JSON.stringify([{ coding: [{ code: params.category }] }]),
        ]);
      }

      if (params.code) {
        query.where('code_code', params.code);
      }

      if (params.dateFrom) {
        query.where('effective_date_time', '>=', params.dateFrom);
      }

      if (params.dateTo) {
        query.where('effective_date_time', '<=', params.dateTo);
      }

      if (params.encounterId) {
        query.where('encounter_id', params.encounterId);
      }

      if (params.status) {
        query.where('status', params.status);
      }

      const allowedSortColumns: Record<string, string> = {
        effectiveDate: 'effective_date_time',
        code: 'code_display',
        status: 'status',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      const result = await this.paginate<ObservationRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to search observations', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Latest Vitals
  // ---------------------------------------------------------------------------

  async getLatestVitals(
    patientId: string
  ): Promise<Record<string, Observation>> {
    try {
      const vitalCodes = [
        VITAL_SIGN_CODES.BLOOD_PRESSURE_PANEL.code,
        VITAL_SIGN_CODES.HEART_RATE.code,
        VITAL_SIGN_CODES.RESPIRATORY_RATE.code,
        VITAL_SIGN_CODES.TEMPERATURE.code,
        VITAL_SIGN_CODES.SPO2.code,
        VITAL_SIGN_CODES.HEIGHT.code,
        VITAL_SIGN_CODES.WEIGHT.code,
        VITAL_SIGN_CODES.BMI.code,
      ];

      const latestVitals: Record<string, Observation> = {};

      for (const code of vitalCodes) {
        const row = await this.db('observations')
          .where('patient_id', patientId)
          .where('code_code', code)
          .orderBy('effective_date_time', 'desc')
          .first<ObservationRow>();

        if (row) {
          latestVitals[code] = this.fromRow(row);
        }
      }

      return latestVitals;
    } catch (error) {
      this.handleError('Failed to get latest vitals', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Vitals Trending
  // ---------------------------------------------------------------------------

  async getVitalsTrending(
    patientId: string,
    code: string,
    dateFrom?: string,
    dateTo?: string,
    limit?: number
  ): Promise<Observation[]> {
    try {
      const query = this.db('observations')
        .where('patient_id', patientId)
        .where('code_code', code)
        .orderBy('effective_date_time', 'asc');

      if (dateFrom) {
        query.where('effective_date_time', '>=', dateFrom);
      }

      if (dateTo) {
        query.where('effective_date_time', '<=', dateTo);
      }

      if (limit) {
        query.limit(limit);
      }

      const rows = await query.select<ObservationRow[]>('*');
      return rows.map((row) => this.fromRow(row));
    } catch (error) {
      this.handleError('Failed to get vitals trending data', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(id: string, data: Partial<Observation> & { encounterId?: string }): Promise<Observation> {
    try {
      const existing = await this.db('observations').where({ id }).first<ObservationRow>();
      if (!existing) {
        throw new NotFoundError('Observation', id);
      }

      const now = new Date().toISOString();
      const updates: Partial<ObservationRow> = { updated_at: now };

      if (data.status !== undefined) updates.status = data.status;
      if (data.category !== undefined) updates.category = JSON.stringify(data.category);
      if (data.code !== undefined) {
        updates.code_code = data.code.coding?.[0]?.code || '';
        updates.code_system = data.code.coding?.[0]?.system || '';
        updates.code_display = data.code.coding?.[0]?.display;
      }
      if (data.effectiveDateTime !== undefined) updates.effective_date_time = data.effectiveDateTime;
      if (data.issued !== undefined) updates.issued = data.issued;
      if (data.valueQuantity !== undefined) {
        updates.value_quantity_value = data.valueQuantity.value;
        updates.value_quantity_unit = data.valueQuantity.unit;
        updates.value_quantity_system = data.valueQuantity.system;
        updates.value_quantity_code = data.valueQuantity.code;
      }
      if (data.valueCodeableConcept !== undefined) {
        updates.value_codeable_concept = JSON.stringify(data.valueCodeableConcept);
      }
      if (data.valueString !== undefined) updates.value_string = data.valueString;
      if (data.valueBoolean !== undefined) updates.value_boolean = data.valueBoolean;
      if (data.interpretation !== undefined) updates.interpretation = JSON.stringify(data.interpretation);
      if (data.referenceRange !== undefined) updates.reference_range = JSON.stringify(data.referenceRange);
      if (data.component !== undefined) updates.component = JSON.stringify(data.component);
      if (data.note !== undefined) updates.note = JSON.stringify(data.note);
      if (data.performer !== undefined) updates.performer = JSON.stringify(data.performer);
      if (data.encounterId !== undefined) updates.encounter_id = data.encounterId;

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('observations').where({ id }).update(updates);

        const updated = await trx('observations').where({ id }).first<ObservationRow>();
        if (updated) {
          const observation = this.fromRow(updated);
          const fhirResource = this.toFHIR(observation);
          const fhirId = updated.fhir_id || id;
          await this.fhirClient.update('Observation', fhirId, fhirResource);
        }
      });

      this.logger.info('Observation updated', { observationId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to update observation', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    try {
      const existing = await this.db('observations').where({ id }).first<ObservationRow>();
      if (!existing) {
        throw new NotFoundError('Observation', id);
      }

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('observations').where({ id }).delete();

        if (existing.fhir_id) {
          try {
            await this.fhirClient.delete('Observation', existing.fhir_id);
          } catch (fhirError) {
            this.logger.warn('Failed to delete observation from FHIR server', {
              observationId: id,
              fhirId: existing.fhir_id,
            });
          }
        }
      });

      this.logger.info('Observation deleted', { observationId: id });
    } catch (error) {
      this.handleError('Failed to delete observation', error);
    }
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: Internal -> FHIR R4 Observation
  // ---------------------------------------------------------------------------

  toFHIR(observation: Observation & { encounterId?: string }): Record<string, unknown> {
    const categoryCode = observation.category?.[0]?.coding?.[0]?.code;
    const loincCode = observation.code?.coding?.[0]?.code;
    const profile = this.getProfile(categoryCode, loincCode);

    const fhirObs: Record<string, unknown> = {
      resourceType: 'Observation',
      id: observation.id,
      meta: {
        profile: [profile],
      },
      status: observation.status,
      category: observation.category,
      code: observation.code,
      subject: {
        reference: `Patient/${observation.patientId}`,
      },
    };

    if (observation.effectiveDateTime) {
      fhirObs.effectiveDateTime = observation.effectiveDateTime;
    }

    if (observation.issued) {
      fhirObs.issued = observation.issued;
    }

    // value[x] mapping
    if (observation.valueQuantity) {
      fhirObs.valueQuantity = observation.valueQuantity;
    } else if (observation.valueCodeableConcept) {
      fhirObs.valueCodeableConcept = observation.valueCodeableConcept;
    } else if (observation.valueString !== undefined) {
      fhirObs.valueString = observation.valueString;
    } else if (observation.valueBoolean !== undefined) {
      fhirObs.valueBoolean = observation.valueBoolean;
    }

    if (observation.interpretation?.length) {
      fhirObs.interpretation = observation.interpretation;
    }

    if (observation.referenceRange?.length) {
      fhirObs.referenceRange = observation.referenceRange;
    }

    if (observation.component?.length) {
      fhirObs.component = observation.component;
    }

    if (observation.note?.length) {
      fhirObs.note = observation.note;
    }

    if (observation.performer?.length) {
      fhirObs.performer = observation.performer;
    }

    if (observation.device) {
      fhirObs.device = observation.device;
    }

    if ((observation as { encounterId?: string }).encounterId) {
      fhirObs.encounter = {
        reference: `Encounter/${(observation as { encounterId?: string }).encounterId}`,
      };
    }

    return fhirObs;
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: FHIR R4 Observation -> Internal
  // ---------------------------------------------------------------------------

  fromFHIR(fhirObs: Record<string, unknown>): Omit<Observation, 'id'> {
    return {
      patientId: ((fhirObs.subject as Reference)?.reference || '').replace('Patient/', ''),
      status: fhirObs.status as ObservationStatus,
      category: fhirObs.category as CodeableConcept[] | undefined,
      code: fhirObs.code as CodeableConcept,
      effectiveDateTime: fhirObs.effectiveDateTime as string | undefined,
      issued: fhirObs.issued as string | undefined,
      valueQuantity: fhirObs.valueQuantity as Quantity | undefined,
      valueCodeableConcept: fhirObs.valueCodeableConcept as CodeableConcept | undefined,
      valueString: fhirObs.valueString as string | undefined,
      valueBoolean: fhirObs.valueBoolean as boolean | undefined,
      interpretation: fhirObs.interpretation as CodeableConcept[] | undefined,
      referenceRange: fhirObs.referenceRange as ObservationReferenceRange[] | undefined,
      component: fhirObs.component as ObservationComponent[] | undefined,
      note: fhirObs.note as { text: string }[] | undefined,
      performer: fhirObs.performer as Reference[] | undefined,
      device: fhirObs.device as Reference | undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private async createSimpleVital(
    trx: Knex.Transaction,
    patientId: string,
    encounterId: string | undefined,
    vitalCode: { system: string; code: string; display: string },
    value: number,
    unit: { unit: string; system: string; code: string },
    category: CodeableConcept[],
    effectiveDateTime: string
  ): Promise<Observation> {
    const id = uuidv4();
    const obs: Omit<Observation, 'id'> & { encounterId?: string } = {
      patientId,
      encounterId,
      status: ObservationStatus.FINAL,
      category,
      code: {
        coding: [
          {
            system: vitalCode.system,
            code: vitalCode.code,
            display: vitalCode.display,
          },
        ],
        text: vitalCode.display,
      },
      effectiveDateTime,
      valueQuantity: {
        value,
        unit: unit.unit,
        system: unit.system,
        code: unit.code,
      },
    };

    const row = this.toRow(id, obs, effectiveDateTime);
    await trx('observations').insert(row);

    const fhirResource = this.toFHIR({ ...obs, id });
    const fhirResult = await this.fhirClient.create<Record<string, unknown>>('Observation', fhirResource);
    if (fhirResult.id) {
      await trx('observations').where({ id }).update({ fhir_id: fhirResult.id as string });
    }

    return { ...obs, id } as Observation;
  }

  private toRow(
    id: string,
    data: Omit<Observation, 'id'> & { encounterId?: string },
    now: string
  ): ObservationRow {
    return {
      id,
      patient_id: data.patientId,
      encounter_id: data.encounterId,
      status: data.status,
      category: JSON.stringify(data.category || []),
      code_code: data.code?.coding?.[0]?.code || '',
      code_system: data.code?.coding?.[0]?.system || '',
      code_display: data.code?.coding?.[0]?.display || data.code?.text,
      effective_date_time: data.effectiveDateTime,
      issued: data.issued,
      value_quantity_value: data.valueQuantity?.value,
      value_quantity_unit: data.valueQuantity?.unit,
      value_quantity_system: data.valueQuantity?.system,
      value_quantity_code: data.valueQuantity?.code,
      value_codeable_concept: data.valueCodeableConcept
        ? JSON.stringify(data.valueCodeableConcept)
        : undefined,
      value_string: data.valueString,
      value_boolean: data.valueBoolean,
      interpretation: data.interpretation ? JSON.stringify(data.interpretation) : undefined,
      reference_range: data.referenceRange ? JSON.stringify(data.referenceRange) : undefined,
      component: data.component ? JSON.stringify(data.component) : undefined,
      note: data.note ? JSON.stringify(data.note) : undefined,
      performer: data.performer ? JSON.stringify(data.performer) : undefined,
      device_reference: data.device?.reference,
      created_at: now,
      updated_at: now,
    };
  }

  private fromRow(row: ObservationRow): Observation {
    const observation: Observation = {
      id: row.id,
      patientId: row.patient_id,
      status: row.status as ObservationStatus,
      category: row.category ? JSON.parse(row.category) : undefined,
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
      effectiveDateTime: row.effective_date_time,
      issued: row.issued,
    };

    if (row.value_quantity_value !== undefined && row.value_quantity_value !== null) {
      observation.valueQuantity = {
        value: row.value_quantity_value,
        unit: row.value_quantity_unit,
        system: row.value_quantity_system,
        code: row.value_quantity_code,
      };
    }

    if (row.value_codeable_concept) {
      observation.valueCodeableConcept = JSON.parse(row.value_codeable_concept);
    }

    if (row.value_string !== undefined && row.value_string !== null) {
      observation.valueString = row.value_string;
    }

    if (row.value_boolean !== undefined && row.value_boolean !== null) {
      observation.valueBoolean = row.value_boolean;
    }

    if (row.interpretation) {
      observation.interpretation = JSON.parse(row.interpretation);
    }

    if (row.reference_range) {
      observation.referenceRange = JSON.parse(row.reference_range);
    }

    if (row.component) {
      observation.component = JSON.parse(row.component);
    }

    if (row.note) {
      observation.note = JSON.parse(row.note);
    }

    if (row.performer) {
      observation.performer = JSON.parse(row.performer);
    }

    if (row.device_reference) {
      observation.device = { reference: row.device_reference };
    }

    return observation;
  }

  private getProfile(categoryCode?: string, loincCode?: string): string {
    if (categoryCode === 'vital-signs') {
      switch (loincCode) {
        case VITAL_SIGN_CODES.BLOOD_PRESSURE_PANEL.code:
          return US_CORE_BLOOD_PRESSURE;
        case VITAL_SIGN_CODES.BMI.code:
          return US_CORE_BMI;
        case VITAL_SIGN_CODES.HEIGHT.code:
          return US_CORE_BODY_HEIGHT;
        case VITAL_SIGN_CODES.WEIGHT.code:
          return US_CORE_BODY_WEIGHT;
        case VITAL_SIGN_CODES.TEMPERATURE.code:
          return US_CORE_BODY_TEMPERATURE;
        case VITAL_SIGN_CODES.HEART_RATE.code:
          return US_CORE_HEART_RATE;
        case VITAL_SIGN_CODES.RESPIRATORY_RATE.code:
          return US_CORE_RESPIRATORY_RATE;
        case VITAL_SIGN_CODES.SPO2.code:
          return US_CORE_PULSE_OXIMETRY;
        default:
          return US_CORE_VITAL_SIGNS;
      }
    }

    if (categoryCode === 'laboratory') {
      return US_CORE_LAB_RESULT;
    }

    if (categoryCode === 'social-history' && loincCode === SMOKING_STATUS_CODE.code) {
      return US_CORE_SMOKING_STATUS;
    }

    if (categoryCode === 'sdoh') {
      return US_CORE_SDOH_ASSESSMENT;
    }

    return 'http://hl7.org/fhir/StructureDefinition/Observation';
  }
}

export const observationService = new ObservationService();
