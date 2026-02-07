import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { saferGuides } from '../../data/safer-guide-seed';

export async function up(knex: Knex): Promise<void> {
  // SAFER Guides catalog
  await knex.schema.createTable('safer_guides', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('guide_number').notNullable().unique();
    table.varchar('title', 255).notNullable();
  });

  // SAFER Practices per guide
  await knex.schema.createTable('safer_practices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('guide_id').notNullable().references('id').inTable('safer_guides');
    table.varchar('practice_number', 10).notNullable();
    table.text('description').notNullable();
    table.boolean('required').defaultTo(false);

    table.index(['guide_id'], 'idx_safer_practices_guide');
  });

  // Annual assessments
  await knex.schema.createTable('safer_assessments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('assessment_year').notNullable().unique();
    table.varchar('status', 30).notNullable().defaultTo('draft'); // draft, in_progress, completed, approved
    table.uuid('assessor_id');
    table.uuid('approved_by');
    table.timestamp('approved_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Individual assessment items
  await knex.schema.createTable('safer_assessment_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('assessment_id').notNullable().references('id').inTable('safer_assessments');
    table.uuid('practice_id').notNullable().references('id').inTable('safer_practices');
    table.integer('implementation_percentage').defaultTo(0); // 0-100
    table.varchar('status', 30).defaultTo('not_assessed'); // not_assessed, fully_implemented, partially_implemented, not_implemented, not_applicable
    table.boolean('ehr_limitation').defaultTo(false);
    table.text('notes');
    table.text('evidence');
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['assessment_id'], 'idx_safer_items_assessment');
    table.unique(['assessment_id', 'practice_id']);
  });

  // Seed all 8 guides and their practices
  for (const guide of saferGuides) {
    const guideId = uuidv4();
    await knex('safer_guides').insert({
      id: guideId,
      guide_number: guide.guideNumber,
      title: guide.title,
    });

    for (const practice of guide.practices) {
      await knex('safer_practices').insert({
        id: uuidv4(),
        guide_id: guideId,
        practice_number: practice.practiceNumber,
        description: practice.description,
        required: practice.required,
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('safer_assessment_items');
  await knex.schema.dropTableIfExists('safer_assessments');
  await knex.schema.dropTableIfExists('safer_practices');
  await knex.schema.dropTableIfExists('safer_guides');
}
