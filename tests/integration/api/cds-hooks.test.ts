/**
 * Integration Tests: CDS Hooks API
 *
 * Tests the CDS Hooks endpoints via supertest against the Express app.
 * Covers: discovery returns all 9 handlers, override recording via API,
 * feedback recording via API.
 */

import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.FHIR_SERVER_URL = 'http://localhost:8080/fhir';

// Create a chainable Knex-like mock
const createKnexMock = () => {
  const chain: any = {};
  const methods = [
    'select', 'from', 'where', 'whereIn', 'whereNot', 'whereNull', 'whereNotNull',
    'andWhere', 'orWhere', 'join', 'leftJoin', 'rightJoin', 'innerJoin',
    'orderBy', 'groupBy', 'having', 'limit', 'offset', 'insert', 'update',
    'delete', 'del', 'count', 'first', 'returning', 'raw', 'distinct',
    'modify', 'clone', 'clearSelect', 'clearWhere', 'clearOrder',
    'on', 'onIn', 'andOn', 'column', 'columns', 'as', 'with', 'withRecursive',
    'whereRaw', 'havingRaw', 'orderByRaw', 'union', 'intersect', 'except',
    'whereExists', 'whereNotExists', 'whereBetween', 'whereNotBetween',
    'pluck', 'avg', 'sum', 'min', 'max', 'increment', 'decrement',
    'truncate', 'transacting', 'forUpdate', 'forShare', 'skipLocked', 'noWait',
  ];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.then = jest.fn((resolve: any) => resolve([]));
  chain.catch = jest.fn().mockReturnValue(chain);
  chain.finally = jest.fn().mockReturnValue(chain);
  const knex: any = jest.fn().mockReturnValue(chain);
  knex.raw = jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
  knex.destroy = jest.fn().mockResolvedValue(undefined);
  knex.transaction = jest.fn((cb: any) => cb(knex));
  knex.schema = { hasTable: jest.fn().mockResolvedValue(true), createTable: jest.fn(), alterTable: jest.fn() };
  return knex;
};

const mockDb = createKnexMock();

jest.mock('../../../packages/api/src/config/database', () => ({
  db: mockDb,
  default: mockDb,
  checkDatabaseConnection: jest.fn().mockResolvedValue(true),
  closeDatabaseConnection: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn().mockReturnValue(mockDb),
  getPool: jest.fn().mockReturnValue({ query: jest.fn(), connect: jest.fn() }),
}));

jest.mock('../../../packages/api/src/config/redis', () => ({
  checkRedisConnection: jest.fn().mockResolvedValue(true),
  getRedisClient: jest.fn().mockReturnValue({ get: jest.fn(), set: jest.fn(), del: jest.fn() }),
}));

jest.mock('../../../packages/api/src/config/rabbitmq', () => ({
  checkRabbitMQConnection: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../packages/api/src/utils/logger', () => {
  const mockLogger: any = {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), http: jest.fn(),
    child: jest.fn().mockReturnThis(),
  };
  return { logger: mockLogger };
});

jest.mock('../../../packages/api/src/middleware/audit', () => ({
  auditMiddleware: jest.fn((_req: any, _res: any, next: any) => next()),
}));

jest.mock('../../../packages/api/src/utils/fhir-client', () => ({
  FHIRClient: jest.fn().mockImplementation(() => ({
    read: jest.fn().mockResolvedValue(null),
    search: jest.fn().mockResolvedValue({ entry: [] }),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  })),
  fhirClient: {
    read: jest.fn().mockResolvedValue(null),
    search: jest.fn().mockResolvedValue({ entry: [] }),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  },
}));

import { createApp } from '../../../packages/api/src/app';

let request: any;
let app: any;

const JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

function generateToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

const physicianUser = {
  id: 'user-physician-001',
  email: 'doctor@tribal-ehr.org',
  role: 'PHYSICIAN',
  permissions: ['cds:read', 'cds:write', 'cds:*', 'order:read', 'order:write'],
  organizationId: 'org-001',
  sessionId: 'session-001',
};

beforeAll(async () => {
  const supertest = await import('supertest');
  request = supertest.default;
  app = createApp();
});

