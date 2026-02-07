// This script seeds the database with synthetic clinical data for development/testing.
// It creates:
// - 5 provider users (2 physicians, 1 nurse, 1 MA, 1 front desk)
// - 1 admin user
// - 20 patients with full demographics (diverse ages, races, ethnicities)
// - For each patient: allergies, conditions, medications, vitals, immunizations, encounters
// - Appointment schedule for next 2 weeks
// - Sample clinical notes
//
// Uses realistic clinical data:
// - Common conditions (hypertension, diabetes, asthma, depression, etc.) with ICD-10 codes
// - Common medications with RxNorm codes
// - Standard immunizations with CVX codes
// - Realistic vital signs with some abnormal values
// - Common allergies (penicillin, sulfa, aspirin, latex, etc.)
//
// Run with: npx ts-node scripts/seed-data.ts

import { v4 as uuid } from 'uuid';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const FHIR_BASE = process.env.FHIR_BASE_URL || 'http://localhost:8080/fhir';

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 1): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function pastDate(yearsBack: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsBack);
  d.setMonth(randomInt(0, 11));
  d.setDate(randomInt(1, 28));
  return dateStr(d);
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return dateStr(d);
}

function instantStr(d: Date): string {
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Reference data: Conditions (ICD-10-CM)
// ---------------------------------------------------------------------------

const CONDITIONS = [
  { code: 'I10', display: 'Essential (primary) hypertension', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'E11.9', display: 'Type 2 diabetes mellitus without complications', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'E11.65', display: 'Type 2 diabetes mellitus with hyperglycemia', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'J45.20', display: 'Mild intermittent asthma, uncomplicated', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'J45.40', display: 'Moderate persistent asthma, uncomplicated', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'F32.1', display: 'Major depressive disorder, single episode, moderate', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'F41.1', display: 'Generalized anxiety disorder', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'E78.5', display: 'Hyperlipidemia, unspecified', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'M54.5', display: 'Low back pain', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'J06.9', display: 'Acute upper respiratory infection, unspecified', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'K21.0', display: 'Gastro-esophageal reflux disease with esophagitis', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'G43.909', display: 'Migraine, unspecified, not intractable, without status migrainosus', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'N39.0', display: 'Urinary tract infection, site not specified', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'J20.9', display: 'Acute bronchitis, unspecified', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'E03.9', display: 'Hypothyroidism, unspecified', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'M79.3', display: 'Panniculitis, unspecified', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'I25.10', display: 'Atherosclerotic heart disease of native coronary artery without angina pectoris', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'N18.3', display: 'Chronic kidney disease, stage 3 (moderate)', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'G47.33', display: 'Obstructive sleep apnea', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'M10.9', display: 'Gout, unspecified', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
];

// ---------------------------------------------------------------------------
// Reference data: Medications (RxNorm)
// ---------------------------------------------------------------------------

const MEDICATIONS: { code: string; display: string; conditionCodes: string[] }[] = [
  { code: '314076', display: 'Lisinopril 10 MG Oral Tablet', conditionCodes: ['I10'] },
  { code: '197361', display: 'Amlodipine 5 MG Oral Tablet', conditionCodes: ['I10'] },
  { code: '860975', display: 'Metformin hydrochloride 500 MG Oral Tablet', conditionCodes: ['E11.9', 'E11.65'] },
  { code: '897122', display: 'Glipizide 5 MG Oral Tablet', conditionCodes: ['E11.9', 'E11.65'] },
  { code: '245314', display: 'Albuterol 0.083 MG/ML Inhalation Solution', conditionCodes: ['J45.20', 'J45.40'] },
  { code: '896188', display: 'Fluticasone propionate 0.05 MG/ACTUAT Metered Dose Inhaler', conditionCodes: ['J45.20', 'J45.40'] },
  { code: '312938', display: 'Sertraline 50 MG Oral Tablet', conditionCodes: ['F32.1', 'F41.1'] },
  { code: '861634', display: 'Escitalopram 10 MG Oral Tablet', conditionCodes: ['F32.1', 'F41.1'] },
  { code: '262095', display: 'Atorvastatin 20 MG Oral Tablet', conditionCodes: ['E78.5'] },
  { code: '861643', display: 'Rosuvastatin calcium 10 MG Oral Tablet', conditionCodes: ['E78.5'] },
  { code: '197696', display: 'Ibuprofen 400 MG Oral Tablet', conditionCodes: ['M54.5'] },
  { code: '198240', display: 'Omeprazole 20 MG Delayed Release Oral Capsule', conditionCodes: ['K21.0'] },
  { code: '311671', display: 'Sumatriptan 50 MG Oral Tablet', conditionCodes: ['G43.909'] },
  { code: '197517', display: 'Levothyroxine Sodium 0.05 MG Oral Tablet', conditionCodes: ['E03.9'] },
  { code: '310429', display: 'Hydrochlorothiazide 25 MG Oral Tablet', conditionCodes: ['I10'] },
  { code: '197807', display: 'Metoprolol Tartrate 50 MG Oral Tablet', conditionCodes: ['I10', 'I25.10'] },
  { code: '200801', display: 'Aspirin 81 MG Delayed Release Oral Tablet', conditionCodes: ['I25.10'] },
  { code: '311989', display: 'Allopurinol 100 MG Oral Tablet', conditionCodes: ['M10.9'] },
  { code: '198211', display: 'Nitrofurantoin 100 MG Oral Capsule', conditionCodes: ['N39.0'] },
  { code: '1049221', display: 'Acetaminophen 325 MG Oral Tablet', conditionCodes: ['M54.5', 'G43.909'] },
];

// ---------------------------------------------------------------------------
// Reference data: Allergies (SNOMED CT)
// ---------------------------------------------------------------------------

const ALLERGIES = [
  { code: '91936005', display: 'Allergy to penicillin', substance: 'Penicillin', reaction: 'Hives', severity: 'moderate' },
  { code: '294505008', display: 'Allergy to sulfonamide', substance: 'Sulfonamide', reaction: 'Rash', severity: 'mild' },
  { code: '293586001', display: 'Allergy to aspirin', substance: 'Aspirin', reaction: 'Wheezing', severity: 'severe' },
  { code: '300913006', display: 'Allergy to latex', substance: 'Latex', reaction: 'Anaphylaxis', severity: 'severe' },
  { code: '419511003', display: 'Allergy to propensity to adverse reactions to drug', substance: 'Codeine', reaction: 'Nausea and vomiting', severity: 'moderate' },
  { code: '419199007', display: 'Allergy to substance', substance: 'Iodine contrast dye', reaction: 'Urticaria', severity: 'moderate' },
  { code: '232347008', display: 'Allergy to egg protein', substance: 'Egg', reaction: 'Angioedema', severity: 'moderate' },
  { code: '91935009', display: 'Allergy to peanut', substance: 'Peanut', reaction: 'Anaphylaxis', severity: 'severe' },
  { code: '294915005', display: 'Allergy to erythromycin', substance: 'Erythromycin', reaction: 'Gastrointestinal upset', severity: 'mild' },
  { code: '300916003', display: 'Allergy to bee venom', substance: 'Bee venom', reaction: 'Anaphylaxis', severity: 'severe' },
];

// ---------------------------------------------------------------------------
// Reference data: Immunizations (CVX)
// ---------------------------------------------------------------------------

const IMMUNIZATIONS = [
  { code: '208', display: 'COVID-19, mRNA, LNP-S, bivalent booster, PF, 30 mcg/0.3 mL dose' },
  { code: '197', display: 'Influenza, inactivated, quadrivalent, adjuvanted, preservative free, 0.5 mL dose' },
  { code: '33', display: 'Pneumococcal polysaccharide PPV23' },
  { code: '113', display: 'Td (adult) preservative free' },
  { code: '115', display: 'Tdap' },
  { code: '121', display: 'Zoster vaccine, live' },
  { code: '187', display: 'Zoster vaccine recombinant' },
  { code: '62', display: 'HPV, quadrivalent' },
  { code: '140', display: 'Influenza, seasonal, injectable, preservative free' },
  { code: '03', display: 'MMR' },
  { code: '21', display: 'Varicella' },
  { code: '83', display: 'Hepatitis A, ped/adol, 2 dose' },
  { code: '43', display: 'Hepatitis B, adult' },
  { code: '52', display: 'Hepatitis A, adult' },
];

// ---------------------------------------------------------------------------
// Reference data: Smoking statuses (SNOMED CT)
// ---------------------------------------------------------------------------

const SMOKING_STATUSES = [
  { code: '449868002', display: 'Current every day smoker' },
  { code: '428041000124106', display: 'Current some day smoker' },
  { code: '8517006', display: 'Former smoker' },
  { code: '266919005', display: 'Never smoker' },
  { code: '77176002', display: 'Smoker, current status unknown' },
  { code: '266927001', display: 'Unknown if ever smoked' },
];

// ---------------------------------------------------------------------------
// Reference data: Patient demographics
// ---------------------------------------------------------------------------

interface PatientDemographics {
  given: string;
  family: string;
  gender: 'male' | 'female';
  birthDate: string;
  race: { code: string; display: string };
  ethnicity: { code: string; display: string };
  address: { line: string; city: string; state: string; postalCode: string };
  phone: string;
  language: string;
}

const RACES = [
  { code: '1002-5', display: 'American Indian or Alaska Native' },
  { code: '2028-9', display: 'Asian' },
  { code: '2054-5', display: 'Black or African American' },
  { code: '2076-8', display: 'Native Hawaiian or Other Pacific Islander' },
  { code: '2106-3', display: 'White' },
];

const ETHNICITIES = [
  { code: '2135-2', display: 'Hispanic or Latino' },
  { code: '2186-5', display: 'Not Hispanic or Latino' },
];

const PATIENTS_DEMO: PatientDemographics[] = [
  { given: 'Maria', family: 'Gonzalez', gender: 'female', birthDate: '1962-03-15', race: RACES[4], ethnicity: ETHNICITIES[0], address: { line: '123 Elm Street', city: 'Albuquerque', state: 'NM', postalCode: '87101' }, phone: '505-555-0101', language: 'es' },
  { given: 'James', family: 'Whitefeather', gender: 'male', birthDate: '1978-07-22', race: RACES[0], ethnicity: ETHNICITIES[1], address: { line: '456 Oak Avenue', city: 'Gallup', state: 'NM', postalCode: '87301' }, phone: '505-555-0102', language: 'en' },
  { given: 'Ayesha', family: 'Patel', gender: 'female', birthDate: '1985-11-08', race: RACES[1], ethnicity: ETHNICITIES[1], address: { line: '789 Pine Road', city: 'Santa Fe', state: 'NM', postalCode: '87501' }, phone: '505-555-0103', language: 'en' },
  { given: 'Robert', family: 'Thunderhawk', gender: 'male', birthDate: '1955-01-30', race: RACES[0], ethnicity: ETHNICITIES[1], address: { line: '321 Cedar Lane', city: 'Shiprock', state: 'NM', postalCode: '87420' }, phone: '505-555-0104', language: 'en' },
  { given: 'Linda', family: 'Blackwater', gender: 'female', birthDate: '1990-06-12', race: RACES[0], ethnicity: ETHNICITIES[1], address: { line: '654 Birch Drive', city: 'Farmington', state: 'NM', postalCode: '87401' }, phone: '505-555-0105', language: 'en' },
  { given: 'DeShawn', family: 'Williams', gender: 'male', birthDate: '1988-09-03', race: RACES[2], ethnicity: ETHNICITIES[1], address: { line: '987 Maple Court', city: 'Las Cruces', state: 'NM', postalCode: '88001' }, phone: '575-555-0106', language: 'en' },
  { given: 'Wei', family: 'Chen', gender: 'female', birthDate: '1972-04-18', race: RACES[1], ethnicity: ETHNICITIES[1], address: { line: '147 Spruce Way', city: 'Albuquerque', state: 'NM', postalCode: '87102' }, phone: '505-555-0107', language: 'zh' },
  { given: 'Thomas', family: 'Redhorse', gender: 'male', birthDate: '1945-12-25', race: RACES[0], ethnicity: ETHNICITIES[1], address: { line: '258 Aspen Trail', city: 'Tuba City', state: 'AZ', postalCode: '86045' }, phone: '928-555-0108', language: 'en' },
  { given: 'Sarah', family: 'Yellowbird', gender: 'female', birthDate: '1998-02-14', race: RACES[0], ethnicity: ETHNICITIES[1], address: { line: '369 Willow Street', city: 'Window Rock', state: 'AZ', postalCode: '86515' }, phone: '928-555-0109', language: 'en' },
  { given: 'Carlos', family: 'Rivera', gender: 'male', birthDate: '1969-08-07', race: RACES[4], ethnicity: ETHNICITIES[0], address: { line: '741 Cottonwood Boulevard', city: 'Espanola', state: 'NM', postalCode: '87532' }, phone: '505-555-0110', language: 'es' },
  { given: 'Michelle', family: 'Eaglebear', gender: 'female', birthDate: '1982-10-31', race: RACES[0], ethnicity: ETHNICITIES[1], address: { line: '852 Juniper Road', city: 'Zuni', state: 'NM', postalCode: '87327' }, phone: '505-555-0111', language: 'en' },
  { given: 'Daniel', family: 'Morningstar', gender: 'male', birthDate: '2001-05-20', race: RACES[0], ethnicity: ETHNICITIES[1], address: { line: '963 Sage Lane', city: 'Taos', state: 'NM', postalCode: '87571' }, phone: '575-555-0112', language: 'en' },
  { given: 'Patricia', family: 'Littlebear', gender: 'female', birthDate: '1958-03-09', race: RACES[0], ethnicity: ETHNICITIES[1], address: { line: '174 Mesquite Avenue', city: 'Laguna', state: 'NM', postalCode: '87026' }, phone: '505-555-0113', language: 'en' },
  { given: 'Keanu', family: 'Nakamura', gender: 'male', birthDate: '1995-07-14', race: RACES[3], ethnicity: ETHNICITIES[1], address: { line: '285 Pinon Way', city: 'Albuquerque', state: 'NM', postalCode: '87103' }, phone: '505-555-0114', language: 'en' },
  { given: 'Angela', family: 'Skyhawk', gender: 'female', birthDate: '1975-11-22', race: RACES[0], ethnicity: ETHNICITIES[1], address: { line: '396 Cactus Drive', city: 'Crownpoint', state: 'NM', postalCode: '87313' }, phone: '505-555-0115', language: 'en' },
  { given: 'William', family: 'Greywolf', gender: 'male', birthDate: '1950-06-01', race: RACES[0], ethnicity: ETHNICITIES[1], address: { line: '507 Arroyo Lane', city: 'Chinle', state: 'AZ', postalCode: '86503' }, phone: '928-555-0116', language: 'en' },
  { given: 'Rosa', family: 'Delgado', gender: 'female', birthDate: '1987-01-28', race: RACES[4], ethnicity: ETHNICITIES[0], address: { line: '618 Pueblo Road', city: 'Socorro', state: 'NM', postalCode: '87801' }, phone: '575-555-0117', language: 'es' },
  { given: 'John', family: 'Runningdeer', gender: 'male', birthDate: '1966-09-15', race: RACES[0], ethnicity: ETHNICITIES[1], address: { line: '729 Canyon Drive', city: 'Gallup', state: 'NM', postalCode: '87301' }, phone: '505-555-0118', language: 'en' },
  { given: 'Emily', family: 'Silvermoon', gender: 'female', birthDate: '2005-04-10', race: RACES[0], ethnicity: ETHNICITIES[1], address: { line: '840 Mesa Court', city: 'Santa Fe', state: 'NM', postalCode: '87505' }, phone: '505-555-0119', language: 'en' },
  { given: 'Michael', family: 'Standing Bear', gender: 'male', birthDate: '1970-12-03', race: RACES[0], ethnicity: ETHNICITIES[1], address: { line: '951 Rio Grande Boulevard', city: 'Albuquerque', state: 'NM', postalCode: '87104' }, phone: '505-555-0120', language: 'en' },
];

// ---------------------------------------------------------------------------
// Reference data: Providers
// ---------------------------------------------------------------------------

interface ProviderDef {
  given: string;
  family: string;
  role: string;
  roleCode: string;
  specialty?: string;
  specialtyCode?: string;
  npi: string;
}

const PROVIDERS: ProviderDef[] = [
  { given: 'Rebecca', family: 'Stonecrow', role: 'Physician', roleCode: '59058001', specialty: 'Family Medicine', specialtyCode: '419772000', npi: '1234567890' },
  { given: 'David', family: 'Windwalker', role: 'Physician', roleCode: '59058001', specialty: 'Internal Medicine', specialtyCode: '419192003', npi: '1234567891' },
  { given: 'Amanda', family: 'Clearwater', role: 'Nurse Practitioner', roleCode: '224571005', specialty: 'Family Medicine', specialtyCode: '419772000', npi: '1234567892' },
  { given: 'Marcus', family: 'Lightfoot', role: 'Medical Assistant', roleCode: '224608005', npi: '1234567893' },
  { given: 'Jennifer', family: 'Rainwater', role: 'Front Desk Coordinator', roleCode: '159561009', npi: '1234567894' },
];

// ---------------------------------------------------------------------------
// Reference data: Encounter types
// ---------------------------------------------------------------------------

const ENCOUNTER_TYPES = [
  { code: 'AMB', display: 'Ambulatory', system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode' },
  { code: 'IMP', display: 'Inpatient', system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode' },
  { code: 'EMER', display: 'Emergency', system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode' },
  { code: 'VR', display: 'Virtual', system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode' },
];

const ENCOUNTER_REASONS = [
  { code: 'Z00.00', display: 'Encounter for general adult medical examination without abnormal findings', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'Z23', display: 'Encounter for immunization', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'R05.9', display: 'Cough, unspecified', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'R51.9', display: 'Headache, unspecified', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'R10.9', display: 'Unspecified abdominal pain', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
  { code: 'M79.3', display: 'Panniculitis, unspecified', system: 'http://hl7.org/fhir/sid/icd-10-cm' },
];

// ---------------------------------------------------------------------------
// FHIR Resource builders
// ---------------------------------------------------------------------------

function buildOrganization(): object {
  return {
    resourceType: 'Organization',
    id: 'tribal-ehr-org',
    identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1003456789' }],
    active: true,
    type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/organization-type', code: 'prov', display: 'Healthcare Provider' }] }],
    name: 'Tribal Health Center',
    telecom: [
      { system: 'phone', value: '505-555-1000', use: 'work' },
      { system: 'email', value: 'info@tribalhealthcenter.org', use: 'work' },
    ],
    address: [{ use: 'work', line: ['100 Health Center Road'], city: 'Gallup', state: 'NM', postalCode: '87301', country: 'US' }],
  };
}

function buildLocation(): object {
  return {
    resourceType: 'Location',
    id: 'main-clinic',
    status: 'active',
    name: 'Tribal Health Center - Main Clinic',
    mode: 'instance',
    type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode', code: 'OF', display: 'Outpatient Facility' }] }],
    telecom: [{ system: 'phone', value: '505-555-1000' }],
    address: { use: 'work', line: ['100 Health Center Road'], city: 'Gallup', state: 'NM', postalCode: '87301', country: 'US' },
    managingOrganization: { reference: 'Organization/tribal-ehr-org' },
  };
}

function buildPractitioner(p: ProviderDef): object {
  const id = `practitioner-${p.npi}`;
  return {
    resourceType: 'Practitioner',
    id,
    identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: p.npi }],
    active: true,
    name: [{ use: 'official', family: p.family, given: [p.given], prefix: p.role === 'Physician' ? ['Dr.'] : undefined }],
    telecom: [{ system: 'phone', value: `505-555-${p.npi.slice(-4)}`, use: 'work' }],
    qualification: p.specialty
      ? [{ code: { coding: [{ system: 'http://snomed.info/sct', code: p.specialtyCode!, display: p.specialty }] } }]
      : undefined,
  };
}

function buildPractitionerRole(p: ProviderDef): object {
  return {
    resourceType: 'PractitionerRole',
    id: `role-${p.npi}`,
    active: true,
    practitioner: { reference: `Practitioner/practitioner-${p.npi}`, display: `${p.given} ${p.family}` },
    organization: { reference: 'Organization/tribal-ehr-org' },
    code: [{ coding: [{ system: 'http://snomed.info/sct', code: p.roleCode, display: p.role }] }],
    specialty: p.specialty
      ? [{ coding: [{ system: 'http://snomed.info/sct', code: p.specialtyCode!, display: p.specialty }] }]
      : undefined,
    location: [{ reference: 'Location/main-clinic' }],
  };
}

function buildPatient(demo: PatientDemographics, index: number): object {
  const id = `patient-${String(index + 1).padStart(3, '0')}`;
  const mrn = `MRN${String(100000 + index).padStart(6, '0')}`;
  return {
    resourceType: 'Patient',
    id,
    meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'] },
    extension: [
      {
        url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race',
        extension: [
          { url: 'ombCategory', valueCoding: { system: 'urn:oid:2.16.840.1.113883.6.238', code: demo.race.code, display: demo.race.display } },
          { url: 'text', valueString: demo.race.display },
        ],
      },
      {
        url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity',
        extension: [
          { url: 'ombCategory', valueCoding: { system: 'urn:oid:2.16.840.1.113883.6.238', code: demo.ethnicity.code, display: demo.ethnicity.display } },
          { url: 'text', valueString: demo.ethnicity.display },
        ],
      },
      {
        url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex',
        valueCode: demo.gender === 'male' ? 'M' : 'F',
      },
    ],
    identifier: [
      { use: 'usual', type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR', display: 'Medical Record Number' }] }, system: 'http://tribal-ehr.org/fhir/mrn', value: mrn },
    ],
    active: true,
    name: [{ use: 'official', family: demo.family, given: [demo.given] }],
    telecom: [
      { system: 'phone', value: demo.phone, use: 'home' },
    ],
    gender: demo.gender,
    birthDate: demo.birthDate,
    address: [{ use: 'home', line: [demo.address.line], city: demo.address.city, state: demo.address.state, postalCode: demo.address.postalCode, country: 'US' }],
    communication: [{ language: { coding: [{ system: 'urn:ietf:bcp:47', code: demo.language }] }, preferred: true }],
  };
}

function buildAllergyIntolerance(
  patientRef: string,
  allergy: typeof ALLERGIES[number],
  allergyIndex: number,
  patientIndex: number,
): object {
  return {
    resourceType: 'AllergyIntolerance',
    id: `allergy-${patientIndex}-${allergyIndex}`,
    meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance'] },
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active', display: 'Active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed', display: 'Confirmed' }] },
    type: 'allergy',
    category: [allergy.substance.includes('Latex') || allergy.substance.includes('Bee') ? 'environment' : 'medication'],
    criticality: allergy.severity === 'severe' ? 'high' : allergy.severity === 'moderate' ? 'low' : 'low',
    code: { coding: [{ system: 'http://snomed.info/sct', code: allergy.code, display: allergy.display }], text: allergy.substance },
    patient: { reference: patientRef },
    recordedDate: pastDate(randomInt(1, 10)),
    reaction: [{ manifestation: [{ coding: [{ system: 'http://snomed.info/sct', code: '271807003', display: allergy.reaction }], text: allergy.reaction }], severity: allergy.severity as 'mild' | 'moderate' | 'severe' }],
  };
}

function buildCondition(
  patientRef: string,
  condition: typeof CONDITIONS[number],
  condIndex: number,
  patientIndex: number,
): object {
  const yearsBack = randomInt(1, 8);
  return {
    resourceType: 'Condition',
    id: `condition-${patientIndex}-${condIndex}`,
    meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns'] },
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed', display: 'Confirmed' }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'problem-list-item', display: 'Problem List Item' }] }],
    code: { coding: [{ system: condition.system, code: condition.code, display: condition.display }], text: condition.display },
    subject: { reference: patientRef },
    onsetDateTime: pastDate(yearsBack),
    recordedDate: pastDate(yearsBack),
  };
}

function buildMedicationRequest(
  patientRef: string,
  med: typeof MEDICATIONS[number],
  encounterRef: string,
  practitionerRef: string,
  medIndex: number,
  patientIndex: number,
): object {
  return {
    resourceType: 'MedicationRequest',
    id: `medrx-${patientIndex}-${medIndex}`,
    meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest'] },
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: med.code, display: med.display }], text: med.display },
    subject: { reference: patientRef },
    encounter: { reference: encounterRef },
    authoredOn: pastDate(randomInt(0, 2)),
    requester: { reference: practitionerRef },
    dosageInstruction: [{
      sequence: 1,
      text: 'Take as directed',
      timing: { repeat: { frequency: randomInt(1, 2), period: 1, periodUnit: 'd' } },
      route: { coding: [{ system: 'http://snomed.info/sct', code: '26643006', display: 'Oral route' }] },
    }],
  };
}

function buildVitalSigns(patientRef: string, encounterRef: string, encounterDate: string, patientIndex: number, encounterIndex: number): object[] {
  const isElderly = patientIndex === 7 || patientIndex === 15; // Thomas Redhorse, William Greywolf
  const isYoung = patientIndex === 11 || patientIndex === 18; // Daniel Morningstar, Emily Silvermoon

  // Generate clinically plausible vitals with some abnormal values
  const systolic = isElderly ? randomInt(140, 165) : randomInt(110, 135);
  const diastolic = isElderly ? randomInt(80, 95) : randomInt(65, 85);
  const heartRate = isYoung ? randomInt(60, 75) : randomInt(68, 95);
  const respRate = randomInt(14, 20);
  const temp = Math.random() > 0.9 ? randomFloat(99.5, 101.5) : randomFloat(97.5, 98.9);
  const o2sat = Math.random() > 0.85 ? randomInt(92, 95) : randomInt(96, 100);
  const heightCm = patientIndex % 2 === 0 ? randomFloat(155, 175) : randomFloat(165, 190);
  const weightKg = randomFloat(55, 110);
  const bmi = parseFloat((weightKg / ((heightCm / 100) ** 2)).toFixed(1));

  const vitals: { loincCode: string; display: string; value: number; unit: string; ucumUnit: string }[] = [
    { loincCode: '8480-6', display: 'Systolic blood pressure', value: systolic, unit: 'mmHg', ucumUnit: 'mm[Hg]' },
    { loincCode: '8462-4', display: 'Diastolic blood pressure', value: diastolic, unit: 'mmHg', ucumUnit: 'mm[Hg]' },
    { loincCode: '8867-4', display: 'Heart rate', value: heartRate, unit: '/min', ucumUnit: '/min' },
    { loincCode: '9279-1', display: 'Respiratory rate', value: respRate, unit: '/min', ucumUnit: '/min' },
    { loincCode: '8310-5', display: 'Body temperature', value: temp, unit: 'degF', ucumUnit: '[degF]' },
    { loincCode: '59408-5', display: 'Oxygen saturation in Arterial blood by Pulse oximetry', value: o2sat, unit: '%', ucumUnit: '%' },
    { loincCode: '8302-2', display: 'Body height', value: heightCm, unit: 'cm', ucumUnit: 'cm' },
    { loincCode: '29463-7', display: 'Body weight', value: weightKg, unit: 'kg', ucumUnit: 'kg' },
    { loincCode: '39156-5', display: 'Body mass index (BMI)', value: bmi, unit: 'kg/m2', ucumUnit: 'kg/m2' },
  ];

  return vitals.map((v, vi) => ({
    resourceType: 'Observation',
    id: `vitals-${patientIndex}-${encounterIndex}-${vi}`,
    meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-vital-signs'] },
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }] }],
    code: { coding: [{ system: 'http://loinc.org', code: v.loincCode, display: v.display }], text: v.display },
    subject: { reference: patientRef },
    encounter: { reference: encounterRef },
    effectiveDateTime: encounterDate,
    valueQuantity: { value: v.value, unit: v.unit, system: 'http://unitsofmeasure.org', code: v.ucumUnit },
  }));
}

