// Medication reference data with RxNorm codes

export interface Medication {
  code: string;
  display: string;
  system: string;
  conditions: string[]; // ICD-10 codes this medication treats
  dosage: string;
  route: string;
  frequency: string;
}

export const MEDICATIONS: Medication[] = [
  // Diabetes medications
  {
    code: '860975',
    display: 'Metformin hydrochloride 500 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['E11.9', 'E11.65', 'E11.40', 'E11.22'],
    dosage: '500 mg',
    route: 'oral',
    frequency: 'twice daily',
  },
  {
    code: '861007',
    display: 'Metformin hydrochloride 1000 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['E11.9', 'E11.65'],
    dosage: '1000 mg',
    route: 'oral',
    frequency: 'twice daily',
  },
  {
    code: '897122',
    display: 'Glipizide 5 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['E11.9', 'E11.65'],
    dosage: '5 mg',
    route: 'oral',
    frequency: 'once daily',
  },
  {
    code: '261551',
    display: 'Insulin Glargine 100 UNT/ML Injectable Solution',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['E11.9', 'E11.65', 'E11.40'],
    dosage: '20 units',
    route: 'subcutaneous',
    frequency: 'once daily at bedtime',
  },

  // Cardiac medications
  {
    code: '314076',
    display: 'Lisinopril 10 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['I10', 'I50.9', 'N18.3'],
    dosage: '10 mg',
    route: 'oral',
    frequency: 'once daily',
  },
  {
    code: '197361',
    display: 'Amlodipine 5 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['I10', 'I25.10'],
    dosage: '5 mg',
    route: 'oral',
    frequency: 'once daily',
  },
  {
    code: '197806',
    display: 'Metoprolol Tartrate 25 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['I10', 'I25.10', 'I48.91'],
    dosage: '25 mg',
    route: 'oral',
    frequency: 'twice daily',
  },
  {
    code: '197807',
    display: 'Metoprolol Tartrate 50 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['I10', 'I25.10', 'I50.9', 'I48.91'],
    dosage: '50 mg',
    route: 'oral',
    frequency: 'twice daily',
  },
  {
    code: '200801',
    display: 'Aspirin 81 MG Delayed Release Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['I25.10', 'I48.91'],
    dosage: '81 mg',
    route: 'oral',
    frequency: 'once daily',
  },

  // Lipid medications
  {
    code: '262095',
    display: 'Atorvastatin 20 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['E78.5', 'I25.10'],
    dosage: '20 mg',
    route: 'oral',
    frequency: 'once daily at bedtime',
  },
  {
    code: '861643',
    display: 'Rosuvastatin calcium 10 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['E78.5'],
    dosage: '10 mg',
    route: 'oral',
    frequency: 'once daily',
  },

  // Mental Health medications
  {
    code: '312938',
    display: 'Sertraline 50 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['F32.1', 'F41.1', 'F43.10'],
    dosage: '50 mg',
    route: 'oral',
    frequency: 'once daily',
  },
  {
    code: '861634',
    display: 'Escitalopram 10 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['F32.1', 'F41.1'],
    dosage: '10 mg',
    route: 'oral',
    frequency: 'once daily',
  },
  {
    code: '310385',
    display: 'Fluoxetine 20 MG Oral Capsule',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['F32.1', 'F41.1', 'F90.0'],
    dosage: '20 mg',
    route: 'oral',
    frequency: 'once daily in the morning',
  },
  {
    code: '993687',
    display: 'Bupropion hydrochloride 150 MG Extended Release Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['F32.1'],
    dosage: '150 mg',
    route: 'oral',
    frequency: 'once daily',
  },

  // Pain medications
  {
    code: '197696',
    display: 'Ibuprofen 400 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['M54.5', 'M17.11', 'M79.3', 'M25.50'],
    dosage: '400 mg',
    route: 'oral',
    frequency: 'every 6 hours as needed',
  },
  {
    code: '1049221',
    display: 'Acetaminophen 500 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['M54.5', 'M17.11', 'M25.50', 'J06.9'],
    dosage: '500 mg',
    route: 'oral',
    frequency: 'every 6 hours as needed',
  },
  {
    code: '310431',
    display: 'Gabapentin 300 MG Oral Capsule',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['E11.40', 'M54.5'],
    dosage: '300 mg',
    route: 'oral',
    frequency: 'three times daily',
  },

  // GI medications
  {
    code: '198240',
    display: 'Omeprazole 20 MG Delayed Release Oral Capsule',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['K21.0'],
    dosage: '20 mg',
    route: 'oral',
    frequency: 'once daily before breakfast',
  },
  {
    code: '261276',
    display: 'Pantoprazole 40 MG Delayed Release Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['K21.0', 'K85'],
    dosage: '40 mg',
    route: 'oral',
    frequency: 'once daily before breakfast',
  },

  // Respiratory medications
  {
    code: '245314',
    display: 'Albuterol 0.083 MG/ML Inhalation Solution',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['J45.20', 'J45.40'],
    dosage: '2 puffs',
    route: 'inhalation',
    frequency: 'every 4-6 hours as needed',
  },
  {
    code: '896188',
    display: 'Fluticasone propionate 0.05 MG/ACTUAT Metered Dose Inhaler',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['J45.20', 'J45.40'],
    dosage: '2 puffs',
    route: 'inhalation',
    frequency: 'twice daily',
  },
  {
    code: '197826',
    display: 'Montelukast 10 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['J45.20', 'J45.40'],
    dosage: '10 mg',
    route: 'oral',
    frequency: 'once daily at bedtime',
  },

  // Antibiotics
  {
    code: '308182',
    display: 'Amoxicillin 500 MG Oral Capsule',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['J06.9', 'J18.9', 'H66.90', 'N39.0'],
    dosage: '500 mg',
    route: 'oral',
    frequency: 'three times daily for 10 days',
  },
  {
    code: '248656',
    display: 'Azithromycin 250 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['J06.9', 'J18.9'],
    dosage: '250 mg',
    route: 'oral',
    frequency: '2 tablets day 1, then 1 tablet daily for 4 days',
  },

  // Other
  {
    code: '197517',
    display: 'Levothyroxine Sodium 0.05 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['E03.9'],
    dosage: '50 mcg',
    route: 'oral',
    frequency: 'once daily on empty stomach',
  },
  {
    code: '310429',
    display: 'Hydrochlorothiazide 25 MG Oral Tablet',
    system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    conditions: ['I10', 'I50.9'],
    dosage: '25 mg',
    route: 'oral',
    frequency: 'once daily in the morning',
  },
];
