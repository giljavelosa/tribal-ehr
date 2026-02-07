import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('encounters', (table) => {
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
    table.varchar('status', 30).notNullable();
    table.varchar('class_code', 30).notNullable();
    table.varchar('type_code', 20);
    table.varchar('type_display', 200);
    table.varchar('priority', 20);
    table.timestamp('period_start', { useTz: true });
    table.timestamp('period_end', { useTz: true });
    table.jsonb('reason_code').defaultTo('[]');
    table.jsonb('diagnosis').defaultTo('[]');
    table.jsonb('participant').defaultTo('[]');
    table.uuid('location_id');
    table.uuid('service_provider_id');
    table.jsonb('hospitalization');
    table
      .uuid('created_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('encounters', (table) => {
    table.index('patient_id', 'idx_encounters_patient_id');
    table.index('status', 'idx_encounters_status');
    table.index('period_start', 'idx_encounters_period_start');
    table.index('class_code', 'idx_encounters_class_code');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('encounters');
}
