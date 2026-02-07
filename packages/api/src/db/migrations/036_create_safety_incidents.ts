import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('safety_incidents', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.varchar('incident_number', 30).notNullable().unique(); // INC-YYYYMMDD-NNN
    table.varchar('type', 50).notNullable(); // near-miss, adverse-event, hazard, complaint
    table.varchar('severity', 20).notNullable(); // low, medium, high, critical
    table.varchar('status', 30).notNullable().defaultTo('reported'); // reported, investigating, resolved, closed
    table.text('description').notNullable();
    table.uuid('reporter_id').notNullable();
    table.uuid('patient_id'); // nullable - not all incidents involve a patient
    table.timestamp('incident_date').notNullable();
    table.uuid('assigned_to');
    table.text('investigation_notes');
    table.text('root_cause');
    table.text('corrective_action');
    table.text('resolution');
    table.boolean('ehr_related').defaultTo(false);
    table.varchar('ehr_module', 100); // which EHR module was involved
    table.jsonb('contributing_factors').defaultTo('[]');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['status'], 'idx_safety_incidents_status');
    table.index(['severity'], 'idx_safety_incidents_severity');
    table.index(['type'], 'idx_safety_incidents_type');
    table.index(['reporter_id'], 'idx_safety_incidents_reporter');
    table.index(['incident_date'], 'idx_safety_incidents_date');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('safety_incidents');
}
