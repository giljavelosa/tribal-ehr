import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Training courses catalog
  await knex.schema.createTable('training_courses', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.varchar('title', 255).notNullable();
    table.text('description');
    table.varchar('category', 100).notNullable(); // EHR, Clinical, Safety, Compliance, Security
    table.boolean('required').defaultTo(false);
    table.integer('recurrence_months'); // null = one-time
    table.integer('passing_score').defaultTo(80); // percentage
    table.boolean('active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['category'], 'idx_training_courses_category');
    table.index(['active'], 'idx_training_courses_active');
  });

  // Individual training records
  await knex.schema.createTable('training_records', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.uuid('course_id').notNullable().references('id').inTable('training_courses');
    table.varchar('status', 30).notNullable().defaultTo('assigned'); // assigned, in_progress, completed, expired
    table.integer('score');
    table.boolean('passed');
    table.timestamp('assigned_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at');
    table.timestamp('expires_at');
    table.uuid('verified_by');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['user_id'], 'idx_training_records_user');
    table.index(['course_id'], 'idx_training_records_course');
    table.index(['status'], 'idx_training_records_status');
    table.index(['expires_at'], 'idx_training_records_expires');
  });

  // Competency assessments
  await knex.schema.createTable('competency_assessments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.varchar('competency_area', 100).notNullable(); // CPOE, eRx, CDS, Lab Orders, etc.
    table.varchar('proficiency_level', 30).notNullable(); // novice, intermediate, proficient, expert
    table.uuid('assessed_by').notNullable();
    table.timestamp('assessed_at').defaultTo(knex.fn.now());
    table.timestamp('next_assessment_due');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['user_id'], 'idx_competency_user');
    table.index(['competency_area'], 'idx_competency_area');
    table.index(['next_assessment_due'], 'idx_competency_due');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('competency_assessments');
  await knex.schema.dropTableIfExists('training_records');
  await knex.schema.dropTableIfExists('training_courses');
}
