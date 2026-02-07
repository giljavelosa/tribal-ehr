// =============================================================================
// Medication Request Service
// FHIR R4 MedicationRequest | US Core 6.1 MedicationRequest profile
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import {
  MedicationRequest,
  MedicationRequestStatus,
  MedicationRequestIntent,
  MedicationRequestDispenseRequest,
  MedicationRequestSubstitution,
  CodeableConcept,
  Reference,
  Dosage,
  CODE_SYSTEMS,
} from '@tribal-ehr/shared';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

const US_CORE_MEDICATION_REQUEST =
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest';

// -----------------------------------------------------------------------------
// Database Row Interface
// -----------------------------------------------------------------------------

interface MedicationRow {
  id: string;
  patient_id: string;
  encounter_id?: string;
  status: string;
  intent: string;
  medication_code: string;
  medication_system: string;
  medication_display?: string;
  authored_on?: string;
  requester_reference?: string;
  requester_display?: string;
  dosage_instruction?: string; // JSON
  dispense_request?: string; // JSON
  substitution?: string; // JSON
  prior_prescription_reference?: string;
  note?: string; // JSON
  fhir_id?: string;
  created_at: string;
  updated_at: string;
}

// Status transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'cancelled', 'entered-in-error'],
  active: ['completed', 'stopped', 'cancelled', 'on-hold', 'entered-in-error'],
  'on-hold': ['active', 'cancelled', 'stopped', 'entered-in-error'],
  completed: ['entered-in-error'],
  stopped: ['entered-in-error'],
  cancelled: ['draft', 'entered-in-error'],
};

// -----------------------------------------------------------------------------
// Search Parameters
// -----------------------------------------------------------------------------

export interface MedicationSearchParams extends PaginationParams {
  patientId: string;
  status?: string;
  intent?: string;
  code?: string;
  requester?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class MedicationService extends BaseService {
  constructor() {
    super('MedicationService');
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(data: Omit<MedicationRequest, 'id'> & { encounterId?: string }): Promise<MedicationRequest> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      const row: MedicationRow = {
        id,
        patient_id: data.patientId,
        encounter_id: data.encounterId,
        status: data.status || MedicationRequestStatus.DRAFT,
        intent: data.intent || MedicationRequestIntent.ORDER,
        medication_code: data.medication.coding?.[0]?.code || '',
        medication_system: data.medication.coding?.[0]?.system || CODE_SYSTEMS.RXNORM,
        medication_display: data.medication.coding?.[0]?.display || data.medication.text,
        authored_on: data.authoredOn || now,
        requester_reference: data.requester?.reference,
        requester_display: data.requester?.display,
        dosage_instruction: data.dosageInstruction ? JSON.stringify(data.dosageInstruction) : undefined,
        dispense_request: data.dispenseRequest ? JSON.stringify(data.dispenseRequest) : undefined,
        substitution: data.substitution ? JSON.stringify(data.substitution) : undefined,
        prior_prescription_reference: data.priorPrescription?.reference,
        note: data.note ? JSON.stringify(data.note) : undefined,
        created_at: now,
        updated_at: now,
      };

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('medication_requests').insert(row);

        const fhirResource = this.toFHIR({ ...data, id });
        const fhirResult = await this.fhirClient.create<Record<string, unknown>>(
          'MedicationRequest',
          fhirResource
        );
        if (fhirResult.id) {
          await trx('medication_requests')
            .where({ id })
            .update({ fhir_id: fhirResult.id as string });
        }
      });

