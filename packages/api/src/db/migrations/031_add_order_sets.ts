import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('order_sets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.varchar('name', 255).notNullable();
    table.varchar('category', 100);
    table.text('description');
    table.jsonb('diagnosis_codes').defaultTo('[]');
    table.jsonb('orders').notNullable();
    table.boolean('approved').defaultTo(false);
    table.uuid('approved_by').references('id').inTable('users');
    table.timestamp('approved_at');
    table.integer('version').defaultTo(1);
    table.boolean('active').defaultTo(true);
    table.uuid('created_by').notNullable().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['category'], 'idx_order_sets_category');
    table.index(['active'], 'idx_order_sets_active');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('order_sets');
}
