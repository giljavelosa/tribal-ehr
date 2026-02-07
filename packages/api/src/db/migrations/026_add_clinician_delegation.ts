import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('clinician_delegates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('delegator_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .uuid('delegate_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.varchar('delegation_type', 20).notNullable();
    table.timestamp('start_date', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('end_date', { useTz: true });
    table.text('reason');
    table.boolean('active').defaultTo(true);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE clinician_delegates ADD CONSTRAINT clinician_delegates_delegation_type_check
    CHECK (delegation_type IN ('messages','results','orders','all'))
  `);

  await knex.schema.alterTable('clinician_delegates', (table) => {
    table.index('delegator_id', 'idx_clinician_delegates_delegator');
    table.index('delegate_id', 'idx_clinician_delegates_delegate');
  });

  await knex.schema.alterTable('users', (table) => {
    table.boolean('out_of_office').defaultTo(false);
    table.text('out_of_office_message');
    table.timestamp('out_of_office_start', { useTz: true });
    table.timestamp('out_of_office_end', { useTz: true });
    table
      .uuid('auto_forward_to')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('auto_forward_to');
    table.dropColumn('out_of_office_end');
    table.dropColumn('out_of_office_start');
    table.dropColumn('out_of_office_message');
    table.dropColumn('out_of_office');
  });

  await knex.schema.dropTableIfExists('clinician_delegates');
}
