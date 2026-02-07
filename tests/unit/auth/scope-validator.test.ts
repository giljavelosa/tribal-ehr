/**
 * Unit Tests: SMART on FHIR Scope Validator
 *
 * Tests for /packages/auth/src/oauth/scope-validator.ts
 * Covers: scope parsing, validation, access checking, and filtering.
 */

import {
  parseSMARTScope,
  isValidScope,
  validateScopeAccess,
  validateScopeString,
  filterResourceByScopes,
} from '../../../packages/auth/src/oauth/scope-validator';

// =============================================================================
// parseSMARTScope
// =============================================================================

describe('parseSMARTScope', () => {
  it('should parse "patient/Patient.read" correctly', () => {
    const parsed = parseSMARTScope('patient/Patient.read');

    expect(parsed).not.toBeNull();
    expect(parsed!.context).toBe('patient');
    expect(parsed!.resourceType).toBe('Patient');
    expect(parsed!.interactions).toContain('read');
    expect(parsed!.interactions).toContain('search');
  });

  it('should parse "user/*.write" with wildcard resource type', () => {
    const parsed = parseSMARTScope('user/*.write');

    expect(parsed).not.toBeNull();
    expect(parsed!.context).toBe('user');
    expect(parsed!.resourceType).toBe('*');
    expect(parsed!.interactions).toContain('create');
    expect(parsed!.interactions).toContain('update');
    expect(parsed!.interactions).toContain('delete');
  });

  it('should parse "system/Observation.cruds" with all interactions expanded', () => {
    const parsed = parseSMARTScope('system/Observation.cruds');

    expect(parsed).not.toBeNull();
    expect(parsed!.context).toBe('system');
    expect(parsed!.resourceType).toBe('Observation');
    expect(parsed!.interactions).toEqual(
      expect.arrayContaining(['create', 'read', 'update', 'delete', 'search'])
    );
  });

  it('should return null for special scope "launch/patient"', () => {
    const parsed = parseSMARTScope('launch/patient');

    expect(parsed).toBeNull();
  });

  it('should return null for special scope "openid"', () => {
    const parsed = parseSMARTScope('openid');

    expect(parsed).toBeNull();
  });

  it('should throw for invalid scope format', () => {
    expect(() => parseSMARTScope('invalid-scope')).toThrow('Invalid SMART scope format');
  });

  it('should throw for unknown FHIR resource type', () => {
    expect(() => parseSMARTScope('patient/FakeResource.read')).toThrow('Unknown FHIR resource type');
  });

  it('should throw for invalid interaction', () => {
    expect(() => parseSMARTScope('patient/Patient.invalid')).toThrow('Invalid interaction');
  });

  it('should throw for empty scope', () => {
    expect(() => parseSMARTScope('')).toThrow();
  });
});

// =============================================================================
// isValidScope
// =============================================================================

describe('isValidScope', () => {
  it('should return true for "patient/Patient.read"', () => {
    expect(isValidScope('patient/Patient.read')).toBe(true);
  });

  it('should return true for "user/*.read"', () => {
    expect(isValidScope('user/*.read')).toBe(true);
  });

  it('should return true for "launch/patient"', () => {
    expect(isValidScope('launch/patient')).toBe(true);
  });

  it('should return true for "openid"', () => {
    expect(isValidScope('openid')).toBe(true);
  });

  it('should return true for "fhirUser"', () => {
    expect(isValidScope('fhirUser')).toBe(true);
  });

  it('should return true for "offline_access"', () => {
    expect(isValidScope('offline_access')).toBe(true);
  });

  it('should return false for invalid scope format', () => {
    expect(isValidScope('totally-invalid')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidScope('')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isValidScope(null as any)).toBe(false);
  });
});

// =============================================================================
// validateScopeAccess
// =============================================================================

