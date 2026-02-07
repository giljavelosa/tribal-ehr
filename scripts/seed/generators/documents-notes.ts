import { Knex } from 'knex';
import crypto from 'crypto';
import { SeededRNG, formatDate, batchInsert } from '../utils';
import { CLINICAL_PROFILES } from '../profiles/clinical-profiles';
import { GeneratedPatients } from './patients';
import { GeneratedEncounter } from './encounters';
import { GeneratedUsers } from './users';

// ---------------------------------------------------------------------------
// Note template definitions
// ---------------------------------------------------------------------------

interface NoteTemplateDef {
  id: string;
  name: string;
  noteType: string;
  contentTemplate: string;
}

const NOTE_TEMPLATES: NoteTemplateDef[] = [
  {
    id: 'progress_note',
    name: 'Progress Note',
    noteType: 'progress_note',
    contentTemplate: `SUBJECTIVE:\n{{chief_complaint}}\n\nOBJECTIVE:\nVitals: BP {{bp}}, HR {{hr}}, RR {{rr}}, Temp {{temp}}, SpO2 {{spo2}}\nPhysical Exam: {{exam_findings}}\n\nASSESSMENT:\n{{assessment}}\n\nPLAN:\n{{plan}}`,
  },
  {
    id: 'hp',
    name: 'History and Physical',
    noteType: 'hp',
    contentTemplate: `CHIEF COMPLAINT:\n{{chief_complaint}}\n\nHISTORY OF PRESENT ILLNESS:\n{{hpi}}\n\nPAST MEDICAL HISTORY:\n{{pmh}}\n\nMEDICATIONS:\n{{medications}}\n\nALLERGIES:\n{{allergies}}\n\nSOCIAL HISTORY:\n{{social_history}}\n\nFAMILY HISTORY:\n{{family_history}}\n\nREVIEW OF SYSTEMS:\n{{ros}}\n\nPHYSICAL EXAM:\n{{exam_findings}}\n\nASSESSMENT AND PLAN:\n{{assessment_plan}}`,
  },
  {
    id: 'discharge_summary',
    name: 'Discharge Summary',
    noteType: 'discharge_summary',
    contentTemplate: `ADMISSION DATE: {{admission_date}}\nDISCHARGE DATE: {{discharge_date}}\n\nADMITTING DIAGNOSIS:\n{{admitting_diagnosis}}\n\nDISCHARGE DIAGNOSIS:\n{{discharge_diagnosis}}\n\nHOSPITAL COURSE:\n{{hospital_course}}\n\nDISCHARGE MEDICATIONS:\n{{discharge_meds}}\n\nFOLLOW-UP:\n{{follow_up}}\n\nDISCHARGE INSTRUCTIONS:\n{{discharge_instructions}}`,
  },
  {
    id: 'consult_note',
    name: 'Consultation Note',
    noteType: 'consult_note',
    contentTemplate: `REQUESTING PHYSICIAN: {{requesting_physician}}\nREASON FOR CONSULTATION: {{reason}}\n\nHISTORY:\n{{history}}\n\nEXAMINATION:\n{{exam_findings}}\n\nRECOMMENDATIONS:\n{{recommendations}}`,
  },
  {
    id: 'preop_assessment',
    name: 'Pre-Operative Assessment',
    noteType: 'preop_assessment',
    contentTemplate: `PROCEDURE PLANNED: {{procedure}}\nDATE OF SURGERY: {{surgery_date}}\n\nPRE-OP DIAGNOSIS: {{preop_diagnosis}}\n\nHISTORY:\n{{history}}\n\nPHYSICAL EXAM:\n{{exam_findings}}\n\nLAB RESULTS:\n{{labs}}\n\nASA CLASS: {{asa_class}}\n\nCLEARANCE: Patient cleared for surgery.`,
  },
  {
    id: 'operative_report',
    name: 'Operative Report',
    noteType: 'operative_report',
    contentTemplate: `PROCEDURE: {{procedure}}\nSURGEON: {{surgeon}}\nASSISTANT: {{assistant}}\nANESTHESIA: {{anesthesia}}\n\nPRE-OP DIAGNOSIS: {{preop_diagnosis}}\nPOST-OP DIAGNOSIS: {{postop_diagnosis}}\n\nFINDINGS: {{findings}}\n\nPROCEDURE DESCRIPTION:\n{{procedure_description}}\n\nEST BLOOD LOSS: {{ebl}}\nCOMPLICATIONS: {{complications}}\nDISPOSITION: {{disposition}}`,
  },
  {
    id: 'postop_note',
    name: 'Post-Operative Note',
    noteType: 'postop_note',
    contentTemplate: `PROCEDURE PERFORMED: {{procedure}}\n\nPOST-OP DAY: {{pod}}\n\nVITALS: {{vitals}}\nPAIN SCORE: {{pain_score}}/10\n\nEXAM: {{exam_findings}}\nINCISION: {{incision_status}}\n\nPLAN:\n{{plan}}`,
  },
  {
    id: 'snf_daily',
    name: 'SNF Daily Progress Note',
    noteType: 'snf_daily',
    contentTemplate: `DATE: {{date}}\n\nFUNCTIONAL STATUS:\nMobility: {{mobility}}\nADLs: {{adls}}\nCognition: {{cognition}}\n\nVITALS: {{vitals}}\nPAIN: {{pain_score}}/10\n\nMEDICATIONS ADMINISTERED:\n{{medications}}\n\nINTERVENTIONS:\n{{interventions}}\n\nPLAN:\n{{plan}}`,
  },
  {
    id: 'nursing_note',
    name: 'Nursing Assessment Note',
    noteType: 'nursing_note',
    contentTemplate: `ASSESSMENT TIME: {{assessment_time}}\n\nNEUROLOGICAL: {{neuro}}\nCARDIOVASCULAR: {{cardio}}\nRESPIRATORY: {{respiratory}}\nGI: {{gi}}\nGU: {{gu}}\nSKIN: {{skin}}\nMUSCULOSKELETAL: {{musculoskeletal}}\n\nPAIN ASSESSMENT: {{pain}}\nSAFETY: {{safety}}\n\nNURSING INTERVENTIONS:\n{{interventions}}`,
  },
  {
    id: 'telehealth_note',
    name: 'Telehealth Visit Note',
    noteType: 'telehealth_note',
    contentTemplate: `VISIT TYPE: Telehealth/Video\nCONNECTION QUALITY: {{connection_quality}}\n\nSUBJECTIVE:\n{{subjective}}\n\nOBJECTIVE:\nAppearance: {{appearance}}\nSelf-reported vitals: {{vitals}}\n\nASSESSMENT:\n{{assessment}}\n\nPLAN:\n{{plan}}`,
  },
];

