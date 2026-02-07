// =============================================================================
// Escalation Engine Service
// Monitors unacknowledged critical results and unread urgent messages,
// automatically escalating them based on configurable rules when response
// thresholds are exceeded.
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService } from './base.service';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface EscalationRule {
  id: string;
  ruleType: string;
  thresholdMinutes: number;
  priorityFilter?: string;
  escalateToRole?: string;
  escalateToUser?: string;
  active: boolean;
  createdAt: string;
}

export interface EscalationEvent {
  id: string;
  ruleId?: string;
  sourceType: string;
  sourceId: string;
  originalRecipient: string;
  escalatedTo: string;
  reason?: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Database Rows
// -----------------------------------------------------------------------------

interface EscalationRuleRow {
  id: string;
  rule_type: string;
  threshold_minutes: number;
  priority_filter?: string;
  escalate_to_role?: string;
  escalate_to_user?: string;
  active: boolean;
  created_at: string;
}

interface EscalationEventRow {
  id: string;
  rule_id?: string;
  source_type: string;
  source_id: string;
  original_recipient: string;
  escalated_to: string;
  reason?: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class EscalationService extends BaseService {
  constructor() {
    super('EscalationService');
  }

  // ---------------------------------------------------------------------------
  // Run Escalation Check
  // ---------------------------------------------------------------------------

  async runEscalationCheck(): Promise<{ escalated: number }> {
    try {
      const rules = await this.db('escalation_rules')
        .where({ active: true }) as EscalationRuleRow[];

      let escalatedCount = 0;

      for (const rule of rules) {
        const thresholdTime = new Date(
          Date.now() - rule.threshold_minutes * 60 * 1000
        ).toISOString();

        if (rule.rule_type === 'critical_result') {
          // Find unacknowledged critical results past the threshold
          const criticalResults = await this.db('orders')
            .where('is_critical', true)
            .whereNull('critical_acknowledged_at')
            .where('critical_notified_at', '<', thresholdTime)
            .select('id', 'ordered_by_id', 'code_display');

          for (const result of criticalResults) {
            const escalatedTo = await this.resolveEscalationTarget(rule);
            if (!escalatedTo) continue;

            const eventId = uuidv4();
            const now = new Date().toISOString();

            await this.db('escalation_events').insert({
              id: eventId,
              rule_id: rule.id,
              source_type: 'critical_result',
              source_id: result.id,
              original_recipient: result.ordered_by_id,
              escalated_to: escalatedTo,
              reason: `Critical result for ${result.code_display || 'order'} not acknowledged within ${rule.threshold_minutes} minutes`,
              acknowledged: false,
              created_at: now,
            });

            // Send system notification message to the escalation target
            await this.sendEscalationMessage(
              escalatedTo,
              result.ordered_by_id,
              `Escalation: Unacknowledged critical result (${result.code_display || result.id})`,
              `A critical result has not been acknowledged within the ${rule.threshold_minutes}-minute threshold. ` +
              `Original recipient has been notified but has not responded. Please review and follow up.\n\n` +
              `Order ID: ${result.id}\nResult: ${result.code_display || 'N/A'}`,
            );

            escalatedCount++;
          }
        } else if (rule.rule_type === 'urgent_message') {
          // Find unread urgent messages past the threshold
          const query = this.db('messages')
            .where('priority', 'urgent')
            .whereNull('read_at')
            .where('created_at', '<', thresholdTime)
            .select('id', 'recipient_id', 'subject');

          if (rule.priority_filter) {
            query.where('priority', rule.priority_filter);
          }

          const urgentMessages = await query;

          for (const message of urgentMessages) {
            const escalatedTo = await this.resolveEscalationTarget(rule);
            if (!escalatedTo) continue;

            const eventId = uuidv4();
            const now = new Date().toISOString();

            await this.db('escalation_events').insert({
              id: eventId,
              rule_id: rule.id,
              source_type: 'urgent_message',
              source_id: message.id,
              original_recipient: message.recipient_id,
              escalated_to: escalatedTo,
              reason: `Urgent message "${message.subject || '(no subject)'}" not read within ${rule.threshold_minutes} minutes`,
              acknowledged: false,
              created_at: now,
            });

            // Send system notification message to the escalation target
            await this.sendEscalationMessage(
              escalatedTo,
              message.recipient_id,
              `Escalation: Unread urgent message - ${message.subject || '(no subject)'}`,
              `An urgent message has not been read within the ${rule.threshold_minutes}-minute threshold. ` +
              `The original recipient has not responded. Please review and follow up.\n\n` +
              `Message ID: ${message.id}\nSubject: ${message.subject || 'N/A'}`,
            );

            escalatedCount++;
          }
        }
      }

      this.logger.info('Escalation check completed', { escalated: escalatedCount });
      return { escalated: escalatedCount };
    } catch (error) {
      this.handleError('Failed to run escalation check', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Escalation Events
  // ---------------------------------------------------------------------------

  async getEscalationEvents(
    filters?: { acknowledged?: boolean; sourceType?: string }
  ): Promise<EscalationEvent[]> {
    try {
      const query = this.db('escalation_events').select('*');

      if (filters) {
        if (filters.acknowledged !== undefined) {
          query.where('acknowledged', filters.acknowledged);
        }
        if (filters.sourceType) {
          query.where('source_type', filters.sourceType);
        }
      }

      query.orderBy('created_at', 'desc');

      const rows = await query as EscalationEventRow[];
      return rows.map((row) => this.fromEventRow(row));
    } catch (error) {
      this.handleError('Failed to get escalation events', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Acknowledge Escalation
  // ---------------------------------------------------------------------------

  async acknowledgeEscalation(eventId: string, userId: string): Promise<void> {
    try {
      const row = await this.db('escalation_events')
        .where({ id: eventId })
        .first<EscalationEventRow>();

      if (!row) {
        throw new NotFoundError('Escalation Event', eventId);
      }

      if (row.acknowledged) {
        return; // Already acknowledged
      }

      const now = new Date().toISOString();

      await this.db('escalation_events')
        .where({ id: eventId })
        .update({
          acknowledged: true,
          acknowledged_at: now,
        });

      this.logger.info('Escalation event acknowledged', { eventId, userId });
    } catch (error) {
      this.handleError('Failed to acknowledge escalation', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Create Rule
  // ---------------------------------------------------------------------------

  async createRule(data: {
    ruleType: string;
    thresholdMinutes: number;
    priorityFilter?: string;
    escalateToRole?: string;
    escalateToUser?: string;
  }): Promise<EscalationRule> {
    try {
      if (!data.ruleType) {
        throw new ValidationError('ruleType is required');
      }
      if (!data.thresholdMinutes || data.thresholdMinutes <= 0) {
        throw new ValidationError('thresholdMinutes must be a positive number');
      }
      if (!data.escalateToRole && !data.escalateToUser) {
        throw new ValidationError('Either escalateToRole or escalateToUser is required');
      }

      const validRuleTypes = ['critical_result', 'urgent_message'];
      if (!validRuleTypes.includes(data.ruleType)) {
        throw new ValidationError(`ruleType must be one of: ${validRuleTypes.join(', ')}`);
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      const row: EscalationRuleRow = {
        id,
        rule_type: data.ruleType,
        threshold_minutes: data.thresholdMinutes,
        priority_filter: data.priorityFilter,
        escalate_to_role: data.escalateToRole,
        escalate_to_user: data.escalateToUser,
        active: true,
        created_at: now,
      };

      await this.db('escalation_rules').insert(row);

      this.logger.info('Escalation rule created', {
        ruleId: id,
        ruleType: data.ruleType,
        thresholdMinutes: data.thresholdMinutes,
      });

      return this.fromRuleRow(row);
    } catch (error) {
      this.handleError('Failed to create escalation rule', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update Rule
  // ---------------------------------------------------------------------------

  async updateRule(
    ruleId: string,
    data: Partial<{
      thresholdMinutes: number;
      active: boolean;
      escalateToRole: string;
      escalateToUser: string;
    }>
  ): Promise<EscalationRule> {
    try {
      const existing = await this.db('escalation_rules')
        .where({ id: ruleId })
        .first<EscalationRuleRow>();

      if (!existing) {
        throw new NotFoundError('Escalation Rule', ruleId);
      }

      if (data.thresholdMinutes !== undefined && data.thresholdMinutes <= 0) {
        throw new ValidationError('thresholdMinutes must be a positive number');
      }

      const updates: Record<string, unknown> = {};

      if (data.thresholdMinutes !== undefined) {
        updates.threshold_minutes = data.thresholdMinutes;
      }
      if (data.active !== undefined) {
        updates.active = data.active;
      }
      if (data.escalateToRole !== undefined) {
        updates.escalate_to_role = data.escalateToRole;
      }
      if (data.escalateToUser !== undefined) {
        updates.escalate_to_user = data.escalateToUser;
      }

      await this.db('escalation_rules')
        .where({ id: ruleId })
        .update(updates);

      const updated = await this.db('escalation_rules')
        .where({ id: ruleId })
        .first<EscalationRuleRow>();

      this.logger.info('Escalation rule updated', { ruleId, updates: Object.keys(updates) });

      return this.fromRuleRow(updated!);
    } catch (error) {
      this.handleError('Failed to update escalation rule', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Rules
  // ---------------------------------------------------------------------------

  async getRules(): Promise<EscalationRule[]> {
    try {
      const rows = await this.db('escalation_rules')
        .select('*')
        .orderBy('created_at', 'desc') as EscalationRuleRow[];

      return rows.map((row) => this.fromRuleRow(row));
    } catch (error) {
      this.handleError('Failed to get escalation rules', error);
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Resolve the escalation target user ID from a rule.
   * If escalateToUser is set, use that directly.
   * If escalateToRole is set, find an available user with that role.
   */
  private async resolveEscalationTarget(rule: EscalationRuleRow): Promise<string | null> {
    if (rule.escalate_to_user) {
      return rule.escalate_to_user;
    }

    if (rule.escalate_to_role) {
      const user = await this.db('users')
        .where({ role: rule.escalate_to_role, active: true })
        .first<{ id: string }>();

      return user?.id || null;
    }

    return null;
  }

  /**
   * Send an escalation notification message via the messages table.
   */
  private async sendEscalationMessage(
    recipientId: string,
    originalRecipientId: string,
    subject: string,
    body: string
  ): Promise<void> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      await this.db('messages').insert({
        id,
        sender_id: 'system',
        sender_name: 'Escalation Engine',
        recipient_id: recipientId,
        subject,
        body,
        priority: 'urgent',
        thread_id: id,
        created_at: now,
      });
    } catch (msgError) {
      this.logger.warn('Failed to send escalation notification message', {
        recipientId,
        error: msgError,
      });
    }
  }

  // ===========================================================================
  // Row Mapping
  // ===========================================================================

  private fromRuleRow(row: EscalationRuleRow): EscalationRule {
    return {
      id: row.id,
      ruleType: row.rule_type,
      thresholdMinutes: row.threshold_minutes,
      priorityFilter: row.priority_filter,
      escalateToRole: row.escalate_to_role,
      escalateToUser: row.escalate_to_user,
      active: row.active,
      createdAt: row.created_at,
    };
  }

  private fromEventRow(row: EscalationEventRow): EscalationEvent {
    return {
      id: row.id,
      ruleId: row.rule_id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      originalRecipient: row.original_recipient,
      escalatedTo: row.escalated_to,
      reason: row.reason,
      acknowledged: row.acknowledged,
      acknowledgedAt: row.acknowledged_at,
      createdAt: row.created_at,
    };
  }
}

export const escalationService = new EscalationService();
