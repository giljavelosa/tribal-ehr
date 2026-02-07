import { Knex } from 'knex';
import crypto from 'crypto';
import { SeededRNG, batchInsert } from '../utils';
import { SEED_CONFIG } from '../config';
import { GeneratedPatients } from './patients';
import { GeneratedUsers } from './users';

// ---------------------------------------------------------------------------
// Audit event action/resource types
// ---------------------------------------------------------------------------

const AUDIT_ACTIONS = ['CREATE', 'READ', 'UPDATE', 'LOGIN', 'LOGOUT'] as const;

const RESOURCE_TYPES = [
  'Patient', 'Encounter', 'Observation', 'MedicationRequest',
  'Condition', 'AllergyIntolerance', 'Procedure', 'CarePlan',
  'CareTeam', 'Goal', 'DocumentReference', 'ClinicalNote',
  'Device', 'Appointment', 'Order', 'Consent',
] as const;

const HTTP_METHODS_BY_ACTION: Record<string, string> = {
  CREATE: 'POST',
  READ: 'GET',
  UPDATE: 'PUT',
  LOGIN: 'POST',
  LOGOUT: 'POST',
};

const ENDPOINTS_BY_RESOURCE: Record<string, string> = {
  Patient: '/api/patients',
  Encounter: '/api/encounters',
  Observation: '/api/observations',
  MedicationRequest: '/api/medication-requests',
  Condition: '/api/conditions',
  AllergyIntolerance: '/api/allergy-intolerances',
  Procedure: '/api/procedures',
  CarePlan: '/api/care-plans',
  CareTeam: '/api/care-teams',
  Goal: '/api/goals',
  DocumentReference: '/api/document-references',
  ClinicalNote: '/api/clinical-notes',
  Device: '/api/devices',
  Appointment: '/api/appointments',
  Order: '/api/orders',
  Consent: '/api/consents',
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'TribalEHR/2.0 (Desktop Client)',
  'TribalEHR-Mobile/1.5 (iOS 17.2)',
];

const IP_ADDRESSES = [
  '192.168.1.10', '192.168.1.11', '192.168.1.12', '192.168.1.20',
  '192.168.1.25', '192.168.1.30', '192.168.1.35', '192.168.1.40',
  '10.0.0.50', '10.0.0.51', '10.0.0.52', '10.0.0.60',
  '172.16.0.10', '172.16.0.11', '172.16.0.12', '172.16.0.20',
];

