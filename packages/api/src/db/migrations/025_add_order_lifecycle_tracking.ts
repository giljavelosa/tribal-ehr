import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (table) => {
    table.timestamp('specimen_received_at', { useTz: true });
    table.timestamp('lab_processing_at', { useTz: true });
    table.timestamp('completed_at', { useTz: true });
    table.timestamp('reported_at', { useTz: true });
    table.timestamp('acknowledged_at', { useTz: true });
    table
      .uuid('acknowledged_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('amended_at', { useTz: true });
    table.text('amendment_reason');
    table.jsonb('original_results');
    table.boolean('is_critical').defaultTo(false);
    table.timestamp('critical_notified_at', { useTz: true });
    table
      .uuid('critical_notified_to')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('critical_acknowledged_at', { useTz: true });
    table.date('follow_up_date');
    table.boolean('follow_up_completed').defaultTo(false);
  });

  await knex.schema.alterTable('orders', (table) => {
    table.index('is_critical', 'idx_orders_is_critical');
    table.index('follow_up_date', 'idx_orders_follow_up_date');
    table.index('acknowledged_at', 'idx_orders_acknowledged_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (table) => {
    table.dropIndex('', 'idx_orders_acknowledged_at');
    table.dropIndex('', 'idx_orders_follow_up_date');
    table.dropIndex('', 'idx_orders_is_critical');
  });

  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('follow_up_completed');
    table.dropColumn('follow_up_date');
    table.dropColumn('critical_acknowledged_at');
    table.dropColumn('critical_notified_to');
    table.dropColumn('critical_notified_at');
    table.dropColumn('is_critical');
    table.dropColumn('original_results');
    table.dropColumn('amendment_reason');
    table.dropColumn('amended_at');
    table.dropColumn('acknowledged_by');
    table.dropColumn('acknowledged_at');
    table.dropColumn('reported_at');
    table.dropColumn('completed_at');
    table.dropColumn('lab_processing_at');
    table.dropColumn('specimen_received_at');
  });
}
