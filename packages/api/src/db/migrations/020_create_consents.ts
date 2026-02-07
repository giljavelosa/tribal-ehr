import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('consents', (table) => {
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
    table.varchar('fhir_id', 64).unique();
    table.varchar('status', 20).notNullable();
    table.varchar('scope', 50);
    table.varchar('category', 50);
    table.timestamp('date_time', { useTz: true }).defaultTo(knex.fn.now());
    table.varchar('policy_rule', 255);
    table.jsonb('provision');
    table.text('source_attachment');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('consents', (table) => {
    table.index('patient_id', 'idx_consents_patient_id');
    table.index('status', 'idx_consents_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('consents');
}
