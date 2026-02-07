import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('goals', (table) => {
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
    table.varchar('lifecycle_status', 20).notNullable();
    table.varchar('achievement_status', 30);
    table.varchar('description_text', 500).notNullable();
    table.date('start_date');
    table.date('target_date');
    table.date('status_date');
    table
      .uuid('expressed_by_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.jsonb('addresses').defaultTo('[]');
    table.text('note');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('goals', (table) => {
    table.index('patient_id', 'idx_goals_patient_id');
    table.index('lifecycle_status', 'idx_goals_lifecycle_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('goals');
}
