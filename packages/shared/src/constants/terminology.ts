// =============================================================================
// Terminology / Code System Constants
// =============================================================================

// ---------------------------------------------------------------------------
// Code System URIs
// ---------------------------------------------------------------------------

export const CODE_SYSTEMS = {
  SNOMED_CT: 'http://snomed.info/sct',
  LOINC: 'http://loinc.org',
  RXNORM: 'http://www.nlm.nih.gov/research/umls/rxnorm',
  CVX: 'http://hl7.org/fhir/sid/cvx',
  ICD10CM: 'http://hl7.org/fhir/sid/icd-10-cm',
  CPT: 'http://www.ama-assn.org/go/cpt',
  HCPCS: 'https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets',
  NDC: 'http://hl7.org/fhir/sid/ndc',
  UCUM: 'http://unitsofmeasure.org',
  CDC_RACE: 'urn:oid:2.16.840.1.113883.6.238',
  OBSERVATION_CATEGORY: 'http://terminology.hl7.org/CodeSystem/observation-category',
  CONDITION_CATEGORY: 'http://terminology.hl7.org/CodeSystem/condition-category',
  ALLERGY_CLINICAL_STATUS: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
  ALLERGY_VERIFICATION_STATUS: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
  CONDITION_CLINICAL_STATUS: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
  CONDITION_VERIFICATION_STATUS: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
} as const;

// ---------------------------------------------------------------------------
// Common LOINC Codes for Vital Signs
// ---------------------------------------------------------------------------

export const VITAL_SIGN_CODES = {
  BLOOD_PRESSURE_SYSTOLIC: {
    system: CODE_SYSTEMS.LOINC,
    code: '8480-6',
    display: 'Systolic blood pressure',
  },
  BLOOD_PRESSURE_DIASTOLIC: {
    system: CODE_SYSTEMS.LOINC,
    code: '8462-4',
    display: 'Diastolic blood pressure',
  },
  BLOOD_PRESSURE_PANEL: {
    system: CODE_SYSTEMS.LOINC,
    code: '85354-9',
    display: 'Blood pressure panel with all children optional',
  },
  HEART_RATE: {
    system: CODE_SYSTEMS.LOINC,
    code: '8867-4',
    display: 'Heart rate',
  },
  RESPIRATORY_RATE: {
    system: CODE_SYSTEMS.LOINC,
    code: '9279-1',
    display: 'Respiratory rate',
  },
  TEMPERATURE: {
    system: CODE_SYSTEMS.LOINC,
    code: '8310-5',
    display: 'Body temperature',
  },
  SPO2: {
    system: CODE_SYSTEMS.LOINC,
    code: '59408-5',
    display: 'Oxygen saturation in Arterial blood by Pulse oximetry',
  },
  HEIGHT: {
    system: CODE_SYSTEMS.LOINC,
    code: '8302-2',
    display: 'Body height',
  },
  WEIGHT: {
    system: CODE_SYSTEMS.LOINC,
    code: '29463-7',
    display: 'Body weight',
  },
  BMI: {
    system: CODE_SYSTEMS.LOINC,
    code: '39156-5',
    display: 'Body mass index (BMI) [Ratio]',
  },
  HEAD_CIRCUMFERENCE: {
    system: CODE_SYSTEMS.LOINC,
    code: '9843-4',
    display: 'Head Occipital-frontal circumference',
  },
  INHALED_OXYGEN_CONCENTRATION: {
    system: CODE_SYSTEMS.LOINC,
    code: '3151-8',
    display: 'Inhaled oxygen flow rate',
  },
} as const;

// ---------------------------------------------------------------------------
// Smoking Status LOINC Code
// ---------------------------------------------------------------------------

export const SMOKING_STATUS_CODE = {
  system: CODE_SYSTEMS.LOINC,
  code: '72166-2',
  display: 'Tobacco smoking status',
} as const;

// ---------------------------------------------------------------------------
// Vital Sign Reference Ranges (Adult)
// ---------------------------------------------------------------------------

