/**
 * @tribal-ehr/hl7-engine
 *
 * HL7v2 message processing engine for Tribal EHR.
 * Provides parsing, building, validating, routing, and MLLP transport
 * for HL7v2 messages.
 */

// Parser
export { HL7Parser } from './parser/hl7-parser';
export {
  HL7Message,
  HL7Segment,
  HL7Field,
  HL7Component,
  EncodingCharacters,
  MessageHeader,
  DEFAULT_ENCODING_CHARS,
} from './parser/types';

// Builder
export { HL7Builder } from './builder/hl7-builder';
export {
  MSHConfig,
  PatientData,
  VisitData,
  OrderData,
  ObservationData,
  AllergyData,
  DiagnosisData,
  PrescriptionData,
  InsuranceData,
  ContactData,
  EventData,
  ScheduleData,
  DocumentData,
  ImmunizationData,
  LabOrderData,
} from './builder/data-types';

// Validator
export {
  MessageValidator,
  ValidationResult,
  ValidationError,
  ValidationSeverity,
  SegmentRule,
} from './validator/message-validator';

// Message Factories - ADT
export {
  buildADT_A01,
  buildADT_A02,
  buildADT_A03,
  buildADT_A04,
  buildADT_A08,
  buildADT_A11,
  buildADT_A13,
  ADTOptions,
} from './messages/adt';

// Message Factories - ORU
export {
  buildORU_R01,
  parseORU_R01,
  ParsedObservation,
  ParsedOrder,
  ParsedPatient,
  ParsedORU,
} from './messages/oru';

// Message Factories - ORM/OML
export { buildORM_O01, buildOML_O21 } from './messages/orm';

// Message Factories - VXU
export { buildVXU_V04 } from './messages/vxu';

// Message Factories - SIU
export {
  buildSIU_S12,
  buildSIU_S13,
  buildSIU_S14,
  buildSIU_S15,
  buildSIU_S26,
  SIUOptions,
} from './messages/siu';

// Message Factories - RDE
export { buildRDE_O11, RDEOptions } from './messages/rde';

// Message Factories - MDM
export { buildMDM_T02 } from './messages/mdm';

// Message Factories - ACK
export { buildACK, AckCode } from './messages/ack';

// Transport
export { MLLPServer, ReplyCallback } from './transport/mllp-server';
export { MLLPClient, MLLPClientOptions } from './transport/mllp-client';

// Router
export {
  MessageRouter,
  MessageHandler,
  ProcessingResult,
  DeadLetterEntry,
} from './router/message-router';

// Logger
export { createLogger } from './logger';
