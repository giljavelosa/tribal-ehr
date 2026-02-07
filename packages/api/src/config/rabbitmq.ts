import amqplib from 'amqplib';
import { config } from './index';
import { logger } from '../utils/logger';

let connection: any = null;
let channel: any = null;

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

const EXCHANGES = {
  events: { name: 'ehr.events', type: 'topic' },
  hl7: { name: 'ehr.hl7', type: 'direct' },
  dlx: { name: 'ehr.dlx', type: 'direct' },
} as const;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectRabbitMQ(): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(`RabbitMQ: connecting (attempt ${attempt}/${MAX_RETRIES})`);

      connection = await amqplib.connect(config.rabbitmq.url);

      connection.on('error', (err: Error) => {
        logger.error('RabbitMQ: connection error', { error: err.message });
      });

      connection.on('close', () => {
        logger.warn('RabbitMQ: connection closed');
        connection = null;
        channel = null;
      });

      channel = await connection.createChannel();

      channel.on('error', (err: Error) => {
        logger.error('RabbitMQ: channel error', { error: err.message });
      });

      channel.on('close', () => {
        logger.warn('RabbitMQ: channel closed');
        channel = null;
      });

      // Assert exchanges
      await channel.assertExchange(EXCHANGES.dlx.name, EXCHANGES.dlx.type, {
        durable: true,
      });

      await channel.assertExchange(EXCHANGES.events.name, EXCHANGES.events.type, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': EXCHANGES.dlx.name,
        },
      });

      await channel.assertExchange(EXCHANGES.hl7.name, EXCHANGES.hl7.type, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': EXCHANGES.dlx.name,
        },
      });

      // Assert dead letter queue
      await channel.assertQueue('ehr.dlq', {
        durable: true,
      });
      await channel.bindQueue('ehr.dlq', EXCHANGES.dlx.name, '#');

      logger.info('RabbitMQ: connected and exchanges asserted');
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(
        `RabbitMQ: connection failed (attempt ${attempt}/${MAX_RETRIES})`,
        { error: lastError.message }
      );

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        logger.info(`RabbitMQ: retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `RabbitMQ: failed to connect after ${MAX_RETRIES} attempts. Last error: ${lastError?.message}`
  );
}

export function getConnection(): any {
  return connection;
}

export function getChannel(): any {
  return channel;
}

export async function checkRabbitMQConnection(): Promise<boolean> {
  return connection !== null && channel !== null;
}

export async function closeRabbitMQConnection(): Promise<void> {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    logger.info('RabbitMQ: connection closed gracefully');
  } catch (error) {
    logger.error('RabbitMQ: error closing connection', { error });
    channel = null;
    connection = null;
  }
}

export { EXCHANGES };
