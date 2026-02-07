import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // -------------------------------------------------------------------------
  // Data Sensitivity Tags - marks resources with sensitivity classification
  // -------------------------------------------------------------------------
  await knex.schema.createTable('data_sensitivity_tags', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.varchar('resource_type', 50).notNullable(); // 'Condition', 'Observation', 'MedicationRequest', etc.
    table.uuid('resource_id').notNullable();
    table.varchar('sensitivity_level', 20).notNullable(); // 'normal', 'restricted', 'very-restricted'
    table.varchar('sensitivity_category', 50).notNullable(); // 'substance-abuse', 'mental-health', 'hiv-sti', 'reproductive', 'genetic', 'general'
    table.uuid('tagged_by').references('id').inTable('users');
    table.timestamp('tagged_at').defaultTo(knex.fn.now());

    table.index(['resource_type', 'resource_id'], 'idx_sensitivity_tags_resource');
    table.index(['sensitivity_category'], 'idx_sensitivity_tags_category');
  });

  // -------------------------------------------------------------------------
  // Break-Glass Events - emergency override access audit trail
  // -------------------------------------------------------------------------
  await knex.schema.createTable('break_glass_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users');
    table.uuid('patient_id').notNullable().references('id').inTable('patients');
    table.text('reason').notNullable(); // why emergency access needed
    table.varchar('reason_category', 50); // 'emergency-treatment', 'danger-to-self-others', 'public-health-emergency'
    table.uuid('approved_by').references('id').inTable('users');
    table.timestamp('approved_at');
    table.timestamp('access_granted_at').defaultTo(knex.fn.now());
    table.timestamp('access_expires_at').notNullable(); // typically +4 hours
    table.boolean('revoked').defaultTo(false);
    table.uuid('revoked_by').references('id').inTable('users');
    table.timestamp('revoked_at');
    table.jsonb('resources_accessed').defaultTo('[]');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['user_id'], 'idx_break_glass_user');
    table.index(['patient_id'], 'idx_break_glass_patient');
    table.index(['access_expires_at'], 'idx_break_glass_expires');
  });

  // -------------------------------------------------------------------------
  // Consent Directives - patient consent decisions for data sharing
  // -------------------------------------------------------------------------
  await knex.schema.createTable('consent_directives', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('patient_id').notNullable().references('id').inTable('patients');
    table.varchar('consent_type', 50).notNullable(); // 'treatment', 'research', 'disclosure', 'opt-out'
    table.varchar('status', 20).notNullable(); // 'active', 'inactive', 'rejected', 'revoked'
    table.varchar('scope', 100); // what the consent covers
    table.varchar('actor_type', 50); // 'Practitioner', 'Organization', 'RelatedPerson'
    table.uuid('actor_id');
    table.jsonb('data_categories').defaultTo('[]'); // which categories restricted
    table.timestamp('period_start');
    table.timestamp('period_end');
    table.uuid('recorded_by').references('id').inTable('users');
    table.boolean('verified').defaultTo(false);
    table.timestamp('verified_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['patient_id'], 'idx_consent_directives_patient');
    table.index(['status'], 'idx_consent_directives_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('consent_directives');
  await knex.schema.dropTableIfExists('break_glass_events');
  await knex.schema.dropTableIfExists('data_sensitivity_tags');
}
