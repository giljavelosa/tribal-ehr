#!/usr/bin/env ts-node
/**
 * Comprehensive Seed Script for Tribal EHR
 *
 * Generates ~43,000+ rows across all 33 tables with clinically coherent data
 * driven by 8 disease profiles. Uses direct Knex inserts (no FHIR server required).
 *
 * Usage:
 *   npx ts-node scripts/seed-comprehensive.ts              # 500 patients (default)
 *   npx ts-node scripts/seed-comprehensive.ts --small       # 50 patients (quick dev)
 *   npx ts-node scripts/seed-comprehensive.ts --count 200   # custom count
 */

import knex, { Knex } from 'knex';
import path from 'path';

import { SEED_CONFIG } from './seed/config';
import { SeededRNG } from './seed/utils';

// Generator imports
import { seedUsers } from './seed/generators/users';
import { seedPatients } from './seed/generators/patients';
import { seedEncounters } from './seed/generators/encounters';
import { seedClinicalData } from './seed/generators/clinical-data';
import { seedProceduresAndOrders } from './seed/generators/procedures-orders';
import { seedCareCoordination } from './seed/generators/care-coordination';
import { seedDocumentsAndNotes } from './seed/generators/documents-notes';
import { seedDevices } from './seed/generators/devices';
import { seedScheduling } from './seed/generators/scheduling';
import { seedAuditAndProvenance } from './seed/generators/audit-provenance';
import { seedConsentsAndMessages } from './seed/generators/consents-messages';
import { seedOAuth } from './seed/generators/oauth';

// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------

function parseArgs(): { patientCount: number; seed: number } {
  const args = process.argv.slice(2);
  let patientCount = SEED_CONFIG.NUM_PATIENTS; // 500
  let seed = 42; // default PRNG seed for reproducibility

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--small') {
      patientCount = 50;
    } else if (args[i] === '--count' && args[i + 1]) {
      patientCount = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--seed' && args[i + 1]) {
      seed = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { patientCount, seed };
}

// ---------------------------------------------------------------------------
// Database connection
// ---------------------------------------------------------------------------

function createKnex(): Knex {
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/tribal_ehr';

  return knex({
    client: 'pg',
    connection: databaseUrl,
    pool: { min: 1, max: 5 },
  });
}

// ---------------------------------------------------------------------------
// Table truncation (respects FK order)
// ---------------------------------------------------------------------------

const TABLES_TO_TRUNCATE = [
  // Audit (drop rules first, handled separately)
  'audit_events',
  'provenance',
  // OAuth
  'smart_launch_contexts',
  'oauth_tokens',
  'oauth_authorization_codes',
  'oauth_clients',
  // Consents & Messages
  'messages',
  'consents',
  // Scheduling
  'appointments',
  'appointment_types',
  'locations',
  // Documents & Notes
  'clinical_notes',
  'note_templates',
  'document_references',
  // Care coordination
  'goals',
  'care_plans',
  'care_teams',
  // Devices
  'devices',
  // Orders & Procedures
  'orders',
  'procedures',
  // Clinical data
  'immunizations',
  'medication_requests',
  'observations',
  'allergy_intolerances',
  'conditions',
  // Encounters
  'encounters',
  // Patient sub-tables
  'insurance_coverages',
  'emergency_contacts',
  'patient_emails',
  'patient_phones',
  'patient_addresses',
  'patients',
  // Users
  'users',
];

async function truncateAll(db: Knex): Promise<void> {
  console.log('[Cleanup] Dropping audit_events rules...');
  await db.raw('DROP RULE IF EXISTS audit_events_no_delete ON audit_events');
  await db.raw('DROP RULE IF EXISTS audit_events_no_update ON audit_events');

  console.log('[Cleanup] Truncating all tables...');
  // Use TRUNCATE CASCADE to handle any remaining FK constraints
  const tableList = TABLES_TO_TRUNCATE.filter(async (t) => {
    // Only truncate tables that exist
    const exists = await db.schema.hasTable(t);
    return exists;
  });

  // Truncate in a single statement with CASCADE for safety
  try {
    await db.raw(
      `TRUNCATE TABLE ${TABLES_TO_TRUNCATE.join(', ')} CASCADE`
    );
  } catch (err: any) {
    // Some tables may not exist yet; truncate individually
    for (const table of TABLES_TO_TRUNCATE) {
      try {
        await db.raw(`TRUNCATE TABLE ${table} CASCADE`);
      } catch {
        // Table doesn't exist, skip
      }
    }
  }
}

