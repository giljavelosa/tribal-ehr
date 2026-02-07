import { Knex } from 'knex';
import crypto from 'crypto';
import { SeededRNG, addDays, batchInsert } from '../utils';
import { GeneratedPatients } from './patients';
import { GeneratedUsers } from './users';

// ---------------------------------------------------------------------------
// Location definitions
// ---------------------------------------------------------------------------

interface LocationDef {
  name: string;
  type: string;
  address: {
    line1: string;
    city: string;
    state: string;
    postal_code: string;
  };
  phone: string;
}

const LOCATIONS: LocationDef[] = [
  {
    name: 'Tribal Health Main Clinic',
    type: 'outpatient',
    address: { line1: '100 Healthcare Drive', city: 'Gallup', state: 'NM', postal_code: '87301' },
    phone: '505-722-1000',
  },
  {
    name: 'Specialty Care Center',
    type: 'outpatient',
    address: { line1: '200 Specialist Way', city: 'Gallup', state: 'NM', postal_code: '87301' },
    phone: '505-722-2000',
  },
  {
    name: 'Inpatient Unit',
    type: 'inpatient',
    address: { line1: '100 Healthcare Drive, Building B', city: 'Gallup', state: 'NM', postal_code: '87301' },
    phone: '505-722-3000',
  },
  {
    name: 'Surgical Center',
    type: 'surgical',
    address: { line1: '300 Surgery Lane', city: 'Gallup', state: 'NM', postal_code: '87301' },
    phone: '505-722-4000',
  },
  {
    name: 'Skilled Nursing Facility Wing',
    type: 'snf',
    address: { line1: '100 Healthcare Drive, Wing C', city: 'Gallup', state: 'NM', postal_code: '87301' },
    phone: '505-722-5000',
  },
  {
    name: 'Urgent Care Center',
    type: 'urgent-care',
    address: { line1: '400 Urgency Boulevard', city: 'Gallup', state: 'NM', postal_code: '87301' },
    phone: '505-722-6000',
  },
];

// ---------------------------------------------------------------------------
// Appointment type definitions
// ---------------------------------------------------------------------------

interface AppointmentTypeDef {
  name: string;
  durationMinutes: number;
  color: string;
}

const APPOINTMENT_TYPES: AppointmentTypeDef[] = [
  { name: 'New Patient', durationMinutes: 60, color: '#4CAF50' },
  { name: 'Follow-up', durationMinutes: 30, color: '#2196F3' },
  { name: 'Annual Wellness', durationMinutes: 45, color: '#9C27B0' },
  { name: 'Procedure', durationMinutes: 60, color: '#F44336' },
  { name: 'Surgical Consult', durationMinutes: 45, color: '#FF9800' },
  { name: 'SNF Visit', durationMinutes: 30, color: '#795548' },
  { name: 'Telehealth', durationMinutes: 20, color: '#00BCD4' },
  { name: 'Urgent', durationMinutes: 30, color: '#E91E63' },
];

// ---------------------------------------------------------------------------
// Appointment reason templates
// ---------------------------------------------------------------------------

const APPOINTMENT_REASONS = [
  'Follow-up for chronic condition management',
  'Routine wellness examination',
  'Medication review and refill',
  'New symptom evaluation',
  'Post-procedure follow-up',
  'Pre-operative assessment',
  'Lab results review',
  'Referral consultation',
  'Immunization visit',
  'Mental health check-in',
  'Diabetes management follow-up',
  'Blood pressure monitoring',
  'Annual physical examination',
  'Wound care evaluation',
  'Pain management consultation',
];

