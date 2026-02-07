/**
 * HL7v2 Message Builder
 *
 * Fluent API for constructing HL7v2 messages segment by segment.
 * Provides convenience methods for common segment types (MSH, PID, PV1, etc.)
 * as well as low-level field/component manipulation.
 */

import { v4 as uuidv4 } from 'uuid';
import {
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
} from './data-types';

/** Internal representation of a segment being built */
interface BuilderSegment {
  name: string;
  fields: string[];
}

export class HL7Builder {
  private segments: BuilderSegment[] = [];
  private messageType: string = '';
  private triggerEvent: string = '';

  /**
   * Generate current timestamp in HL7 format (YYYYMMDDHHMMSS).
   */
  static generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Generate a unique message control ID.
   */
  static generateControlId(): string {
    return uuidv4().replace(/-/g, '').substring(0, 20).toUpperCase();
  }

  /**
   * Create a new message with the specified type and trigger event.
   * Initializes the builder for message construction.
   *
   * @param type - Message type (e.g., 'ADT', 'ORM', 'ORU')
   * @param trigger - Trigger event (e.g., 'A01', 'O01', 'R01')
   * @returns This builder for chaining
   */
  createMessage(type: string, trigger: string): HL7Builder {
    this.segments = [];
    this.messageType = type;
    this.triggerEvent = trigger;
    return this;
  }

  /**
   * Add a new empty segment with the specified name.
   *
   * @param name - Segment identifier (e.g., 'PID', 'PV1', 'OBR')
   * @returns This builder for chaining
   */
  addSegment(name: string): HL7Builder {
    this.segments.push({ name, fields: [] });
    return this;
  }

  /**
   * Set a field value at a specific position in a segment.
   *
   * @param segmentIndex - 0-based index of the segment in the message
   * @param fieldIndex - 1-based HL7 field index within the segment
   * @param value - Field value to set
   * @returns This builder for chaining
   */
  setField(segmentIndex: number, fieldIndex: number, value: string): HL7Builder {
    if (segmentIndex < 0 || segmentIndex >= this.segments.length) {
      throw new Error(`HL7 Builder Error: Segment index ${segmentIndex} out of range`);
    }

    const segment = this.segments[segmentIndex];
    const arrayIndex = fieldIndex - 1;

    // Extend the fields array if necessary
    while (segment.fields.length <= arrayIndex) {
      segment.fields.push('');
    }

    segment.fields[arrayIndex] = value;
    return this;
  }

  /**
   * Set a component value within a field. Creates/extends the field as needed.
   *
   * @param segmentIndex - 0-based index of the segment
   * @param fieldIndex - 1-based HL7 field index
   * @param componentIndex - 1-based component index within the field
   * @param value - Component value to set
   * @returns This builder for chaining
   */
  setComponent(
    segmentIndex: number,
    fieldIndex: number,
    componentIndex: number,
    value: string
  ): HL7Builder {
    if (segmentIndex < 0 || segmentIndex >= this.segments.length) {
      throw new Error(`HL7 Builder Error: Segment index ${segmentIndex} out of range`);
    }

    const segment = this.segments[segmentIndex];
    const arrayIndex = fieldIndex - 1;

    // Extend the fields array if necessary
    while (segment.fields.length <= arrayIndex) {
      segment.fields.push('');
    }

    // Split existing field into components, set the target, rejoin
    const components = segment.fields[arrayIndex].split('^');
    const compArrayIndex = componentIndex - 1;

    while (components.length <= compArrayIndex) {
      components.push('');
    }

    components[compArrayIndex] = value;
    segment.fields[arrayIndex] = components.join('^');
    return this;
  }

