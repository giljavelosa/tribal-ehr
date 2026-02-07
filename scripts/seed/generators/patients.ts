import { Knex } from 'knex';
import crypto from 'crypto';
import { SeededRNG, generateMRN, generatePhone, generateSSN, generateEmail, formatDate, batchInsert } from '../utils';
import { SEED_CONFIG, PROFILE_DISTRIBUTION } from '../config';
import { ProfileType, CLINICAL_PROFILES } from '../profiles/clinical-profiles';
import {
  FIRST_NAMES_MALE, FIRST_NAMES_FEMALE, LAST_NAMES,
  STREET_ADDRESSES, CITIES_STATES, RACE_CODES, ETHNICITY_OPTIONS,
  LANGUAGES, PAYER_NAMES, PLAN_TYPES, RELATIONSHIPS,
} from '../reference-data/demographics';
import { GeneratedUsers } from './users';

export interface GeneratedPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dob: string;
  sex: string;
  profile: ProfileType;
  age: number;
}

export interface GeneratedPatients {
  patients: GeneratedPatient[];
  patientMap: Map<string, GeneratedPatient>;
}

/**
 * Assign a clinical profile based on patient index and PROFILE_DISTRIBUTION.
 * We walk the distribution cumulatively so the first N% get profile A, etc.
 */
function assignProfile(patientIndex: number, totalPatients: number): ProfileType {
  const entries = Object.entries(PROFILE_DISTRIBUTION) as [ProfileType, number][];
  let cumulative = 0;
  const ratio = patientIndex / totalPatients;
  for (const [profile, weight] of entries) {
    cumulative += weight;
    if (ratio < cumulative) {
      return profile;
    }
  }
  return 'HEALTHY';
}

/**
 * Generate a date-of-birth that falls within the profile's ageRange.
 * Uses the reference date of DATE_RANGE_END to calculate backwards.
 */
function generateDOB(profile: ProfileType, rng: SeededRNG): { dob: string; age: number } {
  const profileDef = CLINICAL_PROFILES[profile];
  const ageMin = profileDef.ageRange.min;
  const ageMax = profileDef.ageRange.max;
  const age = rng.randomInt(ageMin, ageMax);

  const refDate = new Date(SEED_CONFIG.DATE_RANGE_END);
  const year = refDate.getFullYear() - age;
  const month = rng.randomInt(1, 12);
  const maxDay = new Date(year, month, 0).getDate(); // last day of month
  const day = rng.randomInt(1, maxDay);
  const dob = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { dob, age };
}