describe('validateScopeAccess', () => {
  describe('patient-level scopes', () => {
    it('should allow Patient read with "patient/Patient.read"', () => {
      const result = validateScopeAccess(['patient/Patient.read'], 'Patient', 'read');
      expect(result).toBe(true);
    });

    it('should deny Patient write (create) with "patient/Patient.read"', () => {
      const result = validateScopeAccess(['patient/Patient.read'], 'Patient', 'create');
      expect(result).toBe(false);
    });

    it('should allow Patient search with "patient/Patient.read" (read expands to search)', () => {
      const result = validateScopeAccess(['patient/Patient.read'], 'Patient', 'search');
      expect(result).toBe(true);
    });

    it('should deny Observation read with "patient/Patient.read" (wrong resource)', () => {
      const result = validateScopeAccess(['patient/Patient.read'], 'Observation', 'read');
      expect(result).toBe(false);
    });
  });

  describe('wildcard resource scopes', () => {
    it('should allow any resource read with "user/*.read"', () => {
      expect(validateScopeAccess(['user/*.read'], 'Patient', 'read')).toBe(true);
      expect(validateScopeAccess(['user/*.read'], 'Observation', 'read')).toBe(true);
      expect(validateScopeAccess(['user/*.read'], 'Condition', 'search')).toBe(true);
    });

    it('should allow any resource write with "user/*.write"', () => {
      expect(validateScopeAccess(['user/*.write'], 'Patient', 'create')).toBe(true);
      expect(validateScopeAccess(['user/*.write'], 'Observation', 'update')).toBe(true);
      expect(validateScopeAccess(['user/*.write'], 'Condition', 'delete')).toBe(true);
    });

    it('should deny write with "user/*.read" (wrong interaction)', () => {
      expect(validateScopeAccess(['user/*.read'], 'Patient', 'create')).toBe(false);
    });
  });

  describe('multiple scopes', () => {
    it('should check all scopes and allow if any match', () => {
      const scopes = ['patient/Patient.read', 'patient/Observation.write'];

      expect(validateScopeAccess(scopes, 'Patient', 'read')).toBe(true);
      expect(validateScopeAccess(scopes, 'Observation', 'create')).toBe(true);
    });

    it('should deny if no scopes match', () => {
      const scopes = ['patient/Patient.read', 'patient/Observation.read'];

      expect(validateScopeAccess(scopes, 'Condition', 'read')).toBe(false);
    });
  });

  describe('special scopes do not grant resource access', () => {
    it('should deny resource access with only special scopes', () => {
      const scopes = ['launch/patient', 'openid', 'fhirUser'];

      expect(validateScopeAccess(scopes, 'Patient', 'read')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false for empty scopes array', () => {
      expect(validateScopeAccess([], 'Patient', 'read')).toBe(false);
    });

    it('should return false for empty resource type', () => {
      expect(validateScopeAccess(['patient/Patient.read'], '', 'read')).toBe(false);
    });

    it('should return false for empty action', () => {
      expect(validateScopeAccess(['patient/Patient.read'], 'Patient', '')).toBe(false);
    });
  });
});

// =============================================================================
// validateScopeString
// =============================================================================

describe('validateScopeString', () => {
  it('should validate a valid space-delimited scope string', () => {
    const result = validateScopeString('patient/Patient.read patient/Observation.read openid');

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should report errors for invalid scopes in the string', () => {
    const result = validateScopeString('patient/Patient.read invalid-scope openid');

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0]).toContain('invalid-scope');
  });

  it('should fail for empty string', () => {
    const result = validateScopeString('');

    expect(result.valid).toBe(false);
  });
});

// =============================================================================
// filterResourceByScopes
// =============================================================================

describe('filterResourceByScopes', () => {
  it('should return the resource if read access is granted', () => {
    const resource = { resourceType: 'Patient', id: '123', name: [{ family: 'Doe' }] };
    const result = filterResourceByScopes(resource, ['patient/Patient.read']);

    expect(result).not.toBeNull();
    expect(result!.resourceType).toBe('Patient');
  });

  it('should return null if no read access is granted', () => {
    const resource = { resourceType: 'Patient', id: '123' };
    const result = filterResourceByScopes(resource, ['patient/Observation.read']);

    expect(result).toBeNull();
  });

  it('should return null for a resource without resourceType', () => {
    const resource = { id: '123' };
    const result = filterResourceByScopes(resource, ['patient/Patient.read']);

    expect(result).toBeNull();
  });

  it('should return null for null resource', () => {
    const result = filterResourceByScopes(null as any, ['patient/Patient.read']);

    expect(result).toBeNull();
  });

  it('should allow access with wildcard scope', () => {
    const resource = { resourceType: 'Observation', id: '456' };
    const result = filterResourceByScopes(resource, ['user/*.read']);

    expect(result).not.toBeNull();
  });
});