// ---------------------------------------------------------------------------
// Document type definitions (LOINC)
// ---------------------------------------------------------------------------

interface DocTypeDef {
  code: string;
  display: string;
  category: string;
}

const DOC_TYPES: DocTypeDef[] = [
  { code: '34117-2', display: 'History and physical note', category: 'clinical-note' },
  { code: '11506-3', display: 'Progress note', category: 'clinical-note' },
  { code: '18842-5', display: 'Discharge summary', category: 'clinical-note' },
  { code: '11488-4', display: 'Consultation note', category: 'clinical-note' },
  { code: '26436-6', display: 'Laboratory report', category: 'lab-report' },
  { code: '18748-4', display: 'Diagnostic imaging report', category: 'imaging-report' },
  { code: '28570-0', display: 'Procedure note', category: 'clinical-note' },
  { code: '57133-1', display: 'Referral note', category: 'clinical-note' },
];

// ---------------------------------------------------------------------------
// Content generation helpers
// ---------------------------------------------------------------------------

const CHIEF_COMPLAINTS = [
  'Follow-up for chronic conditions',
  'Routine wellness visit',
  'Medication refill and management',
  'New onset of symptoms',
  'Post-procedure follow-up',
  'Preventive care visit',
  'Acute complaint evaluation',
  'Lab results review',
  'Chronic pain management',
  'Mental health follow-up',
];

const EXAM_FINDINGS = [
  'General: Alert, oriented, no acute distress. HEENT: PERRL, oropharynx clear. Lungs: CTA bilaterally. Heart: RRR, no murmurs. Abdomen: Soft, non-tender.',
  'General: Well-appearing. Lungs: Clear. Heart: Regular rate and rhythm. Extremities: No edema.',
  'General: Alert and cooperative. Lungs: Mild rhonchi bilateral bases. Heart: RRR, S1/S2 normal. Abdomen: Soft, non-distended.',
  'General: Comfortable at rest. HEENT: Normocephalic. Neck: Supple, no LAD. Lungs: CTA. Cardiac: RRR. Skin: Warm, dry.',
];

