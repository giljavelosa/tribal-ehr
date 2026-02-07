/**
 * ADT (Admit/Discharge/Transfer) Message Factories
 *
 * Builds standard ADT messages used for patient movement and
 * registration events within the healthcare facility.
 */

import { HL7Builder } from '../builder/hl7-builder';
import {
  MSHConfig,
  PatientData,
  VisitData,
  EventData,
  ContactData,
  InsuranceData,
  AllergyData,
  DiagnosisData,
} from '../builder/data-types';

/** Optional additional segments for ADT messages */
export interface ADTOptions {
  mshConfig?: MSHConfig;
  contacts?: ContactData[];
  insurance?: InsuranceData[];
  allergies?: AllergyData[];
  diagnoses?: DiagnosisData[];
}

/**
 * Build an ADT^A01 message (Patient Admit / Visit Notification).
 * Sent when a patient is admitted to a healthcare facility.
 *
 * @param patient - Patient demographic data
 * @param visit - Visit/encounter data
 * @param event - Event type data
 * @param options - Optional additional segments
 * @returns Complete HL7v2 ADT^A01 message string
 */
export function buildADT_A01(
  patient: PatientData,
  visit: VisitData,
  event: EventData = {},
  options: ADTOptions = {}
): string {
  const builder = new HL7Builder();
  builder
    .createMessage('ADT', 'A01')
    .addMSH(options.mshConfig || {})
    .addEVN({ ...event, eventTypeCode: event.eventTypeCode || 'A01' })
    .addPID(patient)
    .addPV1(visit);

  // Add optional NK1 segments
  if (options.contacts) {
    options.contacts.forEach((contact, idx) => {
      builder.addNK1({ ...contact, setId: (idx + 1).toString() });
    });
  }

  // Add optional AL1 segments
  if (options.allergies) {
    options.allergies.forEach((allergy, idx) => {
      builder.addAL1({ ...allergy, setId: (idx + 1).toString() });
    });
  }

  // Add optional DG1 segments
  if (options.diagnoses) {
    options.diagnoses.forEach((diagnosis, idx) => {
      builder.addDG1({ ...diagnosis, setId: (idx + 1).toString() });
    });
  }

  // Add optional IN1 segments
  if (options.insurance) {
    options.insurance.forEach((ins, idx) => {
      builder.addIN1({ ...ins, setId: (idx + 1).toString() });
    });
  }

  return builder.build();
}

/**
 * Build an ADT^A02 message (Patient Transfer).
 * Sent when a patient is transferred from one location to another.
 *
 * @param patient - Patient demographic data
 * @param visit - Visit/encounter data with new location
 * @param event - Event type data
 * @param options - Optional additional segments
 * @returns Complete HL7v2 ADT^A02 message string
 */
export function buildADT_A02(
  patient: PatientData,
  visit: VisitData,
  event: EventData = {},
  options: ADTOptions = {}
): string {
  const builder = new HL7Builder();
  builder
    .createMessage('ADT', 'A02')
    .addMSH(options.mshConfig || {})
    .addEVN({ ...event, eventTypeCode: event.eventTypeCode || 'A02' })
    .addPID(patient)
    .addPV1(visit);

  return builder.build();
}

/**
 * Build an ADT^A03 message (Patient Discharge).
 * Sent when a patient is discharged from a healthcare facility.
 *
 * @param patient - Patient demographic data
 * @param visit - Visit/encounter data with discharge info
 * @param event - Event type data
 * @param options - Optional additional segments
 * @returns Complete HL7v2 ADT^A03 message string
 */
export function buildADT_A03(
  patient: PatientData,
  visit: VisitData,
  event: EventData = {},
  options: ADTOptions = {}
): string {
  const builder = new HL7Builder();
  builder
    .createMessage('ADT', 'A03')
    .addMSH(options.mshConfig || {})
    .addEVN({ ...event, eventTypeCode: event.eventTypeCode || 'A03' })
    .addPID(patient)
    .addPV1(visit);

  // Add optional DG1 segments (common at discharge)
  if (options.diagnoses) {
    options.diagnoses.forEach((diagnosis, idx) => {
      builder.addDG1({ ...diagnosis, setId: (idx + 1).toString() });
    });
  }

  return builder.build();
}

