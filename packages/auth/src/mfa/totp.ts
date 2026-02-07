/**
 * Time-based One-Time Password (TOTP) Multi-Factor Authentication
 *
 * Implements TOTP generation and verification using the otplib library,
 * along with backup code generation for account recovery scenarios.
 * Compliant with RFC 6238 (TOTP) and RFC 4226 (HOTP).
 */

import { authenticator } from 'otplib';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as QRCode from 'qrcode';

const BCRYPT_ROUNDS = 10;
const BACKUP_CODE_LENGTH = 8;
const TOTP_ISSUER = 'Tribal EHR';

export interface TOTPSecret {
  /** Base32-encoded secret key */
  secret: string;
  /** otpauth:// URI for manual entry or QR scanning */
  otpauthUrl: string;
  /** Data URL of the QR code image (PNG, base64-encoded) */
  qrCodeDataUrl: string;
}

export interface BackupCodeVerificationResult {
  /** Whether the provided code was valid */
  valid: boolean;
  /** Remaining hashed backup codes after verification (the used code is removed) */
  remainingCodes: string[];
}

/**
 * Generates a new TOTP secret for the given user, along with a QR code
 * that can be scanned by authenticator apps (Google Authenticator, Authy, etc.).
 *
 * @param username - The username to associate with the TOTP secret
 * @returns The secret, otpauth URL, and QR code data URL
 */
export async function generateSecret(username: string): Promise<TOTPSecret> {
  if (!username || typeof username !== 'string') {
    throw new Error('username must be a non-empty string');
  }

  const secret = authenticator.generateSecret();

  const otpauthUrl = authenticator.keyuri(username, TOTP_ISSUER, secret);

  let qrCodeDataUrl: string;
  try {
    qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 2,
      width: 256,
    });
  } catch (err) {
    throw new Error(
      `Failed to generate QR code: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    secret,
    otpauthUrl,
    qrCodeDataUrl,
  };
}

/**
 * Verifies a TOTP token against the given secret.
 *
 * Uses a default time window of +/- 1 step (30 seconds) to account for
 * minor clock drift between the server and the user's authenticator app.
 *
 * @param secret - The Base32-encoded TOTP secret
 * @param token - The 6-digit token provided by the user
 * @returns true if the token is valid
 */
export function verifyToken(secret: string, token: string): boolean {
  if (!secret || typeof secret !== 'string') {
    throw new Error('secret must be a non-empty string');
  }

  if (!token || typeof token !== 'string') {
    return false;
  }

  // Strip whitespace and dashes that users might include
  const cleanedToken = token.replace(/[\s-]/g, '');

  // Reject tokens that aren't 6 digits
  if (!/^\d{6}$/.test(cleanedToken)) {
    return false;
  }

  try {
    return authenticator.verify({ token: cleanedToken, secret });
  } catch {
    return false;
  }
}

/**
 * Generates a set of single-use backup codes for account recovery.
 *
 * Each backup code is an 8-character alphanumeric string formatted as
 * two groups of 4 characters separated by a dash (e.g., "a1b2-c3d4")
 * for display purposes. The raw codes (without dashes) are returned
 * alongside their bcrypt hashes for storage.
 *
 * @param count - Number of backup codes to generate (default: 10)
 * @returns Object containing display-formatted codes and their bcrypt hashes
 */
export async function generateBackupCodes(
  count: number = 10,
): Promise<{ codes: string[]; hashedCodes: string[] }> {
  if (count < 1 || count > 20) {
    throw new Error('count must be between 1 and 20');
  }

  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const codes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(BACKUP_CODE_LENGTH);
    let code = '';
    for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
      code += chars[bytes[j] % chars.length];
    }
    codes.push(code);

    const hash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    hashedCodes.push(hash);
  }

  return { codes, hashedCodes };
}

/**
 * Verifies a backup code against a list of hashed backup codes.
 *
 * If the code is valid, the matching hash is removed from the list so the
 * code cannot be reused. Returns the updated list of remaining hashed codes.
 *
 * @param code - The backup code provided by the user (with or without dashes)
 * @param hashedCodes - Array of bcrypt-hashed backup codes stored for the user
 * @returns Verification result with validity flag and remaining codes
 */
export async function verifyBackupCode(
  code: string,
  hashedCodes: string[],
): Promise<BackupCodeVerificationResult> {
  if (!code || typeof code !== 'string') {
    return { valid: false, remainingCodes: [...hashedCodes] };
  }

  if (!hashedCodes || hashedCodes.length === 0) {
    return { valid: false, remainingCodes: [] };
  }

  // Normalize: strip whitespace and dashes
  const normalizedCode = code.replace(/[\s-]/g, '').toLowerCase();

  for (let i = 0; i < hashedCodes.length; i++) {
    try {
      const isMatch = await bcrypt.compare(normalizedCode, hashedCodes[i]);
      if (isMatch) {
        // Remove the used code and return remaining
        const remaining = [...hashedCodes.slice(0, i), ...hashedCodes.slice(i + 1)];
        return { valid: true, remainingCodes: remaining };
      }
    } catch {
      // Skip corrupted hashes
      continue;
    }
  }

  return { valid: false, remainingCodes: [...hashedCodes] };
}
