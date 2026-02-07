import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('document_references', (table) => {
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
    table.varchar('type_code', 20);
    table.varchar('type_system', 255);
    table.varchar('type_display', 200);
    table.varchar('category', 50);
    table.timestamp('date', { useTz: true }).defaultTo(knex.fn.now());
    table
      .uuid('author_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.varchar('description', 500);
    table.varchar('content_type', 100);
    table.text('content_data');
    table.text('content_url');
    table.integer('content_size');
    table.varchar('content_hash', 64);
    table
      .uuid('context_encounter_id')
      .references('id')
      .inTable('encounters')
      .onDelete('SET NULL');
    table.timestamp('context_period_start', { useTz: true });
    table.timestamp('context_period_end', { useTz: true });
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('document_references', (table) => {
    table.index('patient_id', 'idx_document_references_patient_id');
    table.index('type_code', 'idx_document_references_type_code');
    table.index('category', 'idx_document_references_category');
    table.index('date', 'idx_document_references_date');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('document_references');
}