  /**
   * Add an MSH (Message Header) segment.
   *
   * @param config - MSH configuration data
   * @returns This builder for chaining
   */
  addMSH(config: MSHConfig = {}): HL7Builder {
    const timestamp = HL7Builder.generateTimestamp();
    const controlId = HL7Builder.generateControlId();

    // MSH segment is constructed differently - MSH-1 is the field separator
    // and MSH-2 is the encoding characters
    const mshFields: string[] = [];

    // MSH-1 (field separator) and MSH-2 (encoding characters) are handled
    // in the build() method for MSH segments. We start from MSH-3.

    // For our internal representation, we store fields starting from MSH-3
    // MSH-3: Sending Application
    mshFields.push(config.sendingApplication || 'TRIBAL-EHR');
    // MSH-4: Sending Facility
    mshFields.push(config.sendingFacility || '');
    // MSH-5: Receiving Application
    mshFields.push(config.receivingApplication || '');
    // MSH-6: Receiving Facility
    mshFields.push(config.receivingFacility || '');
    // MSH-7: Date/Time of Message
    mshFields.push(timestamp);
    // MSH-8: Security
    mshFields.push(config.security || '');
    // MSH-9: Message Type
    mshFields.push(`${this.messageType}^${this.triggerEvent}^${this.messageType}_${this.triggerEvent}`);
    // MSH-10: Message Control ID
    mshFields.push(controlId);
    // MSH-11: Processing ID
    mshFields.push(config.processingId || 'P');
    // MSH-12: Version ID
    mshFields.push(config.versionId || '2.5.1');

    this.segments.push({ name: 'MSH', fields: mshFields });
    return this;
  }

  /**
   * Add a PID (Patient Identification) segment.
   *
   * @param patient - Patient demographic data
   * @returns This builder for chaining
   */
  addPID(patient: PatientData): HL7Builder {
    const fields: string[] = [];

    // PID-1: Set ID
    fields.push('1');
    // PID-2: Patient ID (External)
    fields.push(patient.patientExternalId || '');
    // PID-3: Patient Identifier List
    const assignAuth = patient.assigningAuthority || 'MRN';
    const idType = patient.identifierTypeCode || 'MR';
    fields.push(`${patient.patientId}^^^${assignAuth}^${idType}`);
    // PID-4: Alternate Patient ID (deprecated)
    fields.push('');
    // PID-5: Patient Name
    const nameParts = [
      patient.lastName,
      patient.firstName,
      patient.middleName || '',
      patient.suffix || '',
      patient.prefix || '',
    ];
    fields.push(nameParts.join('^'));
    // PID-6: Mother's Maiden Name
    fields.push('');
    // PID-7: Date/Time of Birth
    fields.push(patient.dateOfBirth || '');
    // PID-8: Administrative Sex
    fields.push(patient.gender || '');
    // PID-9: Patient Alias
    fields.push('');
    // PID-10: Race
    fields.push(patient.race || '');
    // PID-11: Patient Address
    const addressParts = [
      patient.addressStreet || '',
      '',
      patient.addressCity || '',
      patient.addressState || '',
      patient.addressZip || '',
      patient.addressCountry || '',
    ];
    fields.push(addressParts.join('^'));
    // PID-12: County Code
    fields.push('');
    // PID-13: Phone Number - Home
    fields.push(patient.homePhone || '');
    // PID-14: Phone Number - Business
    fields.push(patient.businessPhone || '');
    // PID-15: Primary Language
    fields.push('');
    // PID-16: Marital Status
    fields.push(patient.maritalStatus || '');
    // PID-17: Religion
    fields.push('');
    // PID-18: Patient Account Number
    fields.push(patient.accountNumber || '');
    // PID-19: SSN
    fields.push(patient.ssn || '');
    // PID-20: Driver's License
    fields.push('');
    // PID-21: Mother's Identifier
    fields.push('');
    // PID-22: Ethnic Group
    fields.push(patient.ethnicGroup || '');

    this.segments.push({ name: 'PID', fields });
    return this;
  }

