import { Knex } from 'knex';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface GeneratedUsers {
  physicians: string[];
  nurses: string[];
  medicalAssistants: string[];
  frontDesk: string[];
  billing: string[];
  admins: string[];
  systemAdmins: string[];
  patientUsers: string[];
  allProviderIds: string[];
  allUserIds: string[];
}

export async function seedUsers(trx: Knex.Transaction): Promise<GeneratedUsers> {
  // Pre-hash password once
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const users: Record<string, unknown>[] = [];
  const result: GeneratedUsers = {
    physicians: [],
    nurses: [],
    medicalAssistants: [],
    frontDesk: [],
    billing: [],
    admins: [],
    systemAdmins: [],
    patientUsers: [],
    allProviderIds: [],
    allUserIds: [],
  };

  // Generate specific users for each role
  const staffDefs = [
    // 5 physicians
    { firstName: 'Sarah', lastName: 'Whitehorse', role: 'PHYSICIAN', username: 'swhitehorse', npi: '1234567893', dea: 'AW1234567', specialties: ['Internal Medicine'] },
    { firstName: 'James', lastName: 'Redhawk', role: 'PHYSICIAN', username: 'jredhawk', npi: '1234567901', dea: 'AR1234567', specialties: ['Family Medicine'] },
    { firstName: 'Maria', lastName: 'Garcia', role: 'PHYSICIAN', username: 'mgarcia', npi: '1234567919', dea: 'AG1234567', specialties: ['Cardiology'] },
    { firstName: 'David', lastName: 'Chen', role: 'PHYSICIAN', username: 'dchen', npi: '1234567927', dea: 'AC1234567', specialties: ['General Surgery'] },
    { firstName: 'Emily', lastName: 'Strongbow', role: 'PHYSICIAN', username: 'estrongbow', npi: '1234567935', dea: 'AS1234567', specialties: ['Psychiatry'] },
    // 4 nurses
    { firstName: 'Lisa', lastName: 'Morningstar', role: 'NURSE', username: 'lmorningstar' },
    { firstName: 'Michael', lastName: 'Tallchief', role: 'NURSE', username: 'mtallchief' },
    { firstName: 'Jennifer', lastName: 'Brightwater', role: 'NURSE', username: 'jbrightwater' },
    { firstName: 'Robert', lastName: 'Clearsky', role: 'NURSE', username: 'rclearsky' },
    // 3 medical assistants
    { firstName: 'Amanda', lastName: 'Silvercloud', role: 'MEDICAL_ASSISTANT', username: 'asilvercloud' },
    { firstName: 'Daniel', lastName: 'Windwalker', role: 'MEDICAL_ASSISTANT', username: 'dwindwalker' },
    { firstName: 'Rachel', lastName: 'Sunflower', role: 'MEDICAL_ASSISTANT', username: 'rsunflower' },
    // 2 front desk
    { firstName: 'Karen', lastName: 'Johnson', role: 'FRONT_DESK', username: 'kjohnson' },
    { firstName: 'Steven', lastName: 'Martinez', role: 'FRONT_DESK', username: 'smartinez' },
    // 2 billing
    { firstName: 'Patricia', lastName: 'Williams', role: 'BILLING', username: 'pwilliams' },
    { firstName: 'Thomas', lastName: 'Anderson', role: 'BILLING', username: 'tanderson' },
    // 2 admin
    { firstName: 'Susan', lastName: 'Thompson', role: 'ADMIN', username: 'sthompson' },
    { firstName: 'Richard', lastName: 'Davis', role: 'ADMIN', username: 'rdavis' },
    // 1 system admin
    { firstName: 'Admin', lastName: 'System', role: 'SYSTEM_ADMIN', username: 'admin' },
    // 10 additional staff to reach 30
    { firstName: 'Catherine', lastName: 'Eaglefeather', role: 'PHYSICIAN', username: 'ceaglefeather', npi: '1234567943', dea: 'AE1234567', specialties: ['Pediatrics'] },
    { firstName: 'Marcus', lastName: 'Ironhawk', role: 'PHYSICIAN', username: 'mironhawk', npi: '1234567950', dea: 'AI1234567', specialties: ['Emergency Medicine'] },
    { firstName: 'Nicole', lastName: 'Swiftwater', role: 'NURSE', username: 'nswiftwater' },
    { firstName: 'Brian', lastName: 'Thunderhawk', role: 'NURSE', username: 'bthunderhawk' },
    { firstName: 'Angela', lastName: 'Riverbend', role: 'MEDICAL_ASSISTANT', username: 'arivervend' },
    { firstName: 'Jason', lastName: 'Stonecrow', role: 'MEDICAL_ASSISTANT', username: 'jstonecrow' },
    { firstName: 'Melissa', lastName: 'Pineleaf', role: 'NURSE', username: 'mpineleaf' },
    { firstName: 'Tyler', lastName: 'Cedarwood', role: 'NURSE', username: 'tcedarwood' },
    { firstName: 'Samantha', lastName: 'Wildrose', role: 'FRONT_DESK', username: 'swildrose' },
    { firstName: 'Kevin', lastName: 'Snowbird', role: 'BILLING', username: 'ksnowbird' },
    { firstName: 'Laura', lastName: 'Foxrun', role: 'ADMIN', username: 'lfoxrun' },
  ];

  const now = new Date().toISOString();

  for (const def of staffDefs) {
    const id = crypto.randomUUID();
    users.push({
      id,
      username: def.username,
      email: `${def.username}@tribal-ehr.org`,
      password_hash: passwordHash,
      first_name: def.firstName,
      last_name: def.lastName,
      role: def.role,
      npi: (def as Record<string, unknown>).npi || null,
      dea: (def as Record<string, unknown>).dea || null,
      specialties: JSON.stringify((def as Record<string, unknown>).specialties || []),
      active: true,
      mfa_enabled: false,
      mfa_secret: null,
      last_login: now,
      password_changed_at: now,
      failed_login_attempts: 0,
      locked_until: null,
      created_at: now,
      updated_at: now,
    });

    // Categorize
    switch (def.role) {
      case 'PHYSICIAN':
        result.physicians.push(id);
        result.allProviderIds.push(id);
        break;
      case 'NURSE':
        result.nurses.push(id);
        break;
      case 'MEDICAL_ASSISTANT':
        result.medicalAssistants.push(id);
        break;
      case 'FRONT_DESK':
        result.frontDesk.push(id);
        break;
      case 'BILLING':
        result.billing.push(id);
        break;
      case 'ADMIN':
        result.admins.push(id);
        break;
      case 'SYSTEM_ADMIN':
        result.systemAdmins.push(id);
        break;
    }
    result.allUserIds.push(id);
  }

  // 10 patient portal users
  for (let i = 0; i < 10; i++) {
    const id = crypto.randomUUID();
    users.push({
      id,
      username: `patient${i + 1}`,
      email: `patient${i + 1}@example.com`,
      password_hash: passwordHash,
      first_name: 'Portal',
      last_name: `Patient${i + 1}`,
      role: 'PATIENT',
      npi: null,
      dea: null,
      specialties: JSON.stringify([]),
      active: true,
      mfa_enabled: false,
      mfa_secret: null,
      last_login: null,
      password_changed_at: now,
      failed_login_attempts: 0,
      locked_until: null,
      created_at: now,
      updated_at: now,
    });
    result.patientUsers.push(id);
    result.allUserIds.push(id);
  }

  await trx.batchInsert('users', users, 50);
  console.log(`  - users: ${users.length} rows`);
  return result;
}
