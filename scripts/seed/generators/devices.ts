import { Knex } from 'knex';
import crypto from 'crypto';
import { SeededRNG, formatDate, addDays, batchInsert } from '../utils';
import { GeneratedPatients } from './patients';

// ---------------------------------------------------------------------------
// Device type definitions
// ---------------------------------------------------------------------------

interface DeviceType {
  typeCode: string;
  typeDisplay: string;
  manufacturer: string;
  models: string[];
  prefix: string;
  expirationYears: number; // years from implant to expiration
}

const DEVICE_TYPES: DeviceType[] = [
  {
    typeCode: '63653',
    typeDisplay: 'Joint prosthesis, knee',
    manufacturer: 'Stryker Corporation',
    models: ['Triathlon Total Knee System', 'Scorpio NRG', 'Mako SmartRobotics Knee'],
    prefix: 'KNE',
    expirationYears: 20,
  },
  {
    typeCode: '63289',
    typeDisplay: 'Joint prosthesis, hip',
    manufacturer: 'Zimmer Biomet',
    models: ['Taperloc Complete Hip', 'G7 Acetabular System', 'Persona Hip'],
    prefix: 'HIP',
    expirationYears: 20,
  },
  {
    typeCode: '14106009',
    typeDisplay: 'Cardiac pacemaker',
    manufacturer: 'Medtronic',
    models: ['Micra AV', 'Azure MRI SureScan', 'Adapta DR'],
    prefix: 'CPM',
    expirationYears: 10,
  },
  {
    typeCode: '706004007',
    typeDisplay: 'Cardiac defibrillator',
    manufacturer: 'Abbott (St. Jude Medical)',
    models: ['Gallant ICD', 'Ellipse VR', 'Fortify Assura'],
    prefix: 'ICD',
    expirationYears: 8,
  },
  {
    typeCode: '469008007',
    typeDisplay: 'Insulin infusion pump',
    manufacturer: 'Medtronic',
    models: ['MiniMed 780G', 'MiniMed 770G', 'MiniMed 670G'],
    prefix: 'INS',
    expirationYears: 4,
  },
  {
    typeCode: '702172008',
    typeDisplay: 'CPAP device',
    manufacturer: 'ResMed',
    models: ['AirSense 11', 'AirSense 10 AutoSet', 'AirMini Travel'],
    prefix: 'CPA',
    expirationYears: 5,
  },
  {
    typeCode: '272287005',
    typeDisplay: 'Coronary stent',
    manufacturer: 'Boston Scientific',
    models: ['SYNERGY Stent', 'PROMUS PREMIER', 'TAXUS Element'],
    prefix: 'STN',
    expirationYears: 0, // permanent
  },
];

/**
 * Generate a realistic UDI device identifier.
 * Format: (01)GTIN(11)ProductionDate(17)ExpirationDate(10)LotNumber(21)SerialNumber
 */
function generateUDI(prefix: string, serialNum: string, rng: SeededRNG): {
  deviceIdentifier: string;
  carrierHRF: string;
} {
  const gtin = `0088${String(rng.randomInt(1000000, 9999999)).padStart(7, '0')}${rng.randomInt(0, 9)}`;
  const productionDate = `${rng.randomInt(2020, 2024)}${String(rng.randomInt(1, 12)).padStart(2, '0')}${String(rng.randomInt(1, 28)).padStart(2, '0')}`;
  const lotNumber = `${prefix}${String(rng.randomInt(10000, 99999))}`;

  const deviceIdentifier = gtin;
  const carrierHRF = `(01)${gtin}(11)${productionDate}(10)${lotNumber}(21)${serialNum}`;

  return { deviceIdentifier, carrierHRF };
}

