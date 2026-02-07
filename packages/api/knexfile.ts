import type { Knex } from 'knex';
import path from 'path';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tribal_ehr';

const baseConfig: Knex.Config = {
  client: 'pg',
  connection: databaseUrl,
  migrations: {
    directory: path.resolve(__dirname, 'src/db/migrations'),
    tableName: 'knex_migrations',
    extension: 'ts',
  },
  seeds: {
    directory: path.resolve(__dirname, 'src/db/seeds'),
    extension: 'ts',
  },
};

const config: { [key: string]: Knex.Config } = {
  development: {
    ...baseConfig,
    pool: {
      min: 2,
      max: 10,
    },
    debug: false,
  },

  staging: {
    ...baseConfig,
    pool: {
      min: 2,
      max: 20,
    },
  },

  production: {
    ...baseConfig,
    pool: {
      min: 2,
      max: 20,
    },
  },
};

export default config;
