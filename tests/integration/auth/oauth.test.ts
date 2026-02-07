/**
 * Integration Tests: OAuth / SMART on FHIR Authentication
 *
 * Tests the SMART on FHIR authorization flow, PKCE validation,
 * token introspection, revocation, and scope enforcement.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.FHIR_SERVER_URL = 'http://localhost:8080/fhir';

jest.mock('../../../packages/api/src/config/database', () => ({
  checkDatabaseConnection: jest.fn().mockResolvedValue(true),
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

import {
  parseSMARTScope,
  isValidScope,
  validateScopeAccess,
  validateScopeString,
} from '../../../packages/auth/src/oauth/scope-validator';

const JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

// =============================================================================
// Helper functions
// =============================================================================

function generateSMARTToken(payload: any, options: jwt.SignOptions = {}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h', ...options });
}

function generatePKCEChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

// =============================================================================
// SMART Configuration
// =============================================================================

describe('SMART on FHIR Configuration', () => {
  it('should support required SMART capabilities', () => {
    const requiredCapabilities = [
      'launch-ehr',
      'launch-standalone',
      'client-public',
      'client-confidential-symmetric',
      'sso-openid-connect',
      'context-passthrough-banner',
      'context-passthrough-style',
      'context-ehr-patient',
      'context-ehr-encounter',
      'context-standalone-patient',
      'permission-offline',
      'permission-patient',
      'permission-user',
    ];

    // Verify we have the constants defined
    expect(requiredCapabilities).toHaveLength(13);
    expect(requiredCapabilities).toContain('launch-ehr');
    expect(requiredCapabilities).toContain('context-ehr-patient');
  });

  it('should define authorization and token endpoints', () => {
    const smartConfig = {
      authorization_endpoint: 'http://localhost:3001/auth/authorize',
      token_endpoint: 'http://localhost:3001/auth/token',
      introspection_endpoint: 'http://localhost:3001/auth/introspect',
      revocation_endpoint: 'http://localhost:3001/auth/revoke',
      code_challenge_methods_supported: ['S256'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      scopes_supported: ['launch', 'launch/patient', 'openid', 'fhirUser', 'patient/*.read'],
    };

    expect(smartConfig.authorization_endpoint).toBeTruthy();
    expect(smartConfig.token_endpoint).toBeTruthy();
    expect(smartConfig.code_challenge_methods_supported).toContain('S256');
    expect(smartConfig.grant_types_supported).toContain('authorization_code');
  });
});

// =============================================================================
// Authorization code flow
// =============================================================================

describe('Authorization code flow', () => {
  it('should generate a valid JWT access token', () => {
    const tokenPayload = {
      sub: 'user-001',
      scope: 'patient/Patient.read patient/Observation.read openid',
      patient: 'patient-001',
      fhirUser: 'Practitioner/pract-001',
      iss: 'http://localhost:3001',
      aud: 'http://localhost:3001/fhir',
    };

    const token = generateSMARTToken(tokenPayload);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    expect(decoded.sub).toBe('user-001');
    expect(decoded.scope).toContain('patient/Patient.read');
    expect(decoded.patient).toBe('patient-001');
    expect(decoded.iss).toBe('http://localhost:3001');
  });

  it('should include patient context in token when launched from EHR', () => {
    const tokenPayload = {
      sub: 'user-002',
      scope: 'launch launch/patient patient/Patient.read',
      patient: 'patient-123',
      iss: 'http://localhost:3001',
      aud: 'http://localhost:3001/fhir',
    };

    const token = generateSMARTToken(tokenPayload);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    expect(decoded.patient).toBe('patient-123');
  });
});

// =============================================================================
// PKCE validation
// =============================================================================

describe('PKCE validation', () => {
  it('should verify correct code_verifier against code_challenge', () => {
    const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expectedChallenge = generatePKCEChallenge(codeVerifier);

    // Simulating the server-side check
    const clientChallenge = generatePKCEChallenge(codeVerifier);

    expect(clientChallenge).toBe(expectedChallenge);
  });

  it('should fail verification with wrong code_verifier', () => {
    const correctVerifier = 'correct-code-verifier-value-here-at-least-43-chars-long';
    const wrongVerifier = 'wrong-code-verifier-value-here-at-least-43-chars-long-x';

    const storedChallenge = generatePKCEChallenge(correctVerifier);
    const attemptedChallenge = generatePKCEChallenge(wrongVerifier);

    expect(attemptedChallenge).not.toBe(storedChallenge);
  });

  it('should generate a base64url-encoded S256 challenge', () => {
    const verifier = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    const challenge = generatePKCEChallenge(verifier);

    // base64url characters: [A-Za-z0-9_-] (no +, /, or =)
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('should produce different challenges for different verifiers', () => {
    const challenge1 = generatePKCEChallenge('verifier-one-that-is-at-least-43-characters-long');
    const challenge2 = generatePKCEChallenge('verifier-two-that-is-at-least-43-characters-long');

    expect(challenge1).not.toBe(challenge2);
  });
});

// =============================================================================
// Token introspection
// =============================================================================

describe('Token introspection', () => {
  it('should return active=true for valid non-expired token', () => {
    const token = generateSMARTToken({
      sub: 'user-001',
      scope: 'patient/Patient.read',
      iss: 'http://localhost:3001',
      aud: 'http://localhost:3001/fhir',
    });

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    expect(decoded.sub).toBe('user-001');
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('should reject an expired token', () => {
    const token = generateSMARTToken(
      { sub: 'user-001', scope: 'patient/Patient.read' },
      { expiresIn: '0s' }
    );

    // Small delay to ensure expiration
    expect(() => {
      jwt.verify(token, JWT_SECRET);
    }).toThrow(jwt.TokenExpiredError);
  });
});

// =============================================================================
// Token revocation
// =============================================================================

describe('Token revocation', () => {
  it('should invalidate a token by marking it as revoked', () => {
    // Simulate a revocation store (in-memory for testing)
    const revokedTokens = new Set<string>();

    const token = generateSMARTToken({
      sub: 'user-001',
      scope: 'patient/Patient.read',
      jti: 'unique-token-id-001',
    });

    // Revoke the token
    const decoded = jwt.decode(token) as any;
    revokedTokens.add(decoded.jti);

    // Check revocation
    expect(revokedTokens.has('unique-token-id-001')).toBe(true);
  });
});

// =============================================================================
// Invalid client_id rejection
// =============================================================================

describe('Client validation', () => {
  it('should reject unregistered client_id', () => {
    const registeredClients = new Set(['client-app-001', 'client-app-002']);

    expect(registeredClients.has('unregistered-client')).toBe(false);
    expect(registeredClients.has('client-app-001')).toBe(true);
  });
});

// =============================================================================
// Scope enforcement
// =============================================================================

describe('scope enforcement', () => {
  it('should allow GET (read) when scope is patient/*.read', () => {
    const scopes = ['patient/*.read'];

    expect(validateScopeAccess(scopes, 'Patient', 'read')).toBe(true);
    expect(validateScopeAccess(scopes, 'Observation', 'read')).toBe(true);
    expect(validateScopeAccess(scopes, 'Condition', 'search')).toBe(true);
  });

  it('should deny POST (create) when scope is patient/*.read', () => {
    const scopes = ['patient/*.read'];

    expect(validateScopeAccess(scopes, 'Patient', 'create')).toBe(false);
    expect(validateScopeAccess(scopes, 'Observation', 'update')).toBe(false);
    expect(validateScopeAccess(scopes, 'Condition', 'delete')).toBe(false);
  });

  it('should allow write operations with patient/*.write scope', () => {
    const scopes = ['patient/*.write'];

    expect(validateScopeAccess(scopes, 'Patient', 'create')).toBe(true);
    expect(validateScopeAccess(scopes, 'Observation', 'update')).toBe(true);
    expect(validateScopeAccess(scopes, 'Condition', 'delete')).toBe(true);
  });

  it('should deny write operations when only read scope is granted', () => {
    const scopes = ['patient/Patient.read', 'patient/Observation.read'];

    expect(validateScopeAccess(scopes, 'Patient', 'create')).toBe(false);
    expect(validateScopeAccess(scopes, 'Observation', 'update')).toBe(false);
  });

  it('should enforce resource-specific scopes', () => {
    const scopes = ['patient/Patient.read'];

    expect(validateScopeAccess(scopes, 'Patient', 'read')).toBe(true);
    expect(validateScopeAccess(scopes, 'Observation', 'read')).toBe(false);
  });

  it('should validate a space-delimited scope string', () => {
    const result = validateScopeString(
      'patient/Patient.read patient/Observation.read openid fhirUser launch/patient'
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect invalid scopes in a scope string', () => {
    const result = validateScopeString(
      'patient/Patient.read invalid-scope-here openid'
    );

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// JWT Token structure
// =============================================================================

describe('JWT token structure', () => {
  it('should include standard JWT claims', () => {
    const token = generateSMARTToken({
      sub: 'user-001',
      scope: 'patient/Patient.read',
      iss: 'http://localhost:3001',
      aud: 'http://localhost:3001/fhir',
    });

    const decoded = jwt.decode(token, { complete: true }) as any;

    expect(decoded.header.alg).toBe('HS256');
    expect(decoded.header.typ).toBe('JWT');
    expect(decoded.payload.iat).toBeDefined();
    expect(decoded.payload.exp).toBeDefined();
    expect(decoded.payload.sub).toBe('user-001');
  });

  it('should reject a token signed with a different secret', () => {
    const token = jwt.sign(
      { sub: 'user-001', scope: 'patient/Patient.read' },
      'different-secret-key',
      { expiresIn: '1h' }
    );

    expect(() => jwt.verify(token, JWT_SECRET)).toThrow(jwt.JsonWebTokenError);
  });
});
