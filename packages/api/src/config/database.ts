import Knex from 'knex';
import path from 'path';
import { config } from './index';
import { logger } from '../utils/logger';

// IMPORTANT: Row-Level Security (RLS) is enabled on clinical tables
// (patients, encounters, observations, conditions, medication_requests,
// allergy_intolerances, clinical_notes). RLS policies are bypassed by table
// owners / superusers. In production, the application MUST connect as a
// non-superuser PostgreSQL role so that RLS policies are enforced.
// See migration 041_add_row_level_security.ts for policy details.
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
