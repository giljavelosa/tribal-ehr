import { Knex } from 'knex';
import crypto from 'crypto';
import { SeededRNG, batchInsert } from '../utils';
import { CLINICAL_PROFILES } from '../profiles/clinical-profiles';
import { GeneratedPatients } from './patients';
import { GeneratedEncounter } from './encounters';
import { GeneratedUsers } from './users';

// ---------------------------------------------------------------------------
// Procedure code definitions (CPT)
// ---------------------------------------------------------------------------

interface ProcedureDef {
  code: string;
  display: string;
  system: string;
}

const PROCEDURE_DEFS: Record<string, ProcedureDef> = {
  '99213': { code: '99213', display: 'Office/outpatient visit, established patient, low complexity', system: 'http://www.ama-assn.org/go/cpt' },
  '99214': { code: '99214', display: 'Office/outpatient visit, established patient, moderate complexity', system: 'http://www.ama-assn.org/go/cpt' },
  '36415': { code: '36415', display: 'Venipuncture for collection of specimen(s)', system: 'http://www.ama-assn.org/go/cpt' },
  '93000': { code: '93000', display: 'Electrocardiogram, routine, with interpretation and report', system: 'http://www.ama-assn.org/go/cpt' },
  '93306': { code: '93306', display: 'Echocardiography, transthoracic, complete', system: 'http://www.ama-assn.org/go/cpt' },
  '47562': { code: '47562', display: 'Laparoscopic cholecystectomy', system: 'http://www.ama-assn.org/go/cpt' },
  '27447': { code: '27447', display: 'Total knee arthroplasty', system: 'http://www.ama-assn.org/go/cpt' },
  '49505': { code: '49505', display: 'Repair initial inguinal hernia, age 5 or older', system: 'http://www.ama-assn.org/go/cpt' },
  '44970': { code: '44970', display: 'Laparoscopic appendectomy', system: 'http://www.ama-assn.org/go/cpt' },
  '71046': { code: '71046', display: 'Chest X-ray, 2 views', system: 'http://www.ama-assn.org/go/cpt' },
  '90471': { code: '90471', display: 'Immunization administration', system: 'http://www.ama-assn.org/go/cpt' },
};

// ---------------------------------------------------------------------------
// Order definitions for generating orders
// ---------------------------------------------------------------------------

interface OrderDef {
  type: 'medication' | 'laboratory' | 'imaging';
  code: string;
  display: string;
  system: string;
  indication: string;
}

const ORDER_DEFS: OrderDef[] = [
  // Medication orders
  { type: 'medication', code: '860975', display: 'Metformin 500 MG Oral Tablet', system: 'http://www.nlm.nih.gov/research/umls/rxnorm', indication: 'Type 2 diabetes management' },
  { type: 'medication', code: '314076', display: 'Lisinopril 10 MG Oral Tablet', system: 'http://www.nlm.nih.gov/research/umls/rxnorm', indication: 'Hypertension management' },
  { type: 'medication', code: '197361', display: 'Amlodipine 5 MG Oral Tablet', system: 'http://www.nlm.nih.gov/research/umls/rxnorm', indication: 'Blood pressure control' },
  { type: 'medication', code: '312938', display: 'Sertraline 50 MG Oral Tablet', system: 'http://www.nlm.nih.gov/research/umls/rxnorm', indication: 'Depression treatment' },
  { type: 'medication', code: '197696', display: 'Ibuprofen 400 MG Oral Tablet', system: 'http://www.nlm.nih.gov/research/umls/rxnorm', indication: 'Pain management' },
  { type: 'medication', code: '308182', display: 'Amoxicillin 500 MG Oral Capsule', system: 'http://www.nlm.nih.gov/research/umls/rxnorm', indication: 'Infection treatment' },
  // Laboratory orders
  { type: 'laboratory', code: '4548-4', display: 'Hemoglobin A1c Panel', system: 'http://loinc.org', indication: 'Diabetes monitoring' },
  { type: 'laboratory', code: '24323-8', display: 'Comprehensive Metabolic Panel', system: 'http://loinc.org', indication: 'Metabolic evaluation' },
  { type: 'laboratory', code: '57021-8', display: 'CBC with Differential', system: 'http://loinc.org', indication: 'Routine blood work' },
  { type: 'laboratory', code: '24331-1', display: 'Lipid Panel', system: 'http://loinc.org', indication: 'Cardiovascular risk assessment' },
  { type: 'laboratory', code: '3016-3', display: 'TSH Level', system: 'http://loinc.org', indication: 'Thyroid function evaluation' },
  { type: 'laboratory', code: '24356-8', display: 'Urinalysis Complete', system: 'http://loinc.org', indication: 'UTI screening' },
  // Imaging orders
  { type: 'imaging', code: '71046', display: 'Chest X-ray 2 Views', system: 'http://www.ama-assn.org/go/cpt', indication: 'Pulmonary evaluation' },
  { type: 'imaging', code: '70553', display: 'MRI Brain without contrast', system: 'http://www.ama-assn.org/go/cpt', indication: 'Neurological evaluation' },
  { type: 'imaging', code: '74177', display: 'CT Abdomen/Pelvis with contrast', system: 'http://www.ama-assn.org/go/cpt', indication: 'Abdominal pain evaluation' },
  { type: 'imaging', code: '73721', display: 'MRI Knee without contrast', system: 'http://www.ama-assn.org/go/cpt', indication: 'Knee pain evaluation' },
  { type: 'imaging', code: '76856', display: 'Ultrasound Pelvis Complete', system: 'http://www.ama-assn.org/go/cpt', indication: 'Pelvic evaluation' },
];

