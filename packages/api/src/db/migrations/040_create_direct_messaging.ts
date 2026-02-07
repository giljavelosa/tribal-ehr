import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // -------------------------------------------------------------------------
  // Direct Addresses - Direct Protocol secure messaging addresses
  // -------------------------------------------------------------------------
  await knex.schema.createTable('direct_addresses', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').nullable().references('id').inTable('users');
    table.varchar('direct_address', 255).notNullable().unique();
    table.varchar('display_name', 255).notNullable();
    table.varchar('organization', 255).nullable();
    table.text('certificate_pem').nullable();
    table.varchar('certificate_fingerprint', 128).nullable();
    table.timestamp('certificate_expires_at').nullable();
    table.boolean('active').defaultTo(true);
    table.boolean('verified').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['direct_address'], 'idx_direct_addresses_address');
    table.index(['user_id'], 'idx_direct_addresses_user_id');
  });

  // -------------------------------------------------------------------------
  // Direct Messages - Secure Direct Protocol messages
  // -------------------------------------------------------------------------
  await knex.schema.createTable('direct_messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.varchar('message_id', 255).notNullable().unique(); // RFC 5322 Message-ID
    table.varchar('from_address', 255).notNullable();
    table.jsonb('to_addresses').notNullable(); // array of Direct addresses
    table.jsonb('cc_addresses').defaultTo('[]');
    table.varchar('subject', 500).nullable();
    table.text('body').nullable();
    table.varchar('content_type', 50).defaultTo('text/plain');
    table.jsonb('attachments').defaultTo('[]'); // array of { filename, content_type, size, storage_key }
    table.varchar('direction', 10).notNullable(); // 'inbound', 'outbound'
    table.varchar('status', 20).notNullable(); // 'queued', 'sent', 'delivered', 'failed', 'received', 'read'
    table.varchar('mdn_status', 20).nullable(); // 'requested', 'received', 'failed'
    table.timestamp('mdn_received_at').nullable();
    table.timestamp('sent_at').nullable();
    table.timestamp('received_at').nullable();
    table.text('error_message').nullable();
    table.uuid('related_patient_id').nullable().references('id').inTable('patients');
    table.uuid('related_document_id').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['from_address'], 'idx_direct_messages_from_address');
    table.index(['status'], 'idx_direct_messages_status');
    table.index(['direction'], 'idx_direct_messages_direction');
    table.index(['related_patient_id'], 'idx_direct_messages_patient');
  });

  // Add check constraints
  await knex.raw(`
    ALTER TABLE direct_messages ADD CONSTRAINT direct_messages_direction_check
    CHECK (direction IN ('inbound', 'outbound'))
  `);

  await knex.raw(`
    ALTER TABLE direct_messages ADD CONSTRAINT direct_messages_status_check
    CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'received', 'read'))
  `);

  // -------------------------------------------------------------------------
  // Audit Digests - Signed digests for audit tamper-resistance
  // -------------------------------------------------------------------------
  await knex.schema.createTable('audit_digests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.timestamp('period_start').notNullable();
    table.timestamp('period_end').notNullable();
    table.integer('record_count').notNullable();
    table.varchar('digest_hash', 128).notNullable(); // HMAC-SHA256
    table.varchar('algorithm', 50).notNullable().defaultTo('hmac-sha256');
    table.text('first_record_hash').nullable();
    table.text('last_record_hash').nullable();
    table.uuid('generated_by').nullable().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['period_start', 'period_end'], 'idx_audit_digests_period');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_digests');
  await knex.schema.dropTableIfExists('direct_messages');
  await knex.schema.dropTableIfExists('direct_addresses');
}
