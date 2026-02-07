// =============================================================================
// Provenance Service - FHIR Provenance Tracking for Data Lineage
// =============================================================================

import crypto from 'crypto';
import { BaseService } from './base.service';
import { US_CORE_PROFILES } from '@tribal-ehr/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProvenanceRecordParams {
  targetType: string;
  targetId: string;
  action: string;
  agentId: string;
  agentDisplay: string;
  detail?: Record<string, unknown>;
}

export interface Provenance {
  id: string;
  targetType: string;
  targetId: string;
  action: string;
  agentId: string;
  agentDisplay: string;
  recordedAt: string;
  detail?: Record<string, unknown>;
  fhirProvenanceId?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ProvenanceService extends BaseService {
  constructor() {
    super('ProvenanceService');
  }

  /**
   * Record a provenance entry for a resource action. Persists to the
   * local database and syncs a FHIR Provenance resource to HAPI FHIR.
   */
  async record(params: ProvenanceRecordParams): Promise<void> {
    const id = crypto.randomUUID();
    const recordedAt = new Date().toISOString();

    try {
      // Insert into local provenance table
      await this.db('provenance_records').insert({
        id,
        target_type: params.targetType,
        target_id: params.targetId,
        action: params.action,
        agent_id: params.agentId,
        agent_display: params.agentDisplay,
        recorded_at: recordedAt,
        detail: params.detail ? JSON.stringify(params.detail) : null,
      });

      // Sync to FHIR server (best-effort)
      try {
        const fhirProvenance = this.buildFHIRProvenance(id, params, recordedAt);
        const result = await this.fhirClient.create<Record<string, unknown>>(
          'Provenance',
          fhirProvenance
        );
        const fhirId = result.id as string | undefined;

        if (fhirId) {
          await this.db('provenance_records')
            .where({ id })
            .update({ fhir_provenance_id: fhirId });
        }
      } catch (fhirError) {
        const errorMessage = fhirError instanceof Error ? fhirError.message : String(fhirError);
        this.logger.warn('Failed to sync provenance to FHIR server', {
          provenanceId: id,
          error: errorMessage,
        });
      }

      this.logger.debug('Provenance recorded', {
        id,
        targetType: params.targetType,
        targetId: params.targetId,
        action: params.action,
      });
    } catch (error) {
      this.handleError('Failed to record provenance', error);
    }
  }

  /**
   * Retrieve all provenance records for a given resource.
   */
  async getByTarget(resourceType: string, resourceId: string): Promise<Provenance[]> {
    try {
      const rows = await this.db('provenance_records')
        .where({
          target_type: resourceType,
          target_id: resourceId,
        })
        .orderBy('recorded_at', 'desc');

      return rows.map((row: Record<string, unknown>) => this.rowToProvenance(row));
    } catch (error) {
      this.handleError('Failed to get provenance records', error);
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private buildFHIRProvenance(
    id: string,
    params: ProvenanceRecordParams,
    recordedAt: string
  ): Record<string, unknown> {
    const activityCodeMap: Record<string, { code: string; display: string }> = {
      CREATE: { code: 'CREATE', display: 'create' },
      UPDATE: { code: 'UPDATE', display: 'revise' },
      DELETE: { code: 'DELETE', display: 'delete' },
    };

    const activity = activityCodeMap[params.action] || {
      code: params.action,
      display: params.action.toLowerCase(),
    };

    return {
      resourceType: 'Provenance',
      meta: {
        profile: [US_CORE_PROFILES.PROVENANCE],
      },
      target: [
        {
          reference: `${params.targetType}/${params.targetId}`,
        },
      ],
      recorded: recordedAt,
      activity: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
            code: activity.code,
            display: activity.display,
          },
        ],
      },
      agent: [
        {
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
                code: 'author',
                display: 'Author',
              },
            ],
          },
          who: {
            reference: `Practitioner/${params.agentId}`,
            display: params.agentDisplay,
          },
        },
      ],
    };
  }

  private rowToProvenance(row: Record<string, unknown>): Provenance {
    let detail: Record<string, unknown> | undefined;
    if (row.detail) {
      try {
        detail = typeof row.detail === 'string' ? JSON.parse(row.detail) : row.detail as Record<string, unknown>;
      } catch {
        detail = undefined;
      }
    }

    return {
      id: row.id as string,
      targetType: row.target_type as string,
      targetId: row.target_id as string,
      action: row.action as string,
      agentId: row.agent_id as string,
      agentDisplay: row.agent_display as string,
      recordedAt: row.recorded_at as string,
      detail,
      fhirProvenanceId: (row.fhir_provenance_id as string) || undefined,
    };
  }
}

export const provenanceService = new ProvenanceService();
