import { Knex } from 'knex';
import crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { GeneratedUsers } from './users';

export async function seedOAuth(
  trx: Knex.Transaction,
  users: GeneratedUsers,
): Promise<void> {
  const now = new Date().toISOString();
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const inOneHour = new Date(Date.now() + 3600000).toISOString();
  const inOneDay = new Date(Date.now() + 86400000).toISOString();
  const inThirtyDays = new Date(Date.now() + 30 * 86400000).toISOString();

  // ----- OAUTH CLIENTS -----
  const testClientSecretHash = await bcrypt.hash('test-client-secret-12345', 12);
  const bulkClientSecretHash = await bcrypt.hash('bulk-data-secret-67890', 12);

  const frontendClientId = crypto.randomUUID();
  const testClientId = crypto.randomUUID();
  const bulkClientId = crypto.randomUUID();

  const clientRows = [
    {
      id: frontendClientId,
      client_id: 'tribal-ehr-frontend',
      client_secret_hash: null, // Public client
      name: 'Tribal EHR Frontend Application',
      redirect_uris: JSON.stringify([
        'http://localhost:3000/callback',
        'http://localhost:3000/silent-refresh',
        'https://tribal-ehr.org/callback',
      ]),
      grant_types: JSON.stringify(['authorization_code']),
      scopes: JSON.stringify([
        'openid', 'profile', 'fhirUser',
        'launch', 'launch/patient',
        'patient/*.read', 'patient/*.write',
        'user/*.read', 'user/*.write',
      ]),
      confidential: false,
      active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: testClientId,
      client_id: 'tribal-ehr-test-client',
      client_secret_hash: testClientSecretHash,
      name: 'Test Client Application',
      redirect_uris: JSON.stringify([
        'http://localhost:9090/callback',
      ]),
      grant_types: JSON.stringify(['authorization_code', 'client_credentials']),
      scopes: JSON.stringify([
        'openid', 'profile', 'fhirUser',
        'launch', 'launch/patient',
        'patient/*.read', 'patient/*.write',
        'user/*.read', 'user/*.write',
        'system/*.read',
      ]),
      confidential: true,
      active: true,
      created_at: now,
      updated_at: now,
    },
    {
      id: bulkClientId,
      client_id: 'tribal-ehr-bulk-data',
      client_secret_hash: bulkClientSecretHash,
      name: 'Bulk Data Export Client',
      redirect_uris: JSON.stringify([]),
      grant_types: JSON.stringify(['client_credentials']),
      scopes: JSON.stringify([
        'system/*.read',
        'system/Patient.read',
        'system/Observation.read',
        'system/Condition.read',
        'system/MedicationRequest.read',
        'system/Encounter.read',
      ]),
      confidential: true,
      active: true,
      created_at: now,
      updated_at: now,
    },
  ];

  await trx.batchInsert('oauth_clients', clientRows as any[], 100);
  console.log(`  - oauth_clients: ${clientRows.length} rows`);

  // ----- OAUTH AUTHORIZATION CODES -----
  // Sample expired codes for historical reference
  const sampleUserId = users.physicians.length > 0 ? users.physicians[0] : users.allUserIds[0];
  const sampleUserId2 = users.physicians.length > 1 ? users.physicians[1] : users.allUserIds[0];
  const sampleNurseId = users.nurses.length > 0 ? users.nurses[0] : users.allUserIds[0];

  const authCodeRows = [
    {
      id: crypto.randomUUID(),
      code: crypto.randomBytes(32).toString('base64url'),
      client_id: frontendClientId,
      user_id: sampleUserId,
      redirect_uri: 'http://localhost:3000/callback',
      scope: 'openid profile fhirUser launch/patient patient/*.read',
      code_challenge: crypto.randomBytes(32).toString('base64url'),
      code_challenge_method: 'S256',
      expires_at: oneHourAgo, // expired
      created_at: oneDayAgo,
    },
    {
      id: crypto.randomUUID(),
      code: crypto.randomBytes(32).toString('base64url'),
      client_id: frontendClientId,
      user_id: sampleUserId2,
      redirect_uri: 'http://localhost:3000/callback',
      scope: 'openid profile fhirUser launch/patient patient/*.read patient/*.write',
      code_challenge: crypto.randomBytes(32).toString('base64url'),
      code_challenge_method: 'S256',
      expires_at: oneHourAgo,
      created_at: oneDayAgo,
    },
    {
      id: crypto.randomUUID(),
      code: crypto.randomBytes(32).toString('base64url'),
      client_id: testClientId,
      user_id: sampleNurseId,
      redirect_uri: 'http://localhost:9090/callback',
      scope: 'openid profile user/*.read',
      code_challenge: null,
      code_challenge_method: null,
      expires_at: oneHourAgo,
      created_at: oneWeekAgo,
    },
    {
      id: crypto.randomUUID(),
      code: crypto.randomBytes(32).toString('base64url'),
      client_id: frontendClientId,
      user_id: sampleUserId,
      redirect_uri: 'http://localhost:3000/callback',
      scope: 'openid profile fhirUser',
      code_challenge: crypto.randomBytes(32).toString('base64url'),
      code_challenge_method: 'S256',
      expires_at: oneHourAgo,
      created_at: oneWeekAgo,
    },
    {
      id: crypto.randomUUID(),
      code: crypto.randomBytes(32).toString('base64url'),
      client_id: testClientId,
      user_id: sampleUserId2,
      redirect_uri: 'http://localhost:9090/callback',
      scope: 'openid profile patient/*.read system/*.read',
      code_challenge: null,
      code_challenge_method: null,
      expires_at: oneHourAgo,
      created_at: oneWeekAgo,
    },
  ];

  await trx.batchInsert('oauth_authorization_codes', authCodeRows as any[], 100);
  console.log(`  - oauth_authorization_codes: ${authCodeRows.length} rows`);

  // ----- OAUTH TOKENS -----
  const tokenRows = [
    // Active tokens
    {
      id: crypto.randomUUID(),
      access_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      refresh_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      client_id: frontendClientId,
      user_id: sampleUserId,
      scope: 'openid profile fhirUser launch/patient patient/*.read',
      expires_at: inOneHour,
      refresh_expires_at: inThirtyDays,
      revoked: false,
      created_at: now,
    },
    {
      id: crypto.randomUUID(),
      access_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      refresh_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      client_id: frontendClientId,
      user_id: sampleUserId2,
      scope: 'openid profile fhirUser patient/*.read patient/*.write',
      expires_at: inOneHour,
      refresh_expires_at: inThirtyDays,
      revoked: false,
      created_at: now,
    },
    {
      id: crypto.randomUUID(),
      access_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      refresh_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      client_id: frontendClientId,
      user_id: sampleNurseId,
      scope: 'openid profile fhirUser user/*.read',
      expires_at: inOneDay,
      refresh_expires_at: inThirtyDays,
      revoked: false,
      created_at: now,
    },
    // Bulk data client token (no user)
    {
      id: crypto.randomUUID(),
      access_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      refresh_token_hash: null,
      client_id: bulkClientId,
      user_id: null,
      scope: 'system/*.read',
      expires_at: inOneHour,
      refresh_expires_at: null,
      revoked: false,
      created_at: now,
    },
    // Revoked tokens (historical)
    {
      id: crypto.randomUUID(),
      access_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      refresh_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      client_id: frontendClientId,
      user_id: sampleUserId,
      scope: 'openid profile fhirUser patient/*.read',
      expires_at: oneHourAgo,
      refresh_expires_at: oneDayAgo,
      revoked: true,
      created_at: oneWeekAgo,
    },
    {
      id: crypto.randomUUID(),
      access_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      refresh_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      client_id: testClientId,
      user_id: sampleUserId2,
      scope: 'openid profile patient/*.read system/*.read',
      expires_at: oneHourAgo,
      refresh_expires_at: oneWeekAgo,
      revoked: true,
      created_at: oneWeekAgo,
    },
    {
      id: crypto.randomUUID(),
      access_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      refresh_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      client_id: frontendClientId,
      user_id: sampleNurseId,
      scope: 'openid profile user/*.read',
      expires_at: oneDayAgo,
      refresh_expires_at: oneWeekAgo,
      revoked: true,
      created_at: oneWeekAgo,
    },
    // Test client token
    {
      id: crypto.randomUUID(),
      access_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      refresh_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      client_id: testClientId,
      user_id: sampleUserId,
      scope: 'openid profile patient/*.read patient/*.write user/*.read',
      expires_at: inOneDay,
      refresh_expires_at: inThirtyDays,
      revoked: false,
      created_at: now,
    },
    // Expired but not revoked
    {
      id: crypto.randomUUID(),
      access_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      refresh_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      client_id: frontendClientId,
      user_id: sampleUserId,
      scope: 'openid profile fhirUser patient/*.read',
      expires_at: oneHourAgo,
      refresh_expires_at: inThirtyDays,
      revoked: false,
      created_at: oneDayAgo,
    },
    // Active bulk data token
    {
      id: crypto.randomUUID(),
      access_token_hash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
      refresh_token_hash: null,
      client_id: bulkClientId,
      user_id: null,
      scope: 'system/Patient.read system/Observation.read system/Condition.read',
      expires_at: inOneDay,
      refresh_expires_at: null,
      revoked: false,
      created_at: now,
    },
  ];

  await trx.batchInsert('oauth_tokens', tokenRows as any[], 100);
  console.log(`  - oauth_tokens: ${tokenRows.length} rows`);

  // ----- SMART LAUNCH CONTEXTS -----
  const samplePatientIds = [
    users.patientUsers.length > 0 ? users.patientUsers[0] : null,
    users.patientUsers.length > 1 ? users.patientUsers[1] : null,
  ].filter(Boolean);

  const launchContextRows = [
    {
      id: crypto.randomUUID(),
      launch_id: crypto.randomBytes(16).toString('base64url'),
      client_id: frontendClientId,
      user_id: sampleUserId,
      patient_id: samplePatientIds[0] || null,
      encounter_id: null,
      context: JSON.stringify({
        patient: samplePatientIds[0] || null,
        fhirContext: [{ reference: `Patient/${samplePatientIds[0] || 'unknown'}` }],
      }),
      expires_at: inOneHour,
      created_at: now,
    },
    {
      id: crypto.randomUUID(),
      launch_id: crypto.randomBytes(16).toString('base64url'),
      client_id: frontendClientId,
      user_id: sampleUserId2,
      patient_id: samplePatientIds[1] || samplePatientIds[0] || null,
      encounter_id: null,
      context: JSON.stringify({
        patient: samplePatientIds[1] || samplePatientIds[0] || null,
        fhirContext: [{ reference: `Patient/${samplePatientIds[1] || samplePatientIds[0] || 'unknown'}` }],
      }),
      expires_at: inOneHour,
      created_at: now,
    },
    {
      id: crypto.randomUUID(),
      launch_id: crypto.randomBytes(16).toString('base64url'),
      client_id: testClientId,
      user_id: sampleUserId,
      patient_id: samplePatientIds[0] || null,
      encounter_id: crypto.randomUUID(), // Simulated encounter
      context: JSON.stringify({
        patient: samplePatientIds[0] || null,
        encounter: crypto.randomUUID(),
        fhirContext: [
          { reference: `Patient/${samplePatientIds[0] || 'unknown'}` },
          { reference: 'Encounter/simulated' },
        ],
      }),
      expires_at: inOneDay,
      created_at: now,
    },
    {
      id: crypto.randomUUID(),
      launch_id: crypto.randomBytes(16).toString('base64url'),
      client_id: frontendClientId,
      user_id: sampleNurseId,
      patient_id: null,
      encounter_id: null,
      context: JSON.stringify({
        need_patient_banner: true,
        smart_style_url: '/smart-style.json',
      }),
      expires_at: oneHourAgo, // expired
      created_at: oneDayAgo,
    },
    {
      id: crypto.randomUUID(),
      launch_id: crypto.randomBytes(16).toString('base64url'),
      client_id: testClientId,
      user_id: sampleUserId2,
      patient_id: samplePatientIds[1] || samplePatientIds[0] || null,
      encounter_id: null,
      context: JSON.stringify({
        patient: samplePatientIds[1] || samplePatientIds[0] || null,
        intent: 'reconcile-medications',
      }),
      expires_at: inOneHour,
      created_at: now,
    },
  ];

  await trx.batchInsert('smart_launch_contexts', launchContextRows as any[], 100);
  console.log(`  - smart_launch_contexts: ${launchContextRows.length} rows`);
}
