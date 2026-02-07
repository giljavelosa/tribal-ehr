import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('locations', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table.varchar('name', 200).notNullable();
    table.varchar('type', 50);
    table.jsonb('address');
    table.varchar('phone', 30);
    table.boolean('active').defaultTo(true);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('appointment_types', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table.varchar('name', 100).notNullable();
    table.integer('duration_minutes').notNullable().defaultTo(30);
    table.varchar('color', 7);
    table.boolean('active').defaultTo(true);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('appointments', (table) => {
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
    table.varchar('status', 20).notNullable().defaultTo('booked');
    table
      .uuid('type_id')
      .references('id')
      .inTable('appointment_types')
      .onDelete('SET NULL');
    table.timestamp('start_time', { useTz: true }).notNullable();
    table.timestamp('end_time', { useTz: true }).notNullable();
    table
      .uuid('provider_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table
      .uuid('location_id')
      .references('id')
      .inTable('locations')
      .onDelete('SET NULL');
    table.text('reason');
    table.text('note');
    table.timestamp('check_in_time', { useTz: true });
    table.timestamp('check_out_time', { useTz: true });
    table.text('cancellation_reason');
    table.uuid('recurring_id');
    table
      .uuid('created_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('appointments', (table) => {
    table.index('patient_id', 'idx_appointments_patient_id');
    table.index('provider_id', 'idx_appointments_provider_id');
    table.index('start_time', 'idx_appointments_start_time');
    table.index('status', 'idx_appointments_status');
    table.index(
      ['provider_id', 'start_time'],
      'idx_appointments_provider_start'
    );
    table.index('location_id', 'idx_appointments_location_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('appointments');
  await knex.schema.dropTableIfExists('appointment_types');
  await knex.schema.dropTableIfExists('locations');
}