const ASSESSMENT_TEXTS: Record<string, string[]> = {
  DIABETIC: [
    'Type 2 DM - A1C improving on current regimen. Continue metformin, reinforce dietary counseling.',
    'Diabetes mellitus, type 2 - suboptimal control. Adjusting medication regimen and ordering repeat A1C in 3 months.',
  ],
  CARDIAC: [
    'Hypertension - well controlled on current medications. Continue current regimen.',
    'CAD - stable. Continue aspirin and statin therapy. Follow up lipid panel in 6 months.',
  ],
  SNF: [
    'Multiple chronic conditions - stable. Continue current care plan. PT/OT progressing well.',
    'Gradual improvement in functional status. Continue rehabilitation program.',
  ],
  MENTAL_HEALTH: [
    'Depression, moderate - PHQ-9 score improving. Continue current SSRI and therapy.',
    'Anxiety disorder - well managed with current treatment plan. Continue medication.',
  ],
  HEALTHY: [
    'Routine preventive care visit. All screenings up to date. Continue healthy lifestyle.',
    'Annual wellness exam - no acute issues identified. Age-appropriate screenings ordered.',
  ],
  SURGICAL: [
    'Post-operative course uncomplicated. Wound healing well. Continue current pain management.',
    'Pre-operative evaluation - cleared for planned procedure. Labs and imaging reviewed.',
  ],
  INPATIENT: [
    'Acute condition improving. Transitioning to oral medications. Discharge planning in progress.',
    'Continued improvement. Vital signs stable. Plan for discharge within 24-48 hours.',
  ],
  PEDIATRIC: [
    'Well child visit. Growth and development on track. Immunizations up to date.',
    'Acute upper respiratory infection - viral etiology likely. Supportive care recommended.',
  ],
};

const PLAN_TEXTS = [
  'Continue current medications. Follow up in 3 months. Labs ordered.',
  'Adjust medication dosage. Return for follow-up in 6 weeks.',
  'Referral placed to specialist. Continue current treatment.',
  'Diagnostic imaging ordered. Follow up after results available.',
  'Continue current plan. Patient education provided.',
];

