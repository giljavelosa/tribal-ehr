import crypto from 'crypto';
import { Knex } from 'knex';
import { SEED_CONFIG } from './config';

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32)
// ---------------------------------------------------------------------------

export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** Returns a pseudo-random float in [0, 1). */
  random(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns a pseudo-random integer in [min, max] (inclusive). */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /** Pick a single random element from an array. */
  pick<T>(array: T[]): T {
    return array[this.randomInt(0, array.length - 1)];
  }

  /** Pick n unique random elements from an array. */
  pickN<T>(array: T[], n: number): T[] {
    const copy = [...array];
    const result: T[] = [];
    const count = Math.min(n, copy.length);
    for (let i = 0; i < count; i++) {
      const idx = this.randomInt(0, copy.length - 1);
      result.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return result;
  }

  /** Returns a random Date between start and end. */
  randomDate(start: Date, end: Date): Date {
    const startMs = start.getTime();
    const endMs = end.getTime();
    return new Date(startMs + this.random() * (endMs - startMs));
  }

  /** Returns true with the given probability (0..1). */
  chance(probability: number): boolean {
    return this.random() < probability;
  }

  /** Pick an item based on weighted probabilities. weights must sum to ~1.0. */
  weightedPick<T>(items: T[], weights: number[]): T {
    const r = this.random();
    let cumulative = 0;
    for (let i = 0; i < items.length; i++) {
      cumulative += weights[i];
      if (r <= cumulative) {
        return items[i];
      }
    }
    return items[items.length - 1];
  }
}

// ---------------------------------------------------------------------------
// UUID generation
// ---------------------------------------------------------------------------

export function generateUUID(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Format a Date as YYYY-MM-DD. */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** Add n days to a date (returns a new Date). */
export function addDays(date: Date, n: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + n);
  return result;
}

/** Add n hours to a date (returns a new Date). */
export function addHours(date: Date, n: number): Date {
  const result = new Date(date);
  result.setTime(result.getTime() + n * 60 * 60 * 1000);
  return result;
}

/** Return a random Date between start and end using the provided RNG. */
export function randomDateBetween(start: Date, end: Date, rng: SeededRNG): Date {
  return rng.randomDate(start, end);
}

// ---------------------------------------------------------------------------
// Generator helpers
// ---------------------------------------------------------------------------

/** Generate an MRN like TRB-000001. */
export function generateMRN(index: number): string {
  return `${SEED_CONFIG.MRN_PREFIX}-${String(index + 1).padStart(6, '0')}`;
}

/** Generate a realistic US phone number. */
export function generatePhone(rng: SeededRNG): string {
  const areaCodes = [505, 575, 928, 406, 907, 605, 918, 580, 480, 520];
  const area = rng.pick(areaCodes);
  const exchange = rng.randomInt(200, 999);
  const subscriber = rng.randomInt(1000, 9999);
  return `${area}-${exchange}-${subscriber}`;
}

/** Generate an SSN in XXX-XX-XXXX format (fake, non-issuable range). */
export function generateSSN(rng: SeededRNG): string {
  const area = rng.randomInt(900, 999); // 900+ range is not issued by SSA
  const group = rng.randomInt(10, 99);
  const serial = rng.randomInt(1000, 9999);
  return `${area}-${group}-${serial}`;
}

/** Generate an email from first.last@domain. */
export function generateEmail(first: string, last: string, rng: SeededRNG): string {
  const domains = [
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'ihs.gov',
    'navajo-nsn.gov',
    'tribalmail.org',
  ];
  const domain = rng.pick(domains);
  const suffix = rng.randomInt(1, 999);
  const cleanFirst = first.toLowerCase().replace(/[^a-z]/g, '');
  const cleanLast = last.toLowerCase().replace(/[^a-z]/g, '');
  return `${cleanFirst}.${cleanLast}${suffix}@${domain}`;
}

// ---------------------------------------------------------------------------
// Batch insert helper
// ---------------------------------------------------------------------------

/**
 * Insert rows into a table in batches within a Knex transaction.
 * Uses trx.batchInsert which handles chunking internally.
 */
export async function batchInsert(
  trx: Knex.Transaction,
  table: string,
  rows: Record<string, unknown>[],
  batchSize: number = 500,
): Promise<void> {
  if (rows.length === 0) return;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    await trx.batchInsert(table, chunk, batchSize);
  }
}