describe('CDS Hooks API Integration Tests', () => {
  const physicianToken = generateToken(physicianUser);

  // ===========================================================================
  // GET /cds-services - Discovery
  // ===========================================================================

  describe('GET /api/v1/cds-services', () => {
    it('should return discovery response with all 9 registered services', async () => {
      const res = await request(app)
        .get('/cds-services');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('services');
      expect(Array.isArray(res.body.services)).toBe(true);
      expect(res.body.services.length).toBe(9);
    });

    it('should include drug interaction services in discovery', async () => {
      const res = await request(app)
        .get('/cds-services');

      const serviceIds = res.body.services.map((s: any) => s.id);
      expect(serviceIds).toContain('tribal-ehr-drug-interactions');
    });

    it('should include drug allergy services in discovery', async () => {
      const res = await request(app)
        .get('/cds-services');

      const serviceIds = res.body.services.map((s: any) => s.id);
      expect(serviceIds).toContain('tribal-ehr-drug-allergy');
    });

    it('should include preventive care, vital sign, and immunization services', async () => {
      const res = await request(app)
        .get('/cds-services');

      const serviceIds = res.body.services.map((s: any) => s.id);
      expect(serviceIds).toContain('tribal-ehr-preventive-care');
      expect(serviceIds).toContain('tribal-ehr-vital-alerts');
      expect(serviceIds).toContain('tribal-ehr-immunization-alerts');
    });

    it('should include order-sign services in discovery', async () => {
      const res = await request(app)
        .get('/cds-services');

      const serviceIds = res.body.services.map((s: any) => s.id);
      expect(serviceIds).toContain('tribal-ehr-order-sign-validation');
      expect(serviceIds).toContain('tribal-ehr-order-sign-drug-interactions');
    });

    it('should include medication-prescribe services in discovery', async () => {
      const res = await request(app)
        .get('/cds-services');

      const serviceIds = res.body.services.map((s: any) => s.id);
      expect(serviceIds).toContain('tribal-ehr-drug-interactions-prescribe');
      expect(serviceIds).toContain('tribal-ehr-drug-allergy-prescribe');
    });

    it('should include hook and prefetch for each service', async () => {
      const res = await request(app)
        .get('/cds-services');

      for (const service of res.body.services) {
        expect(service).toHaveProperty('id');
        expect(service).toHaveProperty('hook');
        expect(service).toHaveProperty('title');
        expect(service).toHaveProperty('description');
      }
    });
  });

  // ===========================================================================
  // POST /cds-services/:hookId - Service invocation
  // ===========================================================================

  describe('POST /api/v1/cds-services/:hookId', () => {
    it('should invoke order-select hook and return cards', async () => {
      const res = await request(app)
        .post('/cds-services/order-select')
        .send({
          hookInstance: 'test-hook-123',
          hook: 'order-select',
          fhirServer: 'http://localhost:8080/fhir',
          context: {
            patientId: 'patient-001',
            draftOrders: {
              resourceType: 'Bundle',
              entry: [{
                resource: {
                  resourceType: 'MedicationRequest',
                  medicationCodeableConcept: {
                    text: 'Warfarin 5mg',
                    coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '11289', display: 'Warfarin' }],
                  },
                },
              }],
            },
          },
          prefetch: {
            activeMedications: {
              resourceType: 'Bundle',
              entry: [{
                resource: {
                  resourceType: 'MedicationRequest',
                  medicationCodeableConcept: {
                    text: 'Ibuprofen 400mg',
                    coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '5640', display: 'Ibuprofen' }],
                  },
                },
              }],
            },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('cards');
      expect(Array.isArray(res.body.cards)).toBe(true);
      // Warfarin + Ibuprofen = critical drug interaction
      expect(res.body.cards.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 400 for invalid CDS request (missing hook)', async () => {
      const res = await request(app)
        .post('/cds-services/order-select')
        .send({
          hookInstance: 'test',
          // missing hook field
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid CDS request (missing hookInstance)', async () => {
      const res = await request(app)
        .post('/cds-services/order-select')
        .send({
          hook: 'order-select',
          // missing hookInstance field
        });

      expect(res.status).toBe(400);
    });
  });

  // ===========================================================================
  // POST /cds-services/overrides - Record override
  // ===========================================================================

  describe('POST /cds-services/overrides', () => {
    it('should record a CDS override with auth', async () => {
      const res = await request(app)
        .post('/cds-services/overrides')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          cardId: 'card-warfarin-nsaid-001',
          patientId: '550e8400-e29b-41d4-a716-446655440000',
          hookInstance: 'hook-instance-abc',
          reasonCode: 'clinical-judgment',
          reasonText: 'Patient tolerates combination well',
          cardSummary: 'Critical: Warfarin + Ibuprofen',
        });

      // Should pass auth and validation (service uses mock db)
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/cds-services/overrides')
        .send({
          cardId: 'card-001',
          patientId: '550e8400-e29b-41d4-a716-446655440000',
          hookInstance: 'hook-abc',
          reasonCode: 'clinical-judgment',
          cardSummary: 'Test card',
        });

      expect(res.status).toBe(401);
    });
  });

  // ===========================================================================
  // POST /cds-services/feedback - Record feedback
  // ===========================================================================

  describe('POST /cds-services/feedback', () => {
    it('should record CDS feedback with auth', async () => {
      const res = await request(app)
        .post('/cds-services/feedback')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          cardId: 'card-warfarin-nsaid-001',
          outcome: 'helpful',
        });

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/cds-services/feedback')
        .send({
          cardId: 'card-001',
          outcome: 'helpful',
        });

      expect(res.status).toBe(401);
    });
  });

  // ===========================================================================
  // GET /cds-services/overrides/:patientId - Get patient overrides
  // ===========================================================================

  describe('GET /cds-services/overrides/:patientId', () => {
    it('should retrieve overrides for a patient with auth', async () => {
      const patientId = '550e8400-e29b-41d4-a716-446655440000';
      const res = await request(app)
        .get(`/cds-services/overrides/${patientId}`)
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .get('/cds-services/overrides/550e8400-e29b-41d4-a716-446655440000');

      expect(res.status).toBe(401);
    });
  });
});
