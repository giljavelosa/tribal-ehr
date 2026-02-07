import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('medication_requests', (table) => {
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
    table.varchar('status', 20).notNullable();
    table.varchar('intent', 20).notNullable();
    table.varchar('medication_code_system', 255);
    table.varchar('medication_code_code', 20);
    table.varchar('medication_code_display', 500);
    table
      .timestamp('authored_on', { useTz: true })
      .defaultTo(knex.fn.now());
    table
      .uuid('requester_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.jsonb('dosage_instruction').defaultTo('[]');
    table.jsonb('dispense_request');
    table.jsonb('substitution');
    table
      .uuid('prior_prescription_id')
      .references('id')
      .inTable('medication_requests')
      .onDelete('SET NULL');
    table.text('note');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('medication_requests', (table) => {
    table.index('patient_id', 'idx_medication_requests_patient_id');
    table.index('status', 'idx_medication_requests_status');
    table.index(
      'medication_code_code',
      'idx_medication_requests_medication_code_code'
    );
    table.index('requester_id', 'idx_medication_requests_requester_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('medication_requests');
}
