import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('oauth_clients', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('client_id', 100).unique().notNullable();
    table.string('client_secret_hash', 255);
    table.string('name', 200).notNullable();
    table.jsonb('redirect_uris').notNullable().defaultTo('[]');
    table
      .jsonb('grant_types')
      .notNullable()
      .defaultTo('["authorization_code"]');
    table.jsonb('scopes').notNullable().defaultTo('[]');
    table.boolean('confidential').defaultTo(true);
    table.boolean('active').defaultTo(true);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('oauth_authorization_codes', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('code', 255).unique().notNullable();
    table
      .uuid('client_id')
      .references('id')
      .inTable('oauth_clients')
      .onDelete('CASCADE');
    table
      .uuid('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.text('redirect_uri');
    table.text('scope');
    table.string('code_challenge', 128);
    table.string('code_challenge_method', 10);
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('oauth_tokens', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('access_token_hash', 255).unique().notNullable();
    table.string('refresh_token_hash', 255).unique();
    table
      .uuid('client_id')
      .references('id')
      .inTable('oauth_clients')
      .onDelete('CASCADE');
    table
      .uuid('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.text('scope');
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('refresh_expires_at', { useTz: true });
    table.boolean('revoked').defaultTo(false);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('smart_launch_contexts', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('launch_id', 100).unique().notNullable();
    table
      .uuid('client_id')
      .references('id')
      .inTable('oauth_clients')
      .onDelete('CASCADE');
    table
      .uuid('user_id')
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.uuid('patient_id');
    table.uuid('encounter_id');
    table.jsonb('context').defaultTo('{}');
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Indexes for oauth_clients
  await knex.schema.alterTable('oauth_clients', (table) => {
    table.index('client_id', 'idx_oauth_clients_client_id');
    table.index('active', 'idx_oauth_clients_active');
  });

  // Indexes for oauth_authorization_codes
  await knex.schema.alterTable('oauth_authorization_codes', (table) => {
    table.index('code', 'idx_oauth_auth_codes_code');
    table.index('client_id', 'idx_oauth_auth_codes_client_id');
    table.index('user_id', 'idx_oauth_auth_codes_user_id');
    table.index('expires_at', 'idx_oauth_auth_codes_expires_at');
  });

  // Indexes for oauth_tokens
  await knex.schema.alterTable('oauth_tokens', (table) => {
    table.index('access_token_hash', 'idx_oauth_tokens_access_token');
    table.index('refresh_token_hash', 'idx_oauth_tokens_refresh_token');
    table.index('client_id', 'idx_oauth_tokens_client_id');
    table.index('user_id', 'idx_oauth_tokens_user_id');
    table.index('expires_at', 'idx_oauth_tokens_expires_at');
    table.index('revoked', 'idx_oauth_tokens_revoked');
  });

  // Indexes for smart_launch_contexts
  await knex.schema.alterTable('smart_launch_contexts', (table) => {
    table.index('launch_id', 'idx_smart_launch_launch_id');
    table.index('client_id', 'idx_smart_launch_client_id');
    table.index('user_id', 'idx_smart_launch_user_id');
    table.index('expires_at', 'idx_smart_launch_expires_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('smart_launch_contexts');
  await knex.schema.dropTableIfExists('oauth_tokens');
  await knex.schema.dropTableIfExists('oauth_authorization_codes');
  await knex.schema.dropTableIfExists('oauth_clients');
}
