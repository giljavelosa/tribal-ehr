import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('conditions', (table) => {
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
    table.varchar('clinical_status', 20).notNullable();
    table.varchar('verification_status', 20).notNullable();
    table.varchar('category', 30).notNullable();
    table.varchar('severity_code', 20);
    table.varchar('severity_display', 100);
    table.varchar('code_system', 255);
    table.varchar('code_code', 20);
    table.varchar('code_display', 500);
    table.jsonb('body_site');
    table.timestamp('onset_date_time', { useTz: true });
    table.timestamp('abatement_date_time', { useTz: true });
    table
      .timestamp('recorded_date', { useTz: true })
      .defaultTo(knex.fn.now());
    table
      .uuid('recorder_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.jsonb('evidence').defaultTo('[]');
    table.text('note');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('conditions', (table) => {
    table.index('patient_id', 'idx_conditions_patient_id');
    table.index('clinical_status', 'idx_conditions_clinical_status');
    table.index('code_code', 'idx_conditions_code_code');
    table.index('category', 'idx_conditions_category');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('conditions');
}