function buildSmokingStatus(patientRef: string, patientIndex: number): object {
  const status = pick(SMOKING_STATUSES);
  return {
    resourceType: 'Observation',
    id: `smoking-${patientIndex}`,
    meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-smokingstatus'] },
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'social-history', display: 'Social History' }] }],
    code: { coding: [{ system: 'http://loinc.org', code: '72166-2', display: 'Tobacco smoking status' }], text: 'Tobacco smoking status' },
    subject: { reference: patientRef },
    effectiveDateTime: pastDate(0),
    valueCodeableConcept: { coding: [{ system: 'http://snomed.info/sct', code: status.code, display: status.display }], text: status.display },
  };
}

function buildImmunization(
  patientRef: string,
  imm: typeof IMMUNIZATIONS[number],
  immIndex: number,
  patientIndex: number,
): object {
  return {
    resourceType: 'Immunization',
    id: `imm-${patientIndex}-${immIndex}`,
    meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization'] },
    status: 'completed',
    vaccineCode: { coding: [{ system: 'http://hl7.org/fhir/sid/cvx', code: imm.code, display: imm.display }], text: imm.display },
    patient: { reference: patientRef },
    occurrenceDateTime: pastDate(randomInt(0, 5)),
    primarySource: true,
    location: { reference: 'Location/main-clinic' },
  };
}