export async function seedDocumentsAndNotes(
  trx: Knex.Transaction,
  patients: GeneratedPatients,
  encounters: GeneratedEncounter[],
  users: GeneratedUsers,
  rng: SeededRNG,
): Promise<void> {
  const now = new Date().toISOString();

  // ----- NOTE TEMPLATES -----
  const templateRows = NOTE_TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    note_type: t.noteType,
    content_template: t.contentTemplate,
    active: true,
    created_at: now,
    updated_at: now,
  }));

  await trx.batchInsert('note_templates', templateRows, 100);
  console.log(`  - note_templates: ${templateRows.length} rows`);

  // ----- CLINICAL NOTES -----
  const noteRows: Record<string, unknown>[] = [];
  const amendedNoteIds: string[] = []; // Track IDs for creating amendments

  // Get only non-cancelled encounters
  const validEncounters = encounters.filter(e => e.status !== 'cancelled');

  for (const enc of validEncounters) {
    const patient = patients.patientMap.get(enc.patientId);
    if (!patient) continue;

    const profile = CLINICAL_PROFILES[patient.profile];
    const noteType = rng.pick(profile.noteTypes);
    const isFinished = enc.status === 'finished';
    const isSigned = isFinished && rng.chance(0.90);
    const isDraft = !isFinished || !isSigned;

    const encDate = new Date(enc.periodStart);
    const dateStr = formatDate(encDate);

    // Generate note title
    const noteTypeDisplay = NOTE_TEMPLATES.find(t => t.id === noteType)?.name || 'Progress Note';
    const title = `${noteTypeDisplay} - ${dateStr}`;

    // Generate note content
    const chiefComplaint = rng.pick(CHIEF_COMPLAINTS);
    const examFindings = rng.pick(EXAM_FINDINGS);
    const assessmentOptions = ASSESSMENT_TEXTS[patient.profile] || ASSESSMENT_TEXTS['HEALTHY'];
    const assessment = rng.pick(assessmentOptions);
    const plan = rng.pick(PLAN_TEXTS);

    const content = [
      `SUBJECTIVE:`,
      `Chief Complaint: ${chiefComplaint}`,
      `Patient ${patient.firstName} ${patient.lastName} (MRN: ${patient.mrn}) presents for ${chiefComplaint.toLowerCase()}.`,
      ``,
      `OBJECTIVE:`,
      `Vitals: Recorded in flowsheet.`,
      `Physical Exam: ${examFindings}`,
      ``,
      `ASSESSMENT:`,
      assessment,
      ``,
      `PLAN:`,
      plan,
    ].join('\n');

    const noteId = crypto.randomUUID();
    const authorId = enc.providerId;

    // Cosigner: ~15% of notes have a cosigner (attending reviewing resident notes)
    const hasCosigner = rng.chance(0.15);
    const cosignerId = hasCosigner
      ? rng.pick(users.physicians.filter(p => p !== authorId) || users.physicians)
      : null;

    noteRows.push({
      id: noteId,
      patient_id: enc.patientId,
      encounter_id: enc.id,
      author_id: authorId,
      note_type: noteType,
      status: isDraft ? 'draft' : 'signed',
      title,
      content,
      template_id: noteType,
      signed_by_id: isSigned ? authorId : null,
      signed_at: isSigned ? enc.periodStart : null,
      cosigner_id: cosignerId,
      cosigned_at: cosignerId && isSigned ? enc.periodStart : null,
      amended_from_id: null,
      created_at: now,
      updated_at: now,
    });

    // Track for potential amendments
    if (isSigned) {
      amendedNoteIds.push(noteId);
    }
  }

  // ~5% of signed notes get amended
  const numAmendments = Math.floor(amendedNoteIds.length * 0.05);
  for (let a = 0; a < numAmendments && amendedNoteIds.length > 0; a++) {
    const origIdx = rng.randomInt(0, amendedNoteIds.length - 1);
    const originalNoteId = amendedNoteIds[origIdx];
    amendedNoteIds.splice(origIdx, 1); // Don't amend the same note twice

    // Find the original note row to copy context
    const origNote = noteRows.find(n => n.id === originalNoteId);
    if (!origNote) continue;

    const amendedId = crypto.randomUUID();
    noteRows.push({
      id: amendedId,
      patient_id: origNote.patient_id,
      encounter_id: origNote.encounter_id,
      author_id: origNote.author_id,
      note_type: origNote.note_type,
      status: 'signed',
      title: `${origNote.title} (Amended)`,
      content: `${origNote.content}\n\n--- AMENDMENT ---\nAddendum: Additional information added after initial signing. Clinical details clarified.`,
      template_id: origNote.template_id,
      signed_by_id: origNote.author_id,
      signed_at: now,
      cosigner_id: null,
      cosigned_at: null,
      amended_from_id: originalNoteId,
      created_at: now,
      updated_at: now,
    });
  }

  await batchInsert(trx, 'clinical_notes', noteRows);
  console.log(`  - clinical_notes: ${noteRows.length} rows`);

  // ----- DOCUMENT REFERENCES -----
  const docRows: Record<string, unknown>[] = [];

  for (const enc of validEncounters) {
    // ~80% of encounters generate a document reference
    if (!rng.chance(0.80)) continue;

    const docType = rng.pick(DOC_TYPES);
    const contentType = rng.chance(0.7) ? 'application/pdf' : 'text/xml';
    const contentSize = rng.randomInt(5000, 500000);
    const contentHash = crypto.randomBytes(32).toString('hex');

    docRows.push({
      id: crypto.randomUUID(),
      patient_id: enc.patientId,
      encounter_id: enc.id,
      fhir_id: null,
      status: 'current',
      type_code: docType.code,
      type_system: 'http://loinc.org',
      type_display: docType.display,
      category: docType.category,
      date: enc.periodStart,
      author_id: enc.providerId,
      description: `${docType.display} for encounter on ${formatDate(new Date(enc.periodStart))}`,
      content_type: contentType,
      content_data: null, // No actual file data in seed
      content_url: `/documents/${crypto.randomUUID()}.${contentType === 'application/pdf' ? 'pdf' : 'xml'}`,
      content_size: contentSize,
      content_hash: contentHash,
      context_encounter_id: enc.id,
      context_period_start: enc.periodStart,
      context_period_end: enc.periodEnd,
      created_at: now,
      updated_at: now,
    });
  }

  await batchInsert(trx, 'document_references', docRows);
  console.log(`  - document_references: ${docRows.length} rows`);
}
