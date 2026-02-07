import { Knex } from 'knex';
import crypto from 'crypto';
import { SeededRNG, batchInsert } from '../utils';
import { SEED_CONFIG } from '../config';
import { CLINICAL_PROFILES, ProfileType } from '../profiles/clinical-profiles';
import { CONDITIONS } from '../reference-data/conditions';
import { MEDICATIONS, Medication } from '../reference-data/medications';
import { GeneratedPatients } from './patients';
import { GeneratedEncounter } from './encounters';
import { GeneratedUsers } from './users';

// ---------------------------------------------------------------------------
// Vital sign definitions (LOINC codes)
// ---------------------------------------------------------------------------

interface VitalDef {
  code: string;
  display: string;
  unit: string;
  ucumCode: string;
  normalMin: number;
  normalMax: number;
}

const VITAL_SIGNS: VitalDef[] = [
  { code: '8480-6', display: 'Systolic blood pressure', unit: 'mmHg', ucumCode: 'mm[Hg]', normalMin: 100, normalMax: 130 },
  { code: '8462-4', display: 'Diastolic blood pressure', unit: 'mmHg', ucumCode: 'mm[Hg]', normalMin: 60, normalMax: 85 },
  { code: '8867-4', display: 'Heart rate', unit: 'beats/min', ucumCode: '/min', normalMin: 60, normalMax: 100 },
  { code: '9279-1', display: 'Respiratory rate', unit: 'breaths/min', ucumCode: '/min', normalMin: 12, normalMax: 20 },
  { code: '8310-5', display: 'Body temperature', unit: 'degF', ucumCode: '[degF]', normalMin: 97.0, normalMax: 99.0 },
  { code: '2708-6', display: 'Oxygen saturation', unit: '%', ucumCode: '%', normalMin: 94, normalMax: 100 },
  { code: '29463-7', display: 'Body weight', unit: 'kg', ucumCode: 'kg', normalMin: 55, normalMax: 100 },
];

// ---------------------------------------------------------------------------
// Lab panel definitions (LOINC codes)
// ---------------------------------------------------------------------------

interface LabTest {
  code: string;
  display: string;
  unit: string;
  ucumCode: string;
  normalMin: number;
  normalMax: number;
  precision: number; // decimal places
}

