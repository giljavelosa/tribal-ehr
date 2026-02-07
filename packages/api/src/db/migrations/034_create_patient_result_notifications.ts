import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('patient_result_notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('order_id').notNullable();
    table.uuid('patient_id').notNullable();
    table.varchar('notification_method', 50).notNullable(); // phone, portal, mail, in-person, email
    table.timestamp('notified_at').notNullable();
    table.uuid('notified_by').notNullable();
    table.boolean('patient_acknowledged').defaultTo(false);
    table.timestamp('patient_acknowledged_at');
    table.text('notes');
    table.integer('days_from_result');
    table.boolean('within_threshold').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['order_id'], 'idx_result_notif_order');
    table.index(['patient_id'], 'idx_result_notif_patient');
    table.index(['notified_at'], 'idx_result_notif_date');
    table.index(['within_threshold'], 'idx_result_notif_threshold');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('patient_result_notifications');
}
