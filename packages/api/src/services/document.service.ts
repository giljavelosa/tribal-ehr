// =============================================================================
// DocumentReference Service
// FHIR R4 DocumentReference | US Core 6.1 DocumentReference profile
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import {
  DocumentReference,
  DocumentReferenceStatus,
  DocumentReferenceContent,
  DocumentReferenceContext,
  CodeableConcept,
  Reference,
  Period,
  Attachment,
  CODE_SYSTEMS,
} from '@tribal-ehr/shared';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

const US_CORE_DOCUMENT_REFERENCE =
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference';

// LOINC document type codes
const DOCUMENT_TYPE_CODES: Record<string, { code: string; display: string }> = {
  'consultation': { code: '11488-4', display: 'Consult note' },
  'discharge-summary': { code: '18842-5', display: 'Discharge summary' },
  'history-and-physical': { code: '34117-2', display: 'History and physical note' },
  'progress-note': { code: '11506-3', display: 'Progress note' },
  'procedure-note': { code: '28570-0', display: 'Procedure note' },
  'imaging-narrative': { code: '18748-4', display: 'Diagnostic imaging study' },
  'lab-report': { code: '11502-2', display: 'Laboratory report' },
};

// US Core DocumentReference category
const CLINICAL_NOTE_CATEGORY = {
  system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
  code: 'clinical-note',
  display: 'Clinical Note',
};

// -----------------------------------------------------------------------------
// Database Row Interface
// -----------------------------------------------------------------------------

interface DocumentRow {
  id: string;
  patient_id: string;
  status: string;
  type_code?: string;
  type_system?: string;
  type_display?: string;
  category?: string; // JSON
  date?: string;
  author?: string; // JSON
  description?: string;
  content?: string; // JSON
  context?: string; // JSON
  fhir_id?: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Search Parameters
// -----------------------------------------------------------------------------

export interface DocumentSearchParams extends PaginationParams {
  patientId: string;
  type?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  author?: string;
  status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class DocumentService extends BaseService {
  constructor() {
    super('DocumentService');
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(data: Omit<DocumentReference, 'id'>): Promise<DocumentReference> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      const row: DocumentRow = {
        id,
        patient_id: data.patientId,
        status: data.status,
        type_code: data.type?.coding?.[0]?.code,
        type_system: data.type?.coding?.[0]?.system || CODE_SYSTEMS.LOINC,
        type_display: data.type?.coding?.[0]?.display || data.type?.text,
        category: data.category ? JSON.stringify(data.category) : undefined,
        date: data.date || now,
        author: data.author ? JSON.stringify(data.author) : undefined,
        description: data.description,
        content: JSON.stringify(data.content),
        context: data.context ? JSON.stringify(data.context) : undefined,
        created_at: now,
        updated_at: now,
      };

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('document_references').insert(row);

        const fhirResource = this.toFHIR({ ...data, id });
        const fhirResult = await this.fhirClient.create<Record<string, unknown>>(
          'DocumentReference',
          fhirResource
        );
        if (fhirResult.id) {
          await trx('document_references')
            .where({ id })
            .update({ fhir_id: fhirResult.id as string });
        }
      });

