// =============================================================================
// CDS Override & Feedback Service
// Persists CDS override decisions and card feedback for §170.315(b)(11)
// DSI source attribution and audit trail compliance
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService } from './base.service';

// -----------------------------------------------------------------------------
// Interfaces
// -----------------------------------------------------------------------------

export interface CDSOverrideRecord {
  id: string;
  cardId: string;
  userId: string;
  patientId: string;
  hookInstance: string;
  reasonCode: string;
  reasonText?: string;
  cardSummary: string;
  createdAt: string;
}

export interface CDSFeedbackRecord {
  id: string;
  cardId: string;
  userId: string;
  outcome: string;
  outcomeTimestamp?: string;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class CDSOverrideService extends BaseService {
  constructor() {
    super('CDSOverrideService');
  }

  async recordOverride(data: {
    cardId: string;
    userId: string;
    patientId: string;
    hookInstance: string;
    reasonCode: string;
    reasonText?: string;
    cardSummary: string;
  }): Promise<CDSOverrideRecord> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      await this.db('cds_overrides').insert({
        id,
        card_id: data.cardId,
        user_id: data.userId,
        patient_id: data.patientId,
        hook_instance: data.hookInstance,
        reason_code: data.reasonCode,
        reason_text: data.reasonText || null,
        card_summary: data.cardSummary,
        created_at: now,
      });

      this.logger.info('CDS override recorded', {
        cardId: data.cardId,
        userId: data.userId,
        patientId: data.patientId,
        reasonCode: data.reasonCode,
      });

      return {
        id,
        cardId: data.cardId,
        userId: data.userId,
        patientId: data.patientId,
        hookInstance: data.hookInstance,
        reasonCode: data.reasonCode,
        reasonText: data.reasonText,
        cardSummary: data.cardSummary,
        createdAt: now,
      };
    } catch (error) {
      this.handleError('Failed to record CDS override', error);
    }
  }

  async recordFeedback(data: {
    cardId: string;
    userId: string;
    outcome: string;
    outcomeTimestamp?: string;
  }): Promise<CDSFeedbackRecord> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      await this.db('cds_feedback').insert({
        id,
        card_id: data.cardId,
        user_id: data.userId,
        outcome: data.outcome,
        outcome_timestamp: data.outcomeTimestamp || null,
        created_at: now,
      });

      this.logger.info('CDS feedback recorded', {
        cardId: data.cardId,
        userId: data.userId,
        outcome: data.outcome,
      });

      return {
        id,
        cardId: data.cardId,
        userId: data.userId,
        outcome: data.outcome,
        outcomeTimestamp: data.outcomeTimestamp,
        createdAt: now,
      };
    } catch (error) {
      this.handleError('Failed to record CDS feedback', error);
    }
  }

  async getOverrideAnalytics(
    filters: { startDate?: string; endDate?: string; userId?: string } = {}
  ): Promise<{
    totalOverrides: number;
    overridesByType: Array<{ alertType: string; count: number }>;
    overridesBySeverity: Array<{ severity: string; count: number }>;
    overridesByProvider: Array<{ userId: string; count: number }>;
    appropriateOverrides: number;
    inappropriateOverrides: number;
    unreviewedOverrides: number;
  }> {
    try {
      let query = this.db('cds_overrides').select('*');

      if (filters.startDate) {
        query = query.where('created_at', '>=', filters.startDate);
      }
      if (filters.endDate) {
        query = query.where('created_at', '<=', filters.endDate);
      }
      if (filters.userId) {
        query = query.where('user_id', filters.userId);
      }

      const overrides = await query;

      const byType = new Map<string, number>();
      const bySeverity = new Map<string, number>();
      const byProvider = new Map<string, number>();
      let appropriate = 0;
      let inappropriate = 0;
      let unreviewed = 0;

      for (const o of overrides) {
        const type = o.alert_type || 'unknown';
        byType.set(type, (byType.get(type) || 0) + 1);

        const severity = o.alert_severity || 'unknown';
        bySeverity.set(severity, (bySeverity.get(severity) || 0) + 1);

        byProvider.set(o.user_id, (byProvider.get(o.user_id) || 0) + 1);

        if (o.was_appropriate === true) appropriate++;
        else if (o.was_appropriate === false) inappropriate++;
        else unreviewed++;
      }

      return {
        totalOverrides: overrides.length,
        overridesByType: Array.from(byType.entries()).map(([alertType, count]) => ({ alertType, count })),
        overridesBySeverity: Array.from(bySeverity.entries()).map(([severity, count]) => ({ severity, count })),
        overridesByProvider: Array.from(byProvider.entries()).map(([userId, count]) => ({ userId, count })),
        appropriateOverrides: appropriate,
        inappropriateOverrides: inappropriate,
        unreviewedOverrides: unreviewed,
      };
    } catch (error) {
      this.handleError('Failed to get override analytics', error);
    }
  }

  async markOverrideReview(
    overrideId: string,
    reviewedBy: string,
    wasAppropriate: boolean
  ): Promise<void> {
    try {
      const override = await this.db('cds_overrides').where({ id: overrideId }).first();
      if (!override) {
        throw new Error(`Override ${overrideId} not found`);
      }

      await this.db('cds_overrides').where({ id: overrideId }).update({
        was_appropriate: wasAppropriate,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      });

      this.logger.info('Override reviewed', { overrideId, reviewedBy, wasAppropriate });
    } catch (error) {
      this.handleError('Failed to mark override review', error);
    }
  }

  async getOverridesByProvider(
    userId: string,
    limit = 50
  ): Promise<CDSOverrideRecord[]> {
    try {
      const rows = await this.db('cds_overrides')
        .where({ user_id: userId })
        .orderBy('created_at', 'desc')
        .limit(limit);

      return rows.map((row: any) => ({
        id: row.id,
        cardId: row.card_id,
        userId: row.user_id,
        patientId: row.patient_id,
        hookInstance: row.hook_instance,
        reasonCode: row.reason_code,
        reasonText: row.reason_text,
        cardSummary: row.card_summary,
        createdAt: row.created_at,
      }));
    } catch (error) {
      this.handleError('Failed to get overrides by provider', error);
    }
  }

  async getUnreviewedOverrides(limit = 50): Promise<CDSOverrideRecord[]> {
    try {
      const rows = await this.db('cds_overrides')
        .whereNull('reviewed_by')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .select('*');

      return rows.map((row: any) => ({
        id: row.id,
        cardId: row.card_id,
        userId: row.user_id,
        patientId: row.patient_id,
        hookInstance: row.hook_instance,
        reasonCode: row.reason_code,
        reasonText: row.reason_text,
        cardSummary: row.card_summary,
        createdAt: row.created_at,
      }));
    } catch (error) {
      this.handleError('Failed to get unreviewed overrides', error);
    }
  }

  async getOverridesForPatient(patientId: string): Promise<CDSOverrideRecord[]> {
    try {
      const rows = await this.db('cds_overrides')
        .where('patient_id', patientId)
        .orderBy('created_at', 'desc')
        .select('*');

      return rows.map((row: any) => ({
        id: row.id,
        cardId: row.card_id,
        userId: row.user_id,
        patientId: row.patient_id,
        hookInstance: row.hook_instance,
        reasonCode: row.reason_code,
        reasonText: row.reason_text,
        cardSummary: row.card_summary,
        createdAt: row.created_at,
      }));
    } catch (error) {
      this.handleError('Failed to get CDS overrides', error);
    }
  }
}

export const cdsOverrideService = new CDSOverrideService();
