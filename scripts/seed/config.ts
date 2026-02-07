// Constants and configuration for the seed script

export const SEED_CONFIG = {
  NUM_PATIENTS: 500,
  DATE_RANGE_START: '2023-01-01',
  DATE_RANGE_END: '2025-01-31',
  FUTURE_RANGE_END: '2025-03-15', // for upcoming appointments
  DEFAULT_PASSWORD: 'Password123!',
  MRN_PREFIX: 'TRB',
};

// Clinical profile distribution (% of 500 patients)
export const PROFILE_DISTRIBUTION = {
  DIABETIC: 0.20,        // 100 patients
  CARDIAC: 0.10,         // 50 patients
  SNF: 0.05,            // 25 patients
  SURGICAL: 0.08,       // 40 patients
  INPATIENT: 0.07,      // 35 patients
  MENTAL_HEALTH: 0.10,  // 50 patients
  PEDIATRIC: 0.08,      // 40 patients
  HEALTHY: 0.32,        // 160 patients
};

// Encounter distribution
export const ENCOUNTER_DISTRIBUTION = {
  AMB: 0.65,    // Outpatient
  IMP: 0.10,    // Inpatient
  SS: 0.08,     // Outpatient Surgical
  NONAC: 0.05,  // SNF
  EMER: 0.07,   // Emergency
  VR: 0.05,     // Virtual
};
