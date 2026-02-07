import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// =============================================================================
// Key Rotation Procedure:
// 1. Set ENCRYPTION_KEY_PREVIOUS to current ENCRYPTION_KEY value
// 2. Generate new key: openssl rand -hex 32
// 3. Set ENCRYPTION_KEY to the new key
// 4. Increment ENCRYPTION_KEY_VERSION (e.g., from 1 to 2)
// 5. Restart the application
// 6. Run re-encryption job for existing data (optional, for forward security):
//    - Query all rows with encrypted data
//    - Call reEncrypt() on each row's EncryptedData
//    - Update the row with the new ciphertext, iv, tag, and keyVersion
// 7. After all data re-encrypted, remove ENCRYPTION_KEY_PREVIOUS
// =============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const BCRYPT_ROUNDS = 12;
const KEY_DERIVATION_SALT = 'tribal-ehr-salt';
const MIN_KEY_LENGTH = 32;

// Well-known example/default keys that should trigger warnings
const EXAMPLE_KEYS = [
  '0123456789abcdef0123456789abcdef',
  'change-me-in-production',
  'default-encryption-key',
  'test-encryption-key',
  'development-key',
];

// ---------------------------------------------------------------------------
// Versioned encryption data structure
// ---------------------------------------------------------------------------

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
}

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

function deriveKey(raw: string): Buffer {
  return crypto.scryptSync(raw, KEY_DERIVATION_SALT, 32);
}

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  // Key must be 32 bytes for AES-256
  return deriveKey(key);
}

function getCurrentKeyVersion(): number {
  return parseInt(process.env.ENCRYPTION_KEY_VERSION || '1', 10);
}

function getPreviousKey(): Buffer | null {
  const prev = process.env.ENCRYPTION_KEY_PREVIOUS;
  if (!prev) return null;
  return deriveKey(prev);
}

// ---------------------------------------------------------------------------
// Original encrypt / decrypt (unchanged API for backwards compatibility)
// ---------------------------------------------------------------------------

export function encrypt(plaintext: string): { encrypted: string; iv: string; tag: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

export function decrypt(encrypted: string, iv: string, tag: string): string {
  const key = getEncryptionKey();
  const ivBuffer = Buffer.from(iv, 'hex');
  const tagBuffer = Buffer.from(tag, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(tagBuffer);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ---------------------------------------------------------------------------
// Versioned encrypt / decrypt (new key-management-aware API)
// ---------------------------------------------------------------------------

/**
 * Encrypt plaintext and tag the result with the current key version.
 */
export function encryptWithVersion(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    keyVersion: getCurrentKeyVersion(),
  };
}

/**
 * Decrypt data that was encrypted with encryptWithVersion().
 *
 * Strategy:
 * - Always tries the current key first (most common case).
 * - If decryption fails and a previous key is configured, retries with
 *   the previous key (handles data not yet re-encrypted after rotation).
 */
export function decryptWithVersion(data: EncryptedData): string {
  const currentKey = getEncryptionKey();
  const ivBuffer = Buffer.from(data.iv, 'hex');
  const tagBuffer = Buffer.from(data.tag, 'hex');

  // Try current key first
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, currentKey, ivBuffer);
    decipher.setAuthTag(tagBuffer);
    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // Current key failed – fall through to previous key
  }

  // Try previous key if available
  const previousKey = getPreviousKey();
  if (!previousKey) {
    throw new Error(
      'Decryption failed with current key and no previous key is configured. ' +
      'If a key rotation occurred, set ENCRYPTION_KEY_PREVIOUS to the old key.'
    );
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, previousKey, ivBuffer);
    decipher.setAuthTag(tagBuffer);
    let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    throw new Error(
      'Decryption failed with both current and previous keys. ' +
      'The data may have been encrypted with an unknown key.'
    );
  }
}

/**
 * Re-encrypt data: decrypt with whichever key works, then encrypt with
 * the current key. Used during key rotation to migrate existing data.
 */
export function reEncrypt(data: EncryptedData): EncryptedData {
  const plaintext = decryptWithVersion(data);
  return encryptWithVersion(plaintext);
}

// ---------------------------------------------------------------------------
// Startup validation
// ---------------------------------------------------------------------------

export interface EncryptionValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  keyVersion: number;
  hasPreviousKey: boolean;
}

/**
 * Validate encryption configuration at application startup.
 *
 * Returns a result object indicating whether the configuration is usable,
 * along with any warnings or errors. Does NOT throw – callers decide how
 * to handle failures (e.g., log and continue in dev, abort in production).
 */
export function validateEncryptionConfig(): EncryptionValidationResult {
  const result: EncryptionValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
    keyVersion: getCurrentKeyVersion(),
    hasPreviousKey: !!process.env.ENCRYPTION_KEY_PREVIOUS,
  };

  const key = process.env.ENCRYPTION_KEY;

  // Critical: no key at all
  if (!key) {
    result.valid = false;
    result.errors.push('ENCRYPTION_KEY environment variable is not set');
    return result;
  }

  // Key length check
  if (key.length < MIN_KEY_LENGTH) {
    result.warnings.push(
      `ENCRYPTION_KEY is ${key.length} characters; minimum recommended length is ${MIN_KEY_LENGTH}`
    );
  }

  // Check for well-known example/default values
  const keyLower = key.toLowerCase();
  if (EXAMPLE_KEYS.some((example) => keyLower === example || keyLower.startsWith(example))) {
    result.warnings.push(
      'ENCRYPTION_KEY appears to be a default or example value. ' +
      'Generate a unique key for production: openssl rand -hex 32'
    );
  }

  // Verify key version is a positive integer
  const version = getCurrentKeyVersion();
  if (!Number.isFinite(version) || version < 1) {
    result.warnings.push(
      `ENCRYPTION_KEY_VERSION is invalid ("${process.env.ENCRYPTION_KEY_VERSION}"); defaulting to 1`
    );
  }

  // If previous key is set, verify it differs from current key
  const prevRaw = process.env.ENCRYPTION_KEY_PREVIOUS;
  if (prevRaw && prevRaw === key) {
    result.warnings.push(
      'ENCRYPTION_KEY_PREVIOUS is identical to ENCRYPTION_KEY. ' +
      'This has no effect – remove it or set it to the actual previous key.'
    );
  }

  return result;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function generateChainHash(data: string, previousHash: string): string {
  return crypto
    .createHash('sha256')
    .update(`${previousHash}:${data}`)
    .digest('hex');
}
