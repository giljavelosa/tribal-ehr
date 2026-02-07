import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number): number | null {
        if (times > 10) {
          logger.error('Redis: max reconnection attempts reached');
          return null;
        }
        const delay = Math.min(times * 200, 5000);
        logger.warn(`Redis: reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
      reconnectOnError(err: Error): boolean {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return targetErrors.some((e) => err.message.includes(e));
      },
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      logger.info('Redis: connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis: ready');
    });

    redisClient.on('error', (error: Error) => {
      logger.error('Redis: connection error', { error: error.message });
    });

    redisClient.on('close', () => {
      logger.info('Redis: connection closed');
    });
  }

  return redisClient;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  await client.connect();
}

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis: connection closed gracefully');
    } catch (error) {
      logger.error('Redis: error closing connection', { error });
      if (redisClient) {
        redisClient.disconnect();
        redisClient = null;
      }
    }
  }
}

export default getRedisClient;
