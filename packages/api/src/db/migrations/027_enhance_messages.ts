import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('messages', (table) => {
    table.boolean('flagged').defaultTo(false);
    table
      .uuid('flagged_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('flagged_at', { useTz: true });
    table
      .uuid('forwarded_from')
      .references('id')
      .inTable('messages')
      .onDelete('SET NULL');
    table.date('follow_up_date');
    table.boolean('follow_up_completed').defaultTo(false);
    table.integer('escalation_level').defaultTo(0);
    table.timestamp('escalated_at', { useTz: true });
    table
      .uuid('escalated_to')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.varchar('delivery_status', 20).defaultTo('sent');
  });

  await knex.schema.alterTable('messages', (table) => {
    table.index('flagged', 'idx_messages_flagged');
    table.index('follow_up_date', 'idx_messages_follow_up_date');
    table.index('escalation_level', 'idx_messages_escalation_level');
  });

  await knex.schema.createTable('message_attachments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('message_id')
      .notNullable()
      .references('id')
      .inTable('messages')
      .onDelete('CASCADE');
    table.varchar('file_name', 255).notNullable();
    table.varchar('file_type', 100).notNullable();
    table.integer('file_size').notNullable();
    table.text('storage_path').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('message_id', 'idx_message_attachments_message_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('message_attachments');

  await knex.schema.alterTable('messages', (table) => {
    table.dropIndex('', 'idx_messages_escalation_level');
    table.dropIndex('', 'idx_messages_follow_up_date');
    table.dropIndex('', 'idx_messages_flagged');
  });

  await knex.schema.alterTable('messages', (table) => {
    table.dropColumn('delivery_status');
    table.dropColumn('escalated_to');
    table.dropColumn('escalated_at');
    table.dropColumn('escalation_level');
    table.dropColumn('follow_up_completed');
    table.dropColumn('follow_up_date');
    table.dropColumn('forwarded_from');
    table.dropColumn('flagged_at');
    table.dropColumn('flagged_by');
    table.dropColumn('flagged');
  });
}
