// Clinical conditions reference data with ICD-10-CM codes

export type ClinicalProfile =
  | 'DIABETIC'
  | 'CARDIAC'
  | 'SNF'
  | 'SURGICAL'
  | 'INPATIENT'
  | 'MENTAL_HEALTH'
  | 'PEDIATRIC'
  | 'HEALTHY';

export interface Condition {
  code: string;
  display: string;
  system: string;
  category: string;
  profile: ClinicalProfile[];
}

export const CONDITIONS: Condition[] = [
  // Diabetes
  {
    code: 'E11.9',
    display: 'Type 2 diabetes mellitus without complications',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'endocrine',
    profile: ['DIABETIC', 'CARDIAC', 'SNF'],
  },
  {
    code: 'E11.65',
    display: 'Type 2 diabetes mellitus with hyperglycemia',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'endocrine',
    profile: ['DIABETIC'],
  },
  {
    code: 'E11.40',
    display: 'Type 2 diabetes mellitus with diabetic neuropathy, unspecified',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'endocrine',
    profile: ['DIABETIC', 'SNF'],
  },
  {
    code: 'E11.22',
    display: 'Type 2 diabetes mellitus with diabetic chronic kidney disease',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'endocrine',
    profile: ['DIABETIC'],
  },

  // Cardiac
  {
    code: 'I10',
    display: 'Essential (primary) hypertension',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'cardiovascular',
    profile: ['CARDIAC', 'DIABETIC', 'SNF', 'HEALTHY'],
  },
  {
    code: 'I25.10',
    display: 'Atherosclerotic heart disease of native coronary artery without angina pectoris',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'cardiovascular',
    profile: ['CARDIAC'],
  },
  {
    code: 'I50.9',
    display: 'Heart failure, unspecified',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'cardiovascular',
    profile: ['CARDIAC', 'INPATIENT', 'SNF'],
  },
  {
    code: 'I48.91',
    display: 'Unspecified atrial fibrillation',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'cardiovascular',
    profile: ['CARDIAC'],
  },

  // Respiratory
  {
    code: 'J45.20',
    display: 'Mild intermittent asthma, uncomplicated',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'respiratory',
    profile: ['PEDIATRIC', 'HEALTHY'],
  },
  {
    code: 'J45.40',
    display: 'Moderate persistent asthma, uncomplicated',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'respiratory',
    profile: ['INPATIENT', 'PEDIATRIC'],
  },
  {
    code: 'J06.9',
    display: 'Acute upper respiratory infection, unspecified',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'respiratory',
    profile: ['PEDIATRIC', 'HEALTHY'],
  },
  {
    code: 'J18.9',
    display: 'Pneumonia, unspecified organism',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'respiratory',
    profile: ['INPATIENT', 'SNF'],
  },

  // Mental Health
  {
    code: 'F32.1',
    display: 'Major depressive disorder, single episode, moderate',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'mental_health',
    profile: ['MENTAL_HEALTH'],
  },
  {
    code: 'F41.1',
    display: 'Generalized anxiety disorder',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'mental_health',
    profile: ['MENTAL_HEALTH', 'HEALTHY'],
  },
  {
    code: 'F10.20',
    display: 'Alcohol dependence, uncomplicated',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'mental_health',
    profile: ['MENTAL_HEALTH', 'INPATIENT'],
  },
  {
    code: 'F43.10',
    display: 'Post-traumatic stress disorder, unspecified',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'mental_health',
    profile: ['MENTAL_HEALTH'],
  },
  {
    code: 'F90.0',
    display: 'Attention-deficit hyperactivity disorder, predominantly inattentive type',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'mental_health',
    profile: ['PEDIATRIC', 'MENTAL_HEALTH'],
  },

  // Musculoskeletal
  {
    code: 'M54.5',
    display: 'Low back pain',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'musculoskeletal',
    profile: ['SURGICAL', 'HEALTHY'],
  },
  {
    code: 'M17.11',
    display: 'Primary osteoarthritis, right knee',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'musculoskeletal',
    profile: ['SURGICAL', 'SNF'],
  },
  {
    code: 'M79.3',
    display: 'Panniculitis, unspecified',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'musculoskeletal',
    profile: ['HEALTHY'],
  },
  {
    code: 'M25.50',
    display: 'Pain in unspecified joint',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'musculoskeletal',
    profile: ['HEALTHY', 'SNF'],
  },

  // Gastrointestinal
  {
    code: 'K21.0',
    display: 'Gastro-esophageal reflux disease with esophagitis',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'gastrointestinal',
    profile: ['HEALTHY', 'SURGICAL'],
  },
  {
    code: 'K80.20',
    display: 'Calculus of gallbladder without cholecystitis, without obstruction',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'gastrointestinal',
    profile: ['SURGICAL'],
  },
  {
    code: 'K85',
    display: 'Acute pancreatitis, unspecified',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'gastrointestinal',
    profile: ['INPATIENT', 'SURGICAL'],
  },

  // Renal
  {
    code: 'N18.3',
    display: 'Chronic kidney disease, stage 3 (moderate)',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'renal',
    profile: ['DIABETIC', 'CARDIAC', 'SNF'],
  },

  // SNF-specific
  {
    code: 'G47.33',
    display: 'Obstructive sleep apnea',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'neurological',
    profile: ['SNF', 'CARDIAC'],
  },
  {
    code: 'L89.0',
    display: 'Pressure ulcer of unspecified site, stage unspecified',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'dermatological',
    profile: ['SNF'],
  },
  {
    code: 'R26.81',
    display: 'Unsteadiness on feet',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'neurological',
    profile: ['SNF'],
  },

  // Pediatric
  {
    code: 'L30.9',
    display: 'Dermatitis, unspecified',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'dermatological',
    profile: ['PEDIATRIC', 'HEALTHY'],
  },
  {
    code: 'H66.90',
    display: 'Otitis media, unspecified, unspecified ear',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'ent',
    profile: ['PEDIATRIC'],
  },

  // General / cross-profile
  {
    code: 'E78.5',
    display: 'Hyperlipidemia, unspecified',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'endocrine',
    profile: ['CARDIAC', 'DIABETIC', 'HEALTHY'],
  },
  {
    code: 'E66.9',
    display: 'Obesity, unspecified',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'endocrine',
    profile: ['DIABETIC', 'CARDIAC', 'HEALTHY'],
  },
  {
    code: 'E03.9',
    display: 'Hypothyroidism, unspecified',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'endocrine',
    profile: ['HEALTHY'],
  },
  {
    code: 'N39.0',
    display: 'Urinary tract infection, site not specified',
    system: 'http://hl7.org/fhir/sid/icd-10-cm',
    category: 'genitourinary',
    profile: ['SNF', 'INPATIENT', 'HEALTHY'],
  },
];
