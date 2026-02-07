import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('allergy_intolerances', (table) => {
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
    table.varchar('clinical_status', 20).notNullable();
    table.varchar('verification_status', 20).notNullable();
    table.varchar('type', 20);
    table.varchar('category', 20);
    table.varchar('criticality', 30);
    table.varchar('code_system', 255);
    table.varchar('code_code', 20);
    table.varchar('code_display', 500);
    table.timestamp('onset_date_time', { useTz: true });
    table
      .timestamp('recorded_date', { useTz: true })
      .defaultTo(knex.fn.now());
    table
      .uuid('recorder_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.jsonb('reactions').defaultTo('[]');
    table.text('note');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('allergy_intolerances', (table) => {
    table.index('patient_id', 'idx_allergy_intolerances_patient_id');
    table.index(
      'clinical_status',
      'idx_allergy_intolerances_clinical_status'
    );
    table.index('code_code', 'idx_allergy_intolerances_code_code');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('allergy_intolerances');
}