      this.logger.info('DocumentReference created', { documentId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to create document reference', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get by ID
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<DocumentReference> {
    try {
      const row = await this.db('document_references').where({ id }).first<DocumentRow>();
      if (!row) {
        throw new NotFoundError('DocumentReference', id);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get document reference', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(params: DocumentSearchParams): Promise<PaginatedResult<DocumentReference>> {
    try {
      if (!params.patientId) {
        throw new ValidationError('patientId is required for document search');
      }

      const query = this.db('document_references')
        .where('patient_id', params.patientId)
        .select('*')
        .orderBy('date', 'desc');

      if (params.type) {
        query.where('type_code', params.type);
      }

      if (params.category) {
        query.whereRaw("category::jsonb @> ?::jsonb", [
          JSON.stringify([{ coding: [{ code: params.category }] }]),
        ]);
      }

      if (params.dateFrom) {
        query.where('date', '>=', params.dateFrom);
      }

      if (params.dateTo) {
        query.where('date', '<=', params.dateTo);
      }

      if (params.author) {
        query.whereRaw("author::text LIKE ?", [`%${params.author}%`]);
      }

      if (params.status) {
        query.where('status', params.status);
      }

      const allowedSortColumns: Record<string, string> = {
        date: 'date',
        type: 'type_display',
        status: 'status',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      const result = await this.paginate<DocumentRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to search document references', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(id: string, data: Partial<DocumentReference>): Promise<DocumentReference> {
    try {
      const existing = await this.db('document_references').where({ id }).first<DocumentRow>();
      if (!existing) {
        throw new NotFoundError('DocumentReference', id);
      }

      const now = new Date().toISOString();
      const updates: Partial<DocumentRow> = { updated_at: now };

      if (data.status !== undefined) updates.status = data.status;
      if (data.type !== undefined) {
        updates.type_code = data.type?.coding?.[0]?.code;
        updates.type_system = data.type?.coding?.[0]?.system || CODE_SYSTEMS.LOINC;
        updates.type_display = data.type?.coding?.[0]?.display || data.type?.text;
      }
      if (data.category !== undefined) updates.category = JSON.stringify(data.category);
      if (data.date !== undefined) updates.date = data.date;
      if (data.author !== undefined) updates.author = JSON.stringify(data.author);
      if (data.description !== undefined) updates.description = data.description;
      if (data.content !== undefined) updates.content = JSON.stringify(data.content);
      if (data.context !== undefined) updates.context = JSON.stringify(data.context);

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('document_references').where({ id }).update(updates);

        const updated = await trx('document_references').where({ id }).first<DocumentRow>();
        if (updated) {
          const doc = this.fromRow(updated);
          const fhirResource = this.toFHIR(doc);
          const fhirId = updated.fhir_id || id;
          await this.fhirClient.update('DocumentReference', fhirId, fhirResource);
        }
      });

      this.logger.info('DocumentReference updated', { documentId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to update document reference', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    try {
      const existing = await this.db('document_references').where({ id }).first<DocumentRow>();
      if (!existing) {
        throw new NotFoundError('DocumentReference', id);
      }

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('document_references').where({ id }).delete();

        if (existing.fhir_id) {
          try {
            await this.fhirClient.delete('DocumentReference', existing.fhir_id);
          } catch (fhirError) {
            this.logger.warn('Failed to delete document from FHIR server', {
              documentId: id,
              fhirId: existing.fhir_id,
            });
          }
        }
      });

      this.logger.info('DocumentReference deleted', { documentId: id });
    } catch (error) {
      this.handleError('Failed to delete document reference', error);
    }
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: Internal -> FHIR R4 DocumentReference
  // ---------------------------------------------------------------------------

  toFHIR(doc: DocumentReference): Record<string, unknown> {
    const fhirDoc: Record<string, unknown> = {
      resourceType: 'DocumentReference',
      id: doc.id,
      meta: {
        profile: [US_CORE_DOCUMENT_REFERENCE],
      },
      status: doc.status,
      subject: {
        reference: `Patient/${doc.patientId}`,
      },
      content: doc.content.map((c) => ({
        attachment: c.attachment,
        format: c.format,
      })),
    };

    if (doc.type) {
      fhirDoc.type = doc.type;
    }

    // US Core requires a category; default to clinical-note
    if (doc.category?.length) {
      fhirDoc.category = doc.category;
    } else {
      fhirDoc.category = [
        {
          coding: [CLINICAL_NOTE_CATEGORY],
        },
      ];
    }

    if (doc.date) {
      fhirDoc.date = doc.date;
    }

    if (doc.author?.length) {
      fhirDoc.author = doc.author;
    }

    if (doc.description) {
      fhirDoc.description = doc.description;
    }

    if (doc.context) {
      const ctx: Record<string, unknown> = {};
      if (doc.context.encounter?.length) {
        ctx.encounter = doc.context.encounter;
      }
      if (doc.context.event?.length) {
        ctx.event = doc.context.event;
      }
      if (doc.context.period) {
        ctx.period = doc.context.period;
      }
      if (doc.context.facilityType) {
        ctx.facilityType = doc.context.facilityType;
      }
      if (doc.context.practiceSetting) {
        ctx.practiceSetting = doc.context.practiceSetting;
      }
      if (doc.context.related?.length) {
        ctx.related = doc.context.related;
      }
      fhirDoc.context = ctx;
    }

    return fhirDoc;
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: FHIR R4 DocumentReference -> Internal
  // ---------------------------------------------------------------------------

  fromFHIR(fhirDoc: Record<string, unknown>): Omit<DocumentReference, 'id'> {
    return {
      patientId: ((fhirDoc.subject as Reference)?.reference || '').replace('Patient/', ''),
      status: fhirDoc.status as DocumentReferenceStatus,
      type: fhirDoc.type as CodeableConcept | undefined,
      category: fhirDoc.category as CodeableConcept[] | undefined,
      date: fhirDoc.date as string | undefined,
      author: fhirDoc.author as Reference[] | undefined,
      description: fhirDoc.description as string | undefined,
      content: fhirDoc.content as DocumentReferenceContent[],
      context: fhirDoc.context as DocumentReferenceContext | undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private fromRow(row: DocumentRow): DocumentReference {
    const type: CodeableConcept | undefined = row.type_code
      ? {
          coding: [
            {
              system: row.type_system,
              code: row.type_code,
              display: row.type_display,
            },
          ],
          text: row.type_display,
        }
      : undefined;

    return {
      id: row.id,
      patientId: row.patient_id,
      status: row.status as DocumentReferenceStatus,
      type,
      category: row.category ? JSON.parse(row.category) : undefined,
      date: row.date,
      author: row.author ? JSON.parse(row.author) : undefined,
      description: row.description,
      content: row.content ? JSON.parse(row.content) : [],
      context: row.context ? JSON.parse(row.context) : undefined,
    };
  }
}

export const documentService = new DocumentService();