const LAB_PANELS: Record<string, LabTest[]> = {
  HBA1C: [
    { code: '4548-4', display: 'Hemoglobin A1c', unit: '%', ucumCode: '%', normalMin: 4.0, normalMax: 5.6, precision: 1 },
  ],
  BMP: [
    { code: '2345-7', display: 'Glucose', unit: 'mg/dL', ucumCode: 'mg/dL', normalMin: 70, normalMax: 100, precision: 0 },
    { code: '2160-0', display: 'Creatinine', unit: 'mg/dL', ucumCode: 'mg/dL', normalMin: 0.6, normalMax: 1.2, precision: 2 },
    { code: '3094-0', display: 'BUN', unit: 'mg/dL', ucumCode: 'mg/dL', normalMin: 7, normalMax: 20, precision: 0 },
    { code: '2951-2', display: 'Sodium', unit: 'mEq/L', ucumCode: 'meq/L', normalMin: 136, normalMax: 145, precision: 0 },
    { code: '2823-3', display: 'Potassium', unit: 'mEq/L', ucumCode: 'meq/L', normalMin: 3.5, normalMax: 5.0, precision: 1 },
  ],
  CMP: [
    { code: '2345-7', display: 'Glucose', unit: 'mg/dL', ucumCode: 'mg/dL', normalMin: 70, normalMax: 100, precision: 0 },
    { code: '2160-0', display: 'Creatinine', unit: 'mg/dL', ucumCode: 'mg/dL', normalMin: 0.6, normalMax: 1.2, precision: 2 },
    { code: '3094-0', display: 'BUN', unit: 'mg/dL', ucumCode: 'mg/dL', normalMin: 7, normalMax: 20, precision: 0 },
    { code: '2951-2', display: 'Sodium', unit: 'mEq/L', ucumCode: 'meq/L', normalMin: 136, normalMax: 145, precision: 0 },
    { code: '2823-3', display: 'Potassium', unit: 'mEq/L', ucumCode: 'meq/L', normalMin: 3.5, normalMax: 5.0, precision: 1 },
    { code: '1742-6', display: 'ALT', unit: 'U/L', ucumCode: 'U/L', normalMin: 7, normalMax: 56, precision: 0 },
    { code: '1920-8', display: 'AST', unit: 'U/L', ucumCode: 'U/L', normalMin: 10, normalMax: 40, precision: 0 },
    { code: '1975-2', display: 'Total Bilirubin', unit: 'mg/dL', ucumCode: 'mg/dL', normalMin: 0.1, normalMax: 1.2, precision: 1 },
    { code: '2885-2', display: 'Total Protein', unit: 'g/dL', ucumCode: 'g/dL', normalMin: 6.0, normalMax: 8.3, precision: 1 },
    { code: '1751-7', display: 'Albumin', unit: 'g/dL', ucumCode: 'g/dL', normalMin: 3.5, normalMax: 5.5, precision: 1 },
  ],
  LIPID: [
    { code: '2093-3', display: 'Total Cholesterol', unit: 'mg/dL', ucumCode: 'mg/dL', normalMin: 125, normalMax: 200, precision: 0 },
    { code: '2571-8', display: 'Triglycerides', unit: 'mg/dL', ucumCode: 'mg/dL', normalMin: 50, normalMax: 150, precision: 0 },
    { code: '2085-9', display: 'HDL Cholesterol', unit: 'mg/dL', ucumCode: 'mg/dL', normalMin: 40, normalMax: 60, precision: 0 },
    { code: '13457-7', display: 'LDL Cholesterol', unit: 'mg/dL', ucumCode: 'mg/dL', normalMin: 50, normalMax: 100, precision: 0 },
  ],
  CBC: [
    { code: '6690-2', display: 'WBC', unit: 'K/uL', ucumCode: '10*3/uL', normalMin: 4.5, normalMax: 11.0, precision: 1 },
    { code: '789-8', display: 'RBC', unit: 'M/uL', ucumCode: '10*6/uL', normalMin: 4.2, normalMax: 5.9, precision: 2 },
    { code: '718-7', display: 'Hemoglobin', unit: 'g/dL', ucumCode: 'g/dL', normalMin: 12.0, normalMax: 17.5, precision: 1 },
    { code: '4544-3', display: 'Hematocrit', unit: '%', ucumCode: '%', normalMin: 36, normalMax: 51, precision: 1 },
    { code: '777-3', display: 'Platelet count', unit: 'K/uL', ucumCode: '10*3/uL', normalMin: 150, normalMax: 400, precision: 0 },
  ],
  TSH: [
    { code: '3016-3', display: 'TSH', unit: 'mIU/L', ucumCode: 'mIU/L', normalMin: 0.4, normalMax: 4.0, precision: 2 },
  ],
};

// ---------------------------------------------------------------------------
// Allergy reference data
// ---------------------------------------------------------------------------

interface AllergyDef {
  code: string;
  display: string;
  system: string;
  category: string;
  criticality: string;
  reactions: { substance: string; manifestation: string; severity: string }[];
}

