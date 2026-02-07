import { Knex } from 'knex';
import crypto from 'crypto';
import { SeededRNG, addDays, addHours, batchInsert } from '../utils';
import { SEED_CONFIG } from '../config';
import { CLINICAL_PROFILES } from '../profiles/clinical-profiles';
import { GeneratedPatients } from './patients';
import { GeneratedUsers } from './users';

export interface GeneratedEncounter {
  id: string;
  patientId: string;
  status: string;
  classCode: string;
  periodStart: string;
  periodEnd: string | null;
  providerId: string;
}

/** Map encounter class codes to human-readable type displays. */
const CLASS_DISPLAY: Record<string, { typeCode: string; typeDisplay: string }> = {
  AMB: { typeCode: 'AMB', typeDisplay: 'Ambulatory Visit' },
  IMP: { typeCode: 'IMP', typeDisplay: 'Inpatient Encounter' },
  SS: { typeCode: 'SS', typeDisplay: 'Same Day Surgery' },
  NONAC: { typeCode: 'NONAC', typeDisplay: 'Skilled Nursing Facility' },
  EMER: { typeCode: 'EMER', typeDisplay: 'Emergency Visit' },
  VR: { typeCode: 'VR', typeDisplay: 'Virtual Encounter' },
};

/**
 * Generate a duration for an encounter based on its class code.
 * Returns the end date/time.
 */
function generateEncounterEnd(classCode: string, start: Date, rng: SeededRNG): Date {
  switch (classCode) {
    case 'AMB': {
      const minutes = rng.randomInt(15, 60);
      return new Date(start.getTime() + minutes * 60 * 1000);
    }
    case 'IMP': {
      const days = rng.randomInt(2, 14);
      return addDays(start, days);
    }
    case 'SS': {
      const hours = rng.randomInt(2, 8);
      return addHours(start, hours);
    }
    case 'NONAC': {
      const days = rng.randomInt(7, 90);
      return addDays(start, days);
    }
    case 'EMER': {
      const hours = rng.randomInt(1, 8);
      return addHours(start, hours);
    }
    case 'VR': {
      const minutes = rng.randomInt(15, 30);
      return new Date(start.getTime() + minutes * 60 * 1000);
    }
    default: {
      const minutes = rng.randomInt(15, 60);
      return new Date(start.getTime() + minutes * 60 * 1000);
    }
  }
}

export async function seedEncounters(
  trx: Knex.Transaction,
  patients: GeneratedPatients,
  users: GeneratedUsers,
  rng: SeededRNG,
): Promise<GeneratedEncounter[]> {
  const now = new Date().toISOString();
  const dateRangeStart = new Date(SEED_CONFIG.DATE_RANGE_START);
  const dateRangeEnd = new Date(SEED_CONFIG.DATE_RANGE_END);
  const futureEnd = new Date(SEED_CONFIG.FUTURE_RANGE_END);

  const encounterRows: Record<string, unknown>[] = [];
  const generatedEncounters: GeneratedEncounter[] = [];

  for (const patient of patients.patients) {
    const profile = CLINICAL_PROFILES[patient.profile];
    const encounterCount = rng.randomInt(profile.encounterRange.min, profile.encounterRange.max);

    // Build class distribution arrays for weighted pick
    const classNames = profile.encounterClasses.map(ec => ec.class);
    const classWeights = profile.encounterClasses.map(ec => ec.weight);

    for (let e = 0; e < encounterCount; e++) {
      const id = crypto.randomUUID();
      const classCode = rng.weightedPick(classNames, classWeights);
      const classInfo = CLASS_DISPLAY[classCode] || CLASS_DISPLAY['AMB'];
      const providerId = rng.pick(users.allProviderIds);

      // Determine status and timing
      const statusRoll = rng.random();
      let status: string;
      let periodStart: Date;
      let periodEnd: Date | null;

      if (statusRoll < 0.03) {
        // in-progress: starts recently, no end
        status = 'in-progress';
        periodStart = addDays(dateRangeEnd, -rng.randomInt(0, 3));
        // Set business hours
        periodStart.setHours(rng.randomInt(8, 16), rng.randomInt(0, 59), 0, 0);
        periodEnd = null;
      } else if (statusRoll < 0.08) {
        // planned: future dates
        status = 'planned';
        periodStart = rng.randomDate(dateRangeEnd, futureEnd);
        periodStart.setHours(rng.randomInt(8, 16), rng.randomInt(0, 59), 0, 0);
        periodEnd = generateEncounterEnd(classCode, periodStart, rng);
      } else if (statusRoll < 0.10) {
        // cancelled
        status = 'cancelled';
        periodStart = rng.randomDate(dateRangeStart, dateRangeEnd);
        periodStart.setHours(rng.randomInt(8, 16), rng.randomInt(0, 59), 0, 0);
        periodEnd = null;
      } else {
        // finished
        status = 'finished';
        periodStart = rng.randomDate(dateRangeStart, dateRangeEnd);
        periodStart.setHours(rng.randomInt(8, 16), rng.randomInt(0, 59), 0, 0);
        periodEnd = generateEncounterEnd(classCode, periodStart, rng);
      }

      const participant = [
        {
          type: 'ATND',
          individual: { reference: `Practitioner/${providerId}` },
        },
      ];

      // Optionally add a nurse participant
      if (users.nurses.length > 0 && rng.chance(0.6)) {
        participant.push({
          type: 'PART',
          individual: { reference: `Practitioner/${rng.pick(users.nurses)}` },
        });
      }

      encounterRows.push({
        id,
        patient_id: patient.id,
        fhir_id: null,
        status,
        class_code: classCode,
        type_code: classInfo.typeCode,
        type_display: classInfo.typeDisplay,
        priority: classCode === 'EMER' ? 'emergency' : 'routine',
        period_start: periodStart.toISOString(),
        period_end: periodEnd ? periodEnd.toISOString() : null,
        reason_code: JSON.stringify([]),
        diagnosis: JSON.stringify([]),
        participant: JSON.stringify(participant),
        location_id: null,
        service_provider_id: null,
        hospitalization: classCode === 'IMP' || classCode === 'NONAC'
          ? JSON.stringify({
            admit_source: 'outp',
            discharge_disposition: status === 'finished' ? 'home' : null,
          })
          : null,
        created_by: providerId,
        created_at: now,
        updated_at: now,
      });

      generatedEncounters.push({
        id,
        patientId: patient.id,
        status,
        classCode,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd ? periodEnd.toISOString() : null,
        providerId,
      });
    }
  }

  await batchInsert(trx, 'encounters', encounterRows);
  console.log(`  - encounters: ${encounterRows.length} rows`);
  return generatedEncounters;
}
