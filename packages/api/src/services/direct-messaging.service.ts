// =============================================================================
// Direct Messaging Service - ONC §170.315(h)(1)-(h)(2) Direct Protocol
// Supports secure Direct messaging for transitions of care, referrals,
// and provider-to-provider communication. Transport layer (SMTP/HISP)
// is stubbed for local queueing with TODO markers for HISP integration.
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface DirectAddress {
  id: string;
  userId: string | null;
  directAddress: string;
  displayName: string;
  organization: string | null;
  certificatePem: string | null;
  certificateFingerprint: string | null;
  certificateExpiresAt: string | null;
  active: boolean;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DirectMessage {
  id: string;
  messageId: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string | null;
  body: string | null;
  contentType: string;
  attachments: DirectMessageAttachment[];
  direction: 'inbound' | 'outbound';
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'received' | 'read';
  mdnStatus: string | null;
  mdnReceivedAt: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  errorMessage: string | null;
  relatedPatientId: string | null;
  relatedDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DirectMessageAttachment {
  filename: string;
  contentType: string;
  size: number;
  storageKey: string;
}

export interface SendMessageInput {
  from: string;
  to: string[];
  cc?: string[];
  subject?: string;
  body?: string;
  contentType?: string;
  attachments?: DirectMessageAttachment[];
  relatedPatientId?: string;
}

export interface ReceiveMessageInput {
  messageId: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses?: string[];
  subject?: string;
  body?: string;
  contentType?: string;
  attachments?: DirectMessageAttachment[];
  relatedPatientId?: string;
  relatedDocumentId?: string;
}

export interface MessageFilters extends PaginationParams {
  direction?: 'inbound' | 'outbound';
  status?: string;
  fromAddress?: string;
  toAddress?: string;
  relatedPatientId?: string;
}

export interface MessageStats {
  totalSent: number;
  totalReceived: number;
  totalDelivered: number;
  totalFailed: number;
  totalPending: number;
  mdnReceived: number;
  mdnPending: number;
}

// Row types for database mapping
interface DirectAddressRow {
  id: string;
  user_id: string | null;
  direct_address: string;
  display_name: string;
  organization: string | null;
  certificate_pem: string | null;
  certificate_fingerprint: string | null;
  certificate_expires_at: string | null;
  active: boolean;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

interface DirectMessageRow {
  id: string;
  message_id: string;
  from_address: string;
  to_addresses: string[] | string;
  cc_addresses: string[] | string;
  subject: string | null;
  body: string | null;
  content_type: string;
  attachments: DirectMessageAttachment[] | string;
  direction: 'inbound' | 'outbound';
  status: string;
  mdn_status: string | null;
  mdn_received_at: string | null;
  sent_at: string | null;
  received_at: string | null;
  error_message: string | null;
  related_patient_id: string | null;
  related_document_id: string | null;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class DirectMessagingService extends BaseService {
  constructor() {
    super('DirectMessagingService');
  }

  // ---------------------------------------------------------------------------
  // Address Management
  // ---------------------------------------------------------------------------

  /**
   * Register a new Direct address for a user or organization.
   */
  async registerAddress(
    userId: string | null,
    directAddress: string,
    displayName: string,
    organization?: string
  ): Promise<DirectAddress> {
    try {
      // Validate Direct address format (must contain @)
      if (!directAddress || !directAddress.includes('@')) {
        throw new ValidationError(
          'Direct address must be a valid email-style address (e.g., provider@direct.tribal-ehr.org)'
        );
      }
      if (!displayName || typeof displayName !== 'string') {
        throw new ValidationError('Display name is required');
      }

      // Check for existing address
      const existing = await this.db('direct_addresses')
        .where({ direct_address: directAddress })
        .first();

      if (existing) {
        throw new ConflictError(
          `Direct address '${directAddress}' is already registered`
        );
      }

      // If userId provided, verify user exists
      if (userId) {
        await this.requireExists('users', userId, 'User');
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      const row: DirectAddressRow = {
        id,
        user_id: userId || null,
        direct_address: directAddress,
        display_name: displayName,
        organization: organization || null,
        certificate_pem: null,
        certificate_fingerprint: null,
        certificate_expires_at: null,
        active: true,
        verified: false,
        created_at: now,
        updated_at: now,
      };

      await this.db('direct_addresses').insert(row);

      this.logger.info('Direct address registered', {
        addressId: id,
        directAddress,
        userId,
      });

      return this.rowToAddress(row);
    } catch (error) {
      this.handleError('Failed to register Direct address', error);
    }
  }

  /**
   * Mark a Direct address as verified (admin operation).
   */
  async verifyAddress(id: string): Promise<DirectAddress> {
    try {
      const existing = await this.db('direct_addresses')
        .where({ id })
        .first<DirectAddressRow>();

      if (!existing) {
        throw new NotFoundError('Direct address', id);
      }

      if (existing.verified) {
        return this.rowToAddress(existing);
      }

      const now = new Date().toISOString();

      await this.db('direct_addresses')
        .where({ id })
        .update({
          verified: true,
          updated_at: now,
        });

      this.logger.info('Direct address verified', {
        addressId: id,
        directAddress: existing.direct_address,
      });

      return this.rowToAddress({
        ...existing,
        verified: true,
        updated_at: now,
      });
    } catch (error) {
      this.handleError('Failed to verify Direct address', error);
    }
  }

  /**
   * List Direct addresses with optional filtering.
   */
  async getAddresses(filters?: {
    userId?: string;
    active?: boolean;
    verified?: boolean;
  }): Promise<DirectAddress[]> {
    try {
      const query = this.db('direct_addresses')
        .select('*')
        .orderBy('created_at', 'desc');

      if (filters?.userId) {
        query.where('user_id', filters.userId);
      }
      if (filters?.active !== undefined) {
        query.where('active', filters.active);
      }
      if (filters?.verified !== undefined) {
        query.where('verified', filters.verified);
      }

      const rows = await query as DirectAddressRow[];
      return rows.map((row) => this.rowToAddress(row));
    } catch (error) {
      this.handleError('Failed to list Direct addresses', error);
    }
  }

  /**
   * Deactivate a Direct address (soft delete).
   */
  async deactivateAddress(id: string): Promise<DirectAddress> {
    try {
      const existing = await this.db('direct_addresses')
        .where({ id })
        .first<DirectAddressRow>();

      if (!existing) {
        throw new NotFoundError('Direct address', id);
      }

      const now = new Date().toISOString();

      await this.db('direct_addresses')
        .where({ id })
        .update({
          active: false,
          updated_at: now,
        });

      this.logger.info('Direct address deactivated', {
        addressId: id,
        directAddress: existing.direct_address,
      });

      return this.rowToAddress({
        ...existing,
        active: false,
        updated_at: now,
      });
    } catch (error) {
      this.handleError('Failed to deactivate Direct address', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Message Operations
  // ---------------------------------------------------------------------------

  /**
   * Queue an outbound Direct message. The message is stored locally and
   * marked as 'queued'. Actual SMTP transport would be handled by a HISP
   * integration worker.
   */
  async sendMessage(data: SendMessageInput): Promise<DirectMessage> {
    try {
      // Validate required fields
      if (!data.from || typeof data.from !== 'string') {
        throw new ValidationError('from address is required');
      }
      if (!data.to || !Array.isArray(data.to) || data.to.length === 0) {
        throw new ValidationError('At least one recipient (to) address is required');
      }

      // Validate from address exists and is active
      const fromAddress = await this.db('direct_addresses')
        .where({ direct_address: data.from, active: true })
        .first();

      if (!fromAddress) {
        throw new ValidationError(
          `Sender address '${data.from}' is not registered or not active`
        );
      }

      // Validate patient reference if provided
      if (data.relatedPatientId) {
        await this.requireExists('patients', data.relatedPatientId, 'Patient');
      }

      const id = uuidv4();
      const messageId = `<${uuidv4()}@direct.tribal-ehr.org>`;
      const now = new Date().toISOString();

      const row: DirectMessageRow = {
        id,
        message_id: messageId,
        from_address: data.from,
        to_addresses: JSON.stringify(data.to),
        cc_addresses: JSON.stringify(data.cc || []),
        subject: data.subject || null,
        body: data.body || null,
        content_type: data.contentType || 'text/plain',
        attachments: JSON.stringify(data.attachments || []),
        direction: 'outbound',
        status: 'queued',
        mdn_status: 'requested',
        mdn_received_at: null,
        sent_at: null,
        received_at: null,
        error_message: null,
        related_patient_id: data.relatedPatientId || null,
        related_document_id: null,
        created_at: now,
        updated_at: now,
      };

      await this.db('direct_messages').insert({
        ...row,
        to_addresses: JSON.stringify(data.to),
        cc_addresses: JSON.stringify(data.cc || []),
        attachments: JSON.stringify(data.attachments || []),
      });

      // TODO: Dispatch to HISP transport worker via RabbitMQ
      // await this.dispatchToHISP(id, data);

      this.logger.info('Direct message queued for delivery', {
        messageId: id,
        from: data.from,
        to: data.to,
        subject: data.subject,
      });

      return this.rowToMessage(row);
    } catch (error) {
      this.handleError('Failed to send Direct message', error);
    }
  }

  /**
   * Process an inbound Direct message received from a HISP.
   */
  async receiveMessage(data: ReceiveMessageInput): Promise<DirectMessage> {
    try {
      if (!data.messageId || typeof data.messageId !== 'string') {
        throw new ValidationError('messageId is required');
      }
      if (!data.fromAddress || typeof data.fromAddress !== 'string') {
        throw new ValidationError('fromAddress is required');
      }
      if (!data.toAddresses || !Array.isArray(data.toAddresses) || data.toAddresses.length === 0) {
        throw new ValidationError('At least one toAddress is required');
      }

      // Check for duplicate message IDs
      const existing = await this.db('direct_messages')
        .where({ message_id: data.messageId })
        .first();

      if (existing) {
        throw new ConflictError(
          `Message with ID '${data.messageId}' has already been received`
        );
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      const row: DirectMessageRow = {
        id,
        message_id: data.messageId,
        from_address: data.fromAddress,
        to_addresses: JSON.stringify(data.toAddresses),
        cc_addresses: JSON.stringify(data.ccAddresses || []),
        subject: data.subject || null,
        body: data.body || null,
        content_type: data.contentType || 'text/plain',
        attachments: JSON.stringify(data.attachments || []),
        direction: 'inbound',
        status: 'received',
        mdn_status: null,
        mdn_received_at: null,
        sent_at: null,
        received_at: now,
        error_message: null,
        related_patient_id: data.relatedPatientId || null,
        related_document_id: data.relatedDocumentId || null,
        created_at: now,
        updated_at: now,
      };

      await this.db('direct_messages').insert({
        ...row,
        to_addresses: JSON.stringify(data.toAddresses),
        cc_addresses: JSON.stringify(data.ccAddresses || []),
        attachments: JSON.stringify(data.attachments || []),
      });

      // TODO: Send MDN (Message Disposition Notification) back to sender via HISP
      // await this.sendMDN(data.messageId, data.fromAddress, 'dispatched');

      this.logger.info('Direct message received', {
        messageId: id,
        from: data.fromAddress,
        to: data.toAddresses,
      });

      return this.rowToMessage(row);
    } catch (error) {
      this.handleError('Failed to receive Direct message', error);
    }
  }

  /**
   * List messages with optional filtering and pagination.
   */
  async getMessages(filters: MessageFilters): Promise<PaginatedResult<DirectMessage>> {
    try {
      const query = this.db('direct_messages')
        .select('*')
        .orderBy('created_at', 'desc');

      if (filters.direction) {
        query.where('direction', filters.direction);
      }
      if (filters.status) {
        query.where('status', filters.status);
      }
      if (filters.fromAddress) {
        query.where('from_address', filters.fromAddress);
      }
      if (filters.toAddress) {
        query.whereRaw("to_addresses::text LIKE ?", [`%${filters.toAddress}%`]);
      }
      if (filters.relatedPatientId) {
        query.where('related_patient_id', filters.relatedPatientId);
      }

      const result = await this.paginate<DirectMessageRow>(query, filters);

      return {
        data: result.data.map((row) => this.rowToMessage(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to list Direct messages', error);
    }
  }

  /**
   * Get a single message by ID.
   */
  async getMessage(id: string): Promise<DirectMessage> {
    try {
      const row = await this.db('direct_messages')
        .where({ id })
        .first<DirectMessageRow>();

      if (!row) {
        throw new NotFoundError('Direct message', id);
      }

      return this.rowToMessage(row);
    } catch (error) {
      this.handleError('Failed to get Direct message', error);
    }
  }

  /**
   * Convenience method to send a C-CDA document via Direct protocol.
   * Fetches the document and patient info, then queues the message.
   */
  async sendCCDA(
    patientId: string,
    toAddress: string,
    documentType: string
  ): Promise<DirectMessage> {
    try {
      // Verify patient exists
      const patient = await this.db('patients')
        .where({ id: patientId })
        .first();

      if (!patient) {
        throw new NotFoundError('Patient', patientId);
      }

      // Find the most recent document of the requested type for this patient
      const document = await this.db('documents')
        .where({ patient_id: patientId })
        .where(function () {
          this.where('type', documentType)
            .orWhere('format', 'application/xml');
        })
        .orderBy('created_at', 'desc')
        .first();

      if (!document) {
        throw new NotFoundError(
          'C-CDA document',
          `type=${documentType} for patient ${patientId}`
        );
      }

      // Find a valid sender address (first active, verified address)
      const senderAddress = await this.db('direct_addresses')
        .where({ active: true, verified: true })
        .first<DirectAddressRow>();

      if (!senderAddress) {
        throw new ValidationError(
          'No active, verified Direct address available for sending'
        );
      }

      const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();

      // Send message with C-CDA as attachment
      return this.sendMessage({
        from: senderAddress.direct_address,
        to: [toAddress],
        subject: `C-CDA Document: ${documentType} for ${patientName}`,
        body: `Please find attached the ${documentType} document for patient ${patientName}.`,
        contentType: 'application/xml',
        attachments: [
          {
            filename: `${documentType}-${patientId}.xml`,
            contentType: 'application/xml',
            size: document.content ? Buffer.byteLength(document.content as string, 'utf8') : 0,
            storageKey: `documents/${document.id}`,
          },
        ],
        relatedPatientId: patientId,
      });
    } catch (error) {
      this.handleError('Failed to send C-CDA via Direct', error);
    }
  }

  /**
   * Process a Message Disposition Notification (MDN).
   * Updates the original message's MDN status.
   */
  async processMDN(
    messageId: string,
    status: 'received' | 'failed'
  ): Promise<DirectMessage> {
    try {
      const row = await this.db('direct_messages')
        .where({ message_id: messageId })
        .first<DirectMessageRow>();

      if (!row) {
        throw new NotFoundError('Direct message', messageId);
      }

      const now = new Date().toISOString();
      const updates: Record<string, unknown> = {
        mdn_status: status,
        mdn_received_at: now,
        updated_at: now,
      };

      // If MDN received successfully, mark the message as delivered
      if (status === 'received') {
        updates.status = 'delivered';
      }

      await this.db('direct_messages')
        .where({ message_id: messageId })
        .update(updates);

      this.logger.info('MDN processed', {
        messageId,
        mdnStatus: status,
      });

      const updated = await this.db('direct_messages')
        .where({ message_id: messageId })
        .first<DirectMessageRow>();

      return this.rowToMessage(updated!);
    } catch (error) {
      this.handleError('Failed to process MDN', error);
    }
  }

  /**
   * Get delivery statistics for Direct messages.
   */
  async getMessageStats(): Promise<MessageStats> {
    try {
      const sentResult = await this.db('direct_messages')
        .where({ direction: 'outbound' })
        .count('* as count')
        .first() as { count: string | number } | undefined;

      const receivedResult = await this.db('direct_messages')
        .where({ direction: 'inbound' })
        .count('* as count')
        .first() as { count: string | number } | undefined;

      const deliveredResult = await this.db('direct_messages')
        .where({ status: 'delivered' })
        .count('* as count')
        .first() as { count: string | number } | undefined;

      const failedResult = await this.db('direct_messages')
        .where({ status: 'failed' })
        .count('* as count')
        .first() as { count: string | number } | undefined;

      const pendingResult = await this.db('direct_messages')
        .whereIn('status', ['queued', 'sent'])
        .count('* as count')
        .first() as { count: string | number } | undefined;

      const mdnReceivedResult = await this.db('direct_messages')
        .where({ mdn_status: 'received' })
        .count('* as count')
        .first() as { count: string | number } | undefined;

      const mdnPendingResult = await this.db('direct_messages')
        .where({ mdn_status: 'requested' })
        .count('* as count')
        .first() as { count: string | number } | undefined;

      return {
        totalSent: Number(sentResult?.count || 0),
        totalReceived: Number(receivedResult?.count || 0),
        totalDelivered: Number(deliveredResult?.count || 0),
        totalFailed: Number(failedResult?.count || 0),
        totalPending: Number(pendingResult?.count || 0),
        mdnReceived: Number(mdnReceivedResult?.count || 0),
        mdnPending: Number(mdnPendingResult?.count || 0),
      };
    } catch (error) {
      this.handleError('Failed to get message statistics', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private rowToAddress(row: DirectAddressRow): DirectAddress {
    return {
      id: row.id,
      userId: row.user_id,
      directAddress: row.direct_address,
      displayName: row.display_name,
      organization: row.organization,
      certificatePem: row.certificate_pem,
      certificateFingerprint: row.certificate_fingerprint,
      certificateExpiresAt: row.certificate_expires_at,
      active: row.active,
      verified: row.verified,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToMessage(row: DirectMessageRow): DirectMessage {
    let toAddresses: string[] = [];
    let ccAddresses: string[] = [];
    let attachments: DirectMessageAttachment[] = [];

    if (typeof row.to_addresses === 'string') {
      try { toAddresses = JSON.parse(row.to_addresses); } catch { toAddresses = []; }
    } else if (Array.isArray(row.to_addresses)) {
      toAddresses = row.to_addresses;
    }

    if (typeof row.cc_addresses === 'string') {
      try { ccAddresses = JSON.parse(row.cc_addresses); } catch { ccAddresses = []; }
    } else if (Array.isArray(row.cc_addresses)) {
      ccAddresses = row.cc_addresses;
    }

    if (typeof row.attachments === 'string') {
      try { attachments = JSON.parse(row.attachments); } catch { attachments = []; }
    } else if (Array.isArray(row.attachments)) {
      attachments = row.attachments;
    }

    return {
      id: row.id,
      messageId: row.message_id,
      fromAddress: row.from_address,
      toAddresses,
      ccAddresses,
      subject: row.subject,
      body: row.body,
      contentType: row.content_type,
      attachments,
      direction: row.direction,
      status: row.status as DirectMessage['status'],
      mdnStatus: row.mdn_status,
      mdnReceivedAt: row.mdn_received_at,
      sentAt: row.sent_at,
      receivedAt: row.received_at,
      errorMessage: row.error_message,
      relatedPatientId: row.related_patient_id,
      relatedDocumentId: row.related_document_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const directMessagingService = new DirectMessagingService();
