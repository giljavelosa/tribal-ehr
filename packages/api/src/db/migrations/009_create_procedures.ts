import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('procedures', (table) => {
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
    table.varchar('code_system', 255);
    table.varchar('code_code', 20);
    table.varchar('code_display', 500);
    table.timestamp('performed_date_time', { useTz: true });
    table.timestamp('performed_period_start', { useTz: true });
    table.timestamp('performed_period_end', { useTz: true });
    table
      .uuid('recorder_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.jsonb('performer').defaultTo('[]');
    table.uuid('location_id');
    table.jsonb('reason_code').defaultTo('[]');
    table.jsonb('body_site');
    table.jsonb('outcome');
    table.jsonb('report').defaultTo('[]');
    table.jsonb('complication').defaultTo('[]');
    table.text('note');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('procedures', (table) => {
    table.index('patient_id', 'idx_procedures_patient_id');
    table.index('status', 'idx_procedures_status');
    table.index('code_code', 'idx_procedures_code_code');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('procedures');
}
