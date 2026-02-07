/**
 * Password Policy Engine
 *
 * Enforces healthcare-grade password policies including complexity requirements,
 * common password detection, similarity checks, expiration, and history-based
 * reuse prevention. Designed for HIPAA and ONC certification compliance.
 */

import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PasswordPolicyConfig {
  /** Minimum password length (default: 12) */
  minLength?: number;
  /** Maximum password length (default: 128) */
  maxLength?: number;
  /** Require at least one uppercase letter (default: true) */
  requireUppercase?: boolean;
  /** Require at least one lowercase letter (default: true) */
  requireLowercase?: boolean;
  /** Require at least one digit (default: true) */
  requireDigit?: boolean;
  /** Require at least one special character (default: true) */
  requireSpecialChar?: boolean;
  /** Number of previous passwords that cannot be reused (default: 12) */
  historyCount?: number;
  /** Maximum password age in days (default: 90) */
  maxAgeDays?: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MIN_LENGTH = 12;
const DEFAULT_MAX_LENGTH = 128;
const DEFAULT_HISTORY_COUNT = 12;
const DEFAULT_MAX_AGE_DAYS = 90;
const BCRYPT_ROUNDS = 12;
const TEMP_PASSWORD_LENGTH = 16;

// ---------------------------------------------------------------------------
// Common passwords list (top ~200 most common; a production system should
// use the full NCSC/Have-I-Been-Pwned top-1000 list loaded from a file)
// ---------------------------------------------------------------------------

const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567',
  'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
  'ashley', 'michael', 'shadow', '123123', '654321', 'superman', 'qazwsx',
  'michael', 'football', 'password1', 'password123', 'batman', 'passw0rd',
  'welcome', 'welcome1', 'p@ssw0rd', 'admin', 'admin123', 'root', 'toor',
  'login', 'princess', 'qwerty123', 'solo', 'passpass', 'starwars',
  'hello', 'charlie', 'donald', 'loveme', 'hockey', 'ranger', 'test',
  'test123', 'pass', 'abcdef', 'abcd1234', 'access', 'access14',
  '123456789', '12345', '1234', '111111', '1234567890', '000000',
  'password!', 'password1!', 'changeme', 'changeit', 'secret',
  'letmein1', 'whatever', 'trustme', 'blahblah', 'server',
  'internet', 'computer', 'friday', 'matrix', 'killer',
  'pepper', 'joshua', 'maggie', 'mercedes', 'thunder',
  'cowboy', 'falcon', 'andrea', 'jennifer', 'joshua',
  'sparky', 'matthew', 'chicken', 'george', 'summer',
  'flower', 'harley', 'ginger', 'jordan', 'diamond',
  'robert', 'daniel', 'hannah', 'thomas', 'maverick',
  'austin', 'william', 'nicole', 'midnight', 'buster',
  'tigger', 'bailey', 'jackson', 'cookie', 'jessica',
  'ashley1', 'amanda', 'samantha', 'orange', 'alexander',
  'taylor', 'martin', 'peanut', 'chelsea', 'yankees',
  'dallas', 'camaro', 'brandy', 'compaq', 'albert',
  'merlin', 'oliver', 'prince', 'sophie', 'maria',
  'golfer', 'cheese', 'arsenal', 'junior', 'asdfgh',
  'qwertyu', 'zxcvbn', 'zxcvbnm', 'asdfghjkl', 'qwertyuiop',
  'mysql', 'oracle', 'sysadmin', 'cisco', 'support',
  'system', 'backup', 'recover', 'security', 'health',
  'medical', 'patient', 'doctor', 'nurse', 'hospital',
  'clinical', 'pharmacy', 'tribal', 'native', 'sacred',
  'eagle', 'spirit', 'warrior', 'nation', 'council',
  'spring2024', 'summer2024', 'fall2024', 'winter2024',
  'spring2025', 'summer2025', 'fall2025', 'winter2025',
  'january', 'february', 'march', 'april', 'may2024',
  'june2024', 'july2024', 'august', 'september', 'october',
  'november', 'december', 'monday', 'tuesday', 'wednesday',
  'thursday', 'saturday', 'sunday',
  'Pa$$w0rd', 'P@ssword1', 'Passw0rd!', 'Welcome1!',
  'Changeme1!', 'Admin123!', 'Test1234!', 'Password1!',
  'aaaa', 'bbbb', 'cccc', 'dddd', 'eeee', 'ffff',
  '0000', '1111', '2222', '3333', '4444', '5555',
  '6666', '7777', '8888', '9999',
]);

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

/**
 * Validates a password against the configured password policy.
 *
 * Checks:
 * 1. Minimum length (default 12 characters)
 * 2. Maximum length (default 128 characters)
 * 3. At least one uppercase letter
 * 4. At least one lowercase letter
 * 5. At least one digit
 * 6. At least one special character
 * 7. Not in the common passwords list
 * 8. Not too similar to the username (if provided)
 * 9. No more than 3 consecutive identical characters
 * 10. No keyboard patterns (e.g., "qwerty", "asdfgh")
 *
 * @param password - The password to validate
 * @param username - Optional username for similarity checking
 * @param config - Optional policy configuration overrides
 * @returns Validation result with errors array
 */
