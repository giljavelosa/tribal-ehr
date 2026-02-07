/**
 * Unit Tests: Shared Validation Utilities
 *
 * Tests for /packages/shared/src/utils/validation.ts
 * Covers: validateMRN, validateNPI, validateDEA, validateEmail,
 *         validatePhone, validateDate, validateFHIRId, validateCodeableConcept
 */

import {
  validateMRN,
  validateNPI,
  validateDEA,
  validateEmail,
  validatePhone,
  validateDate,
  validateFHIRId,
  validateCodeableConcept,
} from '../../../packages/shared/src/utils/validation';

// =============================================================================
// validateMRN
// =============================================================================

describe('validateMRN', () => {
  it('should accept a valid hyphenated MRN like TRB-000001', () => {
    expect(validateMRN('TRB-000001')).toBe(true);
  });

  it('should accept a simple alphanumeric MRN', () => {
    expect(validateMRN('MRN123')).toBe(true);
  });

  it('should accept a minimum-length MRN (4 chars)', () => {
    expect(validateMRN('AB12')).toBe(true);
  });

  it('should accept a maximum-length MRN (20 chars)', () => {
    expect(validateMRN('A'.repeat(20))).toBe(true);
  });

  it('should accept an MRN with all hyphens and alphanumeric', () => {
    expect(validateMRN('ABC-DEF-123-456')).toBe(true);
  });

  it('should reject an empty string', () => {
    expect(validateMRN('')).toBe(false);
  });

  it('should reject null/undefined', () => {
    expect(validateMRN(null as any)).toBe(false);
    expect(validateMRN(undefined as any)).toBe(false);
  });

  it('should reject an MRN that is too short (less than 4 chars)', () => {
    expect(validateMRN('AB1')).toBe(false);
  });

  it('should reject an MRN that is too long (more than 20 chars)', () => {
    expect(validateMRN('A'.repeat(21))).toBe(false);
  });

  it('should reject an MRN with special characters', () => {
    expect(validateMRN('MRN@123')).toBe(false);
    expect(validateMRN('MRN#123')).toBe(false);
    expect(validateMRN('MRN 123')).toBe(false);
  });
});

// =============================================================================
// validateNPI
// =============================================================================

describe('validateNPI', () => {
  it('should accept known valid NPI 1234567893', () => {
    expect(validateNPI('1234567893')).toBe(true);
  });

  it('should accept known valid NPI 1245319599', () => {
    expect(validateNPI('1245319599')).toBe(true);
  });

  it('should accept a valid 10-digit NPI passing Luhn check', () => {
    // NPI 1497758544 is a valid NPI
    expect(validateNPI('1497758544')).toBe(true);
  });

  it('should reject known invalid NPI 1234567890 (fails Luhn)', () => {
    expect(validateNPI('1234567890')).toBe(false);
  });

  it('should reject NPI 0000000000 (fails Luhn)', () => {
    expect(validateNPI('0000000000')).toBe(false);
  });

  it('should reject an NPI with wrong length (9 digits)', () => {
    expect(validateNPI('123456789')).toBe(false);
  });

  it('should reject an NPI with wrong length (11 digits)', () => {
    expect(validateNPI('12345678901')).toBe(false);
  });

  it('should reject a non-numeric NPI', () => {
    expect(validateNPI('12345678AB')).toBe(false);
  });

  it('should reject an empty string', () => {
    expect(validateNPI('')).toBe(false);
  });

  it('should reject null/undefined', () => {
    expect(validateNPI(null as any)).toBe(false);
    expect(validateNPI(undefined as any)).toBe(false);
  });
});

// =============================================================================
// validateDEA
// =============================================================================