function buildEncounter(
  patientRef: string,
  practitionerRef: string,
  encounterDate: string,
  encounterIndex: number,
  patientIndex: number,
  status: string = 'finished',
): object {
  const type = pick(ENCOUNTER_TYPES);
  const reason = pick(ENCOUNTER_REASONS);
  return {
    resourceType: 'Encounter',
    id: `encounter-${patientIndex}-${encounterIndex}`,
    meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter'] },
    status,
    class: { system: type.system, code: type.code, display: type.display },
    type: [{ coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99213', display: 'Office or other outpatient visit, established patient' }], text: 'Office Visit' }],
    subject: { reference: patientRef },
    participant: [{ individual: { reference: practitionerRef } }],
    period: { start: `${encounterDate}T09:00:00Z`, end: `${encounterDate}T09:30:00Z` },
    reasonCode: [{ coding: [{ system: reason.system, code: reason.code, display: reason.display }], text: reason.display }],
    serviceProvider: { reference: 'Organization/tribal-ehr-org' },
    location: [{ location: { reference: 'Location/main-clinic' } }],
  };
}

function buildAppointment(
  patientRef: string,
  practitionerRef: string,
  date: string,
  slotHour: number,
  appointmentIndex: number,
): object {
  const startHour = String(slotHour).padStart(2, '0');
  const endMinute = slotHour === 11 ? '00' : '30';
  const endHour = slotHour === 11 ? '12' : startHour;
  return {
    resourceType: 'Appointment',
    id: `appt-${appointmentIndex}`,
    status: 'booked',
    serviceType: [{ coding: [{ system: 'http://snomed.info/sct', code: '185389009', display: 'Follow-up visit' }] }],
    start: `${date}T${startHour}:00:00Z`,
    end: `${date}T${endHour}:${endMinute}:00Z`,
    participant: [
      { actor: { reference: patientRef }, status: 'accepted' },
      { actor: { reference: practitionerRef }, status: 'accepted' },
    ],
  };
}

function buildDocumentReference(
  patientRef: string,
  encounterRef: string,
  practitionerRef: string,
  docIndex: number,
  patientIndex: number,
  encounterDate: string,
): object {
  const docType = pick([
    { code: '11506-3', display: 'Progress Note' },
    { code: '34117-2', display: 'History and Physical Note' },
    { code: '11488-4', display: 'Consultation Note' },
  ]);

  const noteText = generateClinicalNote(PATIENTS_DEMO[patientIndex], docType.display);

  return {
    resourceType: 'DocumentReference',
    id: `doc-${patientIndex}-${docIndex}`,
    meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference'] },
    status: 'current',
    type: { coding: [{ system: 'http://loinc.org', code: docType.code, display: docType.display }] },
    category: [{ coding: [{ system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category', code: 'clinical-note', display: 'Clinical Note' }] }],
    subject: { reference: patientRef },
    date: `${encounterDate}T10:00:00Z`,
    author: [{ reference: practitionerRef }],
    content: [{
      attachment: {
        contentType: 'text/plain',
        data: Buffer.from(noteText).toString('base64'),
      },
    }],
    context: { encounter: [{ reference: encounterRef }] },
  };
}

function generateClinicalNote(patient: PatientDemographics, noteType: string): string {
  const age = new Date().getFullYear() - new Date(patient.birthDate).getFullYear();
  return [
    `${noteType}`,
    `Patient: ${patient.given} ${patient.family}`,
    `Date: ${dateStr(new Date())}`,
    ``,
    `CHIEF COMPLAINT:`,
    `${age > 50 ? 'Follow-up for chronic conditions' : 'Routine health maintenance visit'}`,
    ``,
    `HISTORY OF PRESENT ILLNESS:`,
    `${patient.given} ${patient.family} is a ${age}-year-old ${patient.gender} presenting for ${age > 50 ? 'follow-up of chronic conditions' : 'routine health maintenance'}. Patient reports feeling generally well. ${age > 50 ? 'Blood pressure has been well-controlled on current medications. Denies chest pain, shortness of breath, or edema.' : 'No acute complaints. Denies fever, chills, or weight changes.'}`,
    ``,
    `REVIEW OF SYSTEMS:`,
    `Constitutional: No fever, chills, fatigue, or weight changes.`,
    `HEENT: No headache, vision changes, or hearing loss.`,
    `Cardiovascular: No chest pain, palpitations, or edema.`,
    `Respiratory: No cough, dyspnea, or wheezing.`,
    `GI: No nausea, vomiting, diarrhea, or abdominal pain.`,
    `Musculoskeletal: ${age > 50 ? 'Mild joint stiffness in the morning, resolving within 30 minutes.' : 'No joint pain or stiffness.'}`,
    `Neurological: No headache, dizziness, or numbness.`,
    `Psychiatric: No depression or anxiety symptoms reported.`,
    ``,
    `PHYSICAL EXAMINATION:`,
    `General: Alert, oriented, in no acute distress.`,
    `HEENT: Normocephalic, atraumatic. PERRL. Oropharynx clear.`,
    `Neck: Supple, no lymphadenopathy.`,
    `Cardiovascular: Regular rate and rhythm, no murmurs, rubs, or gallops.`,
    `Lungs: Clear to auscultation bilaterally.`,
    `Abdomen: Soft, non-tender, non-distended. Normal bowel sounds.`,
    `Extremities: No edema, no cyanosis.`,
    `Skin: No rashes or lesions.`,
    ``,
    `ASSESSMENT AND PLAN:`,
    `${age > 50 ? '1. Hypertension - well controlled. Continue current medications.\n2. Hyperlipidemia - continue statin therapy. Recheck lipid panel in 6 months.\n3. Health maintenance - up to date on immunizations. Schedule colonoscopy if due.' : '1. Health maintenance - all immunizations up to date.\n2. Routine labs ordered.\n3. Return in 1 year for annual physical or sooner if concerns arise.'}`,
    ``,
    `Signed electronically.`,
  ].join('\n');
}

function buildCarePlan(patientRef: string, conditions: typeof CONDITIONS, patientIndex: number): object {
  return {
    resourceType: 'CarePlan',
    id: `careplan-${patientIndex}`,
    meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan'] },
    status: 'active',
    intent: 'plan',
    category: [{ coding: [{ system: 'http://hl7.org/fhir/us/core/CodeSystem/careplan-category', code: 'assess-plan' }] }],
    title: `Care Plan for ${PATIENTS_DEMO[patientIndex].given} ${PATIENTS_DEMO[patientIndex].family}`,
    subject: { reference: patientRef },
    period: { start: pastDate(1) },
    activity: conditions.slice(0, 3).map((c) => ({
      detail: {
        status: 'in-progress',
        description: `Manage ${c.display} with medication and lifestyle modifications`,
      },
    })),
  };
}

function buildGoal(patientRef: string, goalIndex: number, patientIndex: number): object {
  const goals = [
    { description: 'Maintain blood pressure below 140/90 mmHg', code: '135840009', display: 'Blood pressure monitoring' },
    { description: 'Maintain HbA1c below 7%', code: '43396009', display: 'Hemoglobin A1c measurement' },
    { description: 'Increase physical activity to 150 minutes per week', code: '226029000', display: 'Exercises' },
    { description: 'Achieve BMI within normal range (18.5-24.9)', code: '60621009', display: 'Body mass index' },
    { description: 'Reduce tobacco use', code: '225323000', display: 'Smoking cessation' },
  ];
  const goal = goals[goalIndex % goals.length];
  return {
    resourceType: 'Goal',
    id: `goal-${patientIndex}-${goalIndex}`,
    meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal'] },
    lifecycleStatus: 'active',
    description: { text: goal.description },
    subject: { reference: patientRef },
    startDate: pastDate(1),
    target: [{ dueDate: futureDate(180) }],
  };
}

function buildCareTeam(patientRef: string, patientIndex: number): object {
  const assignedProviders = pickN(PROVIDERS.filter((p) => p.role === 'Physician' || p.role === 'Nurse Practitioner'), 2);
  return {
    resourceType: 'CareTeam',
    id: `careteam-${patientIndex}`,
    meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-careteam'] },
    status: 'active',
    subject: { reference: patientRef },
    participant: assignedProviders.map((p) => ({
      role: [{ coding: [{ system: 'http://snomed.info/sct', code: p.roleCode, display: p.role }] }],
      member: { reference: `Practitioner/practitioner-${p.npi}`, display: `${p.given} ${p.family}` },
    })),
  };
}

function buildCoverage(patientRef: string, patientIndex: number): object {
  const payors = [
    { name: 'Indian Health Service', type: 'IHS' },
    { name: 'Medicaid', type: 'Medicaid' },
    { name: 'Medicare', type: 'Medicare' },
    { name: 'Blue Cross Blue Shield', type: 'Commercial' },
  ];
  const payor = pick(payors);
  return {
    resourceType: 'Coverage',
    id: `coverage-${patientIndex}`,
    status: 'active',
    type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'EHCPOL', display: 'Extended healthcare' }] },
    subscriber: { reference: patientRef },
    beneficiary: { reference: patientRef },
    relationship: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship', code: 'self' }] },
    period: { start: pastDate(1) },
    payor: [{ display: payor.name }],
    class: [{ type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-class', code: 'plan' }] }, value: payor.type, name: payor.name }],
  };
}

function buildProcedure(patientRef: string, encounterRef: string, procIndex: number, patientIndex: number): object {
  const procedures = [
    { code: '36415', display: 'Venipuncture', system: 'http://www.ama-assn.org/go/cpt' },
    { code: '99000', display: 'Specimen handling', system: 'http://www.ama-assn.org/go/cpt' },
    { code: '90471', display: 'Immunization administration', system: 'http://www.ama-assn.org/go/cpt' },
    { code: '93000', display: 'Electrocardiogram, routine ECG', system: 'http://www.ama-assn.org/go/cpt' },
    { code: '71046', display: 'Chest X-ray, 2 views', system: 'http://www.ama-assn.org/go/cpt' },
    { code: '81001', display: 'Urinalysis with microscopy', system: 'http://www.ama-assn.org/go/cpt' },
  ];
  const proc = procedures[procIndex % procedures.length];
  return {
    resourceType: 'Procedure',
    id: `procedure-${patientIndex}-${procIndex}`,
    meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure'] },
    status: 'completed',
    code: { coding: [{ system: proc.system, code: proc.code, display: proc.display }], text: proc.display },
    subject: { reference: patientRef },
    encounter: { reference: encounterRef },
    performedDateTime: pastDate(randomInt(0, 2)),
  };
}

function buildDiagnosticReport(patientRef: string, encounterRef: string, reportIndex: number, patientIndex: number, encounterDate: string): object {
  const reports = [
    {
      code: '58410-2', display: 'Complete blood count (CBC) panel',
      results: [
        { code: '6690-2', display: 'Leukocytes [#/volume] in Blood by Automated count', value: randomFloat(4.0, 11.0), unit: '10*3/uL' },
        { code: '789-8', display: 'Erythrocytes [#/volume] in Blood by Automated count', value: randomFloat(4.0, 5.5), unit: '10*6/uL' },
        { code: '718-7', display: 'Hemoglobin [Mass/volume] in Blood', value: randomFloat(12.0, 17.0), unit: 'g/dL' },
        { code: '4544-3', display: 'Hematocrit [Volume Fraction] of Blood by Automated count', value: randomFloat(36.0, 50.0), unit: '%' },
        { code: '777-3', display: 'Platelets [#/volume] in Blood by Automated count', value: randomFloat(150, 400, 0), unit: '10*3/uL' },
      ],
    },
    {
      code: '24323-8', display: 'Comprehensive metabolic panel',
      results: [
        { code: '2345-7', display: 'Glucose [Mass/volume] in Serum or Plasma', value: randomFloat(70, 130, 0), unit: 'mg/dL' },
        { code: '3094-0', display: 'Urea nitrogen [Mass/volume] in Serum or Plasma', value: randomFloat(7, 25, 0), unit: 'mg/dL' },
        { code: '2160-0', display: 'Creatinine [Mass/volume] in Serum or Plasma', value: randomFloat(0.6, 1.3), unit: 'mg/dL' },
        { code: '17861-6', display: 'Calcium [Mass/volume] in Serum or Plasma', value: randomFloat(8.5, 10.5), unit: 'mg/dL' },
        { code: '2951-2', display: 'Sodium [Moles/volume] in Serum or Plasma', value: randomFloat(136, 145, 0), unit: 'mmol/L' },
        { code: '2823-3', display: 'Potassium [Moles/volume] in Serum or Plasma', value: randomFloat(3.5, 5.0), unit: 'mmol/L' },
      ],
    },
    {
      code: '57698-3', display: 'Lipid panel with direct LDL',
      results: [
        { code: '2093-3', display: 'Cholesterol [Mass/volume] in Serum or Plasma', value: randomFloat(150, 280, 0), unit: 'mg/dL' },
        { code: '2571-8', display: 'Triglycerides [Mass/volume] in Serum or Plasma', value: randomFloat(50, 250, 0), unit: 'mg/dL' },
        { code: '2085-9', display: 'HDL cholesterol [Mass/volume] in Serum or Plasma', value: randomFloat(35, 80, 0), unit: 'mg/dL' },
        { code: '18262-6', display: 'LDL cholesterol [Mass/volume] in Serum or Plasma (Direct)', value: randomFloat(70, 190, 0), unit: 'mg/dL' },
      ],
    },
  ];

  const report = reports[reportIndex % reports.length];
  const resultRefs = report.results.map((_, ri) => ({
    reference: `Observation/lab-${patientIndex}-${reportIndex}-${ri}`,
  }));

  return {
    resourceType: 'DiagnosticReport',
    id: `diag-${patientIndex}-${reportIndex}`,
    meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab'] },
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB', display: 'Laboratory' }] }],
    code: { coding: [{ system: 'http://loinc.org', code: report.code, display: report.display }], text: report.display },
    subject: { reference: patientRef },
    encounter: { reference: encounterRef },
    effectiveDateTime: encounterDate,
    issued: `${encounterDate}T12:00:00Z`,
    result: resultRefs,
    _labResults: report.results, // internal: we use this to generate child Observations
  } as any;
}

function buildLabObservation(
  patientRef: string,
  encounterRef: string,
  lab: { code: string; display: string; value: number; unit: string },
  reportIndex: number,
  resultIndex: number,
  patientIndex: number,
  encounterDate: string,
): object {
  return {
    resourceType: 'Observation',
    id: `lab-${patientIndex}-${reportIndex}-${resultIndex}`,
    meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab'] },
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory', display: 'Laboratory' }] }],
    code: { coding: [{ system: 'http://loinc.org', code: lab.code, display: lab.display }], text: lab.display },
    subject: { reference: patientRef },
    encounter: { reference: encounterRef },
    effectiveDateTime: encounterDate,
    valueQuantity: { value: lab.value, unit: lab.unit, system: 'http://unitsofmeasure.org', code: lab.unit },
  };
}

function buildProvenance(patientRef: string, practitionerRef: string, targetRef: string, patientIndex: number, provIndex: number): object {
  return {
    resourceType: 'Provenance',
    id: `provenance-${patientIndex}-${provIndex}`,
    target: [{ reference: targetRef }],
    recorded: instantStr(new Date()),
    agent: [
      {
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: 'author', display: 'Author' }] },
        who: { reference: practitionerRef },
      },
      {
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: 'transmitter', display: 'Transmitter' }] },
        who: { reference: 'Organization/tribal-ehr-org' },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Bundle builder and HTTP submission
// ---------------------------------------------------------------------------

function wrapInTransactionBundle(resources: object[]): object {
  return {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: resources.map((resource: any) => ({
      fullUrl: `${FHIR_BASE}/${resource.resourceType}/${resource.id}`,
      resource,
      request: {
        method: 'PUT',
        url: `${resource.resourceType}/${resource.id}`,
      },
    })),
  };
}

async function submitBundle(bundle: object, description: string): Promise<void> {
  console.log(`  Submitting: ${description}...`);
  const response = await fetch(FHIR_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/fhir+json' },
    body: JSON.stringify(bundle),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error(`    FAILED (HTTP ${response.status}): ${text.substring(0, 500)}`);
    throw new Error(`Failed to submit ${description}: HTTP ${response.status}`);
  }
  console.log(`    OK (HTTP ${response.status})`);
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  console.log('='.repeat(60));
  console.log('  Tribal EHR - Seed Data Generator');
  console.log('='.repeat(60));
  console.log(`  FHIR Server: ${FHIR_BASE}`);
  console.log('');

  // ------ Phase 1: Organization, Location ------
  console.log('[Phase 1] Organization & Location');
  const orgResources: object[] = [buildOrganization(), buildLocation()];
  await submitBundle(wrapInTransactionBundle(orgResources), 'Organization and Location');

  // ------ Phase 2: Practitioners ------
  console.log('[Phase 2] Practitioners');
  const practitionerResources: object[] = [];
  for (const p of PROVIDERS) {
    practitionerResources.push(buildPractitioner(p));
    practitionerResources.push(buildPractitionerRole(p));
  }
  await submitBundle(wrapInTransactionBundle(practitionerResources), `${PROVIDERS.length} Practitioners and PractitionerRoles`);

  // ------ Phase 3: Patients and clinical data ------
  console.log('[Phase 3] Patients and clinical data');
  let appointmentCounter = 0;

  for (let pi = 0; pi < PATIENTS_DEMO.length; pi++) {
    const demo = PATIENTS_DEMO[pi];
    const patientId = `patient-${String(pi + 1).padStart(3, '0')}`;
    const patientRef = `Patient/${patientId}`;
    const assignedProvider = PROVIDERS[pi % 3]; // Rotate among the 3 clinical providers
    const practitionerRef = `Practitioner/practitioner-${assignedProvider.npi}`;

    const patientResources: object[] = [];

    // Patient resource
    patientResources.push(buildPatient(demo, pi));

    // Allergies (1-3 per patient)
    const patientAllergies = pickN(ALLERGIES, randomInt(1, 3));
    patientAllergies.forEach((a, ai) => {
      patientResources.push(buildAllergyIntolerance(patientRef, a, ai, pi));
    });

    // Conditions (2-5 per patient)
    const patientConditions = pickN(CONDITIONS, randomInt(2, 5));
    patientConditions.forEach((c, ci) => {
      patientResources.push(buildCondition(patientRef, c, ci, pi));
    });

    // Past encounters (2-4 per patient)
    const numEncounters = randomInt(2, 4);
    for (let ei = 0; ei < numEncounters; ei++) {
      const encDate = pastDate(randomInt(0, 2));
      const encounterRef = `Encounter/encounter-${pi}-${ei}`;

      patientResources.push(buildEncounter(patientRef, practitionerRef, encDate, ei, pi));

      // Vital signs per encounter
      const vitals = buildVitalSigns(patientRef, encounterRef, encDate, pi, ei);
      patientResources.push(...vitals);

      // Medications tied to conditions
      const relevantMeds = MEDICATIONS.filter((m) =>
        m.conditionCodes.some((cc) => patientConditions.some((pc) => pc.code === cc)),
      );
      const selectedMeds = pickN(relevantMeds, Math.min(relevantMeds.length, randomInt(1, 4)));
      selectedMeds.forEach((m, mi) => {
        patientResources.push(buildMedicationRequest(patientRef, m, encounterRef, practitionerRef, mi + ei * 10, pi));
      });

      // Procedures (0-2 per encounter)
      const numProcs = randomInt(0, 2);
      for (let pri = 0; pri < numProcs; pri++) {
        patientResources.push(buildProcedure(patientRef, encounterRef, pri + ei * 10, pi));
      }

      // Diagnostic reports (1 per encounter for half of encounters)
      if (ei % 2 === 0) {
        const report = buildDiagnosticReport(patientRef, encounterRef, ei, pi, encDate) as any;
        const labResults = report._labResults;
        delete report._labResults;
        patientResources.push(report);

        // Lab observations from the report
        labResults.forEach((lab: any, ri: number) => {
          patientResources.push(buildLabObservation(patientRef, encounterRef, lab, ei, ri, pi, encDate));
        });
      }

      // Clinical note document (1 per encounter)
      patientResources.push(buildDocumentReference(patientRef, encounterRef, practitionerRef, ei, pi, encDate));
    }

    // Smoking status
    patientResources.push(buildSmokingStatus(patientRef, pi));

    // Immunizations (2-5 per patient)
    const patientImms = pickN(IMMUNIZATIONS, randomInt(2, 5));
    patientImms.forEach((imm, ii) => {
      patientResources.push(buildImmunization(patientRef, imm, ii, pi));
    });

    // Care plan, care team, goals, coverage
    patientResources.push(buildCarePlan(patientRef, patientConditions, pi));
    patientResources.push(buildCareTeam(patientRef, pi));
    patientResources.push(buildCoverage(patientRef, pi));

    // Goals (1-3 per patient)
    const numGoals = randomInt(1, 3);
    for (let gi = 0; gi < numGoals; gi++) {
      patientResources.push(buildGoal(patientRef, gi, pi));
    }

    // Provenance for the patient record
    patientResources.push(buildProvenance(patientRef, practitionerRef, patientRef, pi, 0));

    await submitBundle(wrapInTransactionBundle(patientResources), `Patient ${pi + 1}/20: ${demo.given} ${demo.family} (${patientResources.length} resources)`);

    // Future appointments (for the next 2 weeks, spread across patients)
    if (pi < 14) { // Appointments for first 14 patients across 10 weekdays
      const dayOffset = Math.floor(pi / 2) * 1 + 1; // Spread across days
      const slotHour = 8 + (pi % 6); // Morning slots 8-13
      const apptDate = futureDate(dayOffset > 14 ? dayOffset % 14 : dayOffset);
      appointmentCounter++;
      const apptResources = [buildAppointment(patientRef, practitionerRef, apptDate, slotHour, appointmentCounter)];
      await submitBundle(wrapInTransactionBundle(apptResources), `Appointment for ${demo.given} ${demo.family}`);
    }
  }

  // ------ Summary ------
  console.log('');
  console.log('='.repeat(60));
  console.log('  Seed data generation complete!');
  console.log('');
  console.log('  Created:');
  console.log('    - 1 Organization (Tribal Health Center)');
  console.log('    - 1 Location (Main Clinic)');
  console.log(`    - ${PROVIDERS.length} Practitioners with PractitionerRoles`);
  console.log(`    - ${PATIENTS_DEMO.length} Patients with full US Core profiles`);
  console.log('    - Allergies, Conditions, Medications per patient');
  console.log('    - Vital signs, Lab results, Procedures per encounter');
  console.log('    - Immunization records');
  console.log('    - Care Plans, Care Teams, Goals, Coverage');
  console.log('    - Clinical notes (DocumentReference)');
  console.log('    - Provenance records');
  console.log(`    - ${appointmentCounter} future Appointments`);
  console.log('='.repeat(60));
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

seed().catch((err) => {
  console.error('Seed data generation failed:', err);
  process.exit(1);
});
