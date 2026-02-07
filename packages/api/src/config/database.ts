import Knex from 'knex';
import path from 'path';
import { config } from './index';
import { logger } from '../utils/logger';

const knexConfig: Knex.Knex.Config = {
  client: 'pg',
  connection: config.database.url,
  pool: {
    min: config.database.pool.min,
    max: config.database.pool.max,
    afterCreate: (conn: unknown, done: (err: Error | null, conn: unknown) => void) => {
      logger.debug('New database connection created');
      done(null, conn);
    },
  },
  migrations: {
    directory: path.resolve(__dirname, '../db/migrations'),
    tableName: 'knex_migrations',
    extension: 'ts',
  },
  seeds: {
    directory: path.resolve(__dirname, '../db/seeds'),
    extension: 'ts',
  },
  acquireConnectionTimeout: 10000,
};

export const db = Knex(knexConfig);

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.raw('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database connection check failed', { error });
    return false;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  try {
    await db.destroy();
    logger.info('Database connection pool closed');
  } catch (error) {
    logger.error('Error closing database connection', { error });
  }
}

export function getDb() {
  return db;
}

export default db;
