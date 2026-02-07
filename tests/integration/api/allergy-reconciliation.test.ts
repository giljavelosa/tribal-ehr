/**
 * Integration Tests: Allergy Reconciliation API
 *
 * Tests the POST /allergies/reconcile endpoint via supertest.
 * Covers: authentication, validation, reconciliation actions
 * (continue, modify, remove).
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
  permissions: ['allergies:read', 'allergies:write', 'allergies:*'],
  organizationId: 'org-001',
  sessionId: 'session-001',
};

const viewOnlyUser = {
  id: 'user-view-001',
  email: 'viewer@tribal-ehr.org',
  role: 'VIEWER',
  permissions: ['allergies:read'],
  organizationId: 'org-001',
  sessionId: 'session-002',
};

beforeAll(async () => {
  const supertest = await import('supertest');
  request = supertest.default;
  app = createApp();
});

describe('Allergy Reconciliation API Integration Tests', () => {
  const physicianToken = generateToken(physicianUser);
  const viewerToken = generateToken(viewOnlyUser);

  const validPayload = {
    patientId: '550e8400-e29b-41d4-a716-446655440000',
    allergies: [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        action: 'continue',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        action: 'modify',
        criticality: 'high',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        action: 'remove',
      },
    ],
  };

  // ===========================================================================
  // Authentication & Authorization
  // ===========================================================================

  describe('authentication', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/v1/allergies/reconcile')
        .send(validPayload);

      expect(res.status).toBe(401);
    });

    it('should accept valid physician token', async () => {
      const res = await request(app)
        .post('/api/v1/allergies/reconcile')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send(validPayload);

      expect(res.status).not.toBe(401);
    });
  });

  // ===========================================================================
  // Validation
  // ===========================================================================

  describe('validation', () => {
    it('should reject missing patientId', async () => {
      const res = await request(app)
        .post('/api/v1/allergies/reconcile')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          allergies: [{ action: 'continue' }],
        });

      expect(res.status).toBe(400);
    });

    it('should reject non-uuid patientId', async () => {
      const res = await request(app)
        .post('/api/v1/allergies/reconcile')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          patientId: 'not-a-uuid',
          allergies: [{ action: 'continue' }],
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid action', async () => {
      const res = await request(app)
        .post('/api/v1/allergies/reconcile')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          patientId: '550e8400-e29b-41d4-a716-446655440000',
          allergies: [{ id: '550e8400-e29b-41d4-a716-446655440001', action: 'invalid-action' }],
        });

      expect(res.status).toBe(400);
    });

    it('should reject missing allergies field', async () => {
      const res = await request(app)
        .post('/api/v1/allergies/reconcile')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          patientId: '550e8400-e29b-41d4-a716-446655440000',
        });

      expect(res.status).toBe(400);
    });
  });

  // ===========================================================================
  // Reconciliation flow
  // ===========================================================================

  describe('reconciliation actions', () => {
    it('should accept continue action', async () => {
      const res = await request(app)
        .post('/api/v1/allergies/reconcile')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          patientId: '550e8400-e29b-41d4-a716-446655440000',
          allergies: [{ id: '550e8400-e29b-41d4-a716-446655440001', action: 'continue' }],
        });

      // Auth + validation pass; service processes via mock db
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(400);
    });

    it('should accept modify action with updates', async () => {
      const res = await request(app)
        .post('/api/v1/allergies/reconcile')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          patientId: '550e8400-e29b-41d4-a716-446655440000',
          allergies: [{
            id: '550e8400-e29b-41d4-a716-446655440001',
            action: 'modify',
            criticality: 'high',
          }],
        });

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(400);
    });

    it('should accept remove action', async () => {
      const res = await request(app)
        .post('/api/v1/allergies/reconcile')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({
          patientId: '550e8400-e29b-41d4-a716-446655440000',
          allergies: [{ id: '550e8400-e29b-41d4-a716-446655440001', action: 'remove' }],
        });

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(400);
    });

    it('should accept mixed actions in a single reconciliation', async () => {
      const res = await request(app)
        .post('/api/v1/allergies/reconcile')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send(validPayload);

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(400);
    });
  });
});