  /**
   * Add a PV1 (Patient Visit) segment.
   *
   * @param visit - Visit/encounter data
   * @returns This builder for chaining
   */
  addPV1(visit: VisitData): HL7Builder {
    const fields: string[] = [];

    // PV1-1: Set ID
    fields.push('1');
    // PV1-2: Patient Class
    fields.push(visit.patientClass);
    // PV1-3: Assigned Patient Location
    const locationParts = [
      visit.assignedLocation || '',
      visit.room || '',
      visit.bed || '',
      visit.facility || '',
    ];
    fields.push(locationParts.join('^'));
    // PV1-4: Admission Type
    fields.push(visit.admissionType || '');
    // PV1-5: Preadmit Number
    fields.push('');
    // PV1-6: Prior Patient Location
    fields.push('');
    // PV1-7: Attending Doctor
    const attendingParts = [
      visit.attendingDoctorId || '',
      visit.attendingDoctorLastName || '',
      visit.attendingDoctorFirstName || '',
    ];
    fields.push(attendingParts.join('^'));
    // PV1-8: Referring Doctor
    const referringParts = [
      visit.referringDoctorId || '',
      visit.referringDoctorLastName || '',
      visit.referringDoctorFirstName || '',
    ];
    fields.push(referringParts.join('^'));
    // PV1-9: Consulting Doctor
    fields.push('');
    // PV1-10: Hospital Service
    fields.push(visit.hospitalService || '');
    // PV1-11 through PV1-13
    fields.push('');
    fields.push('');
    fields.push('');
    // PV1-14: Admit Source
    fields.push(visit.admitSource || '');
    // PV1-15 through PV1-16
    fields.push('');
    fields.push('');
    // PV1-17: Admitting Doctor
    const admittingParts = [
      visit.admittingDoctorId || '',
      visit.admittingDoctorLastName || '',
      visit.admittingDoctorFirstName || '',
    ];
    fields.push(admittingParts.join('^'));
    // PV1-18: Patient Type
    fields.push('');
    // PV1-19: Visit Number
    fields.push(visit.visitNumber || '');
    // PV1-20 through PV1-35
    for (let i = 0; i < 16; i++) {
      fields.push('');
    }
    // PV1-36: Discharge Disposition
    fields.push(visit.dischargeDisposition || '');
    // PV1-37 through PV1-43
    for (let i = 0; i < 7; i++) {
      fields.push('');
    }
    // PV1-44: Admit Date/Time
    fields.push(visit.admitDateTime || '');
    // PV1-45: Discharge Date/Time
    fields.push(visit.dischargeDateTime || '');

    this.segments.push({ name: 'PV1', fields });
    return this;
  }

  /**
   * Add an OBR (Observation Request) segment.
   *
   * @param order - Order/observation request data
   * @returns This builder for chaining
   */
  addOBR(order: OrderData): HL7Builder {
    const fields: string[] = [];

    // OBR-1: Set ID
    fields.push(order.setId || '1');
    // OBR-2: Placer Order Number
    fields.push(order.placerOrderNumber || '');
    // OBR-3: Filler Order Number
    fields.push(order.fillerOrderNumber || '');
    // OBR-4: Universal Service Identifier
    const serviceParts = [
      order.serviceCode,
      order.serviceText,
      order.codingSystem || '',
    ];
    fields.push(serviceParts.join('^'));
    // OBR-5: Priority
    fields.push(order.priority || '');
    // OBR-6: Requested Date/Time
    fields.push('');
    // OBR-7: Observation Date/Time
    fields.push(order.observationDateTime || '');
    // OBR-8 through OBR-13
    for (let i = 0; i < 6; i++) {
      fields.push('');
    }
    // OBR-14: Specimen Received Date/Time
    fields.push(order.specimenReceivedDateTime || '');
    // OBR-15: Specimen Source
    fields.push('');
    // OBR-16: Ordering Provider
    const providerParts = [
      order.orderingProviderId || '',
      order.orderingProviderLastName || '',
      order.orderingProviderFirstName || '',
    ];
    fields.push(providerParts.join('^'));
    // OBR-17 through OBR-21
    for (let i = 0; i < 5; i++) {
      fields.push('');
    }
    // OBR-22: Results Report/Status Change Date/Time
    fields.push(order.resultsDateTime || '');
    // OBR-23 through OBR-24
    fields.push('');
    fields.push('');
    // OBR-25: Result Status
    fields.push(order.resultStatus || '');

    this.segments.push({ name: 'OBR', fields });
    return this;
  }

  /**
   * Add an OBX (Observation Result) segment.
   *
   * @param observation - Observation result data
   * @returns This builder for chaining
   */
  addOBX(observation: ObservationData): HL7Builder {
    const fields: string[] = [];

    // OBX-1: Set ID
    fields.push(observation.setId || '1');
    // OBX-2: Value Type
    fields.push(observation.valueType);
    // OBX-3: Observation Identifier
    const obsParts = [
      observation.observationCode,
      observation.observationText,
      observation.codingSystem || '',
    ];
    fields.push(obsParts.join('^'));
    // OBX-4: Observation Sub-ID
    fields.push(observation.subId || '');
    // OBX-5: Observation Value
    fields.push(observation.value);
    // OBX-6: Units
    const unitsParts = [
      observation.units || '',
      observation.unitsText || '',
    ];
    fields.push(unitsParts.join('^'));
    // OBX-7: Reference Range
    fields.push(observation.referenceRange || '');
    // OBX-8: Abnormal Flags
    fields.push(observation.abnormalFlags || '');
    // OBX-9: Probability
    fields.push('');
    // OBX-10: Nature of Abnormal Test
    fields.push('');
    // OBX-11: Observation Result Status
    fields.push(observation.resultStatus || 'F');
    // OBX-12 through OBX-13
    fields.push('');
    fields.push('');
    // OBX-14: Date/Time of Observation
    fields.push(observation.observationDateTime || '');

    this.segments.push({ name: 'OBX', fields });
    return this;
  }

