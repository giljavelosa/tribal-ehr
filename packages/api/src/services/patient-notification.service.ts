// =============================================================================
// Patient Notification Service - SAFER Guide 4, Practice 3.2
// Tracks when/how patients are notified of test results
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService } from './base.service';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PatientNotification {
  id: string;
  orderId: string;
  patientId: string;
  notificationMethod: string;
  notifiedAt: string;
  notifiedBy: string;
  patientAcknowledged: boolean;
  patientAcknowledgedAt?: string;
  notes?: string;
  daysFromResult?: number;
  withinThreshold: boolean;
}

interface NotificationRow {
  id: string;
  order_id: string;
  patient_id: string;
  notification_method: string;
  notified_at: string;
  notified_by: string;
  patient_acknowledged: boolean;
  patient_acknowledged_at?: string;
  notes?: string;
  days_from_result?: number;
  within_threshold: boolean;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

class PatientNotificationService extends BaseService {
  constructor() {
    super('PatientNotificationService');
  }

  private toModel(row: NotificationRow): PatientNotification {
    return {
      id: row.id,
      orderId: row.order_id,
      patientId: row.patient_id,
      notificationMethod: row.notification_method,
      notifiedAt: row.notified_at,
      notifiedBy: row.notified_by,
      patientAcknowledged: row.patient_acknowledged,
      patientAcknowledgedAt: row.patient_acknowledged_at,
      notes: row.notes,
      daysFromResult: row.days_from_result,
      withinThreshold: row.within_threshold,
    };
  }

  async recordNotification(data: {
    orderId: string;
    patientId: string;
    notificationMethod: string;
    notifiedBy: string;
    notes?: string;
  }): Promise<PatientNotification> {
    if (!data.orderId || !data.patientId || !data.notificationMethod) {
      throw new ValidationError('orderId, patientId, and notificationMethod are required');
    }

    // Calculate days from result
    let daysFromResult = 0;
    let withinThreshold = true;
    try {
      const order = await this.db('orders')
        .where({ id: data.orderId })
        .select('result_date', 'priority')
        .first();
      if (order?.result_date) {
        const resultDate = new Date(order.result_date);
        const now = new Date();
        daysFromResult = Math.floor((now.getTime() - resultDate.getTime()) / (1000 * 60 * 60 * 24));
        // Actionable: 7 days; informational: 14 days
        const threshold = order.priority === 'stat' || order.priority === 'urgent' ? 7 : 14;
        withinThreshold = daysFromResult <= threshold;
      }
    } catch {
      // If order lookup fails, default to current values
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await this.db('patient_result_notifications').insert({
      id,
      order_id: data.orderId,
      patient_id: data.patientId,
      notification_method: data.notificationMethod,
      notified_at: now,
      notified_by: data.notifiedBy,
      notes: data.notes || null,
      days_from_result: daysFromResult,
      within_threshold: withinThreshold,
    });

    const row = await this.db('patient_result_notifications').where({ id }).first();
    return this.toModel(row);
  }

  async recordPatientAcknowledgment(notificationId: string): Promise<PatientNotification> {
    const existing = await this.db('patient_result_notifications').where({ id: notificationId }).first();
    if (!existing) {
      throw new NotFoundError('PatientNotification', notificationId);
    }

    await this.db('patient_result_notifications')
      .where({ id: notificationId })
      .update({
        patient_acknowledged: true,
        patient_acknowledged_at: new Date().toISOString(),
      });

    const row = await this.db('patient_result_notifications').where({ id: notificationId }).first();
    return this.toModel(row);
  }

  async getNotificationsForOrder(orderId: string): Promise<PatientNotification[]> {
    const rows = await this.db('patient_result_notifications')
      .where({ order_id: orderId })
      .orderBy('notified_at', 'desc');
    return rows.map((r: NotificationRow) => this.toModel(r));
  }

  async getOverdueNotifications(thresholdDays: number = 7): Promise<Record<string, unknown>[]> {
    // Find orders with results but no patient notification
    return this.db('orders')
      .leftJoin('patient_result_notifications', 'orders.id', 'patient_result_notifications.order_id')
      .whereNotNull('orders.result_date')
      .whereNull('patient_result_notifications.id')
      .whereRaw(`orders.result_date < NOW() - INTERVAL '${Math.min(thresholdDays, 90)} days'`)
      .select(
        'orders.id as orderId',
        'orders.patient_id as patientId',
        'orders.order_type as orderType',
        'orders.result_date as resultDate',
      )
      .orderBy('orders.result_date', 'asc')
      .limit(200);
  }

  async getNotificationAnalytics(): Promise<{
    totalNotifications: number;
    onTimePercentage: number;
    avgDaysToNotify: number;
    byMethod: { method: string; count: number }[];
    overdueCount: number;
  }> {
    const total = await this.db('patient_result_notifications').count('id as count').first();
    const onTime = await this.db('patient_result_notifications').where({ within_threshold: true }).count('id as count').first();
    const avgDays = await this.db('patient_result_notifications').avg('days_from_result as avg').first();
    const byMethod = await this.db('patient_result_notifications')
      .select('notification_method as method')
      .count('id as count')
      .groupBy('notification_method')
      .orderByRaw('count(id) DESC');

    const overdue = await this.getOverdueNotifications();

    const totalCount = Number(total?.count || 0);
    const onTimeCount = Number(onTime?.count || 0);

    return {
      totalNotifications: totalCount,
      onTimePercentage: totalCount > 0 ? Math.round((onTimeCount / totalCount) * 10000) / 100 : 100,
      avgDaysToNotify: Math.round(Number(avgDays?.avg || 0) * 10) / 10,
      byMethod: byMethod.map((r: Record<string, unknown>) => ({
        method: r.method as string,
        count: Number(r.count),
      })),
      overdueCount: overdue.length,
    };
  }
}

export const patientNotificationService = new PatientNotificationService();
