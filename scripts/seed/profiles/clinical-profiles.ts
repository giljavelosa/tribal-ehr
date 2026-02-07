// Each profile type
export type ProfileType = 'DIABETIC' | 'CARDIAC' | 'SNF' | 'SURGICAL' | 'INPATIENT' | 'MENTAL_HEALTH' | 'PEDIATRIC' | 'HEALTHY';

export interface ClinicalProfile {
  type: ProfileType;
  // ICD-10 codes for conditions to assign (primary + comorbidities)
  conditionCodes: string[];
  // RxNorm codes for medications tied to this profile
  medicationCodes: string[];
  // Lab panels to order (keys from LAB_PANELS)
  labPanels: string[];
  // Lab frequency in days (how often labs repeat)
  labFrequencyDays: number;
  // Encounter class distribution override (if different from default)
  encounterClasses: { class: string; weight: number }[];
  // Min/max encounters over 2-year period
  encounterRange: { min: number; max: number };
  // Whether this profile typically has a care plan
  hasCarePlan: boolean;
  // Whether this profile has care team assignment
  hasCareTeam: boolean;
  // Number of goals if care plan exists
  goalRange: { min: number; max: number };
  // Procedure CPT codes associated with this profile
  procedureCodes: string[];
  // Allergy probability (0-1)
  allergyProbability: number;
  // Average number of allergies if has any
  avgAllergyCount: number;
  // Vital sign profile adjustments (multipliers or offsets)
  vitalAdjustments?: {
    systolicOffset?: number;  // e.g., +20 for hypertensive patients
    diastolicOffset?: number;
    bmiRange?: { min: number; max: number };
    glucoseMultiplier?: number;
  };
  // Age range for this profile
  ageRange: { min: number; max: number };
  // Note types this profile generates
  noteTypes: string[];
}