export async function seedAuditAndProvenance(
  trx: Knex.Transaction,
  patients: GeneratedPatients,
  users: GeneratedUsers,
  rng: SeededRNG,
): Promise<void> {
  const now = new Date().toISOString();
  const dateStart = new Date(SEED_CONFIG.DATE_RANGE_START);
  const dateEnd = new Date(SEED_CONFIG.DATE_RANGE_END);

  // ----- PROVENANCE -----
  const provenanceRows: Record<string, unknown>[] = [];

  // Generate provenance for a sample of patients' clinical resources
  const resourceTypes = ['Condition', 'MedicationRequest', 'Observation'];
  const samplePatients = rng.pickN(patients.patients, Math.min(200, patients.patients.length));

  for (const patient of samplePatients) {
    for (const resType of resourceTypes) {
      const providerId = rng.pick(users.allProviderIds);
      const providerUser = users.physicians.includes(providerId)
        ? providerId
        : rng.pick(users.physicians);

      const recordedDate = rng.randomDate(dateStart, dateEnd);

      provenanceRows.push({
        id: crypto.randomUUID(),
        target_resource_type: resType,
        target_resource_id: crypto.randomUUID(), // Reference to the resource
        fhir_id: null,
        recorded: recordedDate.toISOString(),
        agent_type: 'author',
        agent_who_id: providerUser,
        agent_who_display: null,
        entity_role: 'source',
        entity_what_type: 'Patient',
        entity_what_id: patient.id,
        created_at: now,
      });
    }

    // Some patients get additional provenance records for care plans
    if (rng.chance(0.3)) {
      provenanceRows.push({
        id: crypto.randomUUID(),
        target_resource_type: 'CarePlan',
        target_resource_id: crypto.randomUUID(),
        fhir_id: null,
        recorded: rng.randomDate(dateStart, dateEnd).toISOString(),
        agent_type: 'author',
        agent_who_id: rng.pick(users.physicians),
        agent_who_display: null,
        entity_role: 'source',
        entity_what_type: 'Patient',
        entity_what_id: patient.id,
        created_at: now,
      });
    }
  }

  await batchInsert(trx, 'provenance', provenanceRows);
  console.log(`  - provenance: ${provenanceRows.length} rows`);

  // ----- AUDIT EVENTS -----
  // Must build hash chain sequentially - insert one at a time

  // First, drop the append-only rules
  await trx.raw('DROP RULE IF EXISTS audit_events_no_update ON audit_events');
  await trx.raw('DROP RULE IF EXISTS audit_events_no_delete ON audit_events');

  const numAuditEvents = 1000;
  let previousHash = '0'.repeat(64); // Genesis hash

  // Generate session IDs for users
  const sessionMap = new Map<string, string>();
  for (const userId of users.allUserIds.slice(0, 20)) {
    sessionMap.set(userId, crypto.randomBytes(32).toString('hex'));
  }

  // Generate sorted timestamps for the audit trail
  const timestamps: Date[] = [];
  for (let i = 0; i < numAuditEvents; i++) {
    timestamps.push(rng.randomDate(dateStart, dateEnd));
  }
  timestamps.sort((a, b) => a.getTime() - b.getTime());

  console.log(`  - audit_events: inserting ${numAuditEvents} rows sequentially...`);

  for (let i = 0; i < numAuditEvents; i++) {
    const id = crypto.randomUUID();
    const timestamp = timestamps[i].toISOString();
    const userId = rng.pick(users.allUserIds.slice(0, 20));
    const sessionId = sessionMap.get(userId) || crypto.randomBytes(32).toString('hex');
    const userAgent = rng.pick(USER_AGENTS);
    const ipAddress = rng.pick(IP_ADDRESSES);

    // Determine action and resource
    let action: string;
    let resourceType: string | null;
    let resourceId: string | null;
    let endpoint: string;
    let method: string;
    let statusCode: number;
    let userRole: string;

    // Determine user role
    if (users.physicians.includes(userId)) {
      userRole = 'PHYSICIAN';
    } else if (users.nurses.includes(userId)) {
      userRole = 'NURSE';
    } else if (users.admins.includes(userId) || users.systemAdmins.includes(userId)) {
      userRole = 'ADMIN';
    } else {
      userRole = 'FRONT_DESK';
    }

    const actionRoll = rng.random();
    if (actionRoll < 0.05) {
      // LOGIN
      action = 'LOGIN';
      resourceType = null;
      resourceId = null;
      endpoint = '/api/auth/login';
      method = 'POST';
      statusCode = 200;
    } else if (actionRoll < 0.08) {
      // LOGOUT
      action = 'LOGOUT';
      resourceType = null;
      resourceId = null;
      endpoint = '/api/auth/logout';
      method = 'POST';
      statusCode = 200;
    } else if (actionRoll < 0.50) {
      // READ
      action = 'READ';
      resourceType = rng.pick([...RESOURCE_TYPES]);
      resourceId = rng.pick(patients.patients).id;
      endpoint = `${ENDPOINTS_BY_RESOURCE[resourceType] || '/api/unknown'}/${resourceId}`;
      method = 'GET';
      statusCode = 200;
    } else if (actionRoll < 0.75) {
      // CREATE
      action = 'CREATE';
      resourceType = rng.pick([...RESOURCE_TYPES]);
      resourceId = crypto.randomUUID();
      endpoint = ENDPOINTS_BY_RESOURCE[resourceType] || '/api/unknown';
      method = 'POST';
      statusCode = 201;
    } else {
      // UPDATE
      action = 'UPDATE';
      resourceType = rng.pick([...RESOURCE_TYPES]);
      resourceId = rng.pick(patients.patients).id;
      endpoint = `${ENDPOINTS_BY_RESOURCE[resourceType] || '/api/unknown'}/${resourceId}`;
      method = 'PUT';
      statusCode = 200;
    }

    // Compute hash
    const hashPayload = [
      id, timestamp, userId, action, resourceType || '',
      resourceId || '', endpoint, method, String(statusCode),
      sessionId, previousHash,
    ].join('|');

    const hash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    // Insert one at a time to maintain hash chain order
    await trx('audit_events').insert({
      id,
      timestamp,
      user_id: userId,
      user_role: userRole,
      ip_address: ipAddress,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      endpoint,
      http_method: method,
      status_code: statusCode,
      old_value_encrypted: null,
      new_value_encrypted: null,
      old_value_iv: null,
      new_value_iv: null,
      old_value_tag: null,
      new_value_tag: null,
      clinical_context: resourceType ? `${action} ${resourceType}` : null,
      user_agent: userAgent,
      session_id: sessionId,
      hash_previous: previousHash,
      hash,
      created_at: now,
    });

    previousHash = hash;

    // Log progress every 200 rows
    if ((i + 1) % 200 === 0) {
      console.log(`    ... ${i + 1}/${numAuditEvents} audit events inserted`);
    }
  }

  // Recreate the append-only rules
  await trx.raw('CREATE RULE audit_events_no_update AS ON UPDATE TO audit_events DO INSTEAD NOTHING');
  await trx.raw('CREATE RULE audit_events_no_delete AS ON DELETE TO audit_events DO INSTEAD NOTHING');

  console.log(`  - audit_events: ${numAuditEvents} rows (hash chain complete)`);
}
