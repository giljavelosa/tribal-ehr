import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table.varchar('username', 100).unique().notNullable();
    table.varchar('email', 255).unique().notNullable();
    table.varchar('password_hash', 255).notNullable();
    table.varchar('first_name', 100);
    table.varchar('last_name', 100);
    table.varchar('role', 50).notNullable();
    table.varchar('npi', 10);
    table.varchar('dea', 9);
    table.jsonb('specialties').defaultTo('[]');
    table.boolean('active').defaultTo(true);
    table.boolean('mfa_enabled').defaultTo(false);
    table.varchar('mfa_secret', 255);
    table.timestamp('last_login', { useTz: true });
    table.timestamp('password_changed_at', { useTz: true });
    table.integer('failed_login_attempts').defaultTo(0);
    table.timestamp('locked_until', { useTz: true });
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('PHYSICIAN','NURSE','MEDICAL_ASSISTANT','FRONT_DESK','BILLING','ADMIN','SYSTEM_ADMIN','PATIENT'))
  `);

  await knex.schema.alterTable('users', (table) => {
    table.index('username', 'idx_users_username');
    table.index('email', 'idx_users_email');
    table.index('role', 'idx_users_role');
    table.index('npi', 'idx_users_npi');
    table.index('active', 'idx_users_active');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
