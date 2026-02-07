import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('observations', (table) => {
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
    table.varchar('category_code', 50).notNullable();
    table.varchar('category_display', 100);
    table.varchar('code_system', 255);
    table.varchar('code_code', 20).notNullable();
    table.varchar('code_display', 500);
    table.timestamp('effective_date_time', { useTz: true });
    table.timestamp('issued', { useTz: true });
    table.decimal('value_quantity_value', 10, 4);
    table.varchar('value_quantity_unit', 50);
    table.varchar('value_quantity_system', 255);
    table.varchar('value_quantity_code', 20);
    table.jsonb('value_codeable_concept');
    table.text('value_string');
    table.boolean('value_boolean');
    table.varchar('interpretation_code', 20);
    table.varchar('interpretation_display', 100);
    table.decimal('reference_range_low', 10, 4);
    table.decimal('reference_range_high', 10, 4);
    table.varchar('reference_range_unit', 50);
    table.varchar('reference_range_text', 200);
    table.jsonb('component').defaultTo('[]');
    table.text('note');
    table
      .uuid('performer_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.uuid('device_id');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('observations', (table) => {
    table.index('patient_id', 'idx_observations_patient_id');
    table.index('code_code', 'idx_observations_code_code');
    table.index('category_code', 'idx_observations_category_code');
    table.index(
      'effective_date_time',
      'idx_observations_effective_date_time'
    );
    table.index('encounter_id', 'idx_observations_encounter_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('observations');
}
