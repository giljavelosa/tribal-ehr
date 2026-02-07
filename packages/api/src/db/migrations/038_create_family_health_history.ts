import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('family_health_histories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('patient_id').notNullable();
    table.varchar('relationship', 50).notNullable(); // mother, father, sister, brother, etc.
    table.varchar('relative_name', 255);
    table.varchar('condition_code', 20); // ICD-10 or SNOMED-CT
    table.varchar('condition_display', 500).notNullable(); // human readable
    table.varchar('condition_system', 100); // coding system URI
    table.integer('onset_age');
    table.integer('onset_range_low');
    table.integer('onset_range_high');
    table.boolean('deceased').defaultTo(false);
    table.integer('deceased_age');
    table.varchar('cause_of_death', 500);
    table.text('note');
    table.varchar('status', 20).defaultTo('active'); // active, inactive, entered-in-error
    table.timestamp('recorded_date').defaultTo(knex.fn.now());
    table.uuid('recorded_by');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['patient_id'], 'idx_family_health_histories_patient');
    table.index(['condition_code'], 'idx_family_health_histories_condition');
    table.index(['relationship'], 'idx_family_health_histories_relationship');
    table.index(['status'], 'idx_family_health_histories_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('family_health_histories');
}
