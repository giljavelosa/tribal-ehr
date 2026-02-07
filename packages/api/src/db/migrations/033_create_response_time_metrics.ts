import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('response_time_metrics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.varchar('endpoint', 255).notNullable();
    table.varchar('method', 10).notNullable();
    table.integer('request_count').defaultTo(0);
    table.float('avg_duration_ms').defaultTo(0);
    table.float('p50_ms').defaultTo(0);
    table.float('p95_ms').defaultTo(0);
    table.float('p99_ms').defaultTo(0);
    table.float('max_ms').defaultTo(0);
    table.integer('error_count').defaultTo(0);
    table.timestamp('period_start').notNullable();
    table.timestamp('period_end').notNullable();

    table.index(['endpoint', 'method'], 'idx_response_time_endpoint');
    table.index(['period_start'], 'idx_response_time_period');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('response_time_metrics');
}