      this.logger.info('MedicationRequest created', { medicationRequestId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to create medication request', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get by ID
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<MedicationRequest> {
    try {
      const row = await this.db('medication_requests').where({ id }).first<MedicationRow>();
      if (!row) {
        throw new NotFoundError('MedicationRequest', id);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get medication request', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(params: MedicationSearchParams): Promise<PaginatedResult<MedicationRequest>> {
    try {
      if (!params.patientId) {
        throw new ValidationError('patientId is required for medication search');
      }

      const query = this.db('medication_requests')
        .where('patient_id', params.patientId)
        .select('*')
        .orderBy('authored_on', 'desc');

      if (params.status) {
        query.where('status', params.status);
      }

      if (params.intent) {
        query.where('intent', params.intent);
      }

      if (params.code) {
        query.where('medication_code', params.code);
      }

      if (params.requester) {
        query.where('requester_reference', 'like', `%${params.requester}%`);
      }

      if (params.dateFrom) {
        query.where('authored_on', '>=', params.dateFrom);
      }

      if (params.dateTo) {
        query.where('authored_on', '<=', params.dateTo);
      }

      const allowedSortColumns: Record<string, string> = {
        authoredOn: 'authored_on',
        status: 'status',
        medication: 'medication_display',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      const result = await this.paginate<MedicationRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to search medication requests', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Active Medications
  // ---------------------------------------------------------------------------

  async getActiveMedications(patientId: string): Promise<MedicationRequest[]> {
    try {
      const rows = await this.db('medication_requests')
        .where('patient_id', patientId)
        .whereIn('status', [MedicationRequestStatus.ACTIVE, MedicationRequestStatus.ON_HOLD])
        .orderBy('authored_on', 'desc')
        .select<MedicationRow[]>('*');

      return rows.map((row) => this.fromRow(row));
    } catch (error) {
      this.handleError('Failed to get active medications', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Medication Reconciliation
  // ---------------------------------------------------------------------------

  async reconcile(
    patientId: string,
    medications: Array<{
      id?: string;
      status: MedicationRequestStatus;
      medication: CodeableConcept;
      dosageInstruction?: Dosage[];
      note?: string;
    }>
  ): Promise<MedicationRequest[]> {
    try {
      const results: MedicationRequest[] = [];

      await this.withTransaction(async (trx: Knex.Transaction) => {
        // Mark all current active medications as needs-review by setting a reconciliation flag
        const currentActive = await trx('medication_requests')
          .where('patient_id', patientId)
          .whereIn('status', [MedicationRequestStatus.ACTIVE, MedicationRequestStatus.ON_HOLD])
          .select<MedicationRow[]>('*');

        const reconciledIds = new Set(medications.filter((m) => m.id).map((m) => m.id));

        // Stop medications not in the reconciled list
        for (const current of currentActive) {
          if (!reconciledIds.has(current.id)) {
            await trx('medication_requests').where({ id: current.id }).update({
              status: MedicationRequestStatus.STOPPED,
              updated_at: new Date().toISOString(),
            });

            if (current.fhir_id) {
              const stopped = this.fromRow({ ...current, status: MedicationRequestStatus.STOPPED });
              const fhirResource = this.toFHIR(stopped);
              await this.fhirClient.update('MedicationRequest', current.fhir_id, fhirResource);
            }
          }
        }

        // Update or create medications in the reconciled list
        for (const med of medications) {
          if (med.id) {
            // Update existing
            const updates: Partial<MedicationRow> = {
              status: med.status,
              updated_at: new Date().toISOString(),
            };

            if (med.dosageInstruction) {
              updates.dosage_instruction = JSON.stringify(med.dosageInstruction);
            }

            await trx('medication_requests').where({ id: med.id }).update(updates);
            const row = await trx('medication_requests').where({ id: med.id }).first<MedicationRow>();

            if (row) {
              const medReq = this.fromRow(row);
              results.push(medReq);

              if (row.fhir_id) {
                const fhirResource = this.toFHIR(medReq);
                await this.fhirClient.update('MedicationRequest', row.fhir_id, fhirResource);
              }
            }
          } else {
            // Create new
            const newId = uuidv4();
            const now = new Date().toISOString();

            const newRow: MedicationRow = {
              id: newId,
              patient_id: patientId,
              status: med.status,
              intent: MedicationRequestIntent.ORDER,
              medication_code: med.medication.coding?.[0]?.code || '',
              medication_system: med.medication.coding?.[0]?.system || CODE_SYSTEMS.RXNORM,
              medication_display: med.medication.coding?.[0]?.display || med.medication.text,
              authored_on: now,
              dosage_instruction: med.dosageInstruction
                ? JSON.stringify(med.dosageInstruction)
                : undefined,
              note: med.note ? JSON.stringify([{ text: med.note }]) : undefined,
              created_at: now,
              updated_at: now,
            };

            await trx('medication_requests').insert(newRow);

            const medReq = this.fromRow(newRow);
            results.push(medReq);

            const fhirResource = this.toFHIR(medReq);
            const fhirResult = await this.fhirClient.create<Record<string, unknown>>(
              'MedicationRequest',
              fhirResource
            );
            if (fhirResult.id) {
              await trx('medication_requests')
                .where({ id: newId })
                .update({ fhir_id: fhirResult.id as string });
            }
          }
        }
      });

      this.logger.info('Medication reconciliation completed', {
        patientId,
        medicationCount: medications.length,
      });

      return results;
    } catch (error) {
      this.handleError('Failed to reconcile medications', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(id: string, data: Partial<MedicationRequest> & { encounterId?: string }): Promise<MedicationRequest> {
    try {
      const existing = await this.db('medication_requests').where({ id }).first<MedicationRow>();
      if (!existing) {
        throw new NotFoundError('MedicationRequest', id);
      }

      // Validate status transition
      if (data.status && data.status !== existing.status) {
        const allowed = VALID_STATUS_TRANSITIONS[existing.status];
        if (!allowed || !allowed.includes(data.status)) {
          throw new ValidationError(
            `Cannot transition medication request from '${existing.status}' to '${data.status}'`
          );
        }
      }

      const now = new Date().toISOString();
      const updates: Partial<MedicationRow> = { updated_at: now };

      if (data.status !== undefined) updates.status = data.status;
      if (data.intent !== undefined) updates.intent = data.intent;
      if (data.medication !== undefined) {
        updates.medication_code = data.medication.coding?.[0]?.code || '';
        updates.medication_system = data.medication.coding?.[0]?.system || CODE_SYSTEMS.RXNORM;
        updates.medication_display = data.medication.coding?.[0]?.display || data.medication.text;
      }
      if (data.requester !== undefined) {
        updates.requester_reference = data.requester?.reference;
        updates.requester_display = data.requester?.display;
      }
      if (data.dosageInstruction !== undefined) {
        updates.dosage_instruction = JSON.stringify(data.dosageInstruction);
      }
      if (data.dispenseRequest !== undefined) {
        updates.dispense_request = JSON.stringify(data.dispenseRequest);
      }
      if (data.substitution !== undefined) {
        updates.substitution = JSON.stringify(data.substitution);
      }
      if (data.priorPrescription !== undefined) {
        updates.prior_prescription_reference = data.priorPrescription?.reference;
      }
      if (data.note !== undefined) updates.note = JSON.stringify(data.note);
      if (data.encounterId !== undefined) updates.encounter_id = data.encounterId;

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('medication_requests').where({ id }).update(updates);

        const updated = await trx('medication_requests').where({ id }).first<MedicationRow>();
        if (updated) {
          const medReq = this.fromRow(updated);
          const fhirResource = this.toFHIR(medReq);
          const fhirId = updated.fhir_id || id;
          await this.fhirClient.update('MedicationRequest', fhirId, fhirResource);
        }
      });

      this.logger.info('MedicationRequest updated', { medicationRequestId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to update medication request', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    try {
      const existing = await this.db('medication_requests').where({ id }).first<MedicationRow>();
      if (!existing) {
        throw new NotFoundError('MedicationRequest', id);
      }

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('medication_requests').where({ id }).delete();

        if (existing.fhir_id) {
          try {
            await this.fhirClient.delete('MedicationRequest', existing.fhir_id);
          } catch (fhirError) {
            this.logger.warn('Failed to delete medication request from FHIR server', {
              medicationRequestId: id,
              fhirId: existing.fhir_id,
            });
          }
        }
      });

      this.logger.info('MedicationRequest deleted', { medicationRequestId: id });
    } catch (error) {
      this.handleError('Failed to delete medication request', error);
    }
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: Internal -> FHIR R4 MedicationRequest
  // ---------------------------------------------------------------------------

  toFHIR(medRequest: MedicationRequest & { encounterId?: string }): Record<string, unknown> {
    const fhirMedReq: Record<string, unknown> = {
      resourceType: 'MedicationRequest',
      id: medRequest.id,
      meta: {
        profile: [US_CORE_MEDICATION_REQUEST],
      },
      status: medRequest.status,
      intent: medRequest.intent,
      medicationCodeableConcept: medRequest.medication,
      subject: {
        reference: `Patient/${medRequest.patientId}`,
      },
    };

    if (medRequest.authoredOn) {
      fhirMedReq.authoredOn = medRequest.authoredOn;
    }

    if (medRequest.requester) {
      fhirMedReq.requester = medRequest.requester;
    }

    if (medRequest.dosageInstruction?.length) {
      fhirMedReq.dosageInstruction = medRequest.dosageInstruction;
    }

    if (medRequest.dispenseRequest) {
      fhirMedReq.dispenseRequest = medRequest.dispenseRequest;
    }

    if (medRequest.substitution) {
      fhirMedReq.substitution = medRequest.substitution;
    }

    if (medRequest.priorPrescription) {
      fhirMedReq.priorPrescription = medRequest.priorPrescription;
    }

    if (medRequest.note?.length) {
      fhirMedReq.note = medRequest.note;
    }

    if ((medRequest as { encounterId?: string }).encounterId) {
      fhirMedReq.encounter = {
        reference: `Encounter/${(medRequest as { encounterId?: string }).encounterId}`,
      };
    }

    return fhirMedReq;
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: FHIR R4 MedicationRequest -> Internal
  // ---------------------------------------------------------------------------

  fromFHIR(fhirMedReq: Record<string, unknown>): Omit<MedicationRequest, 'id'> {
    return {
      patientId: ((fhirMedReq.subject as Reference)?.reference || '').replace('Patient/', ''),
      status: fhirMedReq.status as MedicationRequestStatus,
      intent: fhirMedReq.intent as MedicationRequestIntent,
      medication: (fhirMedReq.medicationCodeableConcept as CodeableConcept) || { text: 'Unknown' },
      authoredOn: fhirMedReq.authoredOn as string | undefined,
      requester: fhirMedReq.requester as Reference | undefined,
      dosageInstruction: fhirMedReq.dosageInstruction as Dosage[] | undefined,
      dispenseRequest: fhirMedReq.dispenseRequest as MedicationRequestDispenseRequest | undefined,
      substitution: fhirMedReq.substitution as MedicationRequestSubstitution | undefined,
      priorPrescription: fhirMedReq.priorPrescription as Reference | undefined,
      note: fhirMedReq.note as { text: string }[] | undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private fromRow(row: MedicationRow): MedicationRequest {
    return {
      id: row.id,
      patientId: row.patient_id,
      status: row.status as MedicationRequestStatus,
      intent: row.intent as MedicationRequestIntent,
      medication: {
        coding: [
          {
            system: row.medication_system,
            code: row.medication_code,
            display: row.medication_display,
          },
        ],
        text: row.medication_display,
      },
      authoredOn: row.authored_on,
      requester: row.requester_reference
        ? { reference: row.requester_reference, display: row.requester_display }
        : undefined,
      dosageInstruction: row.dosage_instruction ? JSON.parse(row.dosage_instruction) : undefined,
      dispenseRequest: row.dispense_request ? JSON.parse(row.dispense_request) : undefined,
      substitution: row.substitution ? JSON.parse(row.substitution) : undefined,
      priorPrescription: row.prior_prescription_reference
        ? { reference: row.prior_prescription_reference }
        : undefined,
      note: row.note ? JSON.parse(row.note) : undefined,
    };
  }
}

export const medicationService = new MedicationService();
