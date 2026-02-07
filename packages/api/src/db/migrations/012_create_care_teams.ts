import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('care_teams', (table) => {
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
    table.varchar('name', 200);
    table.date('period_start');
    table.date('period_end');
    table.jsonb('participant').defaultTo('[]');
    table.text('note');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('care_teams', (table) => {
    table.index('patient_id', 'idx_care_teams_patient_id');
    table.index('status', 'idx_care_teams_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('care_teams');
}