export function validatePasswordStrength(
  password: string,
  username?: string,
  config?: PasswordPolicyConfig,
): PasswordValidationResult {
  const errors: string[] = [];

  const minLength = config?.minLength ?? DEFAULT_MIN_LENGTH;
  const maxLength = config?.maxLength ?? DEFAULT_MAX_LENGTH;
  const requireUppercase = config?.requireUppercase ?? true;
  const requireLowercase = config?.requireLowercase ?? true;
  const requireDigit = config?.requireDigit ?? true;
  const requireSpecialChar = config?.requireSpecialChar ?? true;

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }

  // Length checks
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }

  if (password.length > maxLength) {
    errors.push(`Password must not exceed ${maxLength} characters`);
  }

  // Character class checks
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (requireDigit && !/\d/.test(password)) {
    errors.push('Password must contain at least one digit');
  }

  if (requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Common password check (case-insensitive)
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Password is too common and easily guessable');
  }

  // Username similarity check
  if (username && username.length > 0) {
    const lowerPassword = password.toLowerCase();
    const lowerUsername = username.toLowerCase();

    if (lowerPassword.includes(lowerUsername)) {
      errors.push('Password must not contain the username');
    }

    if (lowerUsername.includes(lowerPassword)) {
      errors.push('Password is too similar to the username');
    }

    // Check if password is a simple transformation of username
    if (lowerPassword === lowerUsername.split('').reverse().join('')) {
      errors.push('Password must not be the reverse of the username');
    }

    // Levenshtein-like similarity: if more than 60% of characters overlap
    if (username.length >= 4) {
      const similarity = computeSimilarity(lowerPassword, lowerUsername);
      if (similarity > 0.6) {
        errors.push('Password is too similar to the username');
      }
    }
  }

  // Consecutive identical characters (max 3, case-insensitive)
  if (/(.)\1{3,}/i.test(password)) {
    errors.push('Password must not contain more than 3 consecutive identical characters');
  }

  // Sequential character patterns
  const keyboardPatterns = [
    'qwerty', 'asdfgh', 'zxcvbn', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
    '123456', '234567', '345678', '456789', '567890',
    'abcdef', 'bcdefg', 'cdefgh', 'defghi', 'efghij',
  ];
  const lowerPwd = password.toLowerCase();
  for (const pattern of keyboardPatterns) {
    if (lowerPwd.includes(pattern)) {
      errors.push('Password must not contain common keyboard patterns');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Checks whether a password has expired based on the last change date.
 *
 * @param changedAt - The date the password was last changed
 * @param maxAgeDays - Maximum password age in days (default: 90)
 * @returns true if the password has expired
 */
export function isPasswordExpired(
  changedAt: Date,
  maxAgeDays: number = DEFAULT_MAX_AGE_DAYS,
): boolean {
  if (!changedAt || !(changedAt instanceof Date) || isNaN(changedAt.getTime())) {
    // If we don't know when the password was changed, treat it as expired
    return true;
  }

  if (maxAgeDays <= 0) {
    // Password never expires
    return false;
  }

  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const expiresAt = changedAt.getTime() + maxAgeMs;

  return now >= expiresAt;
}

/**
 * Checks whether a new password hash matches any entry in the password history.
 *
 * Prevents users from reusing their most recent N passwords. The comparison
 * is done using bcrypt.compare so the actual plaintext is compared against
 * stored hashes.
 *
 * @param newPassword - The new plaintext password to check
 * @param history - Array of bcrypt hashes representing previous passwords (most recent first)
 * @param historyCount - Number of historical passwords to check (default: 12)
 * @returns true if the password was found in the history (i.e., reuse detected)
 */
export async function checkPasswordHistory(
  newPassword: string,
  history: string[],
  historyCount: number = DEFAULT_HISTORY_COUNT,
): Promise<boolean> {
  if (!newPassword || !history || history.length === 0) {
    return false;
  }

  // Only check up to historyCount entries
  const entriesToCheck = history.slice(0, historyCount);

  for (const hash of entriesToCheck) {
    try {
      const isMatch = await bcrypt.compare(newPassword, hash);
      if (isMatch) {
        return true; // Password was found in history -- reuse detected
      }
    } catch {
      // Skip corrupted hashes
      continue;
    }
  }

  return false;
}

/**
 * Generates a cryptographically secure temporary password that meets
 * all policy requirements.
 *
 * The generated password will always contain at least one uppercase letter,
 * one lowercase letter, one digit, and one special character.
 *
 * @returns A temporary password string
 */
export function generateTemporaryPassword(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluding I and O for readability
  const lowercase = 'abcdefghjkmnpqrstuvwxyz'; // Excluding i, l, o for readability
  const digits = '23456789'; // Excluding 0 and 1 for readability
  const special = '!@#$%^&*-_+=';
  const allChars = uppercase + lowercase + digits + special;

  let password = '';

  // Guarantee at least one character from each required class
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += digits[crypto.randomInt(digits.length)];
  password += special[crypto.randomInt(special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < TEMP_PASSWORD_LENGTH; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Shuffle the password to avoid predictable positions
  const shuffled = password
    .split('')
    .sort(() => crypto.randomInt(3) - 1) // -1, 0, or 1
    .join('');

  return shuffled;
}

/**
 * Hashes a password using bcrypt for secure storage.
 *
 * @param password - The plaintext password to hash
 * @returns The bcrypt hash
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required');
  }

  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifies a plaintext password against a bcrypt hash.
 *
 * @param password - The plaintext password to verify
 * @param hash - The bcrypt hash to compare against
 * @returns true if the password matches the hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Computes a simple character-overlap similarity ratio between two strings.
 * Returns a value between 0 (no overlap) and 1 (identical character sets).
 */
function computeSimilarity(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;

  let matchCount = 0;
  const used = new Set<number>();

  for (const char of shorter) {
    for (let i = 0; i < longer.length; i++) {
      if (!used.has(i) && longer[i] === char) {
        matchCount++;
        used.add(i);
        break;
      }
    }
  }

  return (matchCount * 2) / (a.length + b.length);
}
