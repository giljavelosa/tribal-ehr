import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('immunizations', (table) => {
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
    table
      .varchar('vaccine_code_system', 255)
      .defaultTo('http://hl7.org/fhir/sid/cvx');
    table.varchar('vaccine_code_code', 10).notNullable();
    table.varchar('vaccine_code_display', 500);
    table.timestamp('occurrence_date_time', { useTz: true }).notNullable();
    table.timestamp('recorded', { useTz: true }).defaultTo(knex.fn.now());
    table.boolean('primary_source').defaultTo(true);
    table.varchar('lot_number', 50);
    table.date('expiration_date');
    table.varchar('site_code', 20);
    table.varchar('site_display', 100);
    table.varchar('route_code', 20);
    table.varchar('route_display', 100);
    table.decimal('dose_quantity_value', 10, 2);
    table.varchar('dose_quantity_unit', 20);
    table
      .uuid('performer_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.text('note');
    table.jsonb('reaction');
    table.jsonb('protocol_applied').defaultTo('[]');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('immunizations', (table) => {
    table.index('patient_id', 'idx_immunizations_patient_id');
    table.index('vaccine_code_code', 'idx_immunizations_vaccine_code_code');
    table.index(
      'occurrence_date_time',
      'idx_immunizations_occurrence_date_time'
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('immunizations');
}