export const VITAL_SIGN_REFERENCE_RANGES = {
  BLOOD_PRESSURE_SYSTOLIC: { low: 90, high: 120, unit: 'mmHg', criticalLow: 70, criticalHigh: 180 },
  BLOOD_PRESSURE_DIASTOLIC: { low: 60, high: 80, unit: 'mmHg', criticalLow: 40, criticalHigh: 120 },
  HEART_RATE: { low: 60, high: 100, unit: '/min', criticalLow: 40, criticalHigh: 150 },
  RESPIRATORY_RATE: { low: 12, high: 20, unit: '/min', criticalLow: 8, criticalHigh: 30 },
  TEMPERATURE: { low: 36.1, high: 37.2, unit: 'Cel', criticalLow: 35.0, criticalHigh: 40.0 },
  SPO2: { low: 95, high: 100, unit: '%', criticalLow: 90, criticalHigh: 100 },
  BMI: { low: 18.5, high: 24.9, unit: 'kg/m2', criticalLow: 15.0, criticalHigh: 40.0 },
} as const;

// ---------------------------------------------------------------------------
// Vital Sign Units (UCUM)
// ---------------------------------------------------------------------------

export const VITAL_SIGN_UNITS = {
  BLOOD_PRESSURE: { unit: 'mmHg', system: CODE_SYSTEMS.UCUM, code: 'mm[Hg]' },
  HEART_RATE: { unit: '/min', system: CODE_SYSTEMS.UCUM, code: '/min' },
  RESPIRATORY_RATE: { unit: '/min', system: CODE_SYSTEMS.UCUM, code: '/min' },
  TEMPERATURE_CELSIUS: { unit: 'Cel', system: CODE_SYSTEMS.UCUM, code: 'Cel' },
  TEMPERATURE_FAHRENHEIT: { unit: '[degF]', system: CODE_SYSTEMS.UCUM, code: '[degF]' },
  SPO2: { unit: '%', system: CODE_SYSTEMS.UCUM, code: '%' },
  HEIGHT_CM: { unit: 'cm', system: CODE_SYSTEMS.UCUM, code: 'cm' },
  HEIGHT_IN: { unit: '[in_i]', system: CODE_SYSTEMS.UCUM, code: '[in_i]' },
  WEIGHT_KG: { unit: 'kg', system: CODE_SYSTEMS.UCUM, code: 'kg' },
  WEIGHT_LB: { unit: '[lb_av]', system: CODE_SYSTEMS.UCUM, code: '[lb_av]' },
  BMI: { unit: 'kg/m2', system: CODE_SYSTEMS.UCUM, code: 'kg/m2' },
  HEAD_CIRCUMFERENCE: { unit: 'cm', system: CODE_SYSTEMS.UCUM, code: 'cm' },
  INHALED_O2_FLOW: { unit: 'L/min', system: CODE_SYSTEMS.UCUM, code: 'L/min' },
  INHALED_O2_CONCENTRATION: { unit: '%', system: CODE_SYSTEMS.UCUM, code: '%' },
} as const;

// ---------------------------------------------------------------------------
// Observation Categories
// ---------------------------------------------------------------------------

export const OBSERVATION_CATEGORIES = {
  VITAL_SIGNS: {
    system: CODE_SYSTEMS.OBSERVATION_CATEGORY,
    code: 'vital-signs',
    display: 'Vital Signs',
  },
  LABORATORY: {
    system: CODE_SYSTEMS.OBSERVATION_CATEGORY,
    code: 'laboratory',
    display: 'Laboratory',
  },
  SOCIAL_HISTORY: {
    system: CODE_SYSTEMS.OBSERVATION_CATEGORY,
    code: 'social-history',
    display: 'Social History',
  },
  SDOH: {
    system: CODE_SYSTEMS.OBSERVATION_CATEGORY,
    code: 'sdoh',
    display: 'SDOH',
  },
  SURVEY: {
    system: CODE_SYSTEMS.OBSERVATION_CATEGORY,
    code: 'survey',
    display: 'Survey',
  },
  EXAM: {
    system: CODE_SYSTEMS.OBSERVATION_CATEGORY,
    code: 'exam',
    display: 'Exam',
  },
} as const;
