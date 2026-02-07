import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('devices', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table
      .uuid('patient_id')
      .references('id')
      .inTable('patients')
      .onDelete('SET NULL');
    table.varchar('fhir_id', 64).unique();
    table.varchar('udi_device_identifier', 100);
    table.varchar('udi_issuer', 255);
    table.varchar('udi_jurisdiction', 255);
    table.text('udi_carrier_aidc');
    table.varchar('udi_carrier_hrf', 500);
    table.varchar('status', 20);
    table.varchar('type_code', 20);
    table.varchar('type_display', 200);
    table.varchar('manufacturer', 200);
    table.varchar('model', 200);
    table.varchar('serial_number', 100);
    table.date('expiration_date');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('devices', (table) => {
    table.index('patient_id', 'idx_devices_patient_id');
    table.index(
      'udi_device_identifier',
      'idx_devices_udi_device_identifier'
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('devices');
}