export const CLINICAL_PROFILES: Record<ProfileType, ClinicalProfile> = {
  DIABETIC: {
    type: 'DIABETIC',
    conditionCodes: ['E11.9', 'I10', 'E78.5'],  // T2DM + HTN + hyperlipidemia
    medicationCodes: ['860975', '197361', '314076', '859747'], // Metformin, Amlodipine, Lisinopril, Atorvastatin
    labPanels: ['HBA1C', 'BMP', 'LIPID', 'CBC'],
    labFrequencyDays: 90,  // A1C every 3 months
    encounterClasses: [
      { class: 'AMB', weight: 0.85 },
      { class: 'IMP', weight: 0.05 },
      { class: 'EMER', weight: 0.05 },
      { class: 'VR', weight: 0.05 },
    ],
    encounterRange: { min: 4, max: 8 },
    hasCarePlan: true,
    hasCareTeam: true,
    goalRange: { min: 2, max: 4 },
    procedureCodes: ['99214', '36415', '93000'],
    allergyProbability: 0.3,
    avgAllergyCount: 2,
    vitalAdjustments: {
      systolicOffset: 10,
      diastolicOffset: 5,
      bmiRange: { min: 26, max: 38 },
      glucoseMultiplier: 1.3,
    },
    ageRange: { min: 35, max: 85 },
    noteTypes: ['progress_note'],
  },
  CARDIAC: {
    type: 'CARDIAC',
    conditionCodes: ['I10', 'I25.10', 'E78.5'],  // HTN + CAD + hyperlipidemia
    medicationCodes: ['866924', '197361', '859747', '243670'], // Metoprolol, Amlodipine, Atorvastatin, Aspirin 81
    labPanels: ['BMP', 'LIPID', 'CBC'],
    labFrequencyDays: 180,
    encounterClasses: [
      { class: 'AMB', weight: 0.60 },
      { class: 'IMP', weight: 0.20 },
      { class: 'EMER', weight: 0.10 },
      { class: 'VR', weight: 0.10 },
    ],
    encounterRange: { min: 3, max: 7 },
    hasCarePlan: true,
    hasCareTeam: true,
    goalRange: { min: 2, max: 3 },
    procedureCodes: ['93000', '93306', '99214'],
    allergyProbability: 0.35,
    avgAllergyCount: 2,
    vitalAdjustments: {
      systolicOffset: 15,
      diastolicOffset: 8,
      bmiRange: { min: 24, max: 35 },
    },
    ageRange: { min: 45, max: 90 },
    noteTypes: ['progress_note', 'consult_note'],
  },
  SNF: {
    type: 'SNF',
    conditionCodes: ['I10', 'E11.9', 'N18.3', 'G47.33', 'M54.5'],  // Multiple chronic
    medicationCodes: ['860975', '314076', '197361', '866924', '859747', '311671'],
    labPanels: ['CMP', 'CBC', 'HBA1C'],
    labFrequencyDays: 30,
    encounterClasses: [
      { class: 'NONAC', weight: 0.80 },
      { class: 'AMB', weight: 0.10 },
      { class: 'IMP', weight: 0.10 },
    ],
    encounterRange: { min: 6, max: 12 },
    hasCarePlan: true,
    hasCareTeam: true,
    goalRange: { min: 3, max: 5 },
    procedureCodes: ['99214', '36415'],
    allergyProbability: 0.5,
    avgAllergyCount: 3,
    vitalAdjustments: {
      systolicOffset: 10,
      bmiRange: { min: 22, max: 32 },
    },
    ageRange: { min: 65, max: 95 },
    noteTypes: ['snf_daily', 'progress_note', 'nursing_note'],
  },
  SURGICAL: {
    type: 'SURGICAL',
    conditionCodes: ['K80.20', 'M17.11'],  // Varies - cholelithiasis, OA knee
    medicationCodes: ['197696', '198440'], // Post-op meds (Ibuprofen, Acetaminophen)
    labPanels: ['CBC', 'BMP', 'CMP'],
    labFrequencyDays: 0,  // Pre-op only
    encounterClasses: [
      { class: 'SS', weight: 0.50 },
      { class: 'AMB', weight: 0.40 },
      { class: 'IMP', weight: 0.10 },
    ],
    encounterRange: { min: 3, max: 6 },
    hasCarePlan: false,
    hasCareTeam: false,
    goalRange: { min: 0, max: 0 },
    procedureCodes: ['47562', '27447', '49505', '44970'],
    allergyProbability: 0.25,
    avgAllergyCount: 1,
    ageRange: { min: 25, max: 80 },
    noteTypes: ['preop_assessment', 'operative_report', 'postop_note'],
  },
  INPATIENT: {
    type: 'INPATIENT',
    conditionCodes: ['J18.9', 'I50.9', 'K85'],  // Pneumonia, CHF, pancreatitis
    medicationCodes: ['197696', '860975'],
    labPanels: ['CBC', 'CMP', 'BMP'],
    labFrequencyDays: 1,  // Daily labs during admission
    encounterClasses: [
      { class: 'IMP', weight: 0.60 },
      { class: 'AMB', weight: 0.25 },
      { class: 'EMER', weight: 0.15 },
    ],
    encounterRange: { min: 2, max: 5 },
    hasCarePlan: true,
    hasCareTeam: true,
    goalRange: { min: 1, max: 3 },
    procedureCodes: ['71046', '93000', '36415'],
    allergyProbability: 0.3,
    avgAllergyCount: 2,
    ageRange: { min: 30, max: 90 },
    noteTypes: ['hp', 'progress_note', 'discharge_summary'],
  },
  MENTAL_HEALTH: {
    type: 'MENTAL_HEALTH',
    conditionCodes: ['F32.1', 'F41.1'],  // Depression + Anxiety
    medicationCodes: ['312938', '351249', '310384'], // Sertraline, Escitalopram, Fluoxetine
    labPanels: ['BMP', 'TSH'],
    labFrequencyDays: 180,
    encounterClasses: [
      { class: 'AMB', weight: 0.80 },
      { class: 'VR', weight: 0.15 },
      { class: 'EMER', weight: 0.05 },
    ],
    encounterRange: { min: 4, max: 10 },
    hasCarePlan: true,
    hasCareTeam: true,
    goalRange: { min: 2, max: 4 },
    procedureCodes: ['99214'],
    allergyProbability: 0.2,
    avgAllergyCount: 1,
    ageRange: { min: 18, max: 75 },
    noteTypes: ['progress_note'],
  },
  PEDIATRIC: {
    type: 'PEDIATRIC',
    conditionCodes: ['J06.9', 'L30.9'],  // URI, dermatitis
    medicationCodes: ['308182', '311671'], // Amoxicillin, Albuterol
    labPanels: ['CBC'],
    labFrequencyDays: 365,
    encounterClasses: [
      { class: 'AMB', weight: 0.85 },
      { class: 'EMER', weight: 0.10 },
      { class: 'VR', weight: 0.05 },
    ],
    encounterRange: { min: 3, max: 8 },
    hasCarePlan: false,
    hasCareTeam: false,
    goalRange: { min: 0, max: 0 },
    procedureCodes: ['99213', '90471', '36415'],
    allergyProbability: 0.15,
    avgAllergyCount: 1,
    ageRange: { min: 0, max: 17 },
    noteTypes: ['progress_note'],
  },
  HEALTHY: {
    type: 'HEALTHY',
    conditionCodes: [],  // 0-2 minor conditions assigned randomly
    medicationCodes: [],  // 0-2 minor meds assigned randomly
    labPanels: ['CBC', 'BMP'],
    labFrequencyDays: 365,
    encounterClasses: [
      { class: 'AMB', weight: 0.90 },
      { class: 'VR', weight: 0.10 },
    ],
    encounterRange: { min: 1, max: 3 },
    hasCarePlan: false,
    hasCareTeam: false,
    goalRange: { min: 0, max: 0 },
    procedureCodes: ['99213'],
    allergyProbability: 0.25,
    avgAllergyCount: 1,
    ageRange: { min: 18, max: 80 },
    noteTypes: ['progress_note'],
  },
};
