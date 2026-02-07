// =============================================================================
// Validation Utilities
// =============================================================================

import { CodeableConcept } from '../types/fhir';

/**
 * Validates a Medical Record Number (MRN).
 * MRN must be alphanumeric, 4-20 characters, no special characters except hyphens.
 */
export function validateMRN(mrn: string): boolean {
  if (!mrn || typeof mrn !== 'string') return false;
  return /^[A-Za-z0-9-]{4,20}$/.test(mrn);
}

/**
 * Validates a National Provider Identifier (NPI) using the Luhn algorithm.
 * NPI is a 10-digit number. The Luhn check digit is computed with a prefix of 80840.
 * See: https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand
 */
export function validateNPI(npi: string): boolean {
  if (!npi || typeof npi !== 'string') return false;
  if (!/^\d{10}$/.test(npi)) return false;

  // NPI Luhn validation uses prefix "80840" prepended to the first 9 digits
  const prefixed = '80840' + npi.substring(0, 9);
  const checkDigit = parseInt(npi[9], 10);

  let sum = 0;
  let alternate = true;

  for (let i = prefixed.length - 1; i >= 0; i--) {
    let digit = parseInt(prefixed[i], 10);
    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    alternate = !alternate;
  }

  const computedCheck = (10 - (sum % 10)) % 10;
  return computedCheck === checkDigit;
}

/**
 * Validates a DEA (Drug Enforcement Administration) number.
 * Format: 2 letters followed by 7 digits.
 * First letter: registrant type (A, B, F, M for standard; mid-level: G, R).
 * Check digit: sum of digits 1,3,5 + 2*(sum of digits 2,4,6) => last digit of result = digit 7.
 */
export function validateDEA(dea: string): boolean {
  if (!dea || typeof dea !== 'string') return false;
  if (!/^[ABFGMRabfgmr][A-Za-z]\d{7}$/.test(dea)) return false;

  const digits = dea.substring(2);
  const oddSum =
    parseInt(digits[0], 10) +
    parseInt(digits[2], 10) +
    parseInt(digits[4], 10);
  const evenSum =
    parseInt(digits[1], 10) +
    parseInt(digits[3], 10) +
    parseInt(digits[5], 10);

  const total = oddSum + 2 * evenSum;
  const checkDigit = total % 10;

  return checkDigit === parseInt(digits[6], 10);
}

/**
 * Validates an email address format.
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  // RFC 5322 simplified pattern
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(
    email
  );
}

/**
 * Validates a US phone number. Accepts various formats:
 * (555) 123-4567, 555-123-4567, 5551234567, +15551234567, etc.
 */
export function validatePhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  // Strip common formatting characters
  const stripped = phone.replace(/[\s()\-+.]/g, '');
  // Must be 10 digits or 11 digits starting with 1
  if (/^\d{10}$/.test(stripped)) return true;
  if (/^1\d{10}$/.test(stripped)) return true;
  return false;
}

/**
 * Validates an ISO 8601 date or datetime string.
 * Accepts: YYYY-MM-DD, YYYY-MM-DDThh:mm:ss, YYYY-MM-DDThh:mm:ssZ,
 *          YYYY-MM-DDThh:mm:ss+hh:mm, YYYY-MM-DDThh:mm:ss.sssZ
 */
export function validateDate(date: string): boolean {
  if (!date || typeof date !== 'string') return false;

  // Check basic format
  const iso8601Regex =
    /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/;

  if (!iso8601Regex.test(date)) return false;

  // Verify it parses to a valid date and the day is calendar-valid
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return false;

  // Extract date parts and verify calendar validity
  // (e.g., Feb 30 wraps to Mar 1 in JS, so check the components match)
  const [datePart] = date.split('T');
  const [yearStr, monthStr, dayStr] = datePart.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const reconstructed = new Date(Date.UTC(year, month - 1, day));
  return (
    reconstructed.getUTCFullYear() === year &&
    reconstructed.getUTCMonth() === month - 1 &&
    reconstructed.getUTCDate() === day
  );
}

/**
 * Validates a FHIR resource ID.
 * FHIR IDs match: [A-Za-z0-9\-\.]{1,64}
 */
export function validateFHIRId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[A-Za-z0-9\-.]{1,64}$/.test(id);
}

/**
 * Validates a CodeableConcept has at minimum a text or at least one coding with code.
 */
export function validateCodeableConcept(cc: CodeableConcept): boolean {
  if (!cc || typeof cc !== 'object') return false;

  // Must have text or at least one coding with a code
  if (cc.text && cc.text.trim().length > 0) return true;

  if (cc.coding && Array.isArray(cc.coding) && cc.coding.length > 0) {
    return cc.coding.some(
      (coding) => coding.code !== undefined && coding.code !== null && coding.code !== ''
    );
  }

  return false;
}