describe('validateDEA', () => {
  it('should accept a valid DEA number with correct check digit', () => {
    // DEA format: 2 letters + 7 digits, check digit = (sum1 + 2*sum2) % 10
    // AB1234563: sum odd=1+3+5=9, sum even=2+4+6=12, total=9+24=33, check=3
    expect(validateDEA('AB1234563')).toBe(true);
  });

  it('should accept a DEA number starting with registrant type F', () => {
    // FA1234563
    expect(validateDEA('FA1234563')).toBe(true);
  });

  it('should accept a mid-level DEA starting with G', () => {
    expect(validateDEA('GA1234563')).toBe(true);
  });

  it('should accept a mid-level DEA starting with M', () => {
    expect(validateDEA('MA1234563')).toBe(true);
  });

  it('should accept a mid-level DEA starting with R', () => {
    expect(validateDEA('RA1234563')).toBe(true);
  });

  it('should reject a DEA with invalid first letter', () => {
    expect(validateDEA('XA1234563')).toBe(false);
  });

  it('should reject a DEA with wrong check digit', () => {
    expect(validateDEA('AB1234560')).toBe(false);
  });

  it('should reject a DEA with wrong format (too short)', () => {
    expect(validateDEA('AB12345')).toBe(false);
  });

  it('should reject a DEA with wrong format (no letters)', () => {
    expect(validateDEA('123456789')).toBe(false);
  });

  it('should reject empty string', () => {
    expect(validateDEA('')).toBe(false);
  });
});

// =============================================================================
// validateEmail
// =============================================================================

