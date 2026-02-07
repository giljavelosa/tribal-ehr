#!/usr/bin/env node
/**
 * Demo Data Seeder for Tribal EHR
 * Generates 500+ patients with realistic clinical data including:
 * - Lab results (CBC, CMP, Lipid Panel, A1C, Urinalysis, etc.)
 * - Imaging studies (X-ray, CT, MRI, Ultrasound)
 * - Operative/Procedure reports
 * - Clinical encounters and notes
 */

const crypto = require('crypto');

// Configuration
const NUM_PATIENTS = 500;
const MRN_OFFSET = 500; // Offset for new batch
const ENCOUNTERS_PER_PATIENT = { min: 2, max: 8 };

// Provider IDs from the database
const PROVIDER_IDS = [
  'f32a7822-ee48-4b30-b0b0-770efa3e61e9',
  'fc430ff4-711e-45dc-80c8-0a0cadd85586',
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000005',
];

const NURSE_IDS = [
  'd1605dae-0645-4e95-a714-376614c43207',
  '20000000-0000-0000-0000-000000000101',
  '20000000-0000-0000-0000-000000000102',
  '20000000-0000-0000-0000-000000000103',
];

// Native American inspired names (fictional, respectful)
const FIRST_NAMES_MALE = [
  'James', 'Michael', 'David', 'Robert', 'John', 'William', 'Richard', 'Joseph',
  'Thomas', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Steven',
  'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Timothy',
  'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas',
  'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin',
  'Samuel', 'Raymond', 'Gregory', 'Frank', 'Alexander', 'Patrick', 'Jack', 'Dennis',
  'Jerry', 'Tyler', 'Aaron', 'Jose', 'Adam', 'Nathan', 'Henry', 'Douglas', 'Zachary',
  'Peter', 'Kyle', 'Noah', 'Ethan', 'Jeremy', 'Walter', 'Christian', 'Keith',
];

const FIRST_NAMES_FEMALE = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica',
  'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley',
  'Kimberly', 'Emily', 'Donna', 'Michelle', 'Dorothy', 'Carol', 'Amanda', 'Melissa',
  'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia', 'Kathleen', 'Amy',
  'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela', 'Emma', 'Nicole', 'Helen',
  'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Carolyn', 'Janet', 'Catherine',
  'Maria', 'Heather', 'Diane', 'Ruth', 'Julie', 'Olivia', 'Joyce', 'Virginia',
  'Victoria', 'Kelly', 'Lauren', 'Christina', 'Joan', 'Evelyn', 'Judith', 'Megan',
];

const LAST_NAMES = [
  'Whitehorse', 'Blackbear', 'Redhawk', 'Standingbear', 'Runningdeer', 'Littlefeather',
  'Eaglefeather', 'Thunderhawk', 'Morningstar', 'Silvercloud', 'Strongbow', 'Swiftwater',
  'Greywolf', 'Sunflower', 'Bluejay', 'Tallchief', 'Brightwater', 'Clearsky',
  'Windwalker', 'Stonecrow', 'Ironhawk', 'Raindrop', 'Riverbend', 'Meadowlark',
  'Pineleaf', 'Cedarwood', 'Wildrose', 'Snowbird', 'Foxrun', 'Birdsong',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill',
  'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell',
];

