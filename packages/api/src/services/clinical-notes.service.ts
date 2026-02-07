// =============================================================================
// Clinical Notes Service
// Supports clinical note creation, signing, co-signing, and amendment workflows.
// Templates for SOAP, H&P, Progress Note, Procedure Note, Discharge Summary.
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type NoteStatus = 'draft' | 'signed' | 'cosigned' | 'amended' | 'entered-in-error';
export type NoteType =
  | 'soap'
  | 'history-and-physical'
  | 'progress'
  | 'procedure'
  | 'discharge-summary'
  | 'consultation'
  | 'nursing'
  | 'social-work'
  | 'telephone-encounter'
  | 'other';

export interface NoteSection {
  label: string;
  key: string;
  content: string;
  order: number;
}

export interface ClinicalNote {
  id: string;
  patientId: string;
  encounterId?: string;
  noteType: NoteType;
  status: NoteStatus;
  title: string;
  sections: NoteSection[];
  plainText?: string;
  templateId?: string;
  authorId: string;
  authorName?: string;
  signedBy?: string;
  signedByName?: string;
  signedAt?: string;
  cosignedBy?: string;
  cosignedByName?: string;
  cosignedAt?: string;
  amendedFromId?: string;
  amendmentReason?: string;
  fhirId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteDTO {
  patientId: string;
  encounterId?: string;
  noteType: NoteType;
  title?: string;
  sections?: NoteSection[];
  plainText?: string;
  templateId?: string;
  authorId: string;
}

export interface UpdateNoteDTO {
  title?: string;
  sections?: NoteSection[];
  plainText?: string;
}

export interface NoteTemplate {
  id: string;
  name: string;
  noteType: NoteType;
  description: string;
  sections: Array<{ label: string; key: string; placeholder: string; order: number }>;
}

export interface NoteSearchParams extends PaginationParams {
  patientId?: string;
  encounterId?: string;
  noteType?: NoteType;
  status?: NoteStatus;
  authorId?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Built-in Note Templates
// -----------------------------------------------------------------------------

const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'tmpl-soap',
    name: 'SOAP Note',
    noteType: 'soap',
    description: 'Standard Subjective, Objective, Assessment, Plan format',
    sections: [
      { label: 'Subjective', key: 'subjective', placeholder: 'Chief complaint, history of present illness, review of systems...', order: 1 },
      { label: 'Objective', key: 'objective', placeholder: 'Vital signs, physical examination findings, lab/imaging results...', order: 2 },
      { label: 'Assessment', key: 'assessment', placeholder: 'Diagnoses, differential diagnoses, clinical impression...', order: 3 },
      { label: 'Plan', key: 'plan', placeholder: 'Treatment plan, medications, referrals, follow-up...', order: 4 },
    ],
  },
  {
    id: 'tmpl-hp',
    name: 'History & Physical',
    noteType: 'history-and-physical',
    description: 'Comprehensive admission history and physical examination',
    sections: [
      { label: 'Chief Complaint', key: 'chief_complaint', placeholder: 'Reason for visit in patient\'s own words...', order: 1 },
      { label: 'History of Present Illness', key: 'hpi', placeholder: 'Detailed narrative of current illness...', order: 2 },
      { label: 'Past Medical History', key: 'past_medical', placeholder: 'Prior diagnoses, surgeries, hospitalizations...', order: 3 },
      { label: 'Past Surgical History', key: 'past_surgical', placeholder: 'Prior surgical procedures and dates...', order: 4 },
      { label: 'Medications', key: 'medications', placeholder: 'Current medications with doses and frequencies...', order: 5 },
      { label: 'Allergies', key: 'allergies', placeholder: 'Known allergies and reactions...', order: 6 },
      { label: 'Family History', key: 'family_history', placeholder: 'Relevant family medical history...', order: 7 },
      { label: 'Social History', key: 'social_history', placeholder: 'Tobacco, alcohol, drugs, occupation, living situation...', order: 8 },
      { label: 'Review of Systems', key: 'ros', placeholder: 'Systematic review by organ system...', order: 9 },
      { label: 'Physical Examination', key: 'physical_exam', placeholder: 'General appearance, HEENT, cardiovascular, respiratory, GI, musculoskeletal, neurological, skin...', order: 10 },
      { label: 'Assessment', key: 'assessment', placeholder: 'Clinical assessment and diagnoses...', order: 11 },
      { label: 'Plan', key: 'plan', placeholder: 'Treatment plan, orders, follow-up...', order: 12 },
    ],
  },
  {
    id: 'tmpl-progress',
    name: 'Progress Note',
    noteType: 'progress',
    description: 'Daily progress note for follow-up visits and inpatient care',
    sections: [
      { label: 'Interval History', key: 'interval_history', placeholder: 'Changes since last visit, new symptoms, response to treatment...', order: 1 },
      { label: 'Review of Systems', key: 'ros', placeholder: 'Focused review of systems...', order: 2 },
      { label: 'Physical Examination', key: 'physical_exam', placeholder: 'Focused physical exam findings...', order: 3 },
      { label: 'Diagnostics', key: 'diagnostics', placeholder: 'Lab results, imaging findings...', order: 4 },
      { label: 'Assessment', key: 'assessment', placeholder: 'Updated diagnoses and clinical impression...', order: 5 },
      { label: 'Plan', key: 'plan', placeholder: 'Updated plan, medication changes, referrals, follow-up...', order: 6 },
    ],
  },
  {
    id: 'tmpl-procedure',
    name: 'Procedure Note',
    noteType: 'procedure',
    description: 'Documentation of performed procedures',
    sections: [
      { label: 'Procedure', key: 'procedure_name', placeholder: 'Name of the procedure performed...', order: 1 },
      { label: 'Indication', key: 'indication', placeholder: 'Clinical indication for the procedure...', order: 2 },
      { label: 'Consent', key: 'consent', placeholder: 'Informed consent details...', order: 3 },
      { label: 'Anesthesia', key: 'anesthesia', placeholder: 'Type of anesthesia used...', order: 4 },
      { label: 'Description of Procedure', key: 'description', placeholder: 'Step-by-step description of the procedure...', order: 5 },
      { label: 'Findings', key: 'findings', placeholder: 'Intraoperative/procedural findings...', order: 6 },
      { label: 'Specimens', key: 'specimens', placeholder: 'Specimens obtained, if any...', order: 7 },
      { label: 'Estimated Blood Loss', key: 'blood_loss', placeholder: 'Estimated blood loss...', order: 8 },
      { label: 'Complications', key: 'complications', placeholder: 'Any complications encountered...', order: 9 },
      { label: 'Disposition', key: 'disposition', placeholder: 'Patient condition and disposition post-procedure...', order: 10 },
    ],
  },
  {
    id: 'tmpl-discharge',
    name: 'Discharge Summary',
    noteType: 'discharge-summary',
    description: 'Comprehensive discharge documentation',
    sections: [
      { label: 'Admission Date', key: 'admission_date', placeholder: 'Date of admission...', order: 1 },
      { label: 'Discharge Date', key: 'discharge_date', placeholder: 'Date of discharge...', order: 2 },
      { label: 'Admitting Diagnosis', key: 'admitting_diagnosis', placeholder: 'Diagnosis at admission...', order: 3 },
      { label: 'Discharge Diagnosis', key: 'discharge_diagnosis', placeholder: 'Final discharge diagnoses...', order: 4 },
      { label: 'Hospital Course', key: 'hospital_course', placeholder: 'Summary of hospital course, treatments, response to therapy...', order: 5 },
      { label: 'Procedures Performed', key: 'procedures', placeholder: 'Procedures performed during admission...', order: 6 },
      { label: 'Consultations', key: 'consultations', placeholder: 'Specialist consultations during admission...', order: 7 },
      { label: 'Discharge Medications', key: 'discharge_meds', placeholder: 'Medications at discharge with complete instructions...', order: 8 },
      { label: 'Discharge Condition', key: 'discharge_condition', placeholder: 'Patient condition at discharge...', order: 9 },
      { label: 'Discharge Instructions', key: 'discharge_instructions', placeholder: 'Activity restrictions, diet, wound care, follow-up appointments...', order: 10 },
      { label: 'Follow-Up', key: 'follow_up', placeholder: 'Follow-up appointments, referrals, pending results...', order: 11 },
    ],
  },
];

