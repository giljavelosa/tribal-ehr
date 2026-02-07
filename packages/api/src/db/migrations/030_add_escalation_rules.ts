import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Escalation rules configuration
  await knex.schema.createTable('escalation_rules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.varchar('rule_type', 50).notNullable();
    table.integer('threshold_minutes').notNullable();
    table.varchar('priority_filter', 20);
    table.varchar('escalate_to_role', 50);
    table.uuid('escalate_to_user').references('id').inTable('users');
    table.boolean('active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['rule_type'], 'idx_escalation_rules_type');
  });

  // Escalation event tracking
  await knex.schema.createTable('escalation_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('rule_id').references('id').inTable('escalation_rules');
    table.varchar('source_type', 50).notNullable();
    table.uuid('source_id').notNullable();
    table.uuid('original_recipient').notNullable().references('id').inTable('users');
    table.uuid('escalated_to').notNullable().references('id').inTable('users');
    table.text('reason');
    table.boolean('acknowledged').defaultTo(false);
    table.timestamp('acknowledged_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['source_type', 'source_id'], 'idx_escalation_events_source');
    table.index(['acknowledged'], 'idx_escalation_events_acknowledged');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('escalation_events');
  await knex.schema.dropTableIfExists('escalation_rules');
}