const ALLERGIES: AllergyDef[] = [
  {
    code: '7980', display: 'Penicillin', system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    category: 'medication', criticality: 'high',
    reactions: [{ substance: 'Penicillin', manifestation: 'Anaphylaxis', severity: 'severe' }],
  },
  {
    code: '2670', display: 'Codeine', system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    category: 'medication', criticality: 'low',
    reactions: [{ substance: 'Codeine', manifestation: 'Nausea and vomiting', severity: 'mild' }],
  },
  {
    code: '1191', display: 'Aspirin', system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    category: 'medication', criticality: 'high',
    reactions: [{ substance: 'Aspirin', manifestation: 'Bronchospasm', severity: 'severe' }],
  },
  {
    code: '70618', display: 'Sulfonamide', system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    category: 'medication', criticality: 'low',
    reactions: [{ substance: 'Sulfonamide antibiotics', manifestation: 'Skin rash', severity: 'moderate' }],
  },
  {
    code: '4053', display: 'Ibuprofen', system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    category: 'medication', criticality: 'low',
    reactions: [{ substance: 'Ibuprofen', manifestation: 'Gastrointestinal upset', severity: 'mild' }],
  },
  {
    code: '102263004', display: 'Latex', system: 'http://snomed.info/sct',
    category: 'environment', criticality: 'high',
    reactions: [{ substance: 'Latex', manifestation: 'Urticaria', severity: 'moderate' }],
  },
  {
    code: '91935009', display: 'Peanut', system: 'http://snomed.info/sct',
    category: 'food', criticality: 'high',
    reactions: [{ substance: 'Peanut protein', manifestation: 'Anaphylaxis', severity: 'severe' }],
  },
  {
    code: '291235007', display: 'Shellfish', system: 'http://snomed.info/sct',
    category: 'food', criticality: 'low',
    reactions: [{ substance: 'Shellfish', manifestation: 'Urticaria and angioedema', severity: 'moderate' }],
  },
  {
    code: '418689008', display: 'Bee venom', system: 'http://snomed.info/sct',
    category: 'environment', criticality: 'high',
    reactions: [{ substance: 'Bee venom', manifestation: 'Anaphylaxis', severity: 'severe' }],
  },
  {
    code: '232350006', display: 'Dust mite', system: 'http://snomed.info/sct',
    category: 'environment', criticality: 'low',
    reactions: [{ substance: 'Dust mite', manifestation: 'Rhinitis', severity: 'mild' }],
  },
];

// ---------------------------------------------------------------------------
// Helper: find encounters for a patient
// ---------------------------------------------------------------------------
function getPatientEncounters(
  encounters: GeneratedEncounter[],
  patientId: string,
): GeneratedEncounter[] {
  return encounters.filter(e => e.patientId === patientId && e.status === 'finished');
}

// ---------------------------------------------------------------------------
// Main seeder
// ---------------------------------------------------------------------------

