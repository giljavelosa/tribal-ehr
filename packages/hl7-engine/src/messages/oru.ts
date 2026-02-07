/**
 * ORU (Observation Result) Message Factories
 *
 * Builds and parses ORU messages used to transmit clinical
 * observation results (lab results, vital signs, etc.).
 */

import { HL7Builder } from '../builder/hl7-builder';
import { HL7Parser } from '../parser/hl7-parser';
import { HL7Message } from '../parser/types';
import {
  MSHConfig,
  PatientData,
  OrderData,
  ObservationData,
} from '../builder/data-types';

/** Parsed observation result from an ORU message */
export interface ParsedObservation {
  setId: string;
  valueType: string;
  observationCode: string;
  observationText: string;
  codingSystem: string;
  subId: string;
  value: string;
  units: string;
  unitsText: string;
  referenceRange: string;
  abnormalFlags: string;
  resultStatus: string;
  observationDateTime: string;
}

/** Parsed order from an ORU message */
export interface ParsedOrder {
  setId: string;
  placerOrderNumber: string;
  fillerOrderNumber: string;
  serviceCode: string;
  serviceText: string;
  codingSystem: string;
  observationDateTime: string;
  resultStatus: string;
  orderingProviderId: string;
  orderingProviderLastName: string;
  orderingProviderFirstName: string;
}

/** Parsed patient from an ORU message */
export interface ParsedPatient {
  patientId: string;
  lastName: string;
  firstName: string;
  middleName: string;
  dateOfBirth: string;
  gender: string;
  accountNumber: string;
}

/** Complete parsed ORU result */
export interface ParsedORU {
  patient: ParsedPatient;
  order: ParsedOrder;
  observations: ParsedObservation[];
}

/**
 * Build an ORU^R01 message (Unsolicited Observation Result).
 * Used to send clinical observation results (lab results, vital signs, etc.).
 *
 * @param patient - Patient demographic data
 * @param order - Order/observation request data
 * @param observations - Array of observation results
 * @param mshConfig - Optional MSH configuration
 * @returns Complete HL7v2 ORU^R01 message string
 */
export function buildORU_R01(
  patient: PatientData,
  order: OrderData,
  observations: ObservationData[],
  mshConfig: MSHConfig = {}
): string {
  const builder = new HL7Builder();
  builder
    .createMessage('ORU', 'R01')
    .addMSH(mshConfig)
    .addPID(patient)
    .addOBR(order);

  observations.forEach((obs, idx) => {
    builder.addOBX({
      ...obs,
      setId: obs.setId || (idx + 1).toString(),
    });
  });

  return builder.build();
}

/**
 * Parse an ORU^R01 message into structured data.
 * Extracts patient, order, and observation information from the message.
 *
 * @param message - Parsed HL7Message (must be ORU^R01)
 * @returns Structured ORU data with patient, order, and observations
 * @throws Error if the message is not a valid ORU^R01
 */
export function parseORU_R01(message: HL7Message): ParsedORU {
  const messageType = message.header.messageType;
  if (!messageType.startsWith('ORU')) {
    throw new Error(`Expected ORU message, got: ${messageType}`);
  }

  // Parse PID segment
  const pidSegment = HL7Parser.findSegment(message, 'PID');
  if (!pidSegment) {
    throw new Error('ORU^R01 message is missing required PID segment');
  }

  const patient: ParsedPatient = {
    patientId: HL7Parser.getComponentValue(pidSegment, 3, 1),
    lastName: HL7Parser.getComponentValue(pidSegment, 5, 1),
    firstName: HL7Parser.getComponentValue(pidSegment, 5, 2),
    middleName: HL7Parser.getComponentValue(pidSegment, 5, 3),
    dateOfBirth: HL7Parser.getFieldValue(pidSegment, 7),
    gender: HL7Parser.getFieldValue(pidSegment, 8),
    accountNumber: HL7Parser.getFieldValue(pidSegment, 18),
  };

  // Parse OBR segment
  const obrSegment = HL7Parser.findSegment(message, 'OBR');
  if (!obrSegment) {
    throw new Error('ORU^R01 message is missing required OBR segment');
  }

  const order: ParsedOrder = {
    setId: HL7Parser.getFieldValue(obrSegment, 1),
    placerOrderNumber: HL7Parser.getFieldValue(obrSegment, 2),
    fillerOrderNumber: HL7Parser.getFieldValue(obrSegment, 3),
    serviceCode: HL7Parser.getComponentValue(obrSegment, 4, 1),
    serviceText: HL7Parser.getComponentValue(obrSegment, 4, 2),
    codingSystem: HL7Parser.getComponentValue(obrSegment, 4, 3),
    observationDateTime: HL7Parser.getFieldValue(obrSegment, 7),
    resultStatus: HL7Parser.getFieldValue(obrSegment, 25),
    orderingProviderId: HL7Parser.getComponentValue(obrSegment, 16, 1),
    orderingProviderLastName: HL7Parser.getComponentValue(obrSegment, 16, 2),
    orderingProviderFirstName: HL7Parser.getComponentValue(obrSegment, 16, 3),
  };

  // Parse OBX segments
  const obxSegments = HL7Parser.findSegments(message, 'OBX');
  const observations: ParsedObservation[] = obxSegments.map((obx) => ({
    setId: HL7Parser.getFieldValue(obx, 1),
    valueType: HL7Parser.getFieldValue(obx, 2),
    observationCode: HL7Parser.getComponentValue(obx, 3, 1),
    observationText: HL7Parser.getComponentValue(obx, 3, 2),
    codingSystem: HL7Parser.getComponentValue(obx, 3, 3),
    subId: HL7Parser.getFieldValue(obx, 4),
    value: HL7Parser.getFieldValue(obx, 5),
    units: HL7Parser.getComponentValue(obx, 6, 1),
    unitsText: HL7Parser.getComponentValue(obx, 6, 2),
    referenceRange: HL7Parser.getFieldValue(obx, 7),
    abnormalFlags: HL7Parser.getFieldValue(obx, 8),
    resultStatus: HL7Parser.getFieldValue(obx, 11),
    observationDateTime: HL7Parser.getFieldValue(obx, 14),
  }));

  return { patient, order, observations };
}