export async function seedDevices(
  trx: Knex.Transaction,
  patients: GeneratedPatients,
  rng: SeededRNG,
): Promise<void> {
  const now = new Date().toISOString();
  const deviceRows: Record<string, unknown>[] = [];

  // Get surgical patients for joint prostheses
  const surgicalPatients = patients.patients.filter(p => p.profile === 'SURGICAL');
  // Get cardiac patients for cardiac devices
  const cardiacPatients = patients.patients.filter(p => p.profile === 'CARDIAC');
  // Get diabetic patients for insulin pumps
  const diabeticPatients = patients.patients.filter(p => p.profile === 'DIABETIC');
  // Get SNF patients for CPAP devices
  const snfPatients = patients.patients.filter(p => p.profile === 'SNF');

  // Assign joint prostheses to surgical patients (knee/hip)
  const jointDevices = DEVICE_TYPES.filter(d =>
    d.typeDisplay.includes('Joint prosthesis')
  );
  for (const patient of surgicalPatients) {
    const device = rng.pick(jointDevices);
    const model = rng.pick(device.models);
    const serialNumber = `${device.prefix}-${String(rng.randomInt(100000, 999999))}`;
    const implantDate = new Date(`${2023 + rng.randomInt(0, 1)}-${String(rng.randomInt(1, 12)).padStart(2, '0')}-${String(rng.randomInt(1, 28)).padStart(2, '0')}`);
    const expirationDate = device.expirationYears > 0
      ? formatDate(addDays(implantDate, device.expirationYears * 365))
      : null;

    const udi = generateUDI(device.prefix, serialNumber, rng);

    deviceRows.push({
      id: crypto.randomUUID(),
      patient_id: patient.id,
      fhir_id: null,
      udi_device_identifier: udi.deviceIdentifier,
      udi_issuer: 'http://hl7.org/fhir/NamingSystem/gs1-di',
      udi_jurisdiction: 'http://hl7.org/fhir/NamingSystem/fda-udi',
      udi_carrier_aidc: null,
      udi_carrier_hrf: udi.carrierHRF,
      status: 'active',
      type_code: device.typeCode,
      type_display: device.typeDisplay,
      manufacturer: device.manufacturer,
      model,
      serial_number: serialNumber,
      expiration_date: expirationDate,
      created_at: now,
      updated_at: now,
    });
  }

  // Assign cardiac devices to some cardiac patients
  const cardiacDevices = DEVICE_TYPES.filter(d =>
    d.typeDisplay.includes('Cardiac') || d.typeDisplay.includes('Coronary')
  );
  const cardiacDevicePatients = rng.pickN(cardiacPatients, Math.min(10, cardiacPatients.length));
  for (const patient of cardiacDevicePatients) {
    const device = rng.pick(cardiacDevices);
    const model = rng.pick(device.models);
    const serialNumber = `${device.prefix}-${String(rng.randomInt(100000, 999999))}`;
    const implantDate = new Date(`${2022 + rng.randomInt(0, 2)}-${String(rng.randomInt(1, 12)).padStart(2, '0')}-${String(rng.randomInt(1, 28)).padStart(2, '0')}`);
    const expirationDate = device.expirationYears > 0
      ? formatDate(addDays(implantDate, device.expirationYears * 365))
      : null;

    const udi = generateUDI(device.prefix, serialNumber, rng);

    deviceRows.push({
      id: crypto.randomUUID(),
      patient_id: patient.id,
      fhir_id: null,
      udi_device_identifier: udi.deviceIdentifier,
      udi_issuer: 'http://hl7.org/fhir/NamingSystem/gs1-di',
      udi_jurisdiction: 'http://hl7.org/fhir/NamingSystem/fda-udi',
      udi_carrier_aidc: null,
      udi_carrier_hrf: udi.carrierHRF,
      status: 'active',
      type_code: device.typeCode,
      type_display: device.typeDisplay,
      manufacturer: device.manufacturer,
      model,
      serial_number: serialNumber,
      expiration_date: expirationDate,
      created_at: now,
      updated_at: now,
    });
  }

  // Assign insulin pumps to some diabetic patients
  const insulinPump = DEVICE_TYPES.find(d => d.typeDisplay.includes('Insulin'));
  if (insulinPump) {
    const pumpPatients = rng.pickN(diabeticPatients, Math.min(5, diabeticPatients.length));
    for (const patient of pumpPatients) {
      const model = rng.pick(insulinPump.models);
      const serialNumber = `${insulinPump.prefix}-${String(rng.randomInt(100000, 999999))}`;
      const startDate = new Date(`${2023 + rng.randomInt(0, 1)}-${String(rng.randomInt(1, 12)).padStart(2, '0')}-${String(rng.randomInt(1, 28)).padStart(2, '0')}`);
      const expirationDate = formatDate(addDays(startDate, insulinPump.expirationYears * 365));

      const udi = generateUDI(insulinPump.prefix, serialNumber, rng);

      deviceRows.push({
        id: crypto.randomUUID(),
        patient_id: patient.id,
        fhir_id: null,
        udi_device_identifier: udi.deviceIdentifier,
        udi_issuer: 'http://hl7.org/fhir/NamingSystem/gs1-di',
        udi_jurisdiction: 'http://hl7.org/fhir/NamingSystem/fda-udi',
        udi_carrier_aidc: null,
        udi_carrier_hrf: udi.carrierHRF,
        status: 'active',
        type_code: insulinPump.typeCode,
        type_display: insulinPump.typeDisplay,
        manufacturer: insulinPump.manufacturer,
        model,
        serial_number: serialNumber,
        expiration_date: expirationDate,
        created_at: now,
        updated_at: now,
      });
    }
  }

  // Assign CPAP devices to some SNF patients
  const cpapDevice = DEVICE_TYPES.find(d => d.typeDisplay.includes('CPAP'));
  if (cpapDevice) {
    const cpapPatients = rng.pickN(snfPatients, Math.min(5, snfPatients.length));
    for (const patient of cpapPatients) {
      const model = rng.pick(cpapDevice.models);
      const serialNumber = `${cpapDevice.prefix}-${String(rng.randomInt(100000, 999999))}`;
      const startDate = new Date(`${2023 + rng.randomInt(0, 1)}-${String(rng.randomInt(1, 12)).padStart(2, '0')}-${String(rng.randomInt(1, 28)).padStart(2, '0')}`);
      const expirationDate = formatDate(addDays(startDate, cpapDevice.expirationYears * 365));

      const udi = generateUDI(cpapDevice.prefix, serialNumber, rng);

      deviceRows.push({
        id: crypto.randomUUID(),
        patient_id: patient.id,
        fhir_id: null,
        udi_device_identifier: udi.deviceIdentifier,
        udi_issuer: 'http://hl7.org/fhir/NamingSystem/gs1-di',
        udi_jurisdiction: 'http://hl7.org/fhir/NamingSystem/fda-udi',
        udi_carrier_aidc: null,
        udi_carrier_hrf: udi.carrierHRF,
        status: 'active',
        type_code: cpapDevice.typeCode,
        type_display: cpapDevice.typeDisplay,
        manufacturer: cpapDevice.manufacturer,
        model,
        serial_number: serialNumber,
        expiration_date: expirationDate,
        created_at: now,
        updated_at: now,
      });
    }
  }

  await batchInsert(trx, 'devices', deviceRows);
  console.log(`  - devices: ${deviceRows.length} rows`);
}
