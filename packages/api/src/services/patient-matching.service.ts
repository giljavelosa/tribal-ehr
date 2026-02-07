// =============================================================================
// Patient Matching Service - Soundex, Verhoeff Check Digits, Temp Patients
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService } from './base.service';
import { ValidationError, NotFoundError } from '../utils/errors';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface SimilarPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  confidence: number; // 0-100
  matchReasons: string[];
}

export interface TemporaryPatient {
  id: string;
  temporaryMrn: string;
  reason: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  sex?: string;
  active: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Verhoeff Tables
// ---------------------------------------------------------------------------

const VERHOEFF_D: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_INV: number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

const VERHOEFF_P: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

// ---------------------------------------------------------------------------
// Soundex Mapping
// ---------------------------------------------------------------------------

const SOUNDEX_MAP: Record<string, string> = {
  B: '1', F: '1', P: '1', V: '1',
  C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
  D: '3', T: '3',
  L: '4',
  M: '5', N: '5',
  R: '6',
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class PatientMatchingService extends BaseService {
  constructor() {
    super('PatientMatchingService');
  }

  // -------------------------------------------------------------------------
  // Soundex
  // -------------------------------------------------------------------------

  /**
   * Standard Soundex algorithm. Returns a 4-character code: the first letter
   * of the name followed by 3 digits derived from consonant mapping.
   */
  soundex(name: string): string {
    if (!name || name.trim().length === 0) {
      return '0000';
    }

    const upper = name.toUpperCase().replace(/[^A-Z]/g, '');
    if (upper.length === 0) {
      return '0000';
    }

    const firstLetter = upper[0];
    let result = firstLetter;

    // Get the Soundex code for the first letter (used for adjacent-duplicate check)
    let lastCode = SOUNDEX_MAP[firstLetter] || '';

    for (let i = 1; i < upper.length && result.length < 4; i++) {
      const ch = upper[i];

      // Skip H and W entirely (they are ignored but do NOT break adjacency)
      if (ch === 'H' || ch === 'W') {
        continue;
      }

      const code = SOUNDEX_MAP[ch];
      if (code) {
        // Only add if different from the previous coded consonant
        if (code !== lastCode) {
          result += code;
        }
        lastCode = code;
      } else {
        // Vowels (A, E, I, O, U) reset the last code so that two consonants
        // with the same code separated by a vowel both appear
        lastCode = '';
      }
    }

    // Pad with zeros to ensure exactly 4 characters
    return (result + '000').slice(0, 4);
  }

  // -------------------------------------------------------------------------
  // Verhoeff Check Digit
  // -------------------------------------------------------------------------

  /**
   * Compute a Verhoeff check digit for a numeric string. Returns a single
   * digit character.
   */
  verhoeffCheckDigit(num: string): string {
    const digits = num.split('').map(Number);
    let c = 0;

    // Process digits from right to left
    for (let i = digits.length - 1; i >= 0; i--) {
      const position = (digits.length - i) % 8;
      c = VERHOEFF_D[c][VERHOEFF_P[position][digits[i]]];
    }

    return String(VERHOEFF_INV[c]);
  }

  // -------------------------------------------------------------------------
  // MRN Generation & Validation
  // -------------------------------------------------------------------------

  /**
   * Generate an MRN with Verhoeff check digit.
   * Format: TRB-XXXXXX-C where X is the zero-padded sequence and C is the
   * check digit.
   */
  generateMRNWithCheckDigit(sequenceNum: number): string {
    const padded = String(sequenceNum).padStart(6, '0');
    const checkDigit = this.verhoeffCheckDigit(padded);
    return `TRB-${padded}-${checkDigit}`;
  }

  /**
   * Validate an MRN in TRB-XXXXXX-C format by recomputing the check digit.
   */
  validateMRNCheckDigit(mrn: string): boolean {
    const match = mrn.match(/^TRB-(\d{6})-(\d)$/);
    if (!match) {
      return false;
    }

    const numericPart = match[1];
    const providedCheck = match[2];
    const expectedCheck = this.verhoeffCheckDigit(numericPart);

    return providedCheck === expectedCheck;
  }

  // -------------------------------------------------------------------------
  // Patient Matching
  // -------------------------------------------------------------------------

  /**
   * Find patients similar to the given demographic parameters using a
   * multi-factor scoring approach. Returns matches with confidence >= 30
   * sorted by confidence descending, limited to 20 results.
   */
  async findSimilarPatients(params: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    sex?: string;
  }): Promise<SimilarPatient[]> {
    try {
      const { firstName, lastName, dateOfBirth, sex } = params;

      // Need at least one parameter to search
      if (!firstName && !lastName && !dateOfBirth && !sex) {
        throw new ValidationError('At least one search parameter is required');
      }

      // Compute Soundex codes for the input names
      const firstNameSoundex = firstName ? this.soundex(firstName) : null;
      const lastNameSoundex = lastName ? this.soundex(lastName) : null;

      // Query all active patients
      const patients = await this.db('patients')
        .select(
          'id',
          'mrn',
          'first_name',
          'last_name',
          'date_of_birth',
          'sex',
          'soundex_first',
          'soundex_last'
        )
        .where('active', true);

      // Score each patient
      const scored: SimilarPatient[] = [];

      for (const patient of patients) {
        let confidence = 0;
        const matchReasons: string[] = [];

        // Exact DOB match: +30 points
        if (dateOfBirth && patient.date_of_birth) {
          const patientDob =
            patient.date_of_birth instanceof Date
              ? patient.date_of_birth.toISOString().split('T')[0]
              : String(patient.date_of_birth);
          if (patientDob === dateOfBirth) {
            confidence += 30;
            matchReasons.push('Exact date of birth match');
          }
        }

        // Soundex last name match: +25 points
        if (lastNameSoundex && patient.soundex_last) {
          if (lastNameSoundex === patient.soundex_last) {
            confidence += 25;
            matchReasons.push('Soundex last name match');
          }
        } else if (lastNameSoundex && patient.last_name) {
          // Compute Soundex on the fly if not stored
          if (lastNameSoundex === this.soundex(patient.last_name)) {
            confidence += 25;
            matchReasons.push('Soundex last name match');
          }
        }

        // Soundex first name match: +20 points
        if (firstNameSoundex && patient.soundex_first) {
          if (firstNameSoundex === patient.soundex_first) {
            confidence += 20;
            matchReasons.push('Soundex first name match');
          }
        } else if (firstNameSoundex && patient.first_name) {
          if (firstNameSoundex === this.soundex(patient.first_name)) {
            confidence += 20;
            matchReasons.push('Soundex first name match');
          }
        }

        // Exact last name (case-insensitive): +15 points
        if (lastName && patient.last_name) {
          if (lastName.toLowerCase() === patient.last_name.toLowerCase()) {
            confidence += 15;
            matchReasons.push('Exact last name match');
          }
        }

        // Exact first name (case-insensitive): +10 points
        if (firstName && patient.first_name) {
          if (firstName.toLowerCase() === patient.first_name.toLowerCase()) {
            confidence += 10;
            matchReasons.push('Exact first name match');
          }
        }

        // Sex match: +5 points
        if (sex && patient.sex) {
          if (sex.toLowerCase() === patient.sex.toLowerCase()) {
            confidence += 5;
            matchReasons.push('Sex match');
          }
        }

        if (confidence >= 30) {
          scored.push({
            id: patient.id,
            mrn: patient.mrn || '',
            firstName: patient.first_name || '',
            lastName: patient.last_name || '',
            dateOfBirth: patient.date_of_birth
              ? patient.date_of_birth instanceof Date
                ? patient.date_of_birth.toISOString().split('T')[0]
                : String(patient.date_of_birth)
              : '',
            sex: patient.sex || '',
            confidence,
            matchReasons,
          });
        }
      }

      // Sort by confidence descending
      scored.sort((a, b) => b.confidence - a.confidence);

      // Limit to 20
      return scored.slice(0, 20);
    } catch (error) {
      this.handleError('Failed to find similar patients', error);
    }
  }

  // -------------------------------------------------------------------------
  // Temporary Patients
  // -------------------------------------------------------------------------

  /**
   * Create a temporary patient record with an auto-generated temporary MRN.
   */
  async createTemporaryPatient(data: {
    reason: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    sex?: string;
    createdBy: string;
  }): Promise<TemporaryPatient> {
    try {
      if (!data.reason) {
        throw new ValidationError('Reason is required for temporary patient');
      }

      const id = uuidv4();
      const temporaryMrn = `TEMP-${uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase()}`;

      const record = {
        id,
        temporary_mrn: temporaryMrn,
        reason: data.reason,
        first_name: data.firstName || null,
        last_name: data.lastName || null,
        date_of_birth: data.dateOfBirth || null,
        sex: data.sex || null,
        active: true,
        created_by: data.createdBy,
      };

      await this.db('temporary_patients').insert(record);

      this.logger.info('Created temporary patient', {
        id,
        temporaryMrn,
        reason: data.reason,
      });

      return {
        id,
        temporaryMrn,
        reason: data.reason,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        sex: data.sex,
        active: true,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      this.handleError('Failed to create temporary patient', error);
    }
  }

  /**
   * Merge a temporary patient into a real patient record. Marks the temporary
   * patient as inactive and records the merge metadata.
   */
  async mergeTemporaryToReal(
    tempId: string,
    realPatientId: string,
    mergedBy: string
  ): Promise<void> {
    try {
      // Verify temporary patient exists and is active
      const tempPatient = await this.db('temporary_patients')
        .where({ id: tempId, active: true })
        .first();

      if (!tempPatient) {
        throw new NotFoundError('Temporary patient', tempId);
      }

      // Verify real patient exists
      await this.requireExists('patients', realPatientId, 'Patient');

      // Perform the merge
      await this.db('temporary_patients').where({ id: tempId }).update({
        active: false,
        merged_to_patient_id: realPatientId,
        merged_at: this.db.fn.now(),
        merged_by: mergedBy,
      });

      this.logger.info('Merged temporary patient to real patient', {
        tempId,
        realPatientId,
        mergedBy,
      });
    } catch (error) {
      this.handleError('Failed to merge temporary patient', error);
    }
  }

  // -------------------------------------------------------------------------
  // Soundex Backfill
  // -------------------------------------------------------------------------

  /**
   * Backfill soundex_first and soundex_last columns for all patients that
   * don't already have them populated. Returns the number of patients updated.
   */
  async backfillSoundex(): Promise<number> {
    try {
      const patients = await this.db('patients')
        .select('id', 'first_name', 'last_name')
        .where(function () {
          this.whereNull('soundex_first').orWhereNull('soundex_last');
        })
        .andWhere('active', true);

      let count = 0;

      for (const patient of patients) {
        const updates: Record<string, string> = {};

        if (patient.first_name) {
          updates.soundex_first = this.soundex(patient.first_name);
        }
        if (patient.last_name) {
          updates.soundex_last = this.soundex(patient.last_name);
        }

        if (Object.keys(updates).length > 0) {
          await this.db('patients').where({ id: patient.id }).update(updates);
          count++;
        }
      }

      this.logger.info(`Backfilled Soundex codes for ${count} patients`);
      return count;
    } catch (error) {
      this.handleError('Failed to backfill Soundex codes', error);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const patientMatchingService = new PatientMatchingService();