  /**
   * Add an AL1 (Patient Allergy Information) segment.
   *
   * @param allergy - Allergy data
   * @returns This builder for chaining
   */
  addAL1(allergy: AllergyData): HL7Builder {
    const fields: string[] = [];

    // AL1-1: Set ID
    fields.push(allergy.setId || '1');
    // AL1-2: Allergen Type Code
    fields.push(allergy.allergenType);
    // AL1-3: Allergen Code/Mnemonic/Description
    const allergenParts = [
      allergy.allergenCode || '',
      allergy.allergenText,
      allergy.codingSystem || '',
    ];
    fields.push(allergenParts.join('^'));
    // AL1-4: Allergy Severity Code
    fields.push(allergy.severity || '');
    // AL1-5: Allergy Reaction Code
    fields.push(allergy.reaction || '');
    // AL1-6: Identification Date
    fields.push(allergy.identificationDate || '');

    this.segments.push({ name: 'AL1', fields });
    return this;
  }

  /**
   * Add a DG1 (Diagnosis) segment.
   *
   * @param diagnosis - Diagnosis data
   * @returns This builder for chaining
   */
  addDG1(diagnosis: DiagnosisData): HL7Builder {
    const fields: string[] = [];

    // DG1-1: Set ID
    fields.push(diagnosis.setId || '1');
    // DG1-2: Diagnosis Coding Method
    fields.push(diagnosis.codingMethod || '');
    // DG1-3: Diagnosis Code
    const diagParts = [
      diagnosis.diagnosisCode,
      diagnosis.diagnosisText,
      diagnosis.codingSystem || '',
    ];
    fields.push(diagParts.join('^'));
    // DG1-4: Diagnosis Description (deprecated, use DG1-3.2)
    fields.push('');
    // DG1-5: Diagnosis Date/Time
    fields.push(diagnosis.diagnosisDateTime || '');
    // DG1-6: Diagnosis Type
    fields.push(diagnosis.diagnosisType || '');
    // DG1-7 through DG1-15
    for (let i = 0; i < 9; i++) {
      fields.push('');
    }
    // DG1-16: Diagnosing Clinician
    const clinicianParts = [
      diagnosis.clinicianId || '',
      diagnosis.clinicianLastName || '',
      diagnosis.clinicianFirstName || '',
    ];
    fields.push(clinicianParts.join('^'));

    this.segments.push({ name: 'DG1', fields });
    return this;
  }

  /**
   * Add an RXE (Pharmacy/Treatment Encoded Order) segment.
   *
   * @param prescription - Prescription data
   * @returns This builder for chaining
   */
  addRXE(prescription: PrescriptionData): HL7Builder {
    const fields: string[] = [];

    // RXE-1: Quantity/Timing
    fields.push(prescription.priority || '');
    // RXE-2: Give Code
    const giveCodeParts = [
      prescription.giveCode,
      prescription.giveCodeText,
      prescription.codingSystem || '',
    ];
    fields.push(giveCodeParts.join('^'));
    // RXE-3: Give Amount - Minimum
    fields.push(prescription.giveAmountMin);
    // RXE-4: Give Amount - Maximum
    fields.push(prescription.giveAmountMax || '');
    // RXE-5: Give Units
    const giveUnitsParts = [
      prescription.giveUnits,
      prescription.giveUnitsText || '',
    ];
    fields.push(giveUnitsParts.join('^'));
    // RXE-6: Give Dosage Form
    fields.push(prescription.dosageForm || '');
    // RXE-7: Provider's Administration Instructions
    fields.push(prescription.adminInstructions || '');
    // RXE-8: Deliver-to Location (deprecated)
    fields.push('');
    // RXE-9: Substitution Status
    fields.push('');
    // RXE-10: Dispense Amount
    fields.push(prescription.dispenseAmount || '');
    // RXE-11: Dispense Units
    fields.push(prescription.dispenseUnits || '');
    // RXE-12: Number of Refills
    fields.push(prescription.numberOfRefills || '');
    // RXE-13 through RXE-14
    fields.push('');
    fields.push('');
    // RXE-15: Prescription Number
    fields.push(prescription.prescriptionNumber || '');
    // RXE-16 through RXE-20
    for (let i = 0; i < 5; i++) {
      fields.push('');
    }
    // RXE-21: Pharmacy/Treatment Supplier's Special Dispensing Instructions
    fields.push(prescription.specialDispensingInstructions || '');
    // RXE-22 through RXE-24
    for (let i = 0; i < 3; i++) {
      fields.push('');
    }
    // RXE-25: Give Strength
    fields.push(prescription.giveStrength || '');
    // RXE-26: Give Strength Units
    fields.push(prescription.giveStrengthUnits || '');
    // RXE-27 through RXE-30
    for (let i = 0; i < 4; i++) {
      fields.push('');
    }
    // RXE-31: Supplementary Code
    fields.push(prescription.supplementaryCode || '');

    this.segments.push({ name: 'RXE', fields });
    return this;
  }

