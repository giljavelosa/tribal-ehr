import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('note_templates', (table) => {
    table.varchar('id', 50).primary();
    table.varchar('name', 200).notNullable();
    table.varchar('note_type', 50).notNullable();
    table.text('content_template').notNullable();
    table.boolean('active').defaultTo(true);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('clinical_notes', (table) => {
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
    table
      .uuid('author_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.varchar('note_type', 50).notNullable();
    table.varchar('status', 20).notNullable().defaultTo('draft');
    table.varchar('title', 500);
    table.text('content');
    table.varchar('template_id', 50);
    table
      .uuid('signed_by_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('signed_at', { useTz: true });
    table
      .uuid('cosigner_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('cosigned_at', { useTz: true });
    table
      .uuid('amended_from_id')
      .references('id')
      .inTable('clinical_notes')
      .onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('clinical_notes', (table) => {
    table.index('patient_id', 'idx_clinical_notes_patient_id');
    table.index('encounter_id', 'idx_clinical_notes_encounter_id');
    table.index('author_id', 'idx_clinical_notes_author_id');
    table.index('note_type', 'idx_clinical_notes_note_type');
    table.index('status', 'idx_clinical_notes_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('clinical_notes');
  await knex.schema.dropTableIfExists('note_templates');
}
