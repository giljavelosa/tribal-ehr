import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_events', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table
      .timestamp('timestamp', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.uuid('user_id');
    table.varchar('user_role', 50);
    table.specificType('ip_address', 'inet');
    table.varchar('action', 10).notNullable();
    table.varchar('resource_type', 50);
    table.uuid('resource_id');
    table.varchar('endpoint', 500);
    table.varchar('http_method', 10);
    table.integer('status_code');
    table.text('old_value_encrypted');
    table.text('new_value_encrypted');
    table.varchar('old_value_iv', 32);
    table.varchar('new_value_iv', 32);
    table.varchar('old_value_tag', 32);
    table.varchar('new_value_tag', 32);
    table.text('clinical_context');
    table.text('user_agent');
    table.varchar('session_id', 64);
    table.varchar('hash_previous', 64);
    table.varchar('hash', 64).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_check
    CHECK (action IN ('CREATE','READ','UPDATE','DELETE','LOGIN','LOGOUT','EXPORT','EMERGENCY'))
  `);

  await knex.schema.alterTable('audit_events', (table) => {
    table.index('timestamp', 'idx_audit_events_timestamp');
    table.index('user_id', 'idx_audit_events_user_id');
    table.index('resource_type', 'idx_audit_events_resource_type');
    table.index('resource_id', 'idx_audit_events_resource_id');
    table.index('action', 'idx_audit_events_action');
    table.index('session_id', 'idx_audit_events_session_id');
  });

  // Make the audit_events table append-only by preventing updates and deletes
  await knex.raw(`
    CREATE RULE audit_events_no_update AS ON UPDATE TO audit_events DO INSTEAD NOTHING
  `);
  await knex.raw(`
    CREATE RULE audit_events_no_delete AS ON DELETE TO audit_events DO INSTEAD NOTHING
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP RULE IF EXISTS audit_events_no_delete ON audit_events');
  await knex.raw('DROP RULE IF EXISTS audit_events_no_update ON audit_events');
  await knex.schema.dropTableIfExists('audit_events');
}