async function restoreAuditRules(db: Knex): Promise<void> {
  console.log('[Finalize] Restoring audit_events append-only rules...');
  await db.raw(
    'CREATE RULE audit_events_no_update AS ON UPDATE TO audit_events DO INSTEAD NOTHING'
  );
  await db.raw(
    'CREATE RULE audit_events_no_delete AS ON DELETE TO audit_events DO INSTEAD NOTHING'
  );
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { patientCount, seed } = parseArgs();
  const rng = new SeededRNG(seed);
  const db = createKnex();

  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('  Tribal EHR - Comprehensive Data Seed');
  console.log('='.repeat(60));
  console.log(`  Patients:   ${patientCount}`);
  console.log(`  PRNG Seed:  ${seed}`);
  console.log(`  Database:   ${(db.client as any).config?.connection || 'default'}`);
  console.log('');

  try {
    // 1. Truncate existing data
    await truncateAll(db);
    console.log('');

    // 2. Run all generators inside a single transaction
    await db.transaction(async (trx: Knex.Transaction) => {
      // Phase 1: Foundation — users
      console.log('[Phase 1] Users');
      const users = await seedUsers(trx);
      console.log('');

      // Phase 2: Patients + demographics
      console.log('[Phase 2] Patients & Demographics');
      const patients = await seedPatients(trx, users, rng, patientCount);
      console.log('');

      // Phase 3: Encounters
      console.log('[Phase 3] Encounters');
      const encounters = await seedEncounters(trx, patients, users, rng);
      console.log('');

      // Phase 4: Clinical data (conditions, observations, allergies, medications, immunizations)
      console.log('[Phase 4] Clinical Data');
      await seedClinicalData(trx, patients, encounters, users, rng);
      console.log('');

      // Phase 5: Procedures & Orders
      console.log('[Phase 5] Procedures & Orders');
      await seedProceduresAndOrders(trx, patients, encounters, users, rng);
      console.log('');

      // Phase 6: Care Coordination (care teams, care plans, goals)
      console.log('[Phase 6] Care Coordination');
      await seedCareCoordination(trx, patients, users, rng);
      console.log('');

      // Phase 7: Documents & Clinical Notes
      console.log('[Phase 7] Documents & Clinical Notes');
      await seedDocumentsAndNotes(trx, patients, encounters, users, rng);
      console.log('');

      // Phase 8: Devices (UDI)
      console.log('[Phase 8] Devices');
      await seedDevices(trx, patients, rng);
      console.log('');

      // Phase 9: Scheduling (locations, appointment types, appointments)
      console.log('[Phase 9] Scheduling');
      await seedScheduling(trx, patients, users, rng);
      console.log('');

      // Phase 10: Consents & Messages
      console.log('[Phase 10] Consents & Messages');
      await seedConsentsAndMessages(trx, patients, users, rng);
      console.log('');

      // Phase 11: OAuth
      console.log('[Phase 11] OAuth');
      await seedOAuth(trx, users);
      console.log('');

      // Phase 12: Audit & Provenance (must be last — hash chain)
      console.log('[Phase 12] Audit & Provenance');
      await seedAuditAndProvenance(trx, patients, users, rng);
      console.log('');
    });

    // 3. Restore audit rules outside the transaction
    await restoreAuditRules(db);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('='.repeat(60));
    console.log('  Seed complete!');
    console.log(`  Time: ${elapsed}s`);
    console.log(`  Patients: ${patientCount}`);
    console.log('='.repeat(60));
  } catch (err) {
    console.error('');
    console.error('SEED FAILED:', err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
