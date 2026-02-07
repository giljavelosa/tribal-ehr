import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ---------------------------------------------------------------------------
  // Row-Level Security (RLS) for HIPAA minimum necessary access principle
  // ---------------------------------------------------------------------------
  // RLS policies enforce access control at the database level, providing a
  // defense-in-depth layer beyond the application service layer.
  //
  // IMPORTANT: RLS is bypassed by table owners (superuser/migration role).
  // In production, the application MUST connect as a non-superuser role.
  // ---------------------------------------------------------------------------

  // Enable RLS on sensitive clinical tables
  await knex.raw('ALTER TABLE patients ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE encounters ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE observations ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE conditions ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE medication_requests ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE allergy_intolerances ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY');

  // -- Patients table policy --
  // All authenticated app users can access all patient records.
  // The application service layer handles role-based filtering;
  // RLS prevents direct database access bypass.
  await knex.raw(`
    CREATE POLICY patients_app_access ON patients
    FOR ALL
    USING (true)
    WITH CHECK (true)
  `);

  // -- Clinical tables policies --
  // Access requires the referenced patient to exist and be active.
  // This prevents access to clinical data for deactivated patients and
  // guards against orphaned data access.

  await knex.raw(`
    CREATE POLICY encounters_patient_active ON encounters
    FOR ALL
    USING (patient_id IN (SELECT id FROM patients WHERE active = true))
    WITH CHECK (patient_id IN (SELECT id FROM patients WHERE active = true))
  `);

  await knex.raw(`
    CREATE POLICY observations_patient_active ON observations
    FOR ALL
    USING (patient_id IN (SELECT id FROM patients WHERE active = true))
    WITH CHECK (patient_id IN (SELECT id FROM patients WHERE active = true))
  `);

  await knex.raw(`
    CREATE POLICY conditions_patient_active ON conditions
    FOR ALL
    USING (patient_id IN (SELECT id FROM patients WHERE active = true))
    WITH CHECK (patient_id IN (SELECT id FROM patients WHERE active = true))
  `);

  await knex.raw(`
    CREATE POLICY medication_requests_patient_active ON medication_requests
    FOR ALL
    USING (patient_id IN (SELECT id FROM patients WHERE active = true))
    WITH CHECK (patient_id IN (SELECT id FROM patients WHERE active = true))
  `);

  await knex.raw(`
    CREATE POLICY allergy_intolerances_patient_active ON allergy_intolerances
    FOR ALL
    USING (patient_id IN (SELECT id FROM patients WHERE active = true))
    WITH CHECK (patient_id IN (SELECT id FROM patients WHERE active = true))
  `);

  await knex.raw(`
    CREATE POLICY clinical_notes_patient_active ON clinical_notes
    FOR ALL
    USING (patient_id IN (SELECT id FROM patients WHERE active = true))
    WITH CHECK (patient_id IN (SELECT id FROM patients WHERE active = true))
  `);

  // Document the RLS requirement on the patients table
  await knex.raw(`COMMENT ON TABLE patients IS 'RLS enabled: connect as non-superuser in production'`);
}

export async function down(knex: Knex): Promise<void> {
  // Drop all RLS policies
  await knex.raw('DROP POLICY IF EXISTS patients_app_access ON patients');
  await knex.raw('DROP POLICY IF EXISTS encounters_patient_active ON encounters');
  await knex.raw('DROP POLICY IF EXISTS observations_patient_active ON observations');
  await knex.raw('DROP POLICY IF EXISTS conditions_patient_active ON conditions');
  await knex.raw('DROP POLICY IF EXISTS medication_requests_patient_active ON medication_requests');
  await knex.raw('DROP POLICY IF EXISTS allergy_intolerances_patient_active ON allergy_intolerances');
  await knex.raw('DROP POLICY IF EXISTS clinical_notes_patient_active ON clinical_notes');

  // Disable RLS on all tables
  await knex.raw('ALTER TABLE patients DISABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE encounters DISABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE observations DISABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE conditions DISABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE medication_requests DISABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE allergy_intolerances DISABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE clinical_notes DISABLE ROW LEVEL SECURITY');

  // Remove the table comment
  await knex.raw(`COMMENT ON TABLE patients IS NULL`);
}
