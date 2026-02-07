import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // CDS Overrides — records when a clinician overrides a CDS card
  await knex.schema.createTable('cds_overrides', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('card_id').notNullable();
    table.uuid('user_id').notNullable().references('id').inTable('users');
    table.uuid('patient_id').notNullable().references('id').inTable('patients');
    table.string('hook_instance').notNullable();
    table.string('reason_code').notNullable();
    table.text('reason_text');
    table.text('card_summary').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['patient_id', 'created_at'], 'idx_cds_overrides_patient');
    table.index(['user_id'], 'idx_cds_overrides_user');
  });

  // CDS Feedback — records clinician feedback on CDS card helpfulness
  await knex.schema.createTable('cds_feedback', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('card_id').notNullable();
    table.uuid('user_id').notNullable().references('id').inTable('users');
    table.string('outcome').notNullable();
    table.string('outcome_timestamp');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['card_id'], 'idx_cds_feedback_card');
    table.index(['user_id'], 'idx_cds_feedback_user');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('cds_feedback');
  await knex.schema.dropTableIfExists('cds_overrides');
}