export async function seedProceduresAndOrders(
  trx: Knex.Transaction,
  patients: GeneratedPatients,
  encounters: GeneratedEncounter[],
  users: GeneratedUsers,
  rng: SeededRNG,
): Promise<void> {
  const now = new Date().toISOString();

  // ----- PROCEDURES -----
  const procedureRows: Record<string, unknown>[] = [];

  for (const patient of patients.patients) {
    const profile = CLINICAL_PROFILES[patient.profile];
    if (profile.procedureCodes.length === 0) continue;

    const finishedEnc = encounters.filter(
      e => e.patientId === patient.id && e.status === 'finished',
    );
    if (finishedEnc.length === 0) continue;

    // Each patient gets 1-2 of their profile procedures across encounters
    const numProcedures = Math.min(
      rng.randomInt(1, 2),
      profile.procedureCodes.length,
    );
    const selectedCodes = rng.pickN(profile.procedureCodes, numProcedures);

    for (const code of selectedCodes) {
      const procDef = PROCEDURE_DEFS[code];
      if (!procDef) continue;

      const encounter = rng.pick(finishedEnc);
      const isCurrent = encounter.periodEnd === null;

      procedureRows.push({
        id: crypto.randomUUID(),
        patient_id: patient.id,
        encounter_id: encounter.id,
        fhir_id: null,
        status: isCurrent ? 'in-progress' : 'completed',
        code_system: procDef.system,
        code_code: procDef.code,
        code_display: procDef.display,
        performed_date_time: encounter.periodStart,
        performed_period_start: encounter.periodStart,
        performed_period_end: encounter.periodEnd || null,
        recorder_id: encounter.providerId,
        performer: JSON.stringify([{
          actor: { reference: `Practitioner/${encounter.providerId}` },
          function: { text: 'Primary performer' },
        }]),
        location_id: null,
        reason_code: JSON.stringify([]),
        body_site: null,
        outcome: encounter.periodEnd
          ? JSON.stringify({ text: 'Successful' })
          : null,
        report: JSON.stringify([]),
        complication: JSON.stringify([]),
        note: null,
        created_at: now,
        updated_at: now,
      });
    }
  }

  await batchInsert(trx, 'procedures', procedureRows);
  console.log(`  - procedures: ${procedureRows.length} rows`);

  // ----- ORDERS -----
  const orderRows: Record<string, unknown>[] = [];

  // Group encounters that are not cancelled
  const activeEncounters = encounters.filter(e => e.status !== 'cancelled');

  for (const enc of activeEncounters) {
    const numOrders = rng.randomInt(1, 3);

    for (let o = 0; o < numOrders; o++) {
      const orderDef = rng.pick(ORDER_DEFS);
      const providerId = enc.providerId;

      // Determine status based on encounter status
      let orderStatus: string;
      if (enc.status === 'finished') {
        orderStatus = rng.chance(0.85) ? 'completed' : 'active';
      } else if (enc.status === 'in-progress') {
        orderStatus = rng.chance(0.5) ? 'active' : 'pending';
      } else {
        // planned encounters
        orderStatus = 'pending';
      }

      // Determine priority
      let priority: string;
      const prioRoll = rng.random();
      if (prioRoll < 0.80) {
        priority = 'routine';
      } else if (prioRoll < 0.93) {
        priority = 'urgent';
      } else {
        priority = 'stat';
      }

      // Signing: completed and some active orders are signed
      const isSigned = orderStatus === 'completed' || (orderStatus === 'active' && rng.chance(0.6));
      const signedById = isSigned ? providerId : null;
      const signedAt = isSigned ? enc.periodStart : null;

      orderRows.push({
        id: crypto.randomUUID(),
        patient_id: enc.patientId,
        encounter_id: enc.id,
        fhir_id: null,
        order_type: orderDef.type,
        status: orderStatus,
        priority,
        code_system: orderDef.system,
        code_code: orderDef.code,
        code_display: orderDef.display,
        clinical_indication: orderDef.indication,
        ordered_by_id: providerId,
        ordered_at: enc.periodStart,
        signed_by_id: signedById,
        signed_at: signedAt,
        details: JSON.stringify({
          category: orderDef.type,
          instructions: orderDef.type === 'laboratory' ? 'Fasting specimen preferred' : null,
        }),
        results: JSON.stringify(
          orderStatus === 'completed' && orderDef.type === 'laboratory'
            ? [{ status: 'final', date: enc.periodEnd || enc.periodStart }]
            : [],
        ),
        notes: null,
        created_at: now,
        updated_at: now,
      });
    }
  }

  await batchInsert(trx, 'orders', orderRows);
  console.log(`  - orders: ${orderRows.length} rows`);
}
