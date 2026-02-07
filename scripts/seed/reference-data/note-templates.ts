// Clinical note templates for seed script

export interface NoteTemplate {
  id: string;
  name: string;
  noteType: string;
  contentTemplate: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'progress_note',
    name: 'Progress Note',
    noteType: 'progress-note',
    contentTemplate: `PROGRESS NOTE

Date: [DATE]
Provider: [PROVIDER_NAME]
Patient: [PATIENT_NAME]     DOB: [DOB]     MRN: [MRN]

SUBJECTIVE:
Chief Complaint: [CHIEF_COMPLAINT]
HPI: [PATIENT_NAME] is a [AGE]-year-old [SEX] presenting for [REASON_FOR_VISIT]. [HPI_DETAILS]
ROS: [REVIEW_OF_SYSTEMS]
Current Medications: [MEDICATION_LIST]
Allergies: [ALLERGY_LIST]

OBJECTIVE:
Vitals: BP [BP] | HR [HR] | RR [RR] | Temp [TEMP] | SpO2 [SPO2] | Wt [WEIGHT]
General: [GENERAL_EXAM]
HEENT: [HEENT_EXAM]
Cardiovascular: [CV_EXAM]
Respiratory: [RESP_EXAM]
Abdomen: [ABD_EXAM]
Extremities: [EXT_EXAM]
Neurological: [NEURO_EXAM]

ASSESSMENT:
[ASSESSMENT_LIST]

PLAN:
[PLAN_DETAILS]

Follow-up: [FOLLOW_UP]

Electronically signed by [PROVIDER_NAME], [PROVIDER_CREDENTIALS]
Date/Time: [SIGNATURE_DATETIME]`,
  },

  {
    id: 'hp',
    name: 'History & Physical',
    noteType: 'history-and-physical',
    contentTemplate: `HISTORY AND PHYSICAL EXAMINATION

Date of Admission: [DATE]
Attending Physician: [PROVIDER_NAME]
Patient: [PATIENT_NAME]     DOB: [DOB]     MRN: [MRN]

CHIEF COMPLAINT:
[CHIEF_COMPLAINT]

HISTORY OF PRESENT ILLNESS:
[PATIENT_NAME] is a [AGE]-year-old [SEX] who presents with [CHIEF_COMPLAINT]. [HPI_DETAILS]

PAST MEDICAL HISTORY:
[PMH_LIST]

PAST SURGICAL HISTORY:
[PSH_LIST]

MEDICATIONS:
[MEDICATION_LIST]

ALLERGIES:
[ALLERGY_LIST]

FAMILY HISTORY:
[FAMILY_HISTORY]

SOCIAL HISTORY:
Tobacco: [TOBACCO_STATUS]
Alcohol: [ALCOHOL_STATUS]
Occupation: [OCCUPATION]
Living situation: [LIVING_SITUATION]

REVIEW OF SYSTEMS:
Constitutional: [ROS_CONSTITUTIONAL]
HEENT: [ROS_HEENT]
Cardiovascular: [ROS_CV]
Respiratory: [ROS_RESP]
GI: [ROS_GI]
GU: [ROS_GU]
Musculoskeletal: [ROS_MSK]
Neurological: [ROS_NEURO]
Psychiatric: [ROS_PSYCH]
Skin: [ROS_SKIN]

PHYSICAL EXAMINATION:
Vitals: BP [BP] | HR [HR] | RR [RR] | Temp [TEMP] | SpO2 [SPO2] | Ht [HEIGHT] | Wt [WEIGHT]
General: [GENERAL_EXAM]
HEENT: [HEENT_EXAM]
Neck: [NECK_EXAM]
Cardiovascular: [CV_EXAM]
Lungs: [RESP_EXAM]
Abdomen: [ABD_EXAM]
Extremities: [EXT_EXAM]
Neurological: [NEURO_EXAM]
Skin: [SKIN_EXAM]

DIAGNOSTIC DATA:
[LAB_RESULTS]
[IMAGING_RESULTS]

ASSESSMENT AND PLAN:
[ASSESSMENT_LIST]
[PLAN_DETAILS]

Electronically signed by [PROVIDER_NAME], [PROVIDER_CREDENTIALS]
Date/Time: [SIGNATURE_DATETIME]`,
  },

  {
    id: 'discharge_summary',
    name: 'Discharge Summary',
    noteType: 'discharge-summary',
    contentTemplate: `DISCHARGE SUMMARY

Patient: [PATIENT_NAME]     DOB: [DOB]     MRN: [MRN]
Admission Date: [ADMISSION_DATE]
Discharge Date: [DISCHARGE_DATE]
Attending Physician: [PROVIDER_NAME]
Length of Stay: [LENGTH_OF_STAY] days

ADMISSION DIAGNOSIS:
[ADMISSION_DIAGNOSIS]

DISCHARGE DIAGNOSIS:
[DISCHARGE_DIAGNOSIS]

HOSPITAL COURSE:
[HOSPITAL_COURSE]

PROCEDURES PERFORMED:
[PROCEDURES_LIST]

SIGNIFICANT FINDINGS:
Labs: [LAB_RESULTS]
Imaging: [IMAGING_RESULTS]

CONDITION AT DISCHARGE: [DISCHARGE_CONDITION]

DISCHARGE MEDICATIONS:
[DISCHARGE_MEDICATIONS]

DISCHARGE INSTRUCTIONS:
1. Activity: [ACTIVITY_INSTRUCTIONS]
2. Diet: [DIET_INSTRUCTIONS]
3. Wound care: [WOUND_CARE_INSTRUCTIONS]
4. Warning signs - return to ED if: [WARNING_SIGNS]

FOLLOW-UP APPOINTMENTS:
[FOLLOW_UP_APPOINTMENTS]

PENDING RESULTS:
[PENDING_RESULTS]

Electronically signed by [PROVIDER_NAME], [PROVIDER_CREDENTIALS]
Date/Time: [SIGNATURE_DATETIME]`,
  },

  {
    id: 'operative_report',
    name: 'Operative Report',
    noteType: 'operative-report',
    contentTemplate: `OPERATIVE REPORT

Date of Surgery: [DATE]
Patient: [PATIENT_NAME]     DOB: [DOB]     MRN: [MRN]

Surgeon: [SURGEON_NAME]
Assistant: [ASSISTANT_NAME]
Anesthesiologist: [ANESTHESIOLOGIST_NAME]
Anesthesia Type: [ANESTHESIA_TYPE]

PREOPERATIVE DIAGNOSIS:
[PREOP_DIAGNOSIS]

POSTOPERATIVE DIAGNOSIS:
[POSTOP_DIAGNOSIS]

PROCEDURE PERFORMED:
[PROCEDURE_NAME]

INDICATIONS:
[INDICATIONS]

FINDINGS:
[OPERATIVE_FINDINGS]

DESCRIPTION OF PROCEDURE:
[PROCEDURE_DESCRIPTION]

SPECIMENS:
[SPECIMENS]

ESTIMATED BLOOD LOSS: [EBL]
FLUIDS ADMINISTERED: [FLUIDS]
DRAINS: [DRAINS]
COMPLICATIONS: [COMPLICATIONS]

DISPOSITION: Patient transferred to [DISPOSITION] in [PATIENT_CONDITION] condition.

Electronically signed by [SURGEON_NAME], MD
Date/Time: [SIGNATURE_DATETIME]`,
  },

  {
    id: 'preop_assessment',
    name: 'Pre-operative Assessment',
    noteType: 'preoperative-assessment',
    contentTemplate: `PRE-OPERATIVE ASSESSMENT

Date: [DATE]
Patient: [PATIENT_NAME]     DOB: [DOB]     MRN: [MRN]
Planned Procedure: [PLANNED_PROCEDURE]
Planned Date of Surgery: [SURGERY_DATE]
Surgeon: [SURGEON_NAME]

ASA Classification: [ASA_CLASS]

HISTORY:
[HPI_DETAILS]

PAST MEDICAL HISTORY:
[PMH_LIST]

PAST SURGICAL HISTORY:
[PSH_LIST]

CURRENT MEDICATIONS:
[MEDICATION_LIST]

ALLERGIES:
[ALLERGY_LIST]

NPO STATUS: [NPO_STATUS]

PHYSICAL EXAMINATION:
Vitals: BP [BP] | HR [HR] | RR [RR] | Temp [TEMP] | SpO2 [SPO2]
Airway: [AIRWAY_EXAM]
Heart: [CV_EXAM]
Lungs: [RESP_EXAM]

PRE-OPERATIVE LABS:
[LAB_RESULTS]

EKG: [EKG_RESULTS]

RISK ASSESSMENT:
Cardiac risk: [CARDIAC_RISK]
Pulmonary risk: [PULMONARY_RISK]
DVT prophylaxis plan: [DVT_PLAN]

ANESTHESIA PLAN:
[ANESTHESIA_PLAN]

BLOOD PRODUCTS:
Type and screen: [TYPE_SCREEN]
Units crossmatched: [UNITS_CROSSMATCHED]

INFORMED CONSENT: [CONSENT_STATUS]

Electronically signed by [PROVIDER_NAME], [PROVIDER_CREDENTIALS]
Date/Time: [SIGNATURE_DATETIME]`,
  },

  {
    id: 'postop_note',
    name: 'Post-operative Note',
    noteType: 'postoperative-note',
    contentTemplate: `POST-OPERATIVE NOTE

Date: [DATE]
Time: [TIME]
Patient: [PATIENT_NAME]     DOB: [DOB]     MRN: [MRN]

PROCEDURE: [PROCEDURE_NAME]
SURGEON: [SURGEON_NAME]
ANESTHESIA: [ANESTHESIA_TYPE]

PREOPERATIVE DIAGNOSIS: [PREOP_DIAGNOSIS]
POSTOPERATIVE DIAGNOSIS: [POSTOP_DIAGNOSIS]

ESTIMATED BLOOD LOSS: [EBL]
FLUIDS: [FLUIDS]
URINE OUTPUT: [URINE_OUTPUT]
COMPLICATIONS: [COMPLICATIONS]

SPECIMENS TO PATHOLOGY: [SPECIMENS]
DRAINS/TUBES: [DRAINS]

CONDITION: [PATIENT_CONDITION]
DISPOSITION: [DISPOSITION]

POST-OPERATIVE ORDERS:
1. Admit to: [ADMIT_TO]
2. Diagnosis: [POSTOP_DIAGNOSIS]
3. Vitals: [VITALS_FREQUENCY]
4. Activity: [ACTIVITY_LEVEL]
5. Diet: [DIET]
6. IV Fluids: [IV_FLUIDS]
7. Medications: [MEDICATIONS]
8. DVT prophylaxis: [DVT_PROPHYLAXIS]
9. Pain management: [PAIN_MANAGEMENT]
10. Notify physician if: [NOTIFY_CRITERIA]

Electronically signed by [SURGEON_NAME], MD
Date/Time: [SIGNATURE_DATETIME]`,
  },

  {
    id: 'consult_note',
    name: 'Consultation Note',
    noteType: 'consultation-note',
    contentTemplate: `CONSULTATION NOTE

Date: [DATE]
Patient: [PATIENT_NAME]     DOB: [DOB]     MRN: [MRN]
Requesting Physician: [REQUESTING_PROVIDER]
Consulting Physician: [CONSULTING_PROVIDER]
Consulting Service: [CONSULTING_SERVICE]

REASON FOR CONSULTATION:
[CONSULT_REASON]

HISTORY OF PRESENT ILLNESS:
[PATIENT_NAME] is a [AGE]-year-old [SEX] referred for evaluation of [CONSULT_REASON]. [HPI_DETAILS]

RELEVANT PAST MEDICAL HISTORY:
[PMH_LIST]

CURRENT MEDICATIONS:
[MEDICATION_LIST]

ALLERGIES:
[ALLERGY_LIST]

REVIEW OF SYSTEMS:
[REVIEW_OF_SYSTEMS]

PHYSICAL EXAMINATION:
Vitals: BP [BP] | HR [HR] | RR [RR] | Temp [TEMP] | SpO2 [SPO2]
General: [GENERAL_EXAM]
[FOCUSED_EXAM]

DIAGNOSTIC DATA REVIEWED:
[LAB_RESULTS]
[IMAGING_RESULTS]

ASSESSMENT:
[ASSESSMENT]

RECOMMENDATIONS:
[RECOMMENDATIONS]

Thank you for this consultation. We will continue to follow this patient.

Electronically signed by [CONSULTING_PROVIDER], [PROVIDER_CREDENTIALS]
Date/Time: [SIGNATURE_DATETIME]`,
  },

  {
    id: 'snf_daily',
    name: 'SNF Daily Note',
    noteType: 'snf-daily-note',
    contentTemplate: `SNF DAILY PROGRESS NOTE

Date: [DATE]
Patient: [PATIENT_NAME]     DOB: [DOB]     MRN: [MRN]
Day of Stay: [DAY_OF_STAY]
Provider: [PROVIDER_NAME]

OVERNIGHT EVENTS:
[OVERNIGHT_EVENTS]

SUBJECTIVE:
Patient reports: [PATIENT_REPORTS]
Pain level: [PAIN_LEVEL]/10 (Location: [PAIN_LOCATION])
Sleep: [SLEEP_QUALITY]
Appetite: [APPETITE]
Bowel/Bladder: [BOWEL_BLADDER]
Mood: [MOOD]

OBJECTIVE:
Vitals: BP [BP] | HR [HR] | RR [RR] | Temp [TEMP] | SpO2 [SPO2]
General: [GENERAL_EXAM]
Skin: [SKIN_EXAM]
Wounds/Pressure areas: [WOUND_STATUS]
Mobility: [MOBILITY_STATUS]
Cognitive status: [COGNITIVE_STATUS]

THERAPY PROGRESS:
PT: [PT_NOTES]
OT: [OT_NOTES]
Speech: [SPEECH_NOTES]

MEDICATIONS:
[MEDICATION_CHANGES]

ASSESSMENT:
[ASSESSMENT_LIST]

PLAN:
[PLAN_DETAILS]

DISCHARGE PLANNING:
Anticipated discharge date: [ANTICIPATED_DISCHARGE]
Discharge disposition: [DISCHARGE_DISPOSITION]
Outstanding needs: [OUTSTANDING_NEEDS]

Electronically signed by [PROVIDER_NAME], [PROVIDER_CREDENTIALS]
Date/Time: [SIGNATURE_DATETIME]`,
  },

  {
    id: 'nursing_note',
    name: 'Nursing Assessment',
    noteType: 'nursing-assessment',
    contentTemplate: `NURSING ASSESSMENT

Date: [DATE]     Time: [TIME]
Patient: [PATIENT_NAME]     DOB: [DOB]     MRN: [MRN]
Nurse: [NURSE_NAME], [NURSE_CREDENTIALS]

VITAL SIGNS:
Blood Pressure: [BP]
Heart Rate: [HR]
Respiratory Rate: [RR]
Temperature: [TEMP]
Oxygen Saturation: [SPO2]
Pain: [PAIN_LEVEL]/10 ([PAIN_LOCATION])

NEUROLOGICAL:
Level of consciousness: [LOC]
Orientation: [ORIENTATION]
Pupils: [PUPILS]
Glasgow Coma Scale: [GCS]

CARDIOVASCULAR:
Heart rhythm: [HEART_RHYTHM]
Peripheral pulses: [PERIPHERAL_PULSES]
Edema: [EDEMA]
Cap refill: [CAP_REFILL]

RESPIRATORY:
Breath sounds: [BREATH_SOUNDS]
Oxygen delivery: [O2_DELIVERY]
Cough: [COUGH]
Sputum: [SPUTUM]

GASTROINTESTINAL:
Abdomen: [ABDOMEN]
Bowel sounds: [BOWEL_SOUNDS]
Last BM: [LAST_BM]
Diet tolerance: [DIET_TOLERANCE]
Nausea/vomiting: [NAUSEA_VOMITING]

GENITOURINARY:
Urine output: [URINE_OUTPUT]
Foley catheter: [FOLEY]
Color/clarity: [URINE_APPEARANCE]

INTEGUMENTARY:
Skin integrity: [SKIN_INTEGRITY]
IV site: [IV_SITE]
Wounds/dressings: [WOUNDS]
Pressure injury risk (Braden): [BRADEN_SCORE]

ACTIVITY/MOBILITY:
Activity level: [ACTIVITY_LEVEL]
Fall risk (Morse): [MORSE_SCORE]
Assistive devices: [ASSISTIVE_DEVICES]

PSYCHOSOCIAL:
Mood/affect: [MOOD]
Family/visitors: [FAMILY_VISITORS]
Concerns: [PATIENT_CONCERNS]

NURSING INTERVENTIONS:
[INTERVENTIONS]

PLAN OF CARE UPDATES:
[CARE_PLAN_UPDATES]

Electronically signed by [NURSE_NAME], [NURSE_CREDENTIALS]
Date/Time: [SIGNATURE_DATETIME]`,
  },

  {
    id: 'transfer_note',
    name: 'Transfer Summary',
    noteType: 'transfer-summary',
    contentTemplate: `TRANSFER SUMMARY

Date of Transfer: [DATE]
Patient: [PATIENT_NAME]     DOB: [DOB]     MRN: [MRN]

TRANSFERRING FROM: [TRANSFER_FROM]
TRANSFERRING TO: [TRANSFER_TO]
TRANSFERRING PHYSICIAN: [TRANSFERRING_PROVIDER]
ACCEPTING PHYSICIAN: [ACCEPTING_PROVIDER]

REASON FOR TRANSFER:
[TRANSFER_REASON]

PRINCIPAL DIAGNOSIS:
[PRINCIPAL_DIAGNOSIS]

SECONDARY DIAGNOSES:
[SECONDARY_DIAGNOSES]

BRIEF HOSPITAL COURSE:
[HOSPITAL_COURSE]

CURRENT CONDITION:
Vitals: BP [BP] | HR [HR] | RR [RR] | Temp [TEMP] | SpO2 [SPO2]
Mental status: [MENTAL_STATUS]
Activity level: [ACTIVITY_LEVEL]
Diet: [DIET]
Code status: [CODE_STATUS]

ACTIVE MEDICATIONS:
[MEDICATION_LIST]

ALLERGIES:
[ALLERGY_LIST]

ACTIVE PROBLEMS:
[ACTIVE_PROBLEMS]

IV ACCESS:
[IV_ACCESS]

PENDING RESULTS:
[PENDING_RESULTS]

RECENT PROCEDURES:
[RECENT_PROCEDURES]

OUTSTANDING ISSUES:
[OUTSTANDING_ISSUES]

ADVANCE DIRECTIVES: [ADVANCE_DIRECTIVES]

EMERGENCY CONTACT:
[EMERGENCY_CONTACT]

Electronically signed by [TRANSFERRING_PROVIDER], [PROVIDER_CREDENTIALS]
Date/Time: [SIGNATURE_DATETIME]`,
  },
];