  /**
   * Add an IN1 (Insurance) segment.
   *
   * @param insurance - Insurance data
   * @returns This builder for chaining
   */
  addIN1(insurance: InsuranceData): HL7Builder {
    const fields: string[] = [];

    // IN1-1: Set ID
    fields.push(insurance.setId || '1');
    // IN1-2: Insurance Plan ID
    const planParts = [
      insurance.insurancePlanId,
      insurance.insurancePlanText || '',
    ];
    fields.push(planParts.join('^'));
    // IN1-3: Insurance Company ID
    fields.push(insurance.insuranceCompanyId);
    // IN1-4: Insurance Company Name
    fields.push(insurance.insuranceCompanyName || '');
    // IN1-5: Insurance Company Address
    fields.push(insurance.insuranceCompanyAddress || '');
    // IN1-6 through IN1-7
    fields.push('');
    fields.push('');
    // IN1-8: Group Number
    fields.push(insurance.groupNumber || '');
    // IN1-9: Group Name
    fields.push(insurance.groupName || '');
    // IN1-10 through IN1-11
    fields.push('');
    fields.push('');
    // IN1-12: Plan Effective Date
    fields.push(insurance.planEffectiveDate || '');
    // IN1-13: Plan Expiration Date
    fields.push(insurance.planExpirationDate || '');
    // IN1-14: Authorization Information
    fields.push('');
    // IN1-15: Plan Type
    fields.push(insurance.planType || '');
    // IN1-16: Name of Insured
    const insuredNameParts = [
      insurance.insuredLastName || '',
      insurance.insuredFirstName || '',
    ];
    fields.push(insuredNameParts.join('^'));
    // IN1-17: Insured's Relationship to Patient
    fields.push(insurance.insuredRelationship || '');
    // IN1-18 through IN1-35
    for (let i = 0; i < 18; i++) {
      fields.push('');
    }
    // IN1-36: Policy Number
    fields.push(insurance.policyNumber || '');
    // IN1-37 through IN1-45
    for (let i = 0; i < 9; i++) {
      fields.push('');
    }
    // IN1-46: Prior Insurance Plan ID
    fields.push(insurance.priorInsurancePlanId || '');

    this.segments.push({ name: 'IN1', fields });
    return this;
  }

  /**
   * Add an NK1 (Next of Kin / Associated Parties) segment.
   *
   * @param contact - Contact/next of kin data
   * @returns This builder for chaining
   */
  addNK1(contact: ContactData): HL7Builder {
    const fields: string[] = [];

    // NK1-1: Set ID
    fields.push(contact.setId || '1');
    // NK1-2: Name
    const nameParts = [
      contact.lastName,
      contact.firstName,
      contact.middleName || '',
    ];
    fields.push(nameParts.join('^'));
    // NK1-3: Relationship
    const relParts = [
      contact.relationship,
      contact.relationshipText || '',
    ];
    fields.push(relParts.join('^'));
    // NK1-4: Address
    const addressParts = [
      contact.addressStreet || '',
      '',
      contact.addressCity || '',
      contact.addressState || '',
      contact.addressZip || '',
    ];
    fields.push(addressParts.join('^'));
    // NK1-5: Phone Number
    fields.push(contact.phoneNumber || '');
    // NK1-6: Business Phone Number
    fields.push(contact.businessPhone || '');
    // NK1-7: Contact Role
    fields.push(contact.contactRole || '');

    this.segments.push({ name: 'NK1', fields });
    return this;
  }

