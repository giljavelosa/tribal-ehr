// =============================================================================
// Audit Service - HIPAA-Compliant Audit Event Logging with Hash Chain
// =============================================================================

import crypto from 'crypto';
import { Knex } from 'knex';
import { config } from '../config';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEventInput {
  userId: string;
  userRole: string;
  ipAddress: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
  resourceType: string;
  resourceId: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  statusCode: number;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  clinicalContext?: string;
  userAgent?: string;
  sessionId: string;
}

export interface AuditEvent extends AuditEventInput {
  id: string;
  timestamp: string;
  hashPrevious?: string;
  hash?: string;
}

export interface AuditSearchParams extends PaginationParams {
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Encryption helpers
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function deriveKey(): Buffer {
  // Derive a consistent 32-byte key from the configured encryption key
  return crypto.scryptSync(config.encryption.key, 'tribal-ehr-audit-salt', 32);
}

function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decrypt(ciphertext: string): string {
  const key = deriveKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encrypted = Buffer.from(parts[2], 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AuditService extends BaseService {
  constructor() {
    super('AuditService');
  }

  /**
   * Log an audit event. This is fire-and-forget so it does not block the
   * calling request. Errors are logged but not propagated.
   */
  async log(event: AuditEventInput): Promise<void> {
    try {
      await this._insertAuditEvent(event);
    } catch (error) {
      // Fire-and-forget: log error but do not propagate
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to write audit event', {
        error: errorMessage,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        action: event.action,
      });
    }
  }

  /**
   * Search audit events with filtering, sorting, and pagination.
   */
  async search(params: AuditSearchParams): Promise<PaginatedResult<AuditEvent>> {
    try {
      const query = this.db('audit_events').select('*');

      if (params.userId) {
        query.where('user_id', params.userId);
      }
      if (params.resourceType) {
        query.where('resource_type', params.resourceType);
      }
      if (params.resourceId) {
        query.where('resource_id', params.resourceId);
      }
      if (params.action) {
        query.where('action', params.action);
      }
      if (params.startDate) {
        query.where('timestamp', '>=', params.startDate);
      }
      if (params.endDate) {
        query.where('timestamp', '<=', params.endDate);
      }

      const allowedSortColumns: Record<string, string> = {
        timestamp: 'timestamp',
        action: 'action',
        resourceType: 'resource_type',
        userId: 'user_id',
      };

      this.buildSortClause(query, params.sort || 'timestamp', params.order || 'desc', allowedSortColumns);

      const result = await this.paginate<Record<string, unknown>>(query, params);

      const events = result.data.map((row) => this.rowToAuditEvent(row, true));

      return {
        data: events,
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to search audit events', error);
    }
  }

  /**
   * Verify the integrity of the audit hash chain.
   * Returns { valid: true } if intact, or { valid: false, brokenAt: id } on first break.
   */
  async verifyIntegrity(
    startId?: string,
    endId?: string
  ): Promise<{ valid: boolean; brokenAt?: string }> {
    try {
      const query = this.db('audit_events').select('*').orderBy('created_at', 'asc');

      if (startId) {
        const startRow = await this.db('audit_events').where({ id: startId }).first();
        if (startRow) {
          query.where('created_at', '>=', startRow.created_at);
        }
      }
      if (endId) {
        const endRow = await this.db('audit_events').where({ id: endId }).first();
        if (endRow) {
          query.where('created_at', '<=', endRow.created_at);
        }
      }

      const rows = await query;

      let previousHash = '';

      for (const row of rows) {
        const expectedHash = this.computeHash(row, previousHash);
        if (row.hash !== expectedHash) {
          return { valid: false, brokenAt: row.id };
        }
        previousHash = row.hash;
      }

      return { valid: true };
    } catch (error) {
      this.handleError('Failed to verify audit integrity', error);
    }
  }

  /**
   * Export audit events as CSV or FHIR AuditEvent Bundle.
   */
  async export(
    params: AuditSearchParams,
    format: 'csv' | 'fhir'
  ): Promise<string> {
    try {
      // Fetch all matching events (no pagination limit for export)
      const query = this.db('audit_events').select('*');

      if (params.userId) query.where('user_id', params.userId);
      if (params.resourceType) query.where('resource_type', params.resourceType);
      if (params.resourceId) query.where('resource_id', params.resourceId);
      if (params.action) query.where('action', params.action);
      if (params.startDate) query.where('timestamp', '>=', params.startDate);
      if (params.endDate) query.where('timestamp', '<=', params.endDate);

      query.orderBy('timestamp', 'asc');

      const rows = await query;
      const events = rows.map((row: Record<string, unknown>) => this.rowToAuditEvent(row, true));

      if (format === 'csv') {
        return this.toCSV(events);
      }

      return JSON.stringify(this.toFHIRAuditBundle(events), null, 2);
    } catch (error) {
      this.handleError('Failed to export audit events', error);
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async _insertAuditEvent(event: AuditEventInput): Promise<void> {
    // Get the hash of the previous audit event for chain integrity
    const previousRow = await this.db('audit_events')
      .select('hash')
      .orderBy('created_at', 'desc')
      .first();
    const previousHash: string = previousRow?.hash || '';

    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Encrypt PHI-containing values
    const encryptedOldValue = event.oldValue
      ? encrypt(JSON.stringify(event.oldValue))
      : null;
    const encryptedNewValue = event.newValue
      ? encrypt(JSON.stringify(event.newValue))
      : null;

    const row: Record<string, unknown> = {
      id,
      timestamp,
      user_id: event.userId,
      user_role: event.userRole,
      ip_address: event.ipAddress,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId,
      endpoint: event.endpoint,
      http_method: event.method,
      status_code: event.statusCode,
      old_value_encrypted: encryptedOldValue,
      new_value_encrypted: encryptedNewValue,
      clinical_context: event.clinicalContext || null,
      user_agent: event.userAgent || null,
      session_id: event.sessionId,
      hash_previous: previousHash || null,
      created_at: timestamp,
    };

    // Compute hash for this row (hash covers the data fields, not the hash itself)
    const hash = this.computeHash(row, previousHash);
    row.hash = hash;

    await this.db('audit_events').insert(row);

    this.logger.debug('Audit event recorded', {
      id,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
    });
  }

  private computeHash(row: Record<string, unknown>, previousHash: string): string {
    const payload = [
      row.id,
      row.timestamp,
      row.user_id,
      row.action,
      row.resource_type,
      row.resource_id,
      row.endpoint,
      row.method,
      row.status_code,
      row.session_id,
      previousHash,
    ].join('|');

    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  private rowToAuditEvent(row: Record<string, unknown>, decryptValues: boolean): AuditEvent {
    let oldValue: Record<string, unknown> | undefined;
    let newValue: Record<string, unknown> | undefined;

    if (decryptValues) {
      if (row.old_value && typeof row.old_value === 'string') {
        try {
          oldValue = JSON.parse(decrypt(row.old_value));
        } catch {
          oldValue = undefined;
        }
      }
      if (row.new_value && typeof row.new_value === 'string') {
        try {
          newValue = JSON.parse(decrypt(row.new_value));
        } catch {
          newValue = undefined;
        }
      }
    }

    return {
      id: row.id as string,
      timestamp: row.timestamp as string,
      userId: row.user_id as string,
      userRole: row.user_role as string,
      ipAddress: row.ip_address as string,
      action: row.action as AuditEvent['action'],
      resourceType: row.resource_type as string,
      resourceId: row.resource_id as string,
      endpoint: row.endpoint as string,
      method: row.method as AuditEvent['method'],
      statusCode: row.status_code as number,
      oldValue,
      newValue,
      clinicalContext: (row.clinical_context as string) || undefined,
      userAgent: (row.user_agent as string) || undefined,
      sessionId: row.session_id as string,
      hashPrevious: (row.hash_previous as string) || undefined,
      hash: (row.hash as string) || undefined,
    };
  }

  private toCSV(events: AuditEvent[]): string {
    const headers = [
      'id',
      'timestamp',
      'userId',
      'userRole',
      'ipAddress',
      'action',
      'resourceType',
      'resourceId',
      'endpoint',
      'method',
      'statusCode',
      'clinicalContext',
      'sessionId',
    ];

    const rows = events.map((e) =>
      headers.map((h) => {
        const value = e[h as keyof AuditEvent];
        if (value === undefined || value === null) return '';
        const str = String(value);
        // Escape CSV values containing commas, quotes, or newlines
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  private toFHIRAuditBundle(events: AuditEvent[]): Record<string, unknown> {
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: events.length,
      entry: events.map((event) => ({
        fullUrl: `urn:uuid:${event.id}`,
        resource: {
          resourceType: 'AuditEvent',
          id: event.id,
          type: {
            system: 'http://dicom.nema.org/resources/ontology/DCM',
            code: event.action === 'READ' ? '110110' : '110111',
            display: event.action === 'READ' ? 'Patient Record' : 'Procedure Record',
          },
          subtype: [
            {
              system: 'http://hl7.org/fhir/restful-interaction',
              code: event.action.toLowerCase(),
              display: event.action,
            },
          ],
          action: this.mapActionToFHIR(event.action),
          recorded: event.timestamp,
          outcome: event.statusCode < 400 ? '0' : '8',
          agent: [
            {
              who: {
                reference: `Practitioner/${event.userId}`,
              },
              requestor: true,
              network: {
                address: event.ipAddress,
                type: '2',
              },
            },
          ],
          source: {
            observer: {
              display: 'Tribal EHR System',
            },
          },
          entity: [
            {
              what: {
                reference: `${event.resourceType}/${event.resourceId}`,
              },
              type: {
                system: 'http://terminology.hl7.org/CodeSystem/audit-entity-type',
                code: '1',
                display: 'Person',
              },
            },
          ],
        },
      })),
    };
  }

  private mapActionToFHIR(action: string): string {
    const map: Record<string, string> = {
      CREATE: 'C',
      READ: 'R',
      UPDATE: 'U',
      DELETE: 'D',
    };
    return map[action] || 'E';
  }
}

export const auditService = new AuditService();
