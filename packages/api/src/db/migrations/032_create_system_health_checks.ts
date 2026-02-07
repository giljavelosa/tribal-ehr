import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('system_health_checks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.varchar('overall_status', 20).notNullable(); // ok, degraded, down
    table.jsonb('services').notNullable(); // { db, redis, rabbitmq, fhir } status + latency
    table.integer('active_users').defaultTo(0);
    table.integer('todays_encounters').defaultTo(0);
    table.integer('total_latency_ms').defaultTo(0);
    table.timestamp('checked_at').defaultTo(knex.fn.now());

    table.index(['checked_at'], 'idx_health_checks_checked_at');
    table.index(['overall_status'], 'idx_health_checks_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('system_health_checks');
}
