// =============================================================================
// Event Publisher
// Provides a helper function for services to publish events to RabbitMQ
// exchanges. Handles serialization, timestamps, and delivery options.
// Returns false gracefully if RabbitMQ is unavailable.
// =============================================================================

import { logger } from '../utils/logger';

const publishLogger = logger.child({ module: 'event-publisher' });

export async function publishEvent(
  routingKey: string,
  data: Record<string, unknown>
): Promise<boolean> {
  try {
    const { getChannel } = await import('../config/rabbitmq');
    const channel = getChannel();

    if (!channel) {
      publishLogger.debug('RabbitMQ channel not available, event not published', {
        routingKey,
      });
      return false;
    }

    const message = Buffer.from(
      JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
      })
    );

    channel.publish('ehr.events', routingKey, message, {
      persistent: true,
      contentType: 'application/json',
    });

    publishLogger.debug('Event published', { routingKey });
    return true;
  } catch (error) {
    publishLogger.error('Failed to publish event', { routingKey, error });
    return false;
  }
}

export async function publishHL7Message(
  routingKey: string,
  data: Record<string, unknown>
): Promise<boolean> {
  try {
    const { getChannel } = await import('../config/rabbitmq');
    const channel = getChannel();

    if (!channel) {
      publishLogger.debug('RabbitMQ channel not available, HL7 message not published', {
        routingKey,
      });
      return false;
    }

    const message = Buffer.from(
      JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
      })
    );

    channel.publish('ehr.hl7', routingKey, message, {
      persistent: true,
      contentType: 'application/json',
    });

    publishLogger.debug('HL7 message published', { routingKey });
    return true;
  } catch (error) {
    publishLogger.error('Failed to publish HL7 message', { routingKey, error });
    return false;
  }
}
