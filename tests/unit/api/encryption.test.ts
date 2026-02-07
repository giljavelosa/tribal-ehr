/**
 * Unit Tests: API Encryption Utilities
 *
 * Tests for /packages/api/src/utils/encryption.ts
 * Covers: encrypt/decrypt, hashPassword/verifyPassword, generateHash, generateChainHash
 */

// Set required env vars before importing the module
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import {
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
  generateHash,
  generateChainHash,
} from '../../../packages/api/src/utils/encryption';

// =============================================================================
// encrypt / decrypt
// =============================================================================

describe('encrypt / decrypt', () => {
  it('should encrypt plaintext and decrypt back to original', () => {
    const plaintext = 'Hello, this is sensitive patient data.';
    const { encrypted, iv, tag } = encrypt(plaintext);
    const decrypted = decrypt(encrypted, iv, tag);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for different plaintexts', () => {
    const result1 = encrypt('plaintext-one');
    const result2 = encrypt('plaintext-two');

    expect(result1.encrypted).not.toBe(result2.encrypted);
  });

  it('should produce different ciphertext for the same plaintext (random IV)', () => {
    const result1 = encrypt('same-plaintext');
    const result2 = encrypt('same-plaintext');

    // Due to random IV, ciphertext should differ
    expect(result1.iv).not.toBe(result2.iv);
    // Encrypted text will very likely differ due to different IVs
    expect(result1.encrypted).not.toBe(result2.encrypted);
  });

  it('should fail to decrypt when ciphertext is tampered', () => {
    const { encrypted, iv, tag } = encrypt('secret data');
    // Tamper with the encrypted data
    const tampered = 'ff' + encrypted.substring(2);

    expect(() => decrypt(tampered, iv, tag)).toThrow();
  });

  it('should fail to decrypt when IV is tampered', () => {
    const { encrypted, iv, tag } = encrypt('secret data');
    const tamperedIV = 'ff' + iv.substring(2);

    expect(() => decrypt(encrypted, tamperedIV, tag)).toThrow();
  });

  it('should fail to decrypt when auth tag is tampered', () => {
    const { encrypted, iv, tag } = encrypt('secret data');
    const tamperedTag = 'ff' + tag.substring(2);

    expect(() => decrypt(encrypted, iv, tamperedTag)).toThrow();
  });

  it('should handle encryption and decryption of an empty string', () => {
    const { encrypted, iv, tag } = encrypt('');
    const decrypted = decrypt(encrypted, iv, tag);

    expect(decrypted).toBe('');
  });

  it('should handle encryption and decryption of a long string', () => {
    const longString = 'A'.repeat(100000);
    const { encrypted, iv, tag } = encrypt(longString);
    const decrypted = decrypt(encrypted, iv, tag);

    expect(decrypted).toBe(longString);
  });

  it('should handle Unicode characters correctly', () => {
    const unicode = 'Patient name: Maria Garcia-Lopez. Notes: \u2603 \u00e9\u00e8\u00ea \u4e16\u754c';
    const { encrypted, iv, tag } = encrypt(unicode);
    const decrypted = decrypt(encrypted, iv, tag);

    expect(decrypted).toBe(unicode);
  });

  it('should produce hex-encoded iv and tag', () => {
    const { iv, tag } = encrypt('test');

    // IV should be 16 bytes = 32 hex chars
    expect(iv).toMatch(/^[0-9a-f]{32}$/);
    // GCM auth tag should be 16 bytes = 32 hex chars
    expect(tag).toMatch(/^[0-9a-f]{32}$/);
  });
});

// =============================================================================
// hashPassword / verifyPassword
// =============================================================================

describe('hashPassword / verifyPassword', () => {
  it('should hash a password and verify it returns true for correct password', async () => {
    const password = 'SecureP@ssw0rd!2024';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);

    expect(isValid).toBe(true);
  });

  it('should return false for an incorrect password', async () => {
    const hash = await hashPassword('correct-password');
    const isValid = await verifyPassword('wrong-password', hash);

    expect(isValid).toBe(false);
  });

  it('should produce different hashes for the same password (bcrypt salting)', async () => {
    const password = 'SamePassword123!';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);

    // But both should verify
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });

  it('should produce a hash of consistent format (bcrypt $2b$)', async () => {
    const hash = await hashPassword('TestPass1!');

    expect(hash).toMatch(/^\$2[aby]?\$\d{2}\$.{53}$/);
  });

  it('should handle special characters in password', async () => {
    const password = 'P@$$w0rd!#%^&*()_+-=[]{}|;:<>?,./~`';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);

    expect(isValid).toBe(true);
  });
});

// =============================================================================
// generateHash
// =============================================================================

describe('generateHash', () => {
  it('should produce a consistent hash for the same input', () => {
    const data = 'audit-log-entry-12345';
    const hash1 = generateHash(data);
    const hash2 = generateHash(data);

    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = generateHash('input-one');
    const hash2 = generateHash('input-two');

    expect(hash1).not.toBe(hash2);
  });

  it('should produce a 64-character hex string (SHA-256)', () => {
    const hash = generateHash('test-data');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should hash empty string consistently', () => {
    const hash = generateHash('');

    // SHA-256 of empty string is a known value
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should handle Unicode input', () => {
    const hash = generateHash('\u00e9\u00e8\u00ea');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// =============================================================================
// generateChainHash
// =============================================================================

describe('generateChainHash', () => {
  it('should incorporate the previous hash into the result', () => {
    const data = 'audit-entry-data';
    const prevHash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const chainHash = generateChainHash(data, prevHash);

    expect(chainHash).toMatch(/^[0-9a-f]{64}$/);
    // The chain hash should be different from a plain hash of the data alone
    const plainHash = generateHash(data);
    expect(chainHash).not.toBe(plainHash);
  });

  it('should produce the same result for same data + same previous hash', () => {
    const data = 'consistent-data';
    const prevHash = '1111111111111111111111111111111111111111111111111111111111111111';

    const hash1 = generateChainHash(data, prevHash);
    const hash2 = generateChainHash(data, prevHash);

    expect(hash1).toBe(hash2);
  });

  it('should produce different results when previous hash differs', () => {
    const data = 'same-data';
    const prevHash1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const prevHash2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

    const hash1 = generateChainHash(data, prevHash1);
    const hash2 = generateChainHash(data, prevHash2);

    expect(hash1).not.toBe(hash2);
  });

  it('should produce different results when data differs', () => {
    const prevHash = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

    const hash1 = generateChainHash('data-one', prevHash);
    const hash2 = generateChainHash('data-two', prevHash);

    expect(hash1).not.toBe(hash2);
  });

  it('should be a SHA-256 hash (64 hex chars)', () => {
    const chainHash = generateChainHash('data', 'prev');

    expect(chainHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