// -----------------------------------------------------------------------------
// Database Row
// -----------------------------------------------------------------------------

interface NoteRow {
  id: string;
  patient_id: string;
  encounter_id?: string;
  note_type: string;
  status: string;
  title: string;
  sections: string; // JSON
  plain_text?: string;
  template_id?: string;
  author_id: string;
  author_name?: string;
  signed_by?: string;
  signed_by_name?: string;
  signed_at?: string;
  cosigned_by?: string;
  cosigned_by_name?: string;
  cosigned_at?: string;
  amended_from_id?: string;
  amendment_reason?: string;
  fhir_id?: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class ClinicalNotesService extends BaseService {
  constructor() {
    super('ClinicalNotesService');
  }

  // ---------------------------------------------------------------------------
  // Create Note
  // ---------------------------------------------------------------------------

  async createNote(data: CreateNoteDTO): Promise<ClinicalNote> {
    try {
      if (!data.patientId) {
        throw new ValidationError('patientId is required');
      }
      if (!data.noteType) {
        throw new ValidationError('noteType is required');
      }
      if (!data.authorId) {
        throw new ValidationError('authorId is required');
      }

      await this.requireExists('patients', data.patientId, 'Patient');

      // If template is specified, load template sections
      let sections: NoteSection[] = data.sections || [];
      if (data.templateId && sections.length === 0) {
        const template = NOTE_TEMPLATES.find((t) => t.id === data.templateId);
        if (template) {
          sections = template.sections.map((s) => ({
            label: s.label,
            key: s.key,
            content: '',
            order: s.order,
          }));
        }
      }

      // Get author name
      const author = await this.db('users')
        .where({ id: data.authorId })
        .first<{ first_name?: string; last_name?: string }>();
      const authorName = author
        ? `${author.first_name || ''} ${author.last_name || ''}`.trim()
        : undefined;

      const id = uuidv4();
      const now = new Date().toISOString();

      // Derive title from template if not provided
      const template = NOTE_TEMPLATES.find((t) => t.id === data.templateId);
      const title = data.title || template?.name || `${data.noteType} Note`;

      const row: NoteRow = {
        id,
        patient_id: data.patientId,
        encounter_id: data.encounterId,
        note_type: data.noteType,
        status: 'draft',
        title,
        sections: JSON.stringify(sections),
        plain_text: data.plainText,
        template_id: data.templateId,
        author_id: data.authorId,
        author_name: authorName,
        created_at: now,
        updated_at: now,
      };

      await this.db('clinical_notes').insert(row);

      this.logger.info('Clinical note created', {
        noteId: id,
        patientId: data.patientId,
        noteType: data.noteType,
        authorId: data.authorId,
      });

      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to create clinical note', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update Note (draft only)
  // ---------------------------------------------------------------------------

  async updateNote(id: string, data: UpdateNoteDTO): Promise<ClinicalNote> {
    try {
      const existing = await this.db('clinical_notes').where({ id }).first<NoteRow>();
      if (!existing) {
        throw new NotFoundError('Clinical Note', id);
      }

      if (existing.status !== 'draft') {
        throw new ConflictError(
          `Cannot update a note with status '${existing.status}'. Only draft notes can be edited. Use the amend workflow for signed notes.`
        );
      }

      const now = new Date().toISOString();
      const updates: Partial<NoteRow> = { updated_at: now };

      if (data.title !== undefined) updates.title = data.title;
      if (data.sections !== undefined) updates.sections = JSON.stringify(data.sections);
      if (data.plainText !== undefined) updates.plain_text = data.plainText;

      await this.db('clinical_notes').where({ id }).update(updates);

      this.logger.info('Clinical note updated', { noteId: id });

      return this.getNote(id);
    } catch (error) {
      this.handleError('Failed to update clinical note', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Sign Note
  // ---------------------------------------------------------------------------

  async signNote(noteId: string, signerId: string): Promise<ClinicalNote> {
    try {
      const existing = await this.db('clinical_notes').where({ id: noteId }).first<NoteRow>();
      if (!existing) {
        throw new NotFoundError('Clinical Note', noteId);
      }

      if (existing.status !== 'draft') {
        throw new ConflictError(`Cannot sign a note with status '${existing.status}'. Only draft notes can be signed.`);
      }

      // Get signer name
      const signer = await this.db('users')
        .where({ id: signerId })
        .first<{ first_name?: string; last_name?: string }>();
      const signerName = signer
        ? `${signer.first_name || ''} ${signer.last_name || ''}`.trim()
        : undefined;

      const now = new Date().toISOString();

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('clinical_notes').where({ id: noteId }).update({
          status: 'signed',
          signed_by: signerId,
          signed_by_name: signerName,
          signed_at: now,
          updated_at: now,
        });

        // Create DocumentReference FHIR resource
        const sections = JSON.parse(existing.sections || '[]') as NoteSection[];
        const narrativeText = sections.map((s) => `${s.label}:\n${s.content}`).join('\n\n');

        const documentReference = {
          resourceType: 'DocumentReference',
          status: 'current',
          type: {
            coding: [
              {
                system: 'http://loinc.org',
                code: this.getNoteTypeLoincCode(existing.note_type),
                display: existing.title,
              },
            ],
          },
          subject: { reference: `Patient/${existing.patient_id}` },
          date: now,
          author: [{ reference: `Practitioner/${signerId}` }],
          description: existing.title,
          content: [
            {
              attachment: {
                contentType: 'text/plain',
                data: Buffer.from(narrativeText || existing.plain_text || '').toString('base64'),
                title: existing.title,
                creation: now,
              },
            },
          ],
          context: existing.encounter_id
            ? { encounter: [{ reference: `Encounter/${existing.encounter_id}` }] }
            : undefined,
        };

        try {
          const fhirResult = await this.fhirClient.create<Record<string, unknown>>('DocumentReference', documentReference);
          if (fhirResult.id) {
            await trx('clinical_notes').where({ id: noteId }).update({ fhir_id: fhirResult.id as string });
          }
        } catch (fhirError) {
          this.logger.warn('Failed to sync clinical note to FHIR server', { noteId, error: fhirError });
        }
      });

      this.logger.info('Clinical note signed', { noteId, signerId });

      return this.getNote(noteId);
    } catch (error) {
      this.handleError('Failed to sign clinical note', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Co-Sign Note
  // ---------------------------------------------------------------------------

  async cosignNote(noteId: string, cosignerId: string): Promise<ClinicalNote> {
    try {
      const existing = await this.db('clinical_notes').where({ id: noteId }).first<NoteRow>();
      if (!existing) {
        throw new NotFoundError('Clinical Note', noteId);
      }

      if (existing.status !== 'signed') {
        throw new ConflictError(`Cannot co-sign a note with status '${existing.status}'. Only signed notes can be co-signed.`);
      }

      if (existing.cosigned_by) {
        throw new ConflictError('This note has already been co-signed.');
      }

      // Get co-signer name
      const cosigner = await this.db('users')
        .where({ id: cosignerId })
        .first<{ first_name?: string; last_name?: string }>();
      const cosignerName = cosigner
        ? `${cosigner.first_name || ''} ${cosigner.last_name || ''}`.trim()
        : undefined;

      const now = new Date().toISOString();

      await this.db('clinical_notes').where({ id: noteId }).update({
        status: 'cosigned',
        cosigned_by: cosignerId,
        cosigned_by_name: cosignerName,
        cosigned_at: now,
        updated_at: now,
      });

      this.logger.info('Clinical note co-signed', { noteId, cosignerId });

      return this.getNote(noteId);
    } catch (error) {
      this.handleError('Failed to co-sign clinical note', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Amend Note
  // ---------------------------------------------------------------------------

  async amendNote(noteId: string, amendment: UpdateNoteDTO & { reason: string }, userId: string): Promise<ClinicalNote> {
    try {
      const original = await this.db('clinical_notes').where({ id: noteId }).first<NoteRow>();
      if (!original) {
        throw new NotFoundError('Clinical Note', noteId);
      }

      if (original.status !== 'signed' && original.status !== 'cosigned') {
        throw new ConflictError(
          `Cannot amend a note with status '${original.status}'. Only signed or co-signed notes can be amended.`
        );
      }

      if (!amendment.reason) {
        throw new ValidationError('Amendment reason is required');
      }

      const now = new Date().toISOString();

      // Mark original as amended
      await this.db('clinical_notes').where({ id: noteId }).update({
        status: 'amended',
        updated_at: now,
      });

      // Get user name
      const user = await this.db('users')
        .where({ id: userId })
        .first<{ first_name?: string; last_name?: string }>();
      const userName = user
        ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
        : undefined;

      // Create new note linked to original
      const newId = uuidv4();
      const originalSections = JSON.parse(original.sections || '[]') as NoteSection[];
      const amendedSections = amendment.sections || originalSections;

      const newRow: NoteRow = {
        id: newId,
        patient_id: original.patient_id,
        encounter_id: original.encounter_id,
        note_type: original.note_type,
        status: 'draft',
        title: `Amended: ${original.title}`,
        sections: JSON.stringify(amendedSections),
        plain_text: amendment.plainText || original.plain_text,
        template_id: original.template_id,
        author_id: userId,
        author_name: userName,
        amended_from_id: noteId,
        amendment_reason: amendment.reason,
        created_at: now,
        updated_at: now,
      };

      await this.db('clinical_notes').insert(newRow);

      this.logger.info('Clinical note amended', {
        originalNoteId: noteId,
        newNoteId: newId,
        userId,
        reason: amendment.reason,
      });

      return this.fromRow(newRow);
    } catch (error) {
      this.handleError('Failed to amend clinical note', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Single Note
  // ---------------------------------------------------------------------------

  async getNote(id: string): Promise<ClinicalNote> {
    try {
      const row = await this.db('clinical_notes').where({ id }).first<NoteRow>();
      if (!row) {
        throw new NotFoundError('Clinical Note', id);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get clinical note', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Patient Notes
  // ---------------------------------------------------------------------------

  async getPatientNotes(params: NoteSearchParams): Promise<PaginatedResult<ClinicalNote>> {
    try {
      const query = this.db('clinical_notes').select('*');

      if (params.patientId) {
        query.where('patient_id', params.patientId);
      }
      if (params.encounterId) {
        query.where('encounter_id', params.encounterId);
      }
      if (params.noteType) {
        query.where('note_type', params.noteType);
      }
      if (params.status) {
        query.where('status', params.status);
      }
      if (params.authorId) {
        query.where('author_id', params.authorId);
      }
      if (params.startDate) {
        query.where('created_at', '>=', params.startDate);
      }
      if (params.endDate) {
        query.where('created_at', '<=', params.endDate);
      }

      const allowedSortColumns: Record<string, string> = {
        createdAt: 'created_at',
        signedAt: 'signed_at',
        noteType: 'note_type',
        status: 'status',
        title: 'title',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      if (!params.sort) {
        query.orderBy('created_at', 'desc');
      }

      const result = await this.paginate<NoteRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to get patient notes', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Encounter Notes
  // ---------------------------------------------------------------------------

  async getEncounterNotes(encounterId: string): Promise<ClinicalNote[]> {
    try {
      const rows = await this.db('clinical_notes')
        .where({ encounter_id: encounterId })
        .orderBy('created_at', 'desc') as NoteRow[];

      return rows.map((row) => this.fromRow(row));
    } catch (error) {
      this.handleError('Failed to get encounter notes', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Templates
  // ---------------------------------------------------------------------------

  getTemplates(noteType?: NoteType): NoteTemplate[] {
    if (noteType) {
      return NOTE_TEMPLATES.filter((t) => t.noteType === noteType);
    }
    return NOTE_TEMPLATES;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private fromRow(row: NoteRow): ClinicalNote {
    return {
      id: row.id,
      patientId: row.patient_id,
      encounterId: row.encounter_id,
      noteType: row.note_type as NoteType,
      status: row.status as NoteStatus,
      title: row.title,
      sections: JSON.parse(row.sections || '[]'),
      plainText: row.plain_text,
      templateId: row.template_id,
      authorId: row.author_id,
      authorName: row.author_name,
      signedBy: row.signed_by,
      signedByName: row.signed_by_name,
      signedAt: row.signed_at,
      cosignedBy: row.cosigned_by,
      cosignedByName: row.cosigned_by_name,
      cosignedAt: row.cosigned_at,
      amendedFromId: row.amended_from_id,
      amendmentReason: row.amendment_reason,
      fhirId: row.fhir_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private getNoteTypeLoincCode(noteType: string): string {
    const loincMap: Record<string, string> = {
      'soap': '11506-3',
      'history-and-physical': '34117-2',
      'progress': '11506-3',
      'procedure': '28570-0',
      'discharge-summary': '18842-5',
      'consultation': '11488-4',
      'nursing': '28651-8',
      'social-work': '34130-5',
      'telephone-encounter': '34748-4',
      'other': '11506-3',
    };
    return loincMap[noteType] || '11506-3';
  }
}

export const clinicalNotesService = new ClinicalNotesService();
