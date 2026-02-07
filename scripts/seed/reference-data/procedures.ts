// Procedure reference data with CPT codes

import { ClinicalProfile } from './conditions';

export interface Procedure {
  code: string;
  display: string;
  system: string;
  profile: ClinicalProfile[];
  duration: number;  // approximate duration in minutes
  setting: 'inpatient' | 'outpatient' | 'office' | 'emergency';
}

export const PROCEDURES: Procedure[] = [
  // Surgical procedures
  {
    code: '47562',
    display: 'Laparoscopic cholecystectomy',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['SURGICAL', 'INPATIENT'],
    duration: 90,
    setting: 'inpatient',
  },
  {
    code: '27447',
    display: 'Total knee arthroplasty',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['SURGICAL', 'SNF'],
    duration: 120,
    setting: 'inpatient',
  },
  {
    code: '49505',
    display: 'Inguinal hernia repair, initial',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['SURGICAL'],
    duration: 60,
    setting: 'outpatient',
  },
  {
    code: '44970',
    display: 'Laparoscopic appendectomy',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['SURGICAL', 'INPATIENT'],
    duration: 75,
    setting: 'inpatient',
  },
  {
    code: '43239',
    display: 'Upper GI endoscopy with biopsy',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['SURGICAL', 'INPATIENT'],
    duration: 30,
    setting: 'outpatient',
  },
  {
    code: '45378',
    display: 'Colonoscopy, diagnostic',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['SURGICAL', 'HEALTHY'],
    duration: 45,
    setting: 'outpatient',
  },
  {
    code: '27130',
    display: 'Total hip arthroplasty',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['SURGICAL', 'SNF'],
    duration: 150,
    setting: 'inpatient',
  },
  {
    code: '64483',
    display: 'Lumbar epidural steroid injection',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['SURGICAL'],
    duration: 20,
    setting: 'outpatient',
  },

  // Diagnostic procedures
  {
    code: '93000',
    display: 'Electrocardiogram, routine ECG with interpretation',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['CARDIAC', 'INPATIENT', 'HEALTHY'],
    duration: 15,
    setting: 'office',
  },
  {
    code: '93306',
    display: 'Echocardiography, transthoracic, complete',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['CARDIAC', 'INPATIENT'],
    duration: 45,
    setting: 'outpatient',
  },
  {
    code: '71046',
    display: 'Chest X-ray, 2 views',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['INPATIENT', 'CARDIAC', 'HEALTHY'],
    duration: 10,
    setting: 'office',
  },
  {
    code: '70553',
    display: 'MRI Brain without contrast, then with contrast',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['INPATIENT', 'MENTAL_HEALTH'],
    duration: 60,
    setting: 'outpatient',
  },
  {
    code: '74177',
    display: 'CT Abdomen and Pelvis with contrast',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['INPATIENT', 'SURGICAL'],
    duration: 30,
    setting: 'outpatient',
  },

  // Office / routine procedures
  {
    code: '99213',
    display: 'Office visit, established patient, level 3',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['HEALTHY', 'DIABETIC', 'CARDIAC', 'MENTAL_HEALTH', 'PEDIATRIC'],
    duration: 15,
    setting: 'office',
  },
  {
    code: '99214',
    display: 'Office visit, established patient, level 4',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['DIABETIC', 'CARDIAC', 'MENTAL_HEALTH', 'SURGICAL'],
    duration: 25,
    setting: 'office',
  },
  {
    code: '99203',
    display: 'Office visit, new patient, level 3',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['HEALTHY', 'PEDIATRIC'],
    duration: 30,
    setting: 'office',
  },
  {
    code: '36415',
    display: 'Venipuncture, routine collection',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['DIABETIC', 'CARDIAC', 'HEALTHY', 'INPATIENT', 'SNF'],
    duration: 5,
    setting: 'office',
  },
  {
    code: '90471',
    display: 'Immunization administration',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['HEALTHY', 'PEDIATRIC'],
    duration: 10,
    setting: 'office',
  },
  {
    code: '20610',
    display: 'Arthrocentesis, aspiration/injection, major joint',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['SURGICAL', 'SNF'],
    duration: 15,
    setting: 'office',
  },
  {
    code: '11042',
    display: 'Debridement, subcutaneous tissue',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['SNF', 'DIABETIC'],
    duration: 20,
    setting: 'office',
  },
  {
    code: '81001',
    display: 'Urinalysis with microscopy',
    system: 'http://www.ama-assn.org/go/cpt',
    profile: ['DIABETIC', 'INPATIENT', 'HEALTHY'],
    duration: 5,
    setting: 'office',
  },
];