// Common conditions for tribal health context
const CONDITIONS = [
  { code: 'E11.9', display: 'Type 2 diabetes mellitus without complications', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'I10', display: 'Essential (primary) hypertension', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'E78.5', display: 'Hyperlipidemia, unspecified', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'J06.9', display: 'Acute upper respiratory infection', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'M54.5', display: 'Low back pain', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'F32.9', display: 'Major depressive disorder, single episode', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'F41.1', display: 'Generalized anxiety disorder', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'K21.0', display: 'Gastro-esophageal reflux disease', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'J45.909', display: 'Unspecified asthma, uncomplicated', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'M79.3', display: 'Panniculitis, unspecified', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'E66.9', display: 'Obesity, unspecified', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'G43.909', display: 'Migraine, unspecified', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'N39.0', display: 'Urinary tract infection', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'L30.9', display: 'Dermatitis, unspecified', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'M25.50', display: 'Pain in unspecified joint', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
];

// Lab panels with LOINC codes
const LAB_PANELS = {
  CBC: [
    { code: '6690-2', display: 'WBC', unit: '10*3/uL', min: 4.5, max: 11.0, refLow: 4.5, refHigh: 11.0 },
    { code: '789-8', display: 'RBC', unit: '10*6/uL', min: 4.0, max: 6.0, refLow: 4.2, refHigh: 5.9 },
    { code: '718-7', display: 'Hemoglobin', unit: 'g/dL', min: 11.0, max: 17.5, refLow: 12.0, refHigh: 17.5 },
    { code: '4544-3', display: 'Hematocrit', unit: '%', min: 35, max: 52, refLow: 36, refHigh: 50 },
    { code: '787-2', display: 'MCV', unit: 'fL', min: 78, max: 100, refLow: 80, refHigh: 100 },
    { code: '785-6', display: 'MCH', unit: 'pg', min: 25, max: 35, refLow: 27, refHigh: 33 },
    { code: '786-4', display: 'MCHC', unit: 'g/dL', min: 31, max: 37, refLow: 32, refHigh: 36 },
    { code: '777-3', display: 'Platelet Count', unit: '10*3/uL', min: 140, max: 440, refLow: 150, refHigh: 400 },
  ],
  CMP: [
    { code: '2345-7', display: 'Glucose', unit: 'mg/dL', min: 65, max: 200, refLow: 70, refHigh: 100 },
    { code: '3094-0', display: 'BUN', unit: 'mg/dL', min: 5, max: 30, refLow: 7, refHigh: 20 },
    { code: '2160-0', display: 'Creatinine', unit: 'mg/dL', min: 0.5, max: 2.0, refLow: 0.7, refHigh: 1.3 },
    { code: '17861-6', display: 'Calcium', unit: 'mg/dL', min: 8.2, max: 10.8, refLow: 8.5, refHigh: 10.5 },
    { code: '2951-2', display: 'Sodium', unit: 'mEq/L', min: 132, max: 148, refLow: 136, refHigh: 145 },
    { code: '2823-3', display: 'Potassium', unit: 'mEq/L', min: 3.2, max: 5.5, refLow: 3.5, refHigh: 5.0 },
    { code: '2075-0', display: 'Chloride', unit: 'mEq/L', min: 95, max: 110, refLow: 98, refHigh: 106 },
    { code: '2028-9', display: 'CO2', unit: 'mEq/L', min: 19, max: 32, refLow: 22, refHigh: 29 },
    { code: '1751-7', display: 'Albumin', unit: 'g/dL', min: 3.0, max: 5.0, refLow: 3.5, refHigh: 5.0 },
    { code: '2885-2', display: 'Total Protein', unit: 'g/dL', min: 5.5, max: 8.5, refLow: 6.0, refHigh: 8.3 },
    { code: '1920-8', display: 'AST', unit: 'U/L', min: 8, max: 80, refLow: 10, refHigh: 40 },
    { code: '1742-6', display: 'ALT', unit: 'U/L', min: 5, max: 80, refLow: 7, refHigh: 56 },
    { code: '1975-2', display: 'Total Bilirubin', unit: 'mg/dL', min: 0.1, max: 2.0, refLow: 0.1, refHigh: 1.2 },
    { code: '6768-6', display: 'Alkaline Phosphatase', unit: 'U/L', min: 30, max: 150, refLow: 44, refHigh: 147 },
  ],
  LIPID: [
    { code: '2093-3', display: 'Total Cholesterol', unit: 'mg/dL', min: 120, max: 300, refLow: 0, refHigh: 200 },
    { code: '2571-8', display: 'Triglycerides', unit: 'mg/dL', min: 40, max: 400, refLow: 0, refHigh: 150 },
    { code: '2085-9', display: 'HDL Cholesterol', unit: 'mg/dL', min: 25, max: 90, refLow: 40, refHigh: 999 },
    { code: '13457-7', display: 'LDL Cholesterol (calculated)', unit: 'mg/dL', min: 40, max: 220, refLow: 0, refHigh: 100 },
  ],
  A1C: [
    { code: '4548-4', display: 'Hemoglobin A1c', unit: '%', min: 4.5, max: 14.0, refLow: 4.0, refHigh: 5.6 },
  ],
  TSH: [
    { code: '3016-3', display: 'TSH', unit: 'mIU/L', min: 0.2, max: 8.0, refLow: 0.4, refHigh: 4.0 },
  ],
  URINALYSIS: [
    { code: '5811-5', display: 'Specific Gravity', unit: '', min: 1.001, max: 1.035, refLow: 1.005, refHigh: 1.030 },
    { code: '2756-5', display: 'pH', unit: '', min: 4.5, max: 8.5, refLow: 5.0, refHigh: 8.0 },
  ],
};

// Imaging studies
const IMAGING_TYPES = [
  { code: '36643-5', display: 'Chest X-ray', category: 'radiology', modality: 'XR' },
  { code: '24725-4', display: 'CT Head without contrast', category: 'radiology', modality: 'CT' },
  { code: '24558-9', display: 'CT Abdomen/Pelvis with contrast', category: 'radiology', modality: 'CT' },
  { code: '24566-2', display: 'MRI Brain without contrast', category: 'radiology', modality: 'MR' },
  { code: '24590-2', display: 'MRI Lumbar Spine', category: 'radiology', modality: 'MR' },
  { code: '46342-2', display: 'Ultrasound Abdomen', category: 'radiology', modality: 'US' },
  { code: '42272-5', display: 'Mammogram Bilateral', category: 'radiology', modality: 'MG' },
  { code: '24531-6', display: 'X-ray Knee', category: 'radiology', modality: 'XR' },
  { code: '24648-8', display: 'X-ray Lumbar Spine', category: 'radiology', modality: 'XR' },
  { code: '30746-2', display: 'DEXA Bone Density', category: 'radiology', modality: 'DX' },
  { code: '24627-2', display: 'Echocardiogram', category: 'cardiology', modality: 'US' },
  { code: '18782-3', display: 'EKG 12-lead', category: 'cardiology', modality: 'ECG' },
];

// Procedures with CPT codes
const PROCEDURES = [
  { code: '99213', display: 'Office visit, established patient, level 3', system: 'http://www.ama-assn.org/go/cpt', category: 'visit' },
  { code: '99214', display: 'Office visit, established patient, level 4', system: 'http://www.ama-assn.org/go/cpt', category: 'visit' },
  { code: '99203', display: 'Office visit, new patient, level 3', system: 'http://www.ama-assn.org/go/cpt', category: 'visit' },
  { code: '36415', display: 'Venipuncture', system: 'http://www.ama-assn.org/go/cpt', category: 'procedure' },
  { code: '90471', display: 'Immunization administration', system: 'http://www.ama-assn.org/go/cpt', category: 'procedure' },
  { code: '20610', display: 'Joint injection, major joint', system: 'http://www.ama-assn.org/go/cpt', category: 'procedure' },
  { code: '11042', display: 'Wound debridement', system: 'http://www.ama-assn.org/go/cpt', category: 'procedure' },
  { code: '17000', display: 'Destruction of premalignant lesion', system: 'http://www.ama-assn.org/go/cpt', category: 'procedure' },
  { code: '43239', display: 'Upper GI endoscopy with biopsy', system: 'http://www.ama-assn.org/go/cpt', category: 'surgery' },
  { code: '45378', display: 'Colonoscopy, diagnostic', system: 'http://www.ama-assn.org/go/cpt', category: 'surgery' },
  { code: '47562', display: 'Laparoscopic cholecystectomy', system: 'http://www.ama-assn.org/go/cpt', category: 'surgery' },
  { code: '27447', display: 'Total knee replacement', system: 'http://www.ama-assn.org/go/cpt', category: 'surgery' },
  { code: '27130', display: 'Total hip replacement', system: 'http://www.ama-assn.org/go/cpt', category: 'surgery' },
  { code: '49505', display: 'Inguinal hernia repair', system: 'http://www.ama-assn.org/go/cpt', category: 'surgery' },
  { code: '64483', display: 'Lumbar epidural steroid injection', system: 'http://www.ama-assn.org/go/cpt', category: 'procedure' },
];

// Operative report templates
const OP_REPORT_TEMPLATES = {
  '47562': `OPERATIVE REPORT

PREOPERATIVE DIAGNOSIS: Symptomatic cholelithiasis
POSTOPERATIVE DIAGNOSIS: Same
PROCEDURE: Laparoscopic cholecystectomy

ANESTHESIA: General endotracheal

FINDINGS: Gallbladder with multiple stones, mild chronic cholecystitis

PROCEDURE IN DETAIL:
The patient was brought to the operating room and placed supine on the operating table. General anesthesia was induced. The abdomen was prepped and draped in the usual sterile fashion.

A 12mm infraumbilical incision was made. The fascia was incised and the peritoneum entered. A 12mm trocar was placed and pneumoperitoneum established to 15mmHg. Three additional trocars were placed under direct visualization.

The gallbladder was retracted cephalad. The cystic duct and artery were identified, clipped, and divided. The gallbladder was dissected from the liver bed using electrocautery. Hemostasis was achieved. The gallbladder was placed in an endoscopic bag and removed through the umbilical port.

The operative field was irrigated and aspirated. Hemostasis was confirmed. The trocars were removed under direct visualization. The fascia was closed with absorbable sutures. The skin was closed with subcuticular sutures.

The patient tolerated the procedure well and was transferred to recovery in stable condition.

ESTIMATED BLOOD LOSS: Minimal
SPECIMENS: Gallbladder to pathology
COMPLICATIONS: None`,

  '45378': `COLONOSCOPY REPORT

INDICATION: Colorectal cancer screening, age 50

PROCEDURE: Colonoscopy

SEDATION: Moderate sedation with Midazolam 4mg IV and Fentanyl 100mcg IV

FINDINGS:
Cecum: Reached, appendiceal orifice and ileocecal valve visualized
Ascending colon: Normal
Hepatic flexure: Normal
Transverse colon: Normal
Splenic flexure: Normal
Descending colon: Normal
Sigmoid colon: Normal
Rectum: Normal

IMPRESSION: Normal colonoscopy to the cecum. No polyps, masses, or other abnormalities identified.

RECOMMENDATIONS:
- Repeat screening colonoscopy in 10 years
- Continue high-fiber diet
- Patient educated on warning signs`,

  '27447': `OPERATIVE REPORT

PREOPERATIVE DIAGNOSIS: End-stage osteoarthritis, right knee
POSTOPERATIVE DIAGNOSIS: Same
PROCEDURE: Right total knee arthroplasty

ANESTHESIA: Spinal with sedation

IMPLANTS USED:
- Femoral component: Size Medium, cemented
- Tibial component: Size Medium, cemented
- Polyethylene insert: 10mm
- Patella: 35mm, cemented

PROCEDURE IN DETAIL:
The patient was positioned supine. A thigh tourniquet was applied. The leg was prepped and draped in sterile fashion. A midline incision was made. A medial parapatellar arthrotomy was performed.

The patella was everted and the knee flexed. Osteophytes were removed. The tibial cut was made perpendicular to the mechanical axis using extramedullary guides. The distal femoral cut was made using intramedullary alignment.

Trial components were placed with good alignment and stability through range of motion. The components were cemented in place. The wound was irrigated. A drain was placed. The arthrotomy was closed. Skin was closed in layers.

The patient tolerated the procedure well.

ESTIMATED BLOOD LOSS: 150cc
TOURNIQUET TIME: 78 minutes
COMPLICATIONS: None`,
};

// Imaging report templates
const IMAGING_REPORT_TEMPLATES = {
  'XR': `CHEST X-RAY PA AND LATERAL

CLINICAL INDICATION: {{indication}}

COMPARISON: {{comparison}}

FINDINGS:
Lungs: Clear bilaterally. No focal consolidation, pleural effusion, or pneumothorax.
Heart: Normal size and configuration.
Mediastinum: Normal width. No adenopathy.
Bones: No acute osseous abnormality.

IMPRESSION:
{{impression}}`,

  'CT': `CT {{region}} {{contrast}}

CLINICAL INDICATION: {{indication}}

COMPARISON: {{comparison}}

TECHNIQUE: Multidetector CT of the {{region}} was performed {{contrast_detail}}.

FINDINGS:
{{findings}}

IMPRESSION:
{{impression}}`,

  'MR': `MRI {{region}}

CLINICAL INDICATION: {{indication}}

COMPARISON: {{comparison}}

TECHNIQUE: Multiplanar, multisequence MRI of the {{region}} without contrast.

FINDINGS:
{{findings}}

IMPRESSION:
{{impression}}`,

  'US': `ULTRASOUND {{region}}

CLINICAL INDICATION: {{indication}}

COMPARISON: {{comparison}}

FINDINGS:
{{findings}}

IMPRESSION:
{{impression}}`,
};

// Utility functions
function uuid() {
  return crypto.randomUUID();
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomDate(startYear, endYear) {
  const start = new Date(startYear, 0, 1);
  const end = new Date(endYear, 11, 31);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatTimestamp(date) {
  return date.toISOString();
}

function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function generateMRN(index) {
  return `MRN${String(index + 1001 + (typeof MRN_OFFSET !== 'undefined' ? MRN_OFFSET : 0)).padStart(6, '0')}`;
}

function generateSSN() {
  return `${randomInt(100, 999)}-${randomInt(10, 99)}-${randomInt(1000, 9999)}`;
}

function interpretLabValue(value, refLow, refHigh) {
  if (value < refLow) return { code: 'L', display: 'Low' };
  if (value > refHigh) return { code: 'H', display: 'High' };
  return { code: 'N', display: 'Normal' };
}

// Generate patients
function generatePatients(count) {
  const patients = [];
  const startMRN = 1001;
  
  for (let i = 0; i < count; i++) {
    const isMale = Math.random() > 0.52; // Slight female predominance
    const firstName = randomItem(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE);
    const lastName = randomItem(LAST_NAMES);
    const dob = randomDate(1940, 2020);
    const age = new Date().getFullYear() - dob.getFullYear();
    
    patients.push({
      id: uuid(),
      mrn: generateMRN(i),
      fhir_id: `patient-${uuid()}`,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: formatDate(dob),
      sex: isMale ? 'male' : 'female',
      race: JSON.stringify([randomItem(['American Indian or Alaska Native', 'White', 'Asian', 'Black or African American'])]),
      ethnicity: randomItem(['Not Hispanic or Latino', 'Hispanic or Latino']),
      preferred_language: randomItem(['English', 'English', 'English', 'Spanish', 'Navajo']),
      marital_status: randomItem(['single', 'married', 'divorced', 'widowed']),
      active: true,
      age: age,
    });
  }
  
  return patients;
}

// Generate encounters for a patient
function generateEncounters(patient, numEncounters) {
  const encounters = [];
  const now = new Date();
  
  for (let i = 0; i < numEncounters; i++) {
    const daysAgo = randomInt(1, 730); // Up to 2 years ago
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + randomInt(15, 120) * 60 * 1000); // 15-120 mins
    
    encounters.push({
      id: uuid(),
      patient_id: patient.id,
      fhir_id: `encounter-${uuid()}`,
      status: 'finished',
      class_code: randomItem(['AMB', 'AMB', 'AMB', 'EMER', 'IMP']),
      type_code: randomItem(['99213', '99214', '99203', '99215']),
      type_display: 'Office Visit',
      period_start: formatTimestamp(startDate),
      period_end: formatTimestamp(endDate),
      reason_code: JSON.stringify([randomItem(CONDITIONS)]),
      diagnosis: JSON.stringify([randomItem(CONDITIONS)]),
      participant: JSON.stringify([{ reference: `Practitioner/${randomItem(PROVIDER_IDS)}` }]),
      created_by: randomItem(PROVIDER_IDS),
    });
  }
  
  return encounters.sort((a, b) => new Date(a.period_start) - new Date(b.period_start));
}

// Generate lab observations
function generateLabObs(patient, encounter, panelName) {
  const observations = [];
  const panel = LAB_PANELS[panelName];
  const effectiveDate = new Date(encounter.period_start);
  const performer = randomItem(NURSE_IDS);
  
  for (const test of panel) {
    const value = randomFloat(test.min, test.max, test.code === '5811-5' ? 3 : (test.code === '2756-5' ? 1 : 1));
    const interp = interpretLabValue(value, test.refLow, test.refHigh);
    
    observations.push({
      id: uuid(),
      patient_id: patient.id,
      encounter_id: encounter.id,
      fhir_id: `obs-${uuid()}`,
      status: 'final',
      category_code: 'laboratory',
      category_display: 'Laboratory',
      code_system: 'http://loinc.org',
      code_code: test.code,
      code_display: test.display,
      effective_date_time: formatTimestamp(effectiveDate),
      issued: formatTimestamp(effectiveDate),
      value_quantity_value: value,
      value_quantity_unit: test.unit,
      value_quantity_system: 'http://unitsofmeasure.org',
      value_quantity_code: test.unit,
      interpretation_code: interp.code,
      interpretation_display: interp.display,
      reference_range_low: test.refLow,
      reference_range_high: test.refHigh,
      reference_range_unit: test.unit,
      performer_id: performer,
    });
  }
  
  return observations;
}

// Generate vital signs
function generateVitals(patient, encounter) {
  const observations = [];
  const effectiveDate = new Date(encounter.period_start);
  const performer = randomItem(NURSE_IDS);
  const age = patient.age;
  
  // Blood Pressure
  const systolic = randomInt(age > 60 ? 120 : 100, age > 60 ? 160 : 140);
  const diastolic = randomInt(60, 95);
  
  observations.push({
    id: uuid(),
    patient_id: patient.id,
    encounter_id: encounter.id,
    fhir_id: `obs-${uuid()}`,
    status: 'final',
    category_code: 'vital-signs',
    category_display: 'Vital Signs',
    code_system: 'http://loinc.org',
    code_code: '85354-9',
    code_display: 'Blood Pressure',
    effective_date_time: formatTimestamp(effectiveDate),
    component: JSON.stringify([
      { code: '8480-6', display: 'Systolic', value: systolic, unit: 'mmHg' },
      { code: '8462-4', display: 'Diastolic', value: diastolic, unit: 'mmHg' },
    ]),
    performer_id: performer,
  });
  
  // Heart Rate
  observations.push({
    id: uuid(),
    patient_id: patient.id,
    encounter_id: encounter.id,
    fhir_id: `obs-${uuid()}`,
    status: 'final',
    category_code: 'vital-signs',
    category_display: 'Vital Signs',
    code_system: 'http://loinc.org',
    code_code: '8867-4',
    code_display: 'Heart Rate',
    effective_date_time: formatTimestamp(effectiveDate),
    value_quantity_value: randomInt(55, 100),
    value_quantity_unit: 'beats/minute',
    performer_id: performer,
  });
  
  // Temperature
  observations.push({
    id: uuid(),
    patient_id: patient.id,
    encounter_id: encounter.id,
    fhir_id: `obs-${uuid()}`,
    status: 'final',
    category_code: 'vital-signs',
    category_display: 'Vital Signs',
    code_system: 'http://loinc.org',
    code_code: '8310-5',
    code_display: 'Body Temperature',
    effective_date_time: formatTimestamp(effectiveDate),
    value_quantity_value: randomFloat(97.0, 99.5, 1),
    value_quantity_unit: 'degF',
    performer_id: performer,
  });
  
  // Weight
  const weightKg = randomFloat(50, 130, 1);
  observations.push({
    id: uuid(),
    patient_id: patient.id,
    encounter_id: encounter.id,
    fhir_id: `obs-${uuid()}`,
    status: 'final',
    category_code: 'vital-signs',
    category_display: 'Vital Signs',
    code_system: 'http://loinc.org',
    code_code: '29463-7',
    code_display: 'Body Weight',
    effective_date_time: formatTimestamp(effectiveDate),
    value_quantity_value: weightKg,
    value_quantity_unit: 'kg',
    performer_id: performer,
  });
  
  // Height
  const heightCm = randomInt(150, 195);
  observations.push({
    id: uuid(),
    patient_id: patient.id,
    encounter_id: encounter.id,
    fhir_id: `obs-${uuid()}`,
    status: 'final',
    category_code: 'vital-signs',
    category_display: 'Vital Signs',
    code_system: 'http://loinc.org',
    code_code: '8302-2',
    code_display: 'Body Height',
    effective_date_time: formatTimestamp(effectiveDate),
    value_quantity_value: heightCm,
    value_quantity_unit: 'cm',
    performer_id: performer,
  });
  
  // BMI
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  observations.push({
    id: uuid(),
    patient_id: patient.id,
    encounter_id: encounter.id,
    fhir_id: `obs-${uuid()}`,
    status: 'final',
    category_code: 'vital-signs',
    category_display: 'Vital Signs',
    code_system: 'http://loinc.org',
    code_code: '39156-5',
    code_display: 'Body Mass Index',
    effective_date_time: formatTimestamp(effectiveDate),
    value_quantity_value: parseFloat(bmi.toFixed(1)),
    value_quantity_unit: 'kg/m2',
    performer_id: performer,
  });
  
  return observations;
}

// Generate imaging documents
function generateImagingDoc(patient, encounter) {
  const imaging = randomItem(IMAGING_TYPES);
  const effectiveDate = new Date(encounter.period_start);
  const author = randomItem(PROVIDER_IDS);
  
  const impressions = [
    'No acute findings.',
    'Findings as described above.',
    'Normal examination.',
    'Mild degenerative changes.',
    'Recommend clinical correlation.',
    'No significant interval change.',
  ];
  
  const findings = [
    'No acute abnormality identified.',
    'Study is technically adequate.',
    'No focal lesions identified.',
    'Normal study.',
    'Age-appropriate changes noted.',
  ];
  
  let reportContent = IMAGING_REPORT_TEMPLATES[imaging.modality] || IMAGING_REPORT_TEMPLATES['XR'];
  reportContent = reportContent
    .replace('{{indication}}', randomItem(['Pain', 'Screening', 'Follow-up', 'Evaluation']))
    .replace('{{comparison}}', randomItem(['None available', 'Prior study from 1 year ago']))
    .replace('{{impression}}', randomItem(impressions))
    .replace('{{findings}}', randomItem(findings))
    .replace('{{region}}', imaging.display.split(' ').slice(1).join(' '))
    .replace('{{contrast}}', imaging.modality === 'CT' ? 'with IV contrast' : '')
    .replace('{{contrast_detail}}', 'following administration of intravenous contrast');
  
  return {
    id: uuid(),
    patient_id: patient.id,
    encounter_id: encounter.id,
    fhir_id: `doc-${uuid()}`,
    status: 'current',
    type_code: imaging.code,
    type_system: 'http://loinc.org',
    type_display: imaging.display,
    category: imaging.category,
    date: formatTimestamp(effectiveDate),
    author_id: author,
    description: imaging.display,
    content_type: 'text/plain',
    content_data: reportContent,
  };
}

// Generate procedure records
function generateProcedure(patient, encounter, procType) {
  const effectiveDate = new Date(encounter.period_start);
  const performer = randomItem(PROVIDER_IDS);
  
  let note = '';
  if (procType.category === 'surgery' && OP_REPORT_TEMPLATES[procType.code]) {
    note = OP_REPORT_TEMPLATES[procType.code];
  } else {
    note = `Procedure: ${procType.display}\nPerformed without complication.\nPatient tolerated procedure well.`;
  }
  
  return {
    id: uuid(),
    patient_id: patient.id,
    encounter_id: encounter.id,
    fhir_id: `proc-${uuid()}`,
    status: 'completed',
    code_system: procType.system,
    code_code: procType.code,
    code_display: procType.display,
    performed_date_time: formatTimestamp(effectiveDate),
    recorder_id: performer,
    performer: JSON.stringify([{ actor: { reference: `Practitioner/${performer}` } }]),
    note: note,
  };
}

// Generate SQL output
function generateSQL() {
  let sql = `-- Demo Data Seed for Tribal EHR
-- Generated: ${new Date().toISOString()}
-- Patients: ${NUM_PATIENTS}
-- Note: Run this after the base schema is created

BEGIN;

-- Disable triggers for faster inserts
SET session_replication_role = 'replica';

`;

  console.error('Generating patients...');
  const patients = generatePatients(NUM_PATIENTS);
  
  // Insert patients
  sql += `-- ============================================\n-- PATIENTS (${patients.length})\n-- ============================================\n\n`;
  
  for (const p of patients) {
    sql += `INSERT INTO patients (id, mrn, fhir_id, first_name, last_name, date_of_birth, sex, race, ethnicity, preferred_language, marital_status, active) VALUES (
  ${escapeSQL(p.id)}, ${escapeSQL(p.mrn)}, ${escapeSQL(p.fhir_id)}, ${escapeSQL(p.first_name)}, ${escapeSQL(p.last_name)}, 
  ${escapeSQL(p.date_of_birth)}, ${escapeSQL(p.sex)}, ${escapeSQL(p.race)}, ${escapeSQL(p.ethnicity)}, 
  ${escapeSQL(p.preferred_language)}, ${escapeSQL(p.marital_status)}, ${p.active}
);\n`;
  }
  
  console.error('Generating encounters and clinical data...');
  
  let totalEncounters = 0;
  let totalObs = 0;
  let totalDocs = 0;
  let totalProcs = 0;
  
  const allEncounters = [];
  const allObservations = [];
  const allDocuments = [];
  const allProcedures = [];
  
  for (const patient of patients) {
    const numEncounters = randomInt(ENCOUNTERS_PER_PATIENT.min, ENCOUNTERS_PER_PATIENT.max);
    const encounters = generateEncounters(patient, numEncounters);
    allEncounters.push(...encounters);
    totalEncounters += encounters.length;
    
    for (const encounter of encounters) {
      // Vitals for every encounter
      const vitals = generateVitals(patient, encounter);
      allObservations.push(...vitals);
      totalObs += vitals.length;
      
      // Labs for some encounters
      if (Math.random() > 0.4) {
        const panels = ['CBC', 'CMP'];
        if (patient.age > 40) panels.push('LIPID');
        if (Math.random() > 0.7) panels.push('A1C');
        if (Math.random() > 0.8) panels.push('TSH');
        
        const panelToRun = randomItem(panels);
        const labs = generateLabObs(patient, encounter, panelToRun);
        allObservations.push(...labs);
        totalObs += labs.length;
      }
      
      // Imaging for some encounters
      if (Math.random() > 0.7) {
        const imagingDoc = generateImagingDoc(patient, encounter);
        allDocuments.push(imagingDoc);
        totalDocs++;
      }
      
      // Procedures for some encounters
      if (Math.random() > 0.5) {
        const procType = randomItem(PROCEDURES);
        const proc = generateProcedure(patient, encounter, procType);
        allProcedures.push(proc);
        totalProcs++;
      }
    }
  }
  
  // Insert encounters
  sql += `\n-- ============================================\n-- ENCOUNTERS (${totalEncounters})\n-- ============================================\n\n`;
  
  for (const e of allEncounters) {
    sql += `INSERT INTO encounters (id, patient_id, fhir_id, status, class_code, type_code, type_display, period_start, period_end, reason_code, diagnosis, participant, created_by) VALUES (
  ${escapeSQL(e.id)}, ${escapeSQL(e.patient_id)}, ${escapeSQL(e.fhir_id)}, ${escapeSQL(e.status)}, ${escapeSQL(e.class_code)}, 
  ${escapeSQL(e.type_code)}, ${escapeSQL(e.type_display)}, ${escapeSQL(e.period_start)}, ${escapeSQL(e.period_end)}, 
  ${escapeSQL(e.reason_code)}, ${escapeSQL(e.diagnosis)}, ${escapeSQL(e.participant)}, ${escapeSQL(e.created_by)}
);\n`;
  }
  
  // Insert observations
  sql += `\n-- ============================================\n-- OBSERVATIONS (${totalObs})\n-- ============================================\n\n`;
  
  for (const o of allObservations) {
    sql += `INSERT INTO observations (id, patient_id, encounter_id, fhir_id, status, category_code, category_display, code_system, code_code, code_display, effective_date_time, issued, value_quantity_value, value_quantity_unit, value_quantity_system, value_quantity_code, interpretation_code, interpretation_display, reference_range_low, reference_range_high, reference_range_unit, component, performer_id) VALUES (
  ${escapeSQL(o.id)}, ${escapeSQL(o.patient_id)}, ${escapeSQL(o.encounter_id)}, ${escapeSQL(o.fhir_id)}, ${escapeSQL(o.status)}, 
  ${escapeSQL(o.category_code)}, ${escapeSQL(o.category_display)}, ${escapeSQL(o.code_system)}, ${escapeSQL(o.code_code)}, ${escapeSQL(o.code_display)}, 
  ${o.effective_date_time ? escapeSQL(o.effective_date_time) : 'NULL'}, ${o.issued ? escapeSQL(o.issued) : 'NULL'}, 
  ${o.value_quantity_value !== undefined ? o.value_quantity_value : 'NULL'}, ${o.value_quantity_unit ? escapeSQL(o.value_quantity_unit) : 'NULL'}, 
  ${o.value_quantity_system ? escapeSQL(o.value_quantity_system) : 'NULL'}, ${o.value_quantity_code ? escapeSQL(o.value_quantity_code) : 'NULL'}, 
  ${o.interpretation_code ? escapeSQL(o.interpretation_code) : 'NULL'}, ${o.interpretation_display ? escapeSQL(o.interpretation_display) : 'NULL'}, 
  ${o.reference_range_low !== undefined ? o.reference_range_low : 'NULL'}, ${o.reference_range_high !== undefined ? o.reference_range_high : 'NULL'}, 
  ${o.reference_range_unit ? escapeSQL(o.reference_range_unit) : 'NULL'}, ${o.component ? escapeSQL(o.component) : 'NULL'}, 
  ${o.performer_id ? escapeSQL(o.performer_id) : 'NULL'}
);\n`;
  }
  
  // Insert documents (imaging reports)
  sql += `\n-- ============================================\n-- DOCUMENT REFERENCES - IMAGING (${totalDocs})\n-- ============================================\n\n`;
  
  for (const d of allDocuments) {
    sql += `INSERT INTO document_references (id, patient_id, encounter_id, fhir_id, status, type_code, type_system, type_display, category, date, author_id, description, content_type, content_data) VALUES (
  ${escapeSQL(d.id)}, ${escapeSQL(d.patient_id)}, ${escapeSQL(d.encounter_id)}, ${escapeSQL(d.fhir_id)}, ${escapeSQL(d.status)}, 
  ${escapeSQL(d.type_code)}, ${escapeSQL(d.type_system)}, ${escapeSQL(d.type_display)}, ${escapeSQL(d.category)}, 
  ${escapeSQL(d.date)}, ${escapeSQL(d.author_id)}, ${escapeSQL(d.description)}, ${escapeSQL(d.content_type)}, ${escapeSQL(d.content_data)}
);\n`;
  }
  
  // Insert procedures
  sql += `\n-- ============================================\n-- PROCEDURES (${totalProcs})\n-- ============================================\n\n`;
  
  for (const p of allProcedures) {
    sql += `INSERT INTO procedures (id, patient_id, encounter_id, fhir_id, status, code_system, code_code, code_display, performed_date_time, recorder_id, performer, note) VALUES (
  ${escapeSQL(p.id)}, ${escapeSQL(p.patient_id)}, ${escapeSQL(p.encounter_id)}, ${escapeSQL(p.fhir_id)}, ${escapeSQL(p.status)}, 
  ${escapeSQL(p.code_system)}, ${escapeSQL(p.code_code)}, ${escapeSQL(p.code_display)}, ${escapeSQL(p.performed_date_time)}, 
  ${escapeSQL(p.recorder_id)}, ${escapeSQL(p.performer)}, ${escapeSQL(p.note)}
);\n`;
  }
  
  sql += `
-- Re-enable triggers
SET session_replication_role = 'origin';

COMMIT;

-- Summary
-- Patients: ${patients.length}
-- Encounters: ${totalEncounters}
-- Observations (vitals + labs): ${totalObs}
-- Imaging Documents: ${totalDocs}
-- Procedures: ${totalProcs}
`;

  console.error(`\nGeneration complete!`);
  console.error(`  Patients: ${patients.length}`);
  console.error(`  Encounters: ${totalEncounters}`);
  console.error(`  Observations: ${totalObs}`);
  console.error(`  Imaging Documents: ${totalDocs}`);
  console.error(`  Procedures: ${totalProcs}`);
  
  return sql;
}

// Run
console.log(generateSQL());
