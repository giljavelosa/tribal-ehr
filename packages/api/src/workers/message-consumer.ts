// =============================================================================
// RabbitMQ Message Consumers
// Sets up consumers for the EHR's message queues. Each consumer processes
// messages from a specific queue and routes them to the appropriate handler.
// Uses dead-letter exchange for failed messages after retry exhaustion.
// =============================================================================

import { logger } from '../utils/logger';

const workerLogger = logger.child({ module: 'message-consumer' });

const QUEUES = {
  HL7_INBOUND: 'ehr.hl7.inbound',
  NOTIFICATIONS: 'ehr.notifications',
  ORDER_EVENTS: 'ehr.order.events',
  AUDIT_EVENTS: 'ehr.audit.events',
} as const;

const MAX_RETRY_COUNT = 5;

let consumersStarted = false;

export async function startConsumers(): Promise<void> {
  try {
    // Dynamic import to avoid issues if RabbitMQ is unavailable
    const { getChannel } = await import('../config/rabbitmq');
    const channel = getChannel();

    if (!channel) {
      workerLogger.warn('RabbitMQ channel not available, consumers not started');
      return;
    }

    // Assert queues with dead-letter routing
    for (const queueName of Object.values(QUEUES)) {
      await channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'ehr.dlx',
          'x-dead-letter-routing-key': queueName,
        },
      });
    }

    // Bind queues to exchanges
    await channel.bindQueue(QUEUES.HL7_INBOUND, 'ehr.hl7', 'inbound');
    await channel.bindQueue(QUEUES.NOTIFICATIONS, 'ehr.events', 'notification.#');
    await channel.bindQueue(QUEUES.ORDER_EVENTS, 'ehr.events', 'order.#');
    await channel.bindQueue(QUEUES.AUDIT_EVENTS, 'ehr.events', 'audit.#');

    // Set prefetch to 1 for fair dispatch
    await channel.prefetch(1);

    // Consumer: HL7 Inbound Messages
    await channel.consume(QUEUES.HL7_INBOUND, async (msg: any) => {
      if (!msg) return;
      try {
        const content = JSON.parse(msg.content.toString());
        workerLogger.info('Processing HL7 inbound message', {
          messageType: content.messageType,
        });
        // Process HL7 message - route to appropriate handler
        // In production: parse HL7, map to FHIR, store in database
        channel.ack(msg);
      } catch (error) {
        workerLogger.error('Failed to process HL7 message', { error });
        const retryCount =
          (msg.properties.headers?.['x-retry-count'] || 0) + 1;
        if (retryCount > MAX_RETRY_COUNT) {
          channel.nack(msg, false, false); // send to DLQ
        } else {
          channel.nack(msg, false, true); // requeue
        }
      }
    });

    // Consumer: Notifications
    await channel.consume(QUEUES.NOTIFICATIONS, async (msg: any) => {
      if (!msg) return;
      try {
        const content = JSON.parse(msg.content.toString());
        workerLogger.info('Processing notification', { type: content.type });
        // In production: send email/SMS via SMTP/Twilio
        channel.ack(msg);
      } catch (error) {
        workerLogger.error('Failed to process notification', { error });
        channel.nack(msg, false, false);
      }
    });

    // Consumer: Order Events
    await channel.consume(QUEUES.ORDER_EVENTS, async (msg: any) => {
      if (!msg) return;
      try {
        const content = JSON.parse(msg.content.toString());
        workerLogger.info('Processing order event', {
          event: content.event,
          orderId: content.orderId,
        });
        // In production: trigger order lifecycle tracking, external system routing
        channel.ack(msg);
      } catch (error) {
        workerLogger.error('Failed to process order event', { error });
        channel.nack(msg, false, false);
      }
    });

    // Consumer: Audit Events (async audit processing)
    await channel.consume(QUEUES.AUDIT_EVENTS, async (msg: any) => {
      if (!msg) return;
      try {
        const content = JSON.parse(msg.content.toString());
        workerLogger.debug('Processing audit event', {
          action: content.action,
        });
        // In production: write to external audit log store, anomaly detection
        channel.ack(msg);
      } catch (error) {
        workerLogger.error('Failed to process audit event', { error });
        channel.nack(msg, false, false);
      }
    });

    consumersStarted = true;
    workerLogger.info(`Started ${Object.keys(QUEUES).length} message consumers`);
  } catch (error) {
    workerLogger.error('Failed to start message consumers', { error });
    // Don't crash - RabbitMQ is optional
  }
}

export async function stopConsumers(): Promise<void> {
  if (consumersStarted) {
    workerLogger.info('Stopping message consumers');
    consumersStarted = false;
  }
  // Channel close is handled by the RabbitMQ config's shutdown
}

export { QUEUES };
