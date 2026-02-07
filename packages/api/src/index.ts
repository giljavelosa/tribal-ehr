import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { closeDatabaseConnection } from './config/database';
import { connectRedis, closeRedisConnection } from './config/redis';
import { connectRabbitMQ, closeRabbitMQConnection } from './config/rabbitmq';
import http from 'http';

let server: http.Server;

async function startServer(): Promise<void> {
  try {
    // Initialize external connections
    logger.info('Initializing service connections...');

    try {
      await connectRedis();
      logger.info('Redis connection established');
    } catch (error) {
      logger.warn('Redis connection failed - continuing without Redis', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      await connectRabbitMQ();
      logger.info('RabbitMQ connection established');
    } catch (error) {
      logger.warn('RabbitMQ connection failed - continuing without RabbitMQ', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Create and start Express app
    const app = createApp();
    const port = config.server.port;

    server = app.listen(port, () => {
      logger.info(`Tribal EHR API server started`, {
        port,
        environment: config.server.nodeEnv,
        pid: process.pid,
      });
    });

    // Configure server timeouts
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught exception', {
        message: error.message,
        stack: error.stack,
      });
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled promise rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  try {
    // Close connections in parallel with a timeout
    const shutdownTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 30000);

    await Promise.allSettled([
      closeDatabaseConnection(),
      closeRedisConnection(),
      closeRabbitMQConnection(),
    ]);

    clearTimeout(shutdownTimeout);

    logger.info('All connections closed. Exiting.');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

startServer();