  /**
   * Add an EVN (Event Type) segment.
   *
   * @param event - Event data
   * @returns This builder for chaining
   */
  addEVN(event: EventData = {}): HL7Builder {
    const fields: string[] = [];

    // EVN-1: Event Type Code
    fields.push(event.eventTypeCode || this.triggerEvent);
    // EVN-2: Recorded Date/Time
    fields.push(event.recordedDateTime || HL7Builder.generateTimestamp());
    // EVN-3: Date/Time Planned Event
    fields.push(event.plannedDateTime || '');
    // EVN-4: Event Reason Code
    fields.push(event.eventReasonCode || '');
    // EVN-5: Operator ID
    const operatorParts = [
      event.operatorId || '',
      event.operatorLastName || '',
      event.operatorFirstName || '',
    ];
    fields.push(operatorParts.join('^'));
    // EVN-6: Event Occurred
    fields.push(event.eventOccurredDateTime || '');

    this.segments.push({ name: 'EVN', fields });
    return this;
  }

  /**
   * Add a SCH (Scheduling Activity Information) segment.
   *
   * @param schedule - Schedule data
   * @returns This builder for chaining
   */
  addSCH(schedule: ScheduleData): HL7Builder {
    const fields: string[] = [];

    // SCH-1: Placer Appointment ID
    fields.push(schedule.placerAppointmentId || '');
    // SCH-2: Filler Appointment ID
    fields.push(schedule.fillerAppointmentId || '');
    // SCH-3: Occurrence Number
    fields.push('');
    // SCH-4: Placer Group Number
    fields.push('');
    // SCH-5: Schedule ID
    fields.push('');
    // SCH-6: Event Reason
    const reasonParts = [
      schedule.eventReasonCode || '',
      schedule.eventReasonText || '',
    ];
    fields.push(reasonParts.join('^'));
    // SCH-7: Appointment Reason
    const apptReasonParts = [
      schedule.appointmentReasonCode || '',
      schedule.appointmentReasonText || '',
    ];
    fields.push(apptReasonParts.join('^'));
    // SCH-8: Appointment Type
    const apptTypeParts = [
      schedule.appointmentTypeCode || '',
      schedule.appointmentTypeText || '',
    ];
    fields.push(apptTypeParts.join('^'));
    // SCH-9: Appointment Duration
    fields.push(schedule.appointmentDuration || '');
    // SCH-10: Appointment Duration Units
    fields.push(schedule.appointmentDurationUnits || '');
    // SCH-11: Appointment Timing Quantity
    // Format: startDateTime^endDateTime
    const timingParts: string[] = [];
    if (schedule.startDateTime) {
      timingParts.push(schedule.startDateTime);
    }
    if (schedule.endDateTime) {
      // Ensure we have start even if empty before adding end
      if (timingParts.length === 0) timingParts.push('');
      timingParts.push(schedule.endDateTime);
    }
    fields.push(timingParts.join('^'));
    // SCH-12: Placer Contact Person
    const placerContactParts = [
      schedule.placerContactId || '',
      schedule.placerContactLastName || '',
      schedule.placerContactFirstName || '',
    ];
    fields.push(placerContactParts.join('^'));
    // SCH-13 through SCH-15
    fields.push('');
    fields.push('');
    fields.push('');
    // SCH-16: Filler Contact Person
    const fillerContactParts = [
      schedule.fillerContactId || '',
      schedule.fillerContactLastName || '',
      schedule.fillerContactFirstName || '',
    ];
    fields.push(fillerContactParts.join('^'));
    // SCH-17 through SCH-24
    for (let i = 0; i < 8; i++) {
      fields.push('');
    }
    // SCH-25: Filler Status Code
    fields.push(schedule.fillerStatusCode || '');

    this.segments.push({ name: 'SCH', fields });
    return this;
  }

  /**
   * Build the complete HL7v2 message string.
   * Joins all segments with \r (carriage return) as per HL7v2 specification.
   *
   * @returns The complete HL7v2 message string
   */
  build(): string {
    const segmentStrings = this.segments.map((segment) => {
      if (segment.name === 'MSH') {
        // MSH is special: MSH|^~\&|field3|field4|...
        return `MSH|^~\\&|${segment.fields.join('|')}`;
      }
      // All other segments: SEGNAME|field1|field2|...
      return `${segment.name}|${segment.fields.join('|')}`;
    });

    // Trim trailing empty fields from each segment for cleaner output
    const trimmed = segmentStrings.map((seg) => {
      // Remove trailing pipe-separated empty fields
      return seg.replace(/\|+$/, '');
    });

    return trimmed.join('\r');
  }
}
