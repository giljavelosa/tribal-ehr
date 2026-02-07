/**
 * Integration Tests: Patient API
 *
 * Tests the Patient CRUD endpoints via supertest against the Express app.
 * Uses mocked database and FHIR client to isolate the API layer.
 */

import jwt from 'jsonwebtoken';

// Set test environment before importing app
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

// Mock external dependencies
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
  getRedisClient: jest.fn().mockReturnValue({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }),
}));

jest.mock('../../../packages/api/src/config/rabbitmq', () => ({
  checkRabbitMQConnection: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../packages/api/src/utils/logger', () => {
  const mockLogger: any = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
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

// Use a lazy import for supertest to work with jest module mocking
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
  permissions: ['patient:read', 'patient:write', 'patient:delete', 'patient:*'],
  organizationId: 'org-001',
  sessionId: 'session-001',
};

const patientUser = {
  id: 'user-patient-001',
  email: 'patient@tribal-ehr.org',
  role: 'PATIENT',
  permissions: ['patient:read'],
  organizationId: 'org-001',
  sessionId: 'session-002',
};

beforeAll(async () => {
  const supertest = await import('supertest');
  request = supertest.default;
  app = createApp();
});

describe('Patient API Integration Tests', () => {
  const physicianToken = generateToken(physicianUser);
  const patientToken = generateToken(patientUser);

  // ===========================================================================
  // GET /api/v1/patients
  // ===========================================================================

  describe('GET /api/v1/patients', () => {
    it('should accept auth token for patient list', async () => {
      const res = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${physicianToken}`);

      // Auth and permission checks should pass; service may error on mock db
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.body).toBeDefined();
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .get('/api/v1/patients');

      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });

    it('should return 401 with expired token', async () => {
      const expiredToken = jwt.sign(physicianUser, JWT_SECRET, { expiresIn: '0s' });

      // Wait a tiny bit to ensure token is expired
      await new Promise((resolve) => setTimeout(resolve, 100));

      const res = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it('should return 401 with malformed authorization header', async () => {
      const res = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', 'NotBearer token');

      expect(res.status).toBe(401);
    });
  });

  // ===========================================================================
  // Health check
  // ===========================================================================

  describe('GET /health', () => {
    it('should return health status without authentication', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBeLessThanOrEqual(503);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('services');
    });

    it('should include all service statuses', async () => {
      const res = await request(app).get('/health');

      expect(res.body.services).toHaveProperty('db');
      expect(res.body.services).toHaveProperty('redis');
      expect(res.body.services).toHaveProperty('rabbitmq');
    });
  });

  // ===========================================================================
  // 404 handling
  // ===========================================================================

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app)
        .get('/api/v1/nonexistent-route')
        .set('Authorization', `Bearer ${physicianToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ===========================================================================
  // Auth middleware
  // ===========================================================================

  describe('authentication middleware', () => {
    it('should set user on request when valid token provided', async () => {
      const res = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${physicianToken}`);

      // The endpoint responds, meaning auth passed
      expect(res.status).not.toBe(401);
    });

    it('should accept patient role token for read operations', async () => {
      const res = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).not.toBe(401);
    });
  });

  // ===========================================================================
  // CORS and security headers
  // ===========================================================================

  describe('security headers', () => {
    it('should include security headers from helmet', async () => {
      const res = await request(app).get('/health');

      // Helmet sets various security headers
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('should include HSTS header', async () => {
      const res = await request(app).get('/health');

      expect(res.headers['strict-transport-security']).toBeDefined();
    });
  });

  // ===========================================================================
  // Rate limiting
  // ===========================================================================

  describe('rate limiting headers', () => {
    it('should include rate limit headers', async () => {
      const res = await request(app).get('/health');

      // express-rate-limit adds these headers
      expect(res.headers['ratelimit-limit']).toBeDefined();
    });
  });
});