export async function seedPatients(
  trx: Knex.Transaction,
  users: GeneratedUsers,
  rng: SeededRNG,
  count: number,
): Promise<GeneratedPatients> {
  const now = new Date().toISOString();
  const today = formatDate(new Date());

  const patientRows: Record<string, unknown>[] = [];
  const addressRows: Record<string, unknown>[] = [];
  const phoneRows: Record<string, unknown>[] = [];
  const emailRows: Record<string, unknown>[] = [];
  const emergencyContactRows: Record<string, unknown>[] = [];
  const insuranceRows: Record<string, unknown>[] = [];

  const result: GeneratedPatients = {
    patients: [],
    patientMap: new Map(),
  };

  const maritalStatuses = ['S', 'M', 'D', 'W', 'UNK'];

  for (let i = 0; i < count; i++) {
    const id = crypto.randomUUID();
    const mrn = generateMRN(i);
    const profile = assignProfile(i, count);
    const { dob, age } = generateDOB(profile, rng);

    const sex = rng.chance(0.5) ? 'male' : 'female';
    const firstName = sex === 'male'
      ? rng.pick(FIRST_NAMES_MALE)
      : rng.pick(FIRST_NAMES_FEMALE);
    const lastName = rng.pick(LAST_NAMES);
    const middleNames = sex === 'male' ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE;
    const middleName = rng.chance(0.6) ? rng.pick(middleNames) : null;

    // Race: weighted toward American Indian for this tribal EHR
    const raceWeights = [0.55, 0.05, 0.05, 0.20, 0.02, 0.13];
    const raceCode = rng.weightedPick(RACE_CODES, raceWeights);
    const ethnicity = rng.pick(ETHNICITY_OPTIONS);
    const language = rng.weightedPick(
      LANGUAGES,
      [0.60, 0.15, 0.10, 0.05, 0.03, 0.04, 0.03],
    );
    const maritalStatus = age < 18 ? 'S' : rng.pick(maritalStatuses);

    const createdBy = rng.pick(users.frontDesk.length > 0 ? users.frontDesk : users.allUserIds);

    // SSN encryption placeholder (fake encrypted data for seed)
    const ssnRaw = generateSSN(rng);
    const ssnIv = crypto.randomBytes(16).toString('hex');
    const ssnTag = crypto.randomBytes(16).toString('hex');

    patientRows.push({
      id,
      mrn,
      fhir_id: null,
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      suffix: null,
      date_of_birth: dob,
      sex,
      gender_identity: null,
      sexual_orientation: null,
      race: JSON.stringify([{ code: raceCode.code, display: raceCode.display, system: raceCode.system }]),
      ethnicity,
      preferred_language: language,
      marital_status: maritalStatus,
      ssn_encrypted: ssnRaw, // In real usage this would be AES-encrypted
      ssn_iv: ssnIv,
      ssn_tag: ssnTag,
      photo_url: null,
      deceased_boolean: false,
      deceased_date_time: null,
      multiple_birth_boolean: null,
      multiple_birth_integer: null,
      communication_preferences: JSON.stringify({ email: rng.chance(0.7), sms: rng.chance(0.5), phone: true }),
      active: true,
      created_by: createdBy,
      updated_by: createdBy,
      created_at: now,
      updated_at: now,
    });

    const generatedPatient: GeneratedPatient = {
      id, mrn, firstName, lastName, dob, sex, profile, age,
    };
    result.patients.push(generatedPatient);
    result.patientMap.set(id, generatedPatient);

    // ---------------------------------------------------------------------------
    // Addresses: 1-2 per patient
    // ---------------------------------------------------------------------------
    const cityState = rng.pick(CITIES_STATES);
    addressRows.push({
      id: crypto.randomUUID(),
      patient_id: id,
      use: 'home',
      type: 'physical',
      line1: rng.pick(STREET_ADDRESSES),
      line2: rng.chance(0.2) ? `Apt ${rng.randomInt(1, 400)}` : null,
      city: cityState.city,
      state: cityState.state,
      postal_code: cityState.zip,
      country: 'US',
      period_start: dob,
      period_end: null,
      created_at: now,
      updated_at: now,
    });

    if (rng.chance(0.3)) {
      const mailCity = rng.pick(CITIES_STATES);
      addressRows.push({
        id: crypto.randomUUID(),
        patient_id: id,
        use: 'billing',
        type: 'postal',
        line1: `PO Box ${rng.randomInt(100, 9999)}`,
        line2: null,
        city: mailCity.city,
        state: mailCity.state,
        postal_code: mailCity.zip,
        country: 'US',
        period_start: today,
        period_end: null,
        created_at: now,
        updated_at: now,
      });
    }

    // ---------------------------------------------------------------------------
    // Phone numbers: 1-2 per patient
    // ---------------------------------------------------------------------------
    phoneRows.push({
      id: crypto.randomUUID(),
      patient_id: id,
      use: 'home',
      system: 'phone',
      value: generatePhone(rng),
      created_at: now,
      updated_at: now,
    });

    if (rng.chance(0.75)) {
      phoneRows.push({
        id: crypto.randomUUID(),
        patient_id: id,
        use: 'mobile',
        system: 'phone',
        value: generatePhone(rng),
        created_at: now,
        updated_at: now,
      });
    }

    // ---------------------------------------------------------------------------
    // Emails: 1 per patient
    // ---------------------------------------------------------------------------
    emailRows.push({
      id: crypto.randomUUID(),
      patient_id: id,
      use: 'home',
      value: generateEmail(firstName, lastName, rng),
      created_at: now,
      updated_at: now,
    });

    // ---------------------------------------------------------------------------
    // Emergency contacts: 1-2 per patient
    // ---------------------------------------------------------------------------
    const ecCount = rng.randomInt(1, 2);
    for (let e = 0; e < ecCount; e++) {
      const ecFirstName = rng.chance(0.5) ? rng.pick(FIRST_NAMES_MALE) : rng.pick(FIRST_NAMES_FEMALE);
      const ecLastName = rng.chance(0.6) ? lastName : rng.pick(LAST_NAMES);
      const ecCity = rng.pick(CITIES_STATES);
      emergencyContactRows.push({
        id: crypto.randomUUID(),
        patient_id: id,
        name: `${ecFirstName} ${ecLastName}`,
        relationship: rng.pick(RELATIONSHIPS),
        phone: generatePhone(rng),
        address: JSON.stringify({
          line1: rng.pick(STREET_ADDRESSES),
          city: ecCity.city,
          state: ecCity.state,
          postal_code: ecCity.zip,
        }),
        created_at: now,
        updated_at: now,
      });
    }

    // ---------------------------------------------------------------------------
    // Insurance coverages: 1-2 per patient
    // ---------------------------------------------------------------------------
    const insCount = rng.randomInt(1, 2);
    for (let ins = 0; ins < insCount; ins++) {
      const payerName = rng.pick(PAYER_NAMES);
      const planType = rng.pick(PLAN_TYPES);
      const effectiveYear = rng.randomInt(2020, 2024);
      insuranceRows.push({
        id: crypto.randomUUID(),
        patient_id: id,
        payer_id: `PAYER-${payerName.replace(/\s+/g, '-').toUpperCase().slice(0, 20)}`,
        payer_name: payerName,
        member_id: `MBR${String(rng.randomInt(100000, 999999))}`,
        group_number: `GRP${String(rng.randomInt(10000, 99999))}`,
        plan_name: `${payerName} ${planType}`,
        plan_type: planType,
        subscriber_relationship: ins === 0 ? 'self' : rng.pick(['spouse', 'child', 'other']),
        effective_date: `${effectiveYear}-01-01`,
        termination_date: null,
        copay: rng.pick([15, 20, 25, 30, 40, 50]),
        deductible: rng.pick([250, 500, 1000, 1500, 2000, 2500]),
        priority: ins + 1,
        active: true,
        created_at: now,
        updated_at: now,
      });
    }
  }

  // Batch insert all rows
  await batchInsert(trx, 'patients', patientRows);
  await batchInsert(trx, 'patient_addresses', addressRows);
  await batchInsert(trx, 'patient_phone_numbers', phoneRows);
  await batchInsert(trx, 'patient_emails', emailRows);
  await batchInsert(trx, 'emergency_contacts', emergencyContactRows);
  await batchInsert(trx, 'insurance_coverages', insuranceRows);

  console.log(`  - patients: ${patientRows.length} rows`);
  console.log(`  - patient_addresses: ${addressRows.length} rows`);
  console.log(`  - patient_phone_numbers: ${phoneRows.length} rows`);
  console.log(`  - patient_emails: ${emailRows.length} rows`);
  console.log(`  - emergency_contacts: ${emergencyContactRows.length} rows`);
  console.log(`  - insurance_coverages: ${insuranceRows.length} rows`);

  return result;
}
