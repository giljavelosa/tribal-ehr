import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('patients', (table) => {
    table.varchar('soundex_last', 4);
    table.varchar('soundex_first', 4);
    table.varchar('mrn_check_digit', 1);
  });

  await knex.schema.createTable('patient_lists', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.varchar('name', 255).notNullable();
    table.text('description');
    table.varchar('list_type', 20).defaultTo('custom');
    table.boolean('is_default').defaultTo(false);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('user_id', 'idx_patient_lists_user_id');
  });

  await knex.raw(`
    ALTER TABLE patient_lists ADD CONSTRAINT patient_lists_list_type_check
    CHECK (list_type IN ('custom','provider','location','service'))
  `);

  await knex.schema.createTable('patient_list_members', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('list_id')
      .notNullable()
      .references('id')
      .inTable('patient_lists')
      .onDelete('CASCADE');
    table
      .uuid('patient_id')
      .notNullable()
      .references('id')
      .inTable('patients')
      .onDelete('CASCADE');
    table.timestamp('added_at', { useTz: true }).defaultTo(knex.fn.now());
    table
      .uuid('added_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.text('notes');

    table.unique(['list_id', 'patient_id'], { indexName: 'uq_patient_list_members' });
  });

  await knex.schema.createTable('temporary_patients', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.varchar('temporary_mrn', 50).notNullable().unique();
    table.varchar('reason', 100).notNullable();
    table.varchar('first_name', 100);
    table.varchar('last_name', 100);
    table.date('date_of_birth');
    table.varchar('sex', 10);
    table
      .uuid('merged_to_patient_id')
      .references('id')
      .inTable('patients')
      .onDelete('SET NULL');
    table.timestamp('merged_at', { useTz: true });
    table
      .uuid('merged_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table
      .uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.boolean('active').defaultTo(true);

    table.index('active', 'idx_temporary_patients_active');
    table.index('merged_to_patient_id', 'idx_temporary_patients_merged');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('temporary_patients');
  await knex.schema.dropTableIfExists('patient_list_members');
  await knex.schema.dropTableIfExists('patient_lists');

  await knex.schema.alterTable('patients', (table) => {
    table.dropColumn('mrn_check_digit');
    table.dropColumn('soundex_first');
    table.dropColumn('soundex_last');
  });
}
