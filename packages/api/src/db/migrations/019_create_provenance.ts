import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('provenance', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table.varchar('target_resource_type', 50).notNullable();
    table.uuid('target_resource_id').notNullable();
    table.varchar('fhir_id', 64).unique();
    table
      .timestamp('recorded', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.varchar('agent_type', 50).notNullable();
    table
      .uuid('agent_who_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.varchar('agent_who_display', 200);
    table.varchar('entity_role', 20);
    table.varchar('entity_what_type', 50);
    table.uuid('entity_what_id');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('provenance', (table) => {
    table.index(
      ['target_resource_type', 'target_resource_id'],
      'idx_provenance_target'
    );
    table.index('agent_who_id', 'idx_provenance_agent_who_id');
    table.index('recorded', 'idx_provenance_recorded');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('provenance');
}
