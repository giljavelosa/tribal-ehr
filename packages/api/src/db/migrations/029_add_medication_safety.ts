import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // High-risk medication verification records
  await knex.schema.createTable('high_risk_medication_verifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('order_id').notNullable().references('id').inTable('orders');
    table.uuid('verified_by').notNullable().references('id').inTable('users');
    table.varchar('verification_type', 50).notNullable();
    table.timestamp('verified_at').notNullable().defaultTo(knex.fn.now());
    table.text('notes');

    table.index(['order_id'], 'idx_high_risk_verifications_order');
  });

  // Add medication safety columns to existing cds_overrides table
  await knex.schema.alterTable('cds_overrides', (table) => {
    table.varchar('alert_severity', 20);
    table.varchar('alert_type', 50);
    table.uuid('order_id').references('id').inTable('orders');
    table.boolean('was_appropriate');
    table.uuid('reviewed_by').references('id').inTable('users');
    table.timestamp('reviewed_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  // Remove added columns from cds_overrides in reverse order
  await knex.schema.alterTable('cds_overrides', (table) => {
    table.dropColumn('reviewed_at');
    table.dropColumn('reviewed_by');
    table.dropColumn('was_appropriate');
    table.dropColumn('order_id');
    table.dropColumn('alert_type');
    table.dropColumn('alert_severity');
  });

  await knex.schema.dropTableIfExists('high_risk_medication_verifications');
}
