import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('messages', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('uuid_generate_v4()'));
    table
      .uuid('sender_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .uuid('recipient_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .uuid('patient_id')
      .references('id')
      .inTable('patients')
      .onDelete('SET NULL');
    table.varchar('subject', 500);
    table.text('body').notNullable();
    table.varchar('priority', 20).defaultTo('normal');
    table.timestamp('read_at', { useTz: true });
    table
      .uuid('parent_id')
      .references('id')
      .inTable('messages')
      .onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('messages', (table) => {
    table.index('sender_id', 'idx_messages_sender_id');
    table.index('recipient_id', 'idx_messages_recipient_id');
    table.index('patient_id', 'idx_messages_patient_id');
    table.index('read_at', 'idx_messages_read_at');
    table.index('created_at', 'idx_messages_created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('messages');
}