export async function seedClinicalData(
  trx: Knex.Transaction,
  patients: GeneratedPatients,
  encounters: GeneratedEncounter[],
  users: GeneratedUsers,
  rng: SeededRNG,
): Promise<void> {
  const now = new Date().toISOString();

  // Build encounter lookup by patient
  const encountersByPatient = new Map<string, GeneratedEncounter[]>();
  for (const enc of encounters) {
    const arr = encountersByPatient.get(enc.patientId) || [];
    arr.push(enc);
    encountersByPatient.set(enc.patientId, arr);
  }

  // ----- CONDITIONS -----
  const conditionRows: Record<string, unknown>[] = [];

  for (const patient of patients.patients) {
    const profile = CLINICAL_PROFILES[patient.profile];
    const patientEncounters = getPatientEncounters(encounters, patient.id);
    if (patientEncounters.length === 0) continue;

    // Primary condition codes from profile
    let codesToAssign = [...profile.conditionCodes];

    // For HEALTHY patients, assign 0-2 random minor conditions
    if (patient.profile === 'HEALTHY') {
      const healthyConditions = CONDITIONS.filter(c => c.profile.includes('HEALTHY'));
      const numConditions = rng.randomInt(0, 2);
      const picked = rng.pickN(healthyConditions, numConditions);
      codesToAssign = picked.map(c => c.code);
    }

    for (const codeStr of codesToAssign) {
      const condDef = CONDITIONS.find(c => c.code === codeStr);
      if (!condDef) continue;

      const encounter = rng.pick(patientEncounters);
      const isResolved = rng.chance(0.15);

      conditionRows.push({
        id: crypto.randomUUID(),
        patient_id: patient.id,
        encounter_id: encounter.id,
        fhir_id: null,
        clinical_status: isResolved ? 'resolved' : 'active',
        verification_status: 'confirmed',
        category: rng.chance(0.7) ? 'problem-list-item' : 'encounter-diagnosis',
        severity_code: null,
        severity_display: null,
        code_system: condDef.system,
        code_code: condDef.code,
        code_display: condDef.display,
        body_site: null,
        onset_date_time: encounter.periodStart,
        abatement_date_time: isResolved ? (encounter.periodEnd || now) : null,
        recorded_date: encounter.periodStart,
        recorder_id: encounter.providerId,
        evidence: JSON.stringify([]),
        note: null,
        created_at: now,
        updated_at: now,
      });
    }
  }

  await batchInsert(trx, 'conditions', conditionRows);
  console.log(`  - conditions: ${conditionRows.length} rows`);

  // ----- OBSERVATIONS - VITALS -----
  const vitalRows: Record<string, unknown>[] = [];

  for (const enc of encounters) {
    // Only generate vitals for finished or in-progress encounters
    if (enc.status === 'cancelled' || enc.status === 'planned') continue;

    const patient = patients.patientMap.get(enc.patientId);
    if (!patient) continue;

    const profile = CLINICAL_PROFILES[patient.profile];
    const vitalAdj = profile.vitalAdjustments || {};

    for (const vital of VITAL_SIGNS) {
      let value: number;
      let min = vital.normalMin;
      let max = vital.normalMax;

      // Apply profile-specific adjustments
      if (vital.code === '8480-6' && vitalAdj.systolicOffset) {
        min += vitalAdj.systolicOffset;
        max += vitalAdj.systolicOffset;
      } else if (vital.code === '8462-4' && vitalAdj.diastolicOffset) {
        min += vitalAdj.diastolicOffset;
        max += vitalAdj.diastolicOffset;
      } else if (vital.code === '29463-7' && vitalAdj.bmiRange) {
        // Approximate weight from BMI range (assume avg height 170cm)
        const bmi = rng.randomInt(vitalAdj.bmiRange.min * 10, vitalAdj.bmiRange.max * 10) / 10;
        min = bmi * 1.7 * 1.7 / 10 * 3; // rough approximation
        max = min + 15;
      }

      // Add some natural variation
      const range = max - min;
      value = min + rng.random() * range;

      // Glucose multiplier for diabetics
      if (vital.code === '2345-7' && vitalAdj.glucoseMultiplier) {
        // Handled in labs, skip in vitals (no glucose vital sign)
      }

      // Round appropriately
      if (vital.unit === 'degF') {
        value = Math.round(value * 10) / 10;
      } else {
        value = Math.round(value);
      }

      // Determine interpretation
      let interpCode: string | null = null;
      let interpDisplay: string | null = null;
      if (value < vital.normalMin) {
        interpCode = 'L';
        interpDisplay = 'Low';
      } else if (value > vital.normalMax) {
        interpCode = 'H';
        interpDisplay = 'High';
      } else {
        interpCode = 'N';
        interpDisplay = 'Normal';
      }

      vitalRows.push({
        id: crypto.randomUUID(),
        patient_id: enc.patientId,
        encounter_id: enc.id,
        fhir_id: null,
        status: 'final',
        category_code: 'vital-signs',
        category_display: 'Vital Signs',
        code_system: 'http://loinc.org',
        code_code: vital.code,
        code_display: vital.display,
        effective_date_time: enc.periodStart,
        issued: enc.periodStart,
        value_quantity_value: value,
        value_quantity_unit: vital.unit,
        value_quantity_system: 'http://unitsofmeasure.org',
        value_quantity_code: vital.ucumCode,
        value_codeable_concept: null,
        value_string: null,
        value_boolean: null,
        interpretation_code: interpCode,
        interpretation_display: interpDisplay,
        reference_range_low: vital.normalMin,
        reference_range_high: vital.normalMax,
        reference_range_unit: vital.unit,
        reference_range_text: `${vital.normalMin}-${vital.normalMax} ${vital.unit}`,
        component: JSON.stringify([]),
        note: null,
        performer_id: enc.providerId,
        device_id: null,
        created_at: now,
        updated_at: now,
      });
    }
  }

  await batchInsert(trx, 'observations', vitalRows);
  console.log(`  - observations (vitals): ${vitalRows.length} rows`);

  // ----- OBSERVATIONS - LABS -----
  const labRows: Record<string, unknown>[] = [];

  for (const patient of patients.patients) {
    const profile = CLINICAL_PROFILES[patient.profile];
    if (profile.labPanels.length === 0) continue;

    const patientEncounters = getPatientEncounters(encounters, patient.id);
    if (patientEncounters.length === 0) continue;

    // Determine how many lab sets to generate based on frequency
    const dateStart = new Date(SEED_CONFIG.DATE_RANGE_START);
    const dateEnd = new Date(SEED_CONFIG.DATE_RANGE_END);
    const totalDays = (dateEnd.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24);
    const freqDays = profile.labFrequencyDays || 365;
    const labSets = freqDays > 0 ? Math.max(1, Math.floor(totalDays / freqDays)) : 1;

    for (let labIdx = 0; labIdx < labSets; labIdx++) {
      const encounter = patientEncounters[labIdx % patientEncounters.length];

      for (const panelName of profile.labPanels) {
        const panel = LAB_PANELS[panelName];
        if (!panel) continue;

        for (const test of panel) {
          let value: number;
          let min = test.normalMin;
          let max = test.normalMax;

          // Profile-specific lab adjustments
          if (patient.profile === 'DIABETIC') {
            if (test.code === '4548-4') {
              // A1C for diabetics: 5.8-12.0, avg ~7.5
              min = 5.8;
              max = 12.0;
              value = 5.8 + rng.random() * 6.2;
              // Bias toward 7.5 (use normal-ish distribution)
              value = 5.8 + Math.abs(rng.random() + rng.random() - 1) * 6.2;
              value = Math.min(12.0, Math.max(5.8, value));
            } else if (test.code === '2345-7') {
              // Glucose: elevated
              min = 90;
              max = 250;
              value = min + rng.random() * (max - min);
            } else {
              value = min + rng.random() * (max - min);
            }
          } else if (patient.profile === 'CARDIAC') {
            if (test.code === '13457-7') {
              // LDL elevated before treatment
              min = 100;
              max = 190;
              value = min + rng.random() * (max - min);
            } else if (test.code === '2093-3') {
              // Total cholesterol elevated
              min = 180;
              max = 280;
              value = min + rng.random() * (max - min);
            } else {
              value = min + rng.random() * (max - min);
            }
          } else {
            value = min + rng.random() * (max - min);
          }

          // Round to specified precision
          const factor = Math.pow(10, test.precision);
          value = Math.round(value * factor) / factor;

          // Interpretation
          let interpCode: string | null = null;
          let interpDisplay: string | null = null;
          if (value < test.normalMin) {
            interpCode = 'L';
            interpDisplay = 'Low';
          } else if (value > test.normalMax) {
            interpCode = 'H';
            interpDisplay = 'High';
          } else {
            interpCode = 'N';
            interpDisplay = 'Normal';
          }

          labRows.push({
            id: crypto.randomUUID(),
            patient_id: patient.id,
            encounter_id: encounter.id,
            fhir_id: null,
            status: 'final',
            category_code: 'laboratory',
            category_display: 'Laboratory',
            code_system: 'http://loinc.org',
            code_code: test.code,
            code_display: test.display,
            effective_date_time: encounter.periodStart,
            issued: encounter.periodStart,
            value_quantity_value: value,
            value_quantity_unit: test.unit,
            value_quantity_system: 'http://unitsofmeasure.org',
            value_quantity_code: test.ucumCode,
            value_codeable_concept: null,
            value_string: null,
            value_boolean: null,
            interpretation_code: interpCode,
            interpretation_display: interpDisplay,
            reference_range_low: test.normalMin,
            reference_range_high: test.normalMax,
            reference_range_unit: test.unit,
            reference_range_text: `${test.normalMin}-${test.normalMax} ${test.unit}`,
            component: JSON.stringify([]),
            note: null,
            performer_id: encounter.providerId,
            device_id: null,
            created_at: now,
            updated_at: now,
          });
        }
      }
    }
  }

  await batchInsert(trx, 'observations', labRows);
  console.log(`  - observations (labs): ${labRows.length} rows`);

  // ----- ALLERGIES -----
  const allergyRows: Record<string, unknown>[] = [];

  for (const patient of patients.patients) {
    const profile = CLINICAL_PROFILES[patient.profile];
    const patientEncounters = getPatientEncounters(encounters, patient.id);
    if (patientEncounters.length === 0) continue;

    if (!rng.chance(profile.allergyProbability)) {
      // NKDA - No known drug allergies (explicit record)
      if (rng.chance(0.25)) {
        const encounter = rng.pick(patientEncounters);
        allergyRows.push({
          id: crypto.randomUUID(),
          patient_id: patient.id,
          fhir_id: null,
          clinical_status: 'active',
          verification_status: 'confirmed',
          type: null,
          category: null,
          criticality: null,
          code_system: 'http://snomed.info/sct',
          code_code: '716186003',
          code_display: 'No known allergy',
          onset_date_time: null,
          recorded_date: encounter.periodStart,
          recorder_id: encounter.providerId,
          reactions: JSON.stringify([]),
          note: 'No known allergies',
          created_at: now,
          updated_at: now,
        });
      }
      continue;
    }

    // Patient has allergies
    const allergyCount = Math.max(1, Math.round(profile.avgAllergyCount + (rng.random() - 0.5) * 2));
    const selectedAllergies = rng.pickN(ALLERGIES, allergyCount);

    for (const allergy of selectedAllergies) {
      const encounter = rng.pick(patientEncounters);
      allergyRows.push({
        id: crypto.randomUUID(),
        patient_id: patient.id,
        fhir_id: null,
        clinical_status: rng.chance(0.9) ? 'active' : 'resolved',
        verification_status: 'confirmed',
        type: 'allergy',
        category: allergy.category,
        criticality: allergy.criticality,
        code_system: allergy.system,
        code_code: allergy.code,
        code_display: allergy.display,
        onset_date_time: encounter.periodStart,
        recorded_date: encounter.periodStart,
        recorder_id: encounter.providerId,
        reactions: JSON.stringify(allergy.reactions.map(r => ({
          substance: { text: r.substance },
          manifestation: [{ text: r.manifestation }],
          severity: r.severity,
        }))),
        note: null,
        created_at: now,
        updated_at: now,
      });
    }
  }

  await batchInsert(trx, 'allergy_intolerances', allergyRows);
  console.log(`  - allergy_intolerances: ${allergyRows.length} rows`);

  // ----- MEDICATIONS -----
  const medRows: Record<string, unknown>[] = [];

  for (const patient of patients.patients) {
    const profile = CLINICAL_PROFILES[patient.profile];
    const patientEncounters = getPatientEncounters(encounters, patient.id);
    if (patientEncounters.length === 0) continue;

    // Get medication codes from profile
    let medCodes = [...profile.medicationCodes];

    // For HEALTHY patients, assign 0-2 random mild medications
    if (patient.profile === 'HEALTHY' && medCodes.length === 0) {
      const mildMeds = MEDICATIONS.filter(m =>
        m.conditions.some(c => ['I10', 'K21.0', 'E03.9', 'M54.5'].includes(c))
      );
      const numMeds = rng.randomInt(0, 2);
      const picked = rng.pickN(mildMeds, numMeds);
      medCodes = picked.map(m => m.code);
    }

    for (const medCode of medCodes) {
      const medDef = MEDICATIONS.find(m => m.code === medCode);
      if (!medDef) continue;

      const encounter = rng.pick(patientEncounters);
      const isActive = rng.chance(0.80);

      medRows.push({
        id: crypto.randomUUID(),
        patient_id: patient.id,
        encounter_id: encounter.id,
        fhir_id: null,
        status: isActive ? 'active' : 'completed',
        intent: 'order',
        medication_code_system: medDef.system,
        medication_code_code: medDef.code,
        medication_code_display: medDef.display,
        authored_on: encounter.periodStart,
        requester_id: encounter.providerId,
        dosage_instruction: JSON.stringify([{
          text: `${medDef.dosage} ${medDef.route} ${medDef.frequency}`,
          timing: { repeat: { frequency: 1, period: 1, periodUnit: 'd' } },
          route: { text: medDef.route },
          dose_and_rate: [{ dose_quantity: { value: parseFloat(medDef.dosage) || 1, unit: medDef.dosage.replace(/[0-9.\s]/g, '') || 'dose' } }],
        }]),
        dispense_request: JSON.stringify({
          quantity: { value: 30, unit: 'tablets' },
          expected_supply_duration: { value: 30, unit: 'days' },
          number_of_repeats_allowed: 3,
        }),
        substitution: JSON.stringify({ allowed: true }),
        prior_prescription_id: null,
        note: null,
        created_at: now,
        updated_at: now,
      });
    }
  }

  await batchInsert(trx, 'medication_requests', medRows);
  console.log(`  - medication_requests: ${medRows.length} rows`);
}