describe('validateEmail', () => {
  it('should accept a standard email address', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('should accept an email with subdomain', () => {
    expect(validateEmail('user@mail.example.com')).toBe(true);
  });

  it('should accept an email with plus sign', () => {
    expect(validateEmail('user+tag@example.com')).toBe(true);
  });

  it('should accept an email with dots in local part', () => {
    expect(validateEmail('first.last@example.com')).toBe(true);
  });

  it('should accept an email with numbers', () => {
    expect(validateEmail('user123@example456.com')).toBe(true);
  });

  it('should reject an email without @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  it('should reject an email without domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  it('should reject an email without TLD', () => {
    expect(validateEmail('user@example')).toBe(false);
  });

  it('should reject an email with spaces', () => {
    expect(validateEmail('user @example.com')).toBe(false);
  });

  it('should reject an empty string', () => {
    expect(validateEmail('')).toBe(false);
  });
});

// =============================================================================
// validatePhone
// =============================================================================

describe('validatePhone', () => {
  it('should accept format (555) 123-4567', () => {
    expect(validatePhone('(555) 123-4567')).toBe(true);
  });

  it('should accept format 555-123-4567', () => {
    expect(validatePhone('555-123-4567')).toBe(true);
  });

  it('should accept format 5551234567 (10 digits)', () => {
    expect(validatePhone('5551234567')).toBe(true);
  });

  it('should accept format +15551234567 (11 digits with country code)', () => {
    expect(validatePhone('+15551234567')).toBe(true);
  });

  it('should accept format 555.123.4567', () => {
    expect(validatePhone('555.123.4567')).toBe(true);
  });

  it('should reject a phone number that is too short', () => {
    expect(validatePhone('555123')).toBe(false);
  });

  it('should reject a phone number that is too long', () => {
    expect(validatePhone('555123456789012')).toBe(false);
  });

  it('should reject a phone number with letters', () => {
    expect(validatePhone('555-ABC-4567')).toBe(false);
  });

  it('should reject an empty string', () => {
    expect(validatePhone('')).toBe(false);
  });

  it('should reject null/undefined', () => {
    expect(validatePhone(null as any)).toBe(false);
    expect(validatePhone(undefined as any)).toBe(false);
  });
});

// =============================================================================
// validateDate
// =============================================================================

describe('validateDate', () => {
  it('should accept a simple ISO date: 2024-01-15', () => {
    expect(validateDate('2024-01-15')).toBe(true);
  });

  it('should accept a full ISO datetime with Z: 2024-01-15T10:30:00Z', () => {
    expect(validateDate('2024-01-15T10:30:00Z')).toBe(true);
  });

  it('should accept ISO datetime with timezone offset: 2024-01-15T10:30:00+05:30', () => {
    expect(validateDate('2024-01-15T10:30:00+05:30')).toBe(true);
  });

  it('should accept ISO datetime with milliseconds: 2024-01-15T10:30:00.123Z', () => {
    expect(validateDate('2024-01-15T10:30:00.123Z')).toBe(true);
  });

  it('should accept date at boundary: 2024-12-31', () => {
    expect(validateDate('2024-12-31')).toBe(true);
  });

  it('should reject an invalid date Feb 30: 2024-02-30', () => {
    expect(validateDate('2024-02-30')).toBe(false);
  });

  it('should reject month 13: 2024-13-01', () => {
    expect(validateDate('2024-13-01')).toBe(false);
  });

  it('should reject a non-date string', () => {
    expect(validateDate('not-a-date')).toBe(false);
  });

  it('should reject an empty string', () => {
    expect(validateDate('')).toBe(false);
  });

  it('should reject null/undefined', () => {
    expect(validateDate(null as any)).toBe(false);
    expect(validateDate(undefined as any)).toBe(false);
  });
});

// =============================================================================
// validateFHIRId
// =============================================================================

describe('validateFHIRId', () => {
  it('should accept a simple alphanumeric ID', () => {
    expect(validateFHIRId('abc123')).toBe(true);
  });

  it('should accept a UUID-like ID with hyphens', () => {
    expect(validateFHIRId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('should accept an ID with dots', () => {
    expect(validateFHIRId('patient.123')).toBe(true);
  });

  it('should accept a single character ID', () => {
    expect(validateFHIRId('a')).toBe(true);
  });

  it('should accept a maximum-length ID (64 chars)', () => {
    expect(validateFHIRId('a'.repeat(64))).toBe(true);
  });

  it('should reject an ID with special characters', () => {
    expect(validateFHIRId('abc@123')).toBe(false);
    expect(validateFHIRId('abc 123')).toBe(false);
    expect(validateFHIRId('abc/123')).toBe(false);
  });

  it('should reject an ID that is too long (65+ chars)', () => {
    expect(validateFHIRId('a'.repeat(65))).toBe(false);
  });

  it('should reject an empty string', () => {
    expect(validateFHIRId('')).toBe(false);
  });

  it('should reject null/undefined', () => {
    expect(validateFHIRId(null as any)).toBe(false);
    expect(validateFHIRId(undefined as any)).toBe(false);
  });
});

// =============================================================================
// validateCodeableConcept
// =============================================================================

describe('validateCodeableConcept', () => {
  it('should accept a CodeableConcept with text only', () => {
    expect(validateCodeableConcept({ text: 'Diabetes Mellitus' })).toBe(true);
  });

  it('should accept a CodeableConcept with coding containing a code', () => {
    expect(
      validateCodeableConcept({
        coding: [{ system: 'http://snomed.info/sct', code: '73211009', display: 'Diabetes mellitus' }],
      })
    ).toBe(true);
  });

  it('should accept a CodeableConcept with both text and coding', () => {
    expect(
      validateCodeableConcept({
        text: 'Diabetes',
        coding: [{ code: '73211009' }],
      })
    ).toBe(true);
  });

  it('should accept a CodeableConcept with multiple codings where at least one has a code', () => {
    expect(
      validateCodeableConcept({
        coding: [
          { system: 'http://snomed.info/sct', display: 'DM' },
          { system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'E11.9' },
        ],
      })
    ).toBe(true);
  });

  it('should accept a CodeableConcept with non-empty trimmed text', () => {
    expect(validateCodeableConcept({ text: '  Some text  ' })).toBe(true);
  });

  it('should reject an empty object', () => {
    expect(validateCodeableConcept({} as any)).toBe(false);
  });

  it('should reject null/undefined', () => {
    expect(validateCodeableConcept(null as any)).toBe(false);
    expect(validateCodeableConcept(undefined as any)).toBe(false);
  });

  it('should reject a CodeableConcept with empty text and no codings', () => {
    expect(validateCodeableConcept({ text: '' })).toBe(false);
  });

  it('should reject a CodeableConcept with whitespace-only text and no codings', () => {
    expect(validateCodeableConcept({ text: '   ' })).toBe(false);
  });

  it('should reject a CodeableConcept with codings that have no code field', () => {
    expect(
      validateCodeableConcept({
        coding: [
          { system: 'http://snomed.info/sct', display: 'DM' },
        ],
      })
    ).toBe(false);
  });

  it('should reject a CodeableConcept with coding where code is empty string', () => {
    expect(
      validateCodeableConcept({
        coding: [{ code: '' }],
      })
    ).toBe(false);
  });
});
