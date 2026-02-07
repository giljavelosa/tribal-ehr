// Allergy reference data with SNOMED CT codes

export interface AllergyReaction {
  display: string;
  severity: 'mild' | 'moderate' | 'severe';
  snomedCode: string;
}

export interface Allergy {
  code: string;
  display: string;
  system: string;
  category: 'medication' | 'food' | 'environment';
  type: 'allergy' | 'intolerance';
  reactions: AllergyReaction[];
}

export const ALLERGIES: Allergy[] = [
  // Medication allergies
  {
    code: '91936005',
    display: 'Allergy to penicillin',
    system: 'http://snomed.info/sct',
    category: 'medication',
    type: 'allergy',
    reactions: [
      { display: 'Urticaria (hives)', severity: 'moderate', snomedCode: '126485001' },
      { display: 'Maculopapular rash', severity: 'mild', snomedCode: '271807003' },
      { display: 'Anaphylaxis', severity: 'severe', snomedCode: '39579001' },
    ],
  },
  {
    code: '294505008',
    display: 'Allergy to sulfonamide',
    system: 'http://snomed.info/sct',
    category: 'medication',
    type: 'allergy',
    reactions: [
      { display: 'Maculopapular rash', severity: 'mild', snomedCode: '271807003' },
      { display: 'Fever', severity: 'mild', snomedCode: '386661006' },
    ],
  },
  {
    code: '293586001',
    display: 'Allergy to aspirin',
    system: 'http://snomed.info/sct',
    category: 'medication',
    type: 'allergy',
    reactions: [
      { display: 'Wheezing', severity: 'moderate', snomedCode: '56018004' },
      { display: 'Angioedema', severity: 'severe', snomedCode: '41291007' },
      { display: 'Bronchospasm', severity: 'severe', snomedCode: '4386001' },
    ],
  },
  {
    code: '419511003',
    display: 'Allergy to codeine',
    system: 'http://snomed.info/sct',
    category: 'medication',
    type: 'intolerance',
    reactions: [
      { display: 'Nausea and vomiting', severity: 'moderate', snomedCode: '422587007' },
      { display: 'Constipation', severity: 'mild', snomedCode: '14760008' },
      { display: 'Pruritus (itching)', severity: 'mild', snomedCode: '418290006' },
    ],
  },
  {
    code: '293883005',
    display: 'Allergy to NSAID',
    system: 'http://snomed.info/sct',
    category: 'medication',
    type: 'allergy',
    reactions: [
      { display: 'Gastrointestinal upset', severity: 'mild', snomedCode: '267060006' },
      { display: 'Urticaria (hives)', severity: 'moderate', snomedCode: '126485001' },
    ],
  },
  {
    code: '372680006',
    display: 'Allergy to ACE inhibitor',
    system: 'http://snomed.info/sct',
    category: 'medication',
    type: 'allergy',
    reactions: [
      { display: 'Angioedema', severity: 'severe', snomedCode: '41291007' },
      { display: 'Persistent dry cough', severity: 'moderate', snomedCode: '49727002' },
    ],
  },

  // Food allergies
  {
    code: '91935009',
    display: 'Allergy to peanut',
    system: 'http://snomed.info/sct',
    category: 'food',
    type: 'allergy',
    reactions: [
      { display: 'Anaphylaxis', severity: 'severe', snomedCode: '39579001' },
      { display: 'Urticaria (hives)', severity: 'moderate', snomedCode: '126485001' },
      { display: 'Throat swelling', severity: 'severe', snomedCode: '267101005' },
    ],
  },
  {
    code: '91934008',
    display: 'Allergy to shellfish',
    system: 'http://snomed.info/sct',
    category: 'food',
    type: 'allergy',
    reactions: [
      { display: 'Anaphylaxis', severity: 'severe', snomedCode: '39579001' },
      { display: 'Urticaria (hives)', severity: 'moderate', snomedCode: '126485001' },
      { display: 'Nausea', severity: 'mild', snomedCode: '422587007' },
    ],
  },
  {
    code: '232347008',
    display: 'Allergy to egg protein',
    system: 'http://snomed.info/sct',
    category: 'food',
    type: 'allergy',
    reactions: [
      { display: 'Angioedema', severity: 'moderate', snomedCode: '41291007' },
      { display: 'Urticaria (hives)', severity: 'mild', snomedCode: '126485001' },
    ],
  },
  {
    code: '425525006',
    display: 'Allergy to dairy product',
    system: 'http://snomed.info/sct',
    category: 'food',
    type: 'intolerance',
    reactions: [
      { display: 'Gastrointestinal upset', severity: 'mild', snomedCode: '267060006' },
      { display: 'Bloating', severity: 'mild', snomedCode: '248490000' },
    ],
  },
  {
    code: '714035009',
    display: 'Allergy to soy protein',
    system: 'http://snomed.info/sct',
    category: 'food',
    type: 'allergy',
    reactions: [
      { display: 'Urticaria (hives)', severity: 'mild', snomedCode: '126485001' },
      { display: 'Gastrointestinal upset', severity: 'mild', snomedCode: '267060006' },
    ],
  },

  // Environmental allergies
  {
    code: '300913006',
    display: 'Allergy to latex',
    system: 'http://snomed.info/sct',
    category: 'environment',
    type: 'allergy',
    reactions: [
      { display: 'Contact dermatitis', severity: 'moderate', snomedCode: '40275004' },
      { display: 'Anaphylaxis', severity: 'severe', snomedCode: '39579001' },
      { display: 'Urticaria (hives)', severity: 'moderate', snomedCode: '126485001' },
    ],
  },
  {
    code: '300916003',
    display: 'Allergy to bee venom',
    system: 'http://snomed.info/sct',
    category: 'environment',
    type: 'allergy',
    reactions: [
      { display: 'Anaphylaxis', severity: 'severe', snomedCode: '39579001' },
      { display: 'Local swelling', severity: 'moderate', snomedCode: '442672001' },
    ],
  },
  {
    code: '418689008',
    display: 'Allergy to grass pollen',
    system: 'http://snomed.info/sct',
    category: 'environment',
    type: 'allergy',
    reactions: [
      { display: 'Rhinitis', severity: 'mild', snomedCode: '70076002' },
      { display: 'Watery eyes', severity: 'mild', snomedCode: '418290006' },
      { display: 'Sneezing', severity: 'mild', snomedCode: '162367006' },
    ],
  },
  {
    code: '232350006',
    display: 'Allergy to dust mite',
    system: 'http://snomed.info/sct',
    category: 'environment',
    type: 'allergy',
    reactions: [
      { display: 'Rhinitis', severity: 'mild', snomedCode: '70076002' },
      { display: 'Asthma exacerbation', severity: 'moderate', snomedCode: '195967001' },
      { display: 'Sneezing', severity: 'mild', snomedCode: '162367006' },
    ],
  },
];
