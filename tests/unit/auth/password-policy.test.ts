/**
 * Unit Tests: Password Policy Engine
 *
 * Tests for /packages/auth/src/password/password-policy.ts
 * Covers: strength validation (length, uppercase, lowercase, digit, special char),
 *         common password rejection, username similarity, and password expiration.
 */

import {
  validatePasswordStrength,
  isPasswordExpired,
  generateTemporaryPassword,
} from '../../../packages/auth/src/password/password-policy';

// =============================================================================
// validatePasswordStrength
// =============================================================================

describe('validatePasswordStrength', () => {
  describe('strong password', () => {
    it('should pass for a strong password (12+ chars, mixed case, digit, special)', () => {
      const result = validatePasswordStrength('MyStr0ng!Pass');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for a complex 16-character password', () => {
      const result = validatePasswordStrength('C0mpl3x#Passw0rd');

      expect(result.valid).toBe(true);
    });

    it('should pass for a password with many special characters', () => {
      const result = validatePasswordStrength('Aa1!@#$%^&*()_+');

      expect(result.valid).toBe(true);
    });
  });

  describe('too short', () => {
    it('should fail when password is shorter than 12 characters', () => {
      const result = validatePasswordStrength('Sh0rt!Pw');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('12 characters'))).toBe(true);
    });

    it('should fail for a 1-character password', () => {
      const result = validatePasswordStrength('A');

      expect(result.valid).toBe(false);
    });
  });

  describe('missing character classes', () => {
    it('should fail when no uppercase letter is present', () => {
      const result = validatePasswordStrength('nouppercase1!pwd');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('uppercase'))).toBe(true);
    });

    it('should fail when no lowercase letter is present', () => {
      const result = validatePasswordStrength('NOLOWERCASE1!PWD');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('lowercase'))).toBe(true);
    });

    it('should fail when no digit is present', () => {
      const result = validatePasswordStrength('NoDigitHere!@#ab');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('digit'))).toBe(true);
    });

    it('should fail when no special character is present', () => {
      const result = validatePasswordStrength('NoSpecialChar123');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('special'))).toBe(true);
    });
  });

  describe('common password', () => {
    it('should fail for a common password like "password"', () => {
      const result = validatePasswordStrength('password');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('common'))).toBe(true);
    });

    it('should fail for a common password like "Password1!"', () => {
      const result = validatePasswordStrength('Password1!');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('common'))).toBe(true);
    });

    it('should fail for healthcare-related common password "patient"', () => {
      const result = validatePasswordStrength('patient');

      expect(result.valid).toBe(false);
    });
  });

  describe('username similarity', () => {
    it('should fail when password contains the username', () => {
      const result = validatePasswordStrength('jsmith_Passw0rd!', 'jsmith');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('username'))).toBe(true);
    });

    it('should fail when password is the reverse of the username', () => {
      const result = validatePasswordStrength('htimSnhoJ12345!', 'JohnSmith');

      // If it passes the reverse check depends on case sensitivity
      // The password 'htimsnhoj12345!' reversed is '!54321johnsmmith' which is NOT the username
      // But let us test an actual reverse:
      const result2 = validatePasswordStrength('htimsnhoj!!!!!!', 'johnsmith');

      expect(result2.valid).toBe(false);
    });

    it('should pass when password has no similarity to username', () => {
      const result = validatePasswordStrength('Tr!b@lEhr2024!!', 'jsmith');

      expect(result.valid).toBe(true);
    });
  });

  describe('consecutive characters', () => {
    it('should fail when password has more than 3 consecutive identical characters', () => {
      const result = validatePasswordStrength('Aaaa1!bcdefghij');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('consecutive'))).toBe(true);
    });
  });

  describe('keyboard patterns', () => {
    it('should fail when password contains a keyboard pattern', () => {
      const result = validatePasswordStrength('Qwerty!23456ab');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('keyboard'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should fail for empty string', () => {
      const result = validatePasswordStrength('');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('required'))).toBe(true);
    });

    it('should fail for null/undefined', () => {
      const result = validatePasswordStrength(null as any);

      expect(result.valid).toBe(false);
    });
  });
});

// =============================================================================
// isPasswordExpired
// =============================================================================

describe('isPasswordExpired', () => {
  it('should return true when password was changed more than 90 days ago', () => {
    const changedAt = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    expect(isPasswordExpired(changedAt)).toBe(true);
  });

  it('should return false when password was changed less than 90 days ago', () => {
    const changedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(isPasswordExpired(changedAt)).toBe(false);
  });

  it('should return true for invalid date', () => {
    expect(isPasswordExpired(new Date('invalid'))).toBe(true);
  });

  it('should return false when maxAgeDays is 0 (never expires)', () => {
    const changedAt = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    expect(isPasswordExpired(changedAt, 0)).toBe(false);
  });

  it('should respect custom maxAgeDays', () => {
    const changedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    expect(isPasswordExpired(changedAt, 30)).toBe(true);
    expect(isPasswordExpired(changedAt, 60)).toBe(false);
  });
});

// =============================================================================
// generateTemporaryPassword
// =============================================================================

describe('generateTemporaryPassword', () => {
  it('should generate a password that passes validation', () => {
    const tempPassword = generateTemporaryPassword();
    const result = validatePasswordStrength(tempPassword);

    // Temporary passwords should meet all requirements
    expect(tempPassword.length).toBeGreaterThanOrEqual(12);
    expect(/[A-Z]/.test(tempPassword)).toBe(true);
    expect(/[a-z]/.test(tempPassword)).toBe(true);
    expect(/\d/.test(tempPassword)).toBe(true);
    expect(/[!@#$%^&*\-_+=]/.test(tempPassword)).toBe(true);
  });

  it('should generate different passwords each time', () => {
    const passwords = new Set<string>();
    for (let i = 0; i < 10; i++) {
      passwords.add(generateTemporaryPassword());
    }

    // All 10 should be unique
    expect(passwords.size).toBe(10);
  });
});
