/**
 * SIU (Schedule Information Unsolicited) Message Factories
 *
 * Builds SIU messages used for scheduling appointments and
 * notifying about scheduling changes.
 */

import { HL7Builder } from '../builder/hl7-builder';
import {
  MSHConfig,
  PatientData,
  ScheduleData,
} from '../builder/data-types';

/** Options for SIU messages */
export interface SIUOptions {
  mshConfig?: MSHConfig;
  /** AIS (Appointment Information - Service) segment data */
  serviceCode?: string;
  serviceText?: string;
  /** AIG (Appointment Information - General Resource) segment data */
  resourceId?: string;
  resourceLastName?: string;
  resourceFirstName?: string;
  /** AIL (Appointment Information - Location) segment data */
  locationCode?: string;
  locationText?: string;
}

/**
 * Build a base SIU message with common segments.
 */
function buildBaseSIU(
  triggerEvent: string,
  patient: PatientData,
  schedule: ScheduleData,
  options: SIUOptions = {}
): string {
  const builder = new HL7Builder();
  builder
    .createMessage('SIU', triggerEvent)
    .addMSH(options.mshConfig || {})
    .addSCH(schedule)
    .addPID(patient);

  // Add AIS (Appointment Information - Service) if service data provided
  if (options.serviceCode) {
    builder.addSegment('AIS');
    const built = builder.build();
    const aisIndex = built.split('\r').filter((s) => s.length > 0).length - 1;

    // AIS-1: Set ID
    builder.setField(aisIndex, 1, '1');
    // AIS-2: Segment Action Code
    builder.setField(aisIndex, 2, '');
    // AIS-3: Universal Service Identifier
    const serviceParts = [
      options.serviceCode,
      options.serviceText || '',
    ].join('^');
    builder.setField(aisIndex, 3, serviceParts);
    // AIS-4: Start Date/Time
    builder.setField(aisIndex, 4, schedule.startDateTime || '');
  }

  // Add AIG (Appointment Information - General Resource) if resource data provided
  if (options.resourceId) {
    builder.addSegment('AIG');
    const built = builder.build();
    const aigIndex = built.split('\r').filter((s) => s.length > 0).length - 1;

    // AIG-1: Set ID
    builder.setField(aigIndex, 1, '1');
    // AIG-2: Segment Action Code
    builder.setField(aigIndex, 2, '');
    // AIG-3: Resource ID
    const resourceParts = [
      options.resourceId,
      options.resourceLastName || '',
      options.resourceFirstName || '',
    ].join('^');
    builder.setField(aigIndex, 3, resourceParts);
  }

  // Add AIL (Appointment Information - Location) if location data provided
  if (options.locationCode) {
    builder.addSegment('AIL');
    const built = builder.build();
    const ailIndex = built.split('\r').filter((s) => s.length > 0).length - 1;

    // AIL-1: Set ID
    builder.setField(ailIndex, 1, '1');
    // AIL-2: Segment Action Code
    builder.setField(ailIndex, 2, '');
    // AIL-3: Location Resource ID
    const locationParts = [
      options.locationCode,
      options.locationText || '',
    ].join('^');
    builder.setField(ailIndex, 3, locationParts);
  }

  return builder.build();
}

/**
 * Build a SIU^S12 message (Notification of New Appointment Booking).
 * Sent when a new appointment is scheduled.
 *
 * @param patient - Patient demographic data
 * @param schedule - Scheduling data
 * @param options - Optional additional data
 * @returns Complete HL7v2 SIU^S12 message string
 */
export function buildSIU_S12(
  patient: PatientData,
  schedule: ScheduleData,
  options: SIUOptions = {}
): string {
  return buildBaseSIU('S12', patient, schedule, options);
}

/**
 * Build a SIU^S13 message (Notification of Appointment Rescheduling).
 * Sent when an existing appointment is rescheduled to a new date/time.
 *
 * @param patient - Patient demographic data
 * @param schedule - Updated scheduling data
 * @param options - Optional additional data
 * @returns Complete HL7v2 SIU^S13 message string
 */
export function buildSIU_S13(
  patient: PatientData,
  schedule: ScheduleData,
  options: SIUOptions = {}
): string {
  return buildBaseSIU('S13', patient, schedule, options);
}

/**
 * Build a SIU^S14 message (Notification of Appointment Modification).
 * Sent when an appointment's details are modified (not rescheduled).
 *
 * @param patient - Patient demographic data
 * @param schedule - Modified scheduling data
 * @param options - Optional additional data
 * @returns Complete HL7v2 SIU^S14 message string
 */
export function buildSIU_S14(
  patient: PatientData,
  schedule: ScheduleData,
  options: SIUOptions = {}
): string {
  return buildBaseSIU('S14', patient, schedule, options);
}

/**
 * Build a SIU^S15 message (Notification of Appointment Cancellation).
 * Sent when an existing appointment is cancelled.
 *
 * @param patient - Patient demographic data
 * @param schedule - Scheduling data for the cancelled appointment
 * @param options - Optional additional data
 * @returns Complete HL7v2 SIU^S15 message string
 */
export function buildSIU_S15(
  patient: PatientData,
  schedule: ScheduleData,
  options: SIUOptions = {}
): string {
  return buildBaseSIU('S15', patient, schedule, options);
}

/**
 * Build a SIU^S26 message (Notification That Patient Did Not Show Up).
 * Sent when a patient fails to appear for a scheduled appointment.
 *
 * @param patient - Patient demographic data
 * @param schedule - Scheduling data for the missed appointment
 * @param options - Optional additional data
 * @returns Complete HL7v2 SIU^S26 message string
 */
export function buildSIU_S26(
  patient: PatientData,
  schedule: ScheduleData,
  options: SIUOptions = {}
): string {
  return buildBaseSIU('S26', patient, schedule, options);
}
