import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('patients', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table.varchar('mrn', 20).unique().notNullable();
    table.varchar('fhir_id', 64).unique();
    table.varchar('first_name', 100).notNullable();
    table.varchar('middle_name', 100);
    table.varchar('last_name', 100).notNullable();
    table.varchar('suffix', 20);
    table.date('date_of_birth').notNullable();
    table.varchar('sex', 20).notNullable();
    table.varchar('gender_identity', 50);
    table.varchar('sexual_orientation', 50);
    table.jsonb('race').defaultTo('[]');
    table.varchar('ethnicity', 50);
    table.varchar('preferred_language', 50).defaultTo('en');
    table.varchar('marital_status', 30);
    table.text('ssn_encrypted');
    table.varchar('ssn_iv', 32);
    table.varchar('ssn_tag', 32);
    table.text('photo_url');
    table.boolean('deceased_boolean').defaultTo(false);
    table.timestamp('deceased_date_time', { useTz: true });
    table.boolean('multiple_birth_boolean');
    table.integer('multiple_birth_integer');
    table.jsonb('communication_preferences').defaultTo('{}');
    table.boolean('active').defaultTo(true);
    table
      .uuid('created_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table
      .uuid('updated_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('patients', (table) => {
    table.index('mrn', 'idx_patients_mrn');
    table.index('fhir_id', 'idx_patients_fhir_id');
    table.index('last_name', 'idx_patients_last_name');
    table.index('date_of_birth', 'idx_patients_date_of_birth');
    table.index(
      ['last_name', 'first_name', 'date_of_birth'],
      'idx_patients_name_dob'
    );
  });

  await knex.schema.createTable('patient_addresses', (table) => {
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
    table.varchar('use', 20);
    table.varchar('type', 20);
    table.varchar('line1', 255);
    table.varchar('line2', 255);
    table.varchar('city', 100);
    table.varchar('state', 2);
    table.varchar('postal_code', 10);
    table.varchar('country', 3).defaultTo('US');
    table.date('period_start');
    table.date('period_end');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('patient_id', 'idx_patient_addresses_patient_id');
  });

  await knex.schema.createTable('patient_phone_numbers', (table) => {
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
    table.varchar('use', 20);
    table.varchar('system', 20).defaultTo('phone');
    table.varchar('value', 30).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('patient_id', 'idx_patient_phone_numbers_patient_id');
  });

  await knex.schema.createTable('patient_emails', (table) => {
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
    table.varchar('use', 20);
    table.varchar('value', 255).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('patient_id', 'idx_patient_emails_patient_id');
  });

  await knex.schema.createTable('emergency_contacts', (table) => {
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
    table.varchar('name', 200).notNullable();
    table.varchar('relationship', 50);
    table.varchar('phone', 30);
    table.jsonb('address');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('patient_id', 'idx_emergency_contacts_patient_id');
  });

  await knex.schema.createTable('insurance_coverages', (table) => {
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
    table.varchar('payer_id', 50);
    table.varchar('payer_name', 200);
    table.varchar('member_id', 50);
    table.varchar('group_number', 50);
    table.varchar('plan_name', 200);
    table.varchar('plan_type', 50);
    table.varchar('subscriber_relationship', 50);
    table.date('effective_date');
    table.date('termination_date');
    table.decimal('copay', 10, 2);
    table.decimal('deductible', 10, 2);
    table.integer('priority').defaultTo(1);
    table.boolean('active').defaultTo(true);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('patient_id', 'idx_insurance_coverages_patient_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('insurance_coverages');
  await knex.schema.dropTableIfExists('emergency_contacts');
  await knex.schema.dropTableIfExists('patient_emails');
  await knex.schema.dropTableIfExists('patient_phone_numbers');
  await knex.schema.dropTableIfExists('patient_addresses');
  await knex.schema.dropTableIfExists('patients');
}