export async function seedScheduling(
  trx: Knex.Transaction,
  patients: GeneratedPatients,
  users: GeneratedUsers,
  rng: SeededRNG,
): Promise<{ locationIds: string[]; appointmentTypeIds: string[] }> {
  const now = new Date().toISOString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ----- LOCATIONS -----
  const locationIds: string[] = [];
  const locationRows: Record<string, unknown>[] = [];

  for (const loc of LOCATIONS) {
    const id = crypto.randomUUID();
    locationIds.push(id);
    locationRows.push({
      id,
      name: loc.name,
      type: loc.type,
      address: JSON.stringify(loc.address),
      phone: loc.phone,
      active: true,
      created_at: now,
      updated_at: now,
    });
  }

  await trx.batchInsert('locations', locationRows, 100);
  console.log(`  - locations: ${locationRows.length} rows`);

  // ----- APPOINTMENT TYPES -----
  const appointmentTypeIds: string[] = [];
  const apptTypeRows: Record<string, unknown>[] = [];

  for (const apptType of APPOINTMENT_TYPES) {
    const id = crypto.randomUUID();
    appointmentTypeIds.push(id);
    apptTypeRows.push({
      id,
      name: apptType.name,
      duration_minutes: apptType.durationMinutes,
      color: apptType.color,
      active: true,
      created_at: now,
      updated_at: now,
    });
  }

  await trx.batchInsert('appointment_types', apptTypeRows, 100);
  console.log(`  - appointment_types: ${apptTypeRows.length} rows`);

  // ----- APPOINTMENTS -----
  // Generate ~300 upcoming appointments over next 4 weeks
  const appointmentRows: Record<string, unknown>[] = [];

  // Select ~300 random patients for appointments
  const numAppointments = 300;
  const selectedPatients = rng.pickN(
    patients.patients,
    Math.min(numAppointments, patients.patients.length),
  );

  // Map appointment types by name for easy lookup
  const apptTypeMap = new Map<string, { id: string; duration: number }>();
  APPOINTMENT_TYPES.forEach((at, idx) => {
    apptTypeMap.set(at.name, { id: appointmentTypeIds[idx], duration: at.durationMinutes });
  });

  // Time slots: 8am to 5pm, in 15-minute increments
  const timeSlots: number[] = [];
  for (let hour = 8; hour < 17; hour++) {
    for (let min = 0; min < 60; min += 15) {
      timeSlots.push(hour * 60 + min);
    }
  }

  for (const patient of selectedPatients) {
    const providerId = rng.pick(users.allProviderIds);
    const locationId = rng.pick(locationIds);

    // Pick an appointment type based on patient profile
    let apptTypeNames: string[];
    switch (patient.profile) {
      case 'SURGICAL':
        apptTypeNames = ['Surgical Consult', 'Procedure', 'Follow-up'];
        break;
      case 'SNF':
        apptTypeNames = ['SNF Visit', 'Follow-up'];
        break;
      case 'MENTAL_HEALTH':
        apptTypeNames = ['Follow-up', 'Telehealth'];
        break;
      case 'PEDIATRIC':
        apptTypeNames = ['Follow-up', 'New Patient', 'Annual Wellness'];
        break;
      case 'HEALTHY':
        apptTypeNames = ['Annual Wellness', 'Follow-up', 'Telehealth'];
        break;
      default:
        apptTypeNames = ['Follow-up', 'Annual Wellness', 'Telehealth', 'Urgent'];
    }

    const apptTypeName = rng.pick(apptTypeNames);
    const apptTypeInfo = apptTypeMap.get(apptTypeName) || apptTypeMap.get('Follow-up')!;

    // Random date within next 4 weeks
    const daysFromNow = rng.randomInt(0, 28);
    const apptDate = addDays(today, daysFromNow);

    // Skip weekends
    const dayOfWeek = apptDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    // Random time slot
    const slotMinutes = rng.pick(timeSlots);
    const startTime = new Date(apptDate);
    startTime.setHours(Math.floor(slotMinutes / 60), slotMinutes % 60, 0, 0);

    const endTime = new Date(startTime.getTime() + apptTypeInfo.duration * 60 * 1000);

    // Status: mostly booked, some checked-in for today
    let status = 'booked';
    if (daysFromNow === 0) {
      const currentHour = new Date().getHours();
      const apptHour = Math.floor(slotMinutes / 60);
      if (apptHour <= currentHour) {
        status = rng.chance(0.6) ? 'checked-in' : 'booked';
      }
    }

    const reason = rng.pick(APPOINTMENT_REASONS);
    const createdBy = rng.pick(users.frontDesk.length > 0 ? users.frontDesk : users.allUserIds);

    appointmentRows.push({
      id: crypto.randomUUID(),
      patient_id: patient.id,
      fhir_id: null,
      status,
      type_id: apptTypeInfo.id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      provider_id: providerId,
      location_id: locationId,
      reason,
      note: null,
      check_in_time: status === 'checked-in' ? startTime.toISOString() : null,
      check_out_time: null,
      cancellation_reason: null,
      recurring_id: null,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    });
  }

  await batchInsert(trx, 'appointments', appointmentRows);
  console.log(`  - appointments: ${appointmentRows.length} rows`);

  return { locationIds, appointmentTypeIds };
}
