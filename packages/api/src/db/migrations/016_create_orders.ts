import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('orders', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table
      .uuid('patient_id')
      .notNullable()
      .references('id')
      .inTable('patients')
      .onDelete('CASCADE');
    table
      .uuid('encounter_id')
      .references('id')
      .inTable('encounters')
      .onDelete('SET NULL');
    table.varchar('fhir_id', 64).unique();
    table.varchar('order_type', 20).notNullable();
    table.varchar('status', 20).notNullable();
    table.varchar('priority', 20).defaultTo('routine');
    table.varchar('code_system', 255);
    table.varchar('code_code', 20);
    table.varchar('code_display', 500);
    table.text('clinical_indication');
    table
      .uuid('ordered_by_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table
      .timestamp('ordered_at', { useTz: true })
      .defaultTo(knex.fn.now());
    table
      .uuid('signed_by_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('signed_at', { useTz: true });
    table.jsonb('details').defaultTo('{}');
    table.jsonb('results').defaultTo('[]');
    table.text('notes');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE orders ADD CONSTRAINT orders_order_type_check
    CHECK (order_type IN ('medication','laboratory','imaging'))
  `);

  await knex.schema.alterTable('orders', (table) => {
    table.index('patient_id', 'idx_orders_patient_id');
    table.index('order_type', 'idx_orders_order_type');
    table.index('status', 'idx_orders_status');
    table.index('ordered_by_id', 'idx_orders_ordered_by_id');
    table.index('encounter_id', 'idx_orders_encounter_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('orders');
}