/**
 * Build an ADT^A04 message (Patient Registration).
 * Sent when a patient registers (outpatient, recurring, etc.) without being admitted.
 *
 * @param patient - Patient demographic data
 * @param visit - Visit/encounter data
 * @param event - Event type data
 * @param options - Optional additional segments
 * @returns Complete HL7v2 ADT^A04 message string
 */
export function buildADT_A04(
  patient: PatientData,
  visit: VisitData,
  event: EventData = {},
  options: ADTOptions = {}
): string {
  const builder = new HL7Builder();
  builder
    .createMessage('ADT', 'A04')
    .addMSH(options.mshConfig || {})
    .addEVN({ ...event, eventTypeCode: event.eventTypeCode || 'A04' })
    .addPID(patient)
    .addPV1(visit);

  if (options.contacts) {
    options.contacts.forEach((contact, idx) => {
      builder.addNK1({ ...contact, setId: (idx + 1).toString() });
    });
  }

  if (options.insurance) {
    options.insurance.forEach((ins, idx) => {
      builder.addIN1({ ...ins, setId: (idx + 1).toString() });
    });
  }

  return builder.build();
}

/**
 * Build an ADT^A08 message (Update Patient Information).
 * Sent when a patient's demographic or visit information is updated.
 *
 * @param patient - Updated patient demographic data
 * @param visit - Visit/encounter data
 * @param event - Event type data
 * @param options - Optional additional segments
 * @returns Complete HL7v2 ADT^A08 message string
 */
export function buildADT_A08(
  patient: PatientData,
  visit: VisitData,
  event: EventData = {},
  options: ADTOptions = {}
): string {
  const builder = new HL7Builder();
  builder
    .createMessage('ADT', 'A08')
    .addMSH(options.mshConfig || {})
    .addEVN({ ...event, eventTypeCode: event.eventTypeCode || 'A08' })
    .addPID(patient)
    .addPV1(visit);

  if (options.contacts) {
    options.contacts.forEach((contact, idx) => {
      builder.addNK1({ ...contact, setId: (idx + 1).toString() });
    });
  }

  if (options.allergies) {
    options.allergies.forEach((allergy, idx) => {
      builder.addAL1({ ...allergy, setId: (idx + 1).toString() });
    });
  }

  if (options.diagnoses) {
    options.diagnoses.forEach((diagnosis, idx) => {
      builder.addDG1({ ...diagnosis, setId: (idx + 1).toString() });
    });
  }

  if (options.insurance) {
    options.insurance.forEach((ins, idx) => {
      builder.addIN1({ ...ins, setId: (idx + 1).toString() });
    });
  }

  return builder.build();
}

/**
 * Build an ADT^A11 message (Cancel Admit / Visit Notification).
 * Sent to cancel a previously sent A01 admit message.
 *
 * @param patient - Patient demographic data
 * @param visit - Visit/encounter data for the cancelled admission
 * @param event - Event type data
 * @param options - Optional additional segments
 * @returns Complete HL7v2 ADT^A11 message string
 */
export function buildADT_A11(
  patient: PatientData,
  visit: VisitData,
  event: EventData = {},
  options: ADTOptions = {}
): string {
  const builder = new HL7Builder();
  builder
    .createMessage('ADT', 'A11')
    .addMSH(options.mshConfig || {})
    .addEVN({ ...event, eventTypeCode: event.eventTypeCode || 'A11' })
    .addPID(patient)
    .addPV1(visit);

  return builder.build();
}

/**
 * Build an ADT^A13 message (Cancel Discharge / End Visit).
 * Sent to cancel a previously sent A03 discharge message.
 *
 * @param patient - Patient demographic data
 * @param visit - Visit/encounter data for the cancelled discharge
 * @param event - Event type data
 * @param options - Optional additional segments
 * @returns Complete HL7v2 ADT^A13 message string
 */
export function buildADT_A13(
  patient: PatientData,
  visit: VisitData,
  event: EventData = {},
  options: ADTOptions = {}
): string {
  const builder = new HL7Builder();
  builder
    .createMessage('ADT', 'A13')
    .addMSH(options.mshConfig || {})
    .addEVN({ ...event, eventTypeCode: event.eventTypeCode || 'A13' })
    .addPID(patient)
    .addPV1(visit);

  return builder.build();
}
