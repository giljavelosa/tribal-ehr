// =============================================================================
// Secure Messaging Service
// HIPAA-compliant provider-to-provider and provider-to-patient messaging.
// All messages stored with audit trail and access controls.
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type MessagePriority = 'normal' | 'high' | 'urgent';

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  recipientId: string;
  recipientName?: string;
  patientId?: string;
  patientName?: string;
  subject: string;
  body: string;
  priority: MessagePriority;
  readAt?: string;
  parentId?: string;
  threadId: string;
  createdAt: string;
}

export interface CreateMessageDTO {
  senderId: string;
  recipientId: string;
  patientId?: string;
  subject: string;
  body: string;
  priority?: MessagePriority;
}

export interface MessageSearchParams extends PaginationParams {
  unreadOnly?: boolean;
  patientId?: string;
  priority?: MessagePriority;
  startDate?: string;
  endDate?: string;
}

// -----------------------------------------------------------------------------
// Database Row
// -----------------------------------------------------------------------------

interface MessageRow {
  id: string;
  sender_id: string;
  sender_name?: string;
  recipient_id: string;
  recipient_name?: string;
  patient_id?: string;
  patient_name?: string;
  subject: string;
  body: string;
  priority: string;
  read_at?: string;
  parent_id?: string;
  thread_id: string;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class MessageService extends BaseService {
  constructor() {
    super('MessageService');
  }

  // ---------------------------------------------------------------------------
  // Send Message
  // ---------------------------------------------------------------------------

  async send(data: CreateMessageDTO): Promise<Message> {
    try {
      if (!data.senderId) {
        throw new ValidationError('senderId is required');
      }
      if (!data.recipientId) {
        throw new ValidationError('recipientId is required');
      }
      if (!data.subject || !data.subject.trim()) {
        throw new ValidationError('subject is required');
      }
      if (!data.body || !data.body.trim()) {
        throw new ValidationError('body is required');
      }

      // Resolve sender and recipient names
      const sender = await this.db('users')
        .where({ id: data.senderId })
        .first<{ first_name?: string; last_name?: string }>();
      const senderName = sender
        ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim()
        : undefined;

      const recipient = await this.db('users')
        .where({ id: data.recipientId })
        .first<{ first_name?: string; last_name?: string }>();
      if (!recipient) {
        throw new NotFoundError('Recipient User', data.recipientId);
      }
      const recipientName = `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim();

      // Resolve patient name if patientId is provided
      let patientName: string | undefined;
      if (data.patientId) {
        const patient = await this.db('patients')
          .where({ id: data.patientId })
          .first<{ first_name?: string; last_name?: string }>();
        if (patient) {
          patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
        }
      }

      const id = uuidv4();
      const now = new Date().toISOString();
      const threadId = id; // New messages start their own thread

      const row: MessageRow = {
        id,
        sender_id: data.senderId,
        sender_name: senderName,
        recipient_id: data.recipientId,
        recipient_name: recipientName,
        patient_id: data.patientId,
        patient_name: patientName,
        subject: data.subject,
        body: data.body,
        priority: data.priority || 'normal',
        thread_id: threadId,
        created_at: now,
      };

      await this.db('messages').insert(row);

      this.logger.info('Message sent', {
        messageId: id,
        senderId: data.senderId,
        recipientId: data.recipientId,
        priority: data.priority || 'normal',
      });

      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to send message', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Inbox
  // ---------------------------------------------------------------------------

  async getInbox(userId: string, params: MessageSearchParams = {}): Promise<PaginatedResult<Message>> {
    try {
      const query = this.db('messages')
        .where('recipient_id', userId)
        .select('*');

      if (params.unreadOnly) {
        query.whereNull('read_at');
      }
      if (params.patientId) {
        query.where('patient_id', params.patientId);
      }
      if (params.priority) {
        query.where('priority', params.priority);
      }
      if (params.startDate) {
        query.where('created_at', '>=', params.startDate);
      }
      if (params.endDate) {
        query.where('created_at', '<=', params.endDate);
      }

      query.orderBy('created_at', 'desc');

      const result = await this.paginate<MessageRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to get inbox', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Sent Messages
  // ---------------------------------------------------------------------------

  async getSent(userId: string, params: MessageSearchParams = {}): Promise<PaginatedResult<Message>> {
    try {
      const query = this.db('messages')
        .where('sender_id', userId)
        .select('*');

      if (params.patientId) {
        query.where('patient_id', params.patientId);
      }
      if (params.priority) {
        query.where('priority', params.priority);
      }
      if (params.startDate) {
        query.where('created_at', '>=', params.startDate);
      }
      if (params.endDate) {
        query.where('created_at', '<=', params.endDate);
      }

      query.orderBy('created_at', 'desc');

      const result = await this.paginate<MessageRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to get sent messages', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Mark as Read
  // ---------------------------------------------------------------------------

  async markRead(messageId: string, userId: string): Promise<void> {
    try {
      const message = await this.db('messages').where({ id: messageId }).first<MessageRow>();
      if (!message) {
        throw new NotFoundError('Message', messageId);
      }

      // Only the recipient can mark a message as read
      if (message.recipient_id !== userId) {
        throw new ValidationError('Only the recipient can mark a message as read');
      }

      if (message.read_at) {
        return; // Already read
      }

      await this.db('messages')
        .where({ id: messageId })
        .update({ read_at: new Date().toISOString() });

      this.logger.debug('Message marked as read', { messageId, userId });
    } catch (error) {
      this.handleError('Failed to mark message as read', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Reply
  // ---------------------------------------------------------------------------

  async reply(parentId: string, senderId: string, body: string): Promise<Message> {
    try {
      if (!body || !body.trim()) {
        throw new ValidationError('Reply body is required');
      }

      const parent = await this.db('messages').where({ id: parentId }).first<MessageRow>();
      if (!parent) {
        throw new NotFoundError('Parent Message', parentId);
      }

      // Determine recipient: if sender of the reply is the original sender, send to original recipient, and vice versa
      const recipientId = parent.sender_id === senderId
        ? parent.recipient_id
        : parent.sender_id;

      // Resolve names
      const sender = await this.db('users')
        .where({ id: senderId })
        .first<{ first_name?: string; last_name?: string }>();
      const senderName = sender
        ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim()
        : undefined;

      const recipient = await this.db('users')
        .where({ id: recipientId })
        .first<{ first_name?: string; last_name?: string }>();
      const recipientName = recipient
        ? `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim()
        : undefined;

      const id = uuidv4();
      const now = new Date().toISOString();
      const subject = parent.subject.startsWith('Re: ') ? parent.subject : `Re: ${parent.subject}`;

      const row: MessageRow = {
        id,
        sender_id: senderId,
        sender_name: senderName,
        recipient_id: recipientId,
        recipient_name: recipientName,
        patient_id: parent.patient_id,
        patient_name: parent.patient_name,
        subject,
        body,
        priority: parent.priority,
        parent_id: parentId,
        thread_id: parent.thread_id,
        created_at: now,
      };

      await this.db('messages').insert(row);

      this.logger.info('Reply sent', {
        messageId: id,
        parentId,
        senderId,
        recipientId,
      });

      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to send reply', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Thread
  // ---------------------------------------------------------------------------

  async getThread(messageId: string): Promise<Message[]> {
    try {
      // First find the thread ID
      const message = await this.db('messages').where({ id: messageId }).first<MessageRow>();
      if (!message) {
        throw new NotFoundError('Message', messageId);
      }

      const rows = await this.db('messages')
        .where('thread_id', message.thread_id)
        .orderBy('created_at', 'asc') as MessageRow[];

      return rows.map((row) => this.fromRow(row));
    } catch (error) {
      this.handleError('Failed to get message thread', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Unread Count
  // ---------------------------------------------------------------------------

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const result = await this.db('messages')
        .where({ recipient_id: userId })
        .whereNull('read_at')
        .count('* as count')
        .first() as { count: string | number } | undefined;

      return result ? Number(result.count) : 0;
    } catch (error) {
      this.handleError('Failed to get unread count', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Single Message
  // ---------------------------------------------------------------------------

  async getMessage(id: string): Promise<Message> {
    try {
      const row = await this.db('messages').where({ id }).first<MessageRow>();
      if (!row) {
        throw new NotFoundError('Message', id);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get message', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Forward Message
  // ---------------------------------------------------------------------------

  async forward(
    messageId: string,
    forwarderId: string,
    recipientId: string,
    note?: string
  ): Promise<Message> {
    try {
      const original = await this.db('messages').where({ id: messageId }).first<MessageRow>();
      if (!original) {
        throw new NotFoundError('Message', messageId);
      }

      if (!recipientId) {
        throw new ValidationError('recipientId is required for forwarding');
      }

      // Resolve names
      const forwarder = await this.db('users')
        .where({ id: forwarderId })
        .first<{ first_name?: string; last_name?: string }>();
      const forwarderName = forwarder
        ? `${forwarder.first_name || ''} ${forwarder.last_name || ''}`.trim()
        : undefined;

      const recipient = await this.db('users')
        .where({ id: recipientId })
        .first<{ first_name?: string; last_name?: string }>();
      if (!recipient) {
        throw new NotFoundError('Recipient User', recipientId);
      }
      const recipientName = `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim();

      const id = uuidv4();
      const now = new Date().toISOString();
      const subject = original.subject.startsWith('Fwd: ')
        ? original.subject
        : `Fwd: ${original.subject}`;
      const body = note
        ? `${note}\n\n--- Forwarded Message ---\n${original.body}`
        : `--- Forwarded Message ---\n${original.body}`;

      const row: MessageRow = {
        id,
        sender_id: forwarderId,
        sender_name: forwarderName,
        recipient_id: recipientId,
        recipient_name: recipientName,
        patient_id: original.patient_id,
        patient_name: original.patient_name,
        subject,
        body,
        priority: original.priority,
        thread_id: id,
        created_at: now,
      };

      await this.db('messages').insert({
        ...row,
        forwarded_from: messageId,
      });

      this.logger.info('Message forwarded', {
        messageId: id,
        originalId: messageId,
        forwarderId,
        recipientId,
      });

      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to forward message', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Flag / Unflag Message
  // ---------------------------------------------------------------------------

  async flag(messageId: string, userId: string): Promise<void> {
    try {
      const message = await this.db('messages').where({ id: messageId }).first<MessageRow>();
      if (!message) {
        throw new NotFoundError('Message', messageId);
      }

      await this.db('messages').where({ id: messageId }).update({
        flagged: true,
        flagged_by: userId,
        flagged_at: new Date().toISOString(),
      });

      this.logger.debug('Message flagged', { messageId, userId });
    } catch (error) {
      this.handleError('Failed to flag message', error);
    }
  }

  async unflag(messageId: string, userId: string): Promise<void> {
    try {
      const message = await this.db('messages').where({ id: messageId }).first<MessageRow>();
      if (!message) {
        throw new NotFoundError('Message', messageId);
      }

      await this.db('messages').where({ id: messageId }).update({
        flagged: false,
        flagged_by: null,
        flagged_at: null,
      });

      this.logger.debug('Message unflagged', { messageId, userId });
    } catch (error) {
      this.handleError('Failed to unflag message', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Flagged Messages
  // ---------------------------------------------------------------------------

  async getFlaggedMessages(userId: string): Promise<Message[]> {
    try {
      const rows = await this.db('messages')
        .where({ recipient_id: userId, flagged: true })
        .orderBy('flagged_at', 'desc') as MessageRow[];

      return rows.map((row) => this.fromRow(row));
    } catch (error) {
      this.handleError('Failed to get flagged messages', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Set Follow-Up Date
  // ---------------------------------------------------------------------------

  async setFollowUpDate(messageId: string, userId: string, followUpDate: string): Promise<void> {
    try {
      const message = await this.db('messages').where({ id: messageId }).first<MessageRow>();
      if (!message) {
        throw new NotFoundError('Message', messageId);
      }

      if (!followUpDate) {
        throw new ValidationError('followUpDate is required');
      }

      await this.db('messages').where({ id: messageId }).update({
        follow_up_date: followUpDate,
        follow_up_completed: false,
      });

      this.logger.debug('Follow-up date set', { messageId, userId, followUpDate });
    } catch (error) {
      this.handleError('Failed to set follow-up date', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Escalate Message
  // ---------------------------------------------------------------------------

  async escalateMessage(messageId: string, escalatedBy: string, escalateTo: string): Promise<void> {
    try {
      const message = await this.db('messages').where({ id: messageId }).first<MessageRow>();
      if (!message) {
        throw new NotFoundError('Message', messageId);
      }

      if (!escalateTo) {
        throw new ValidationError('escalateTo is required');
      }

      const currentLevel = (message as any).escalation_level || 0;

      await this.db('messages').where({ id: messageId }).update({
        escalation_level: currentLevel + 1,
        escalated_at: new Date().toISOString(),
        escalated_to: escalateTo,
      });

      // Create a forwarded copy to the escalation target
      await this.forward(messageId, escalatedBy, escalateTo, '[ESCALATED] This message has been escalated for your attention.');

      this.logger.info('Message escalated', {
        messageId,
        escalatedBy,
        escalateTo,
        level: currentLevel + 1,
      });
    } catch (error) {
      this.handleError('Failed to escalate message', error);
    }
  }

  // ===========================================================================
  // Row Mapping
  // ===========================================================================

  private fromRow(row: MessageRow): Message {
    return {
      id: row.id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      recipientId: row.recipient_id,
      recipientName: row.recipient_name,
      patientId: row.patient_id,
      patientName: row.patient_name,
      subject: row.subject,
      body: row.body,
      priority: row.priority as MessagePriority,
      readAt: row.read_at,
      parentId: row.parent_id,
      threadId: row.thread_id,
      createdAt: row.created_at,
    };
  }
}

export const messageService = new MessageService();
