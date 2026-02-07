// =============================================================================
// Background Job Scheduler
// Runs periodic maintenance tasks using node-cron. Each job uses dynamic imports
// to avoid circular dependency issues and is wrapped in try/catch to ensure
// individual failures do not affect other scheduled jobs.
// =============================================================================

import cron from 'node-cron';
import { logger } from './utils/logger';

const schedulerLogger = logger.child({ module: 'scheduler' });

// Track scheduled tasks for graceful shutdown
const scheduledTasks: cron.ScheduledTask[] = [];

export function startScheduler(): void {
  schedulerLogger.info('Starting background job scheduler');

  // 1. Escalation checks - every 5 minutes
  //    Monitors unacknowledged critical results and unread urgent messages
  scheduledTasks.push(
    cron.schedule('*/5 * * * *', async () => {
      try {
        schedulerLogger.debug('Running escalation check');
        const { escalationService } = await import('./services/escalation.service');
        const result = await escalationService.runEscalationCheck();
        if (result.escalated > 0) {
          schedulerLogger.info(`Escalation check: ${result.escalated} items escalated`);
        }
      } catch (error) {
        schedulerLogger.error('Escalation check failed', { error });
      }
    })
  );

  // 2. System health recording - every 10 minutes
  //    Checks all service connections and records the health snapshot
  scheduledTasks.push(
    cron.schedule('*/10 * * * *', async () => {
      try {
        const { systemHealthService } = await import('./services/system-health.service');
        const health = await systemHealthService.checkAll();
        await systemHealthService.recordHealthCheck(health);
        schedulerLogger.debug('Health check recorded', { status: health.status });
      } catch (error) {
        schedulerLogger.error('Health check recording failed', { error });
      }
    })
  );

  // 3. Overdue result notification check - every hour
  //    Finds orders with results that patients have not been notified about
  scheduledTasks.push(
    cron.schedule('0 * * * *', async () => {
      try {
        const { patientNotificationService } = await import('./services/patient-notification.service');
        const overdue = await patientNotificationService.getOverdueNotifications(7);
        if (overdue.length > 0) {
          schedulerLogger.warn(`${overdue.length} overdue patient result notifications found`);
        }
      } catch (error) {
        schedulerLogger.error('Overdue notification check failed', { error });
      }
    })
  );

  // 4. Training expiration check - daily at 6 AM
  //    Identifies training records that have passed their expiration date
  scheduledTasks.push(
    cron.schedule('0 6 * * *', async () => {
      try {
        const { trainingService } = await import('./services/training.service');
        const expired = await trainingService.getExpiredTraining();
        if (expired.length > 0) {
          schedulerLogger.info(`${expired.length} training records expired`);
        }
      } catch (error) {
        schedulerLogger.error('Training expiration check failed', { error });
      }
    })
  );

  // 5. Response time metrics cleanup - daily at midnight
  //    Removes response time metric records older than 30 days
  scheduledTasks.push(
    cron.schedule('0 0 * * *', async () => {
      try {
        const { default: knex } = await import('./config/database');
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const deleted = await knex('response_time_metrics')
          .where('period_end', '<', cutoff.toISOString())
          .delete();
        if (deleted > 0) {
          schedulerLogger.info(`Cleaned up ${deleted} old response time metric records`);
        }
      } catch (error) {
        schedulerLogger.error('Response time cleanup failed', { error });
      }
    })
  );

  schedulerLogger.info(`Scheduled ${scheduledTasks.length} background jobs`);
}

export function stopScheduler(): void {
  schedulerLogger.info('Stopping background job scheduler');
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.length = 0;
}
