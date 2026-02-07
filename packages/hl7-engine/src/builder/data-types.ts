/**
 * Data Types for the HL7v2 Message Builder
 *
 * These interfaces define the input data structures used by the HL7Builder
 * to construct HL7v2 message segments. Each type maps to a specific HL7v2 segment.
 */

/** MSH (Message Header) segment configuration */
export interface MSHConfig {
  /** MSH-3: Sending application name */
  sendingApplication?: string;
  /** MSH-4: Sending facility */
  sendingFacility?: string;
  /** MSH-5: Receiving application name */
  receivingApplication?: string;
  /** MSH-6: Receiving facility */
  receivingFacility?: string;
  /** MSH-8: Security */
  security?: string;
  /** MSH-11: Processing ID (P=Production, D=Debugging, T=Training) */
  processingId?: string;
  /** MSH-12: Version ID (default '2.5.1') */
  versionId?: string;
}

/** Patient demographic data for PID segment */
export interface PatientData {
  /** PID-2: Patient ID (external) */
  patientExternalId?: string;
  /** PID-3: Patient identifier list (MRN) */
  patientId: string;
  /** PID-3.4: Assigning authority */
  assigningAuthority?: string;
  /** PID-3.5: Identifier type code */
  identifierTypeCode?: string;
  /** PID-5: Patient last name */
  lastName: string;
  /** PID-5.2: Patient first name */
  firstName: string;
  /** PID-5.3: Patient middle name */
  middleName?: string;
  /** PID-5.5: Prefix (Mr, Mrs, etc.) */
  prefix?: string;
  /** PID-5.6: Suffix (Jr, Sr, etc.) */
  suffix?: string;
  /** PID-7: Date of birth (YYYYMMDD) */
  dateOfBirth?: string;
  /** PID-8: Administrative sex (M, F, O, U, A, N) */
  gender?: string;
  /** PID-10: Race */
  race?: string;
  /** PID-11: Patient address - street */
  addressStreet?: string;
  /** PID-11.3: City */
  addressCity?: string;
  /** PID-11.4: State/province */
  addressState?: string;
  /** PID-11.5: ZIP/postal code */
  addressZip?: string;
  /** PID-11.6: Country */
  addressCountry?: string;
  /** PID-13: Home phone number */
  homePhone?: string;
  /** PID-14: Business phone number */
  businessPhone?: string;
  /** PID-16: Marital status */
  maritalStatus?: string;
  /** PID-18: Patient account number */
  accountNumber?: string;
  /** PID-19: SSN */
  ssn?: string;
  /** PID-22: Ethnic group */
  ethnicGroup?: string;
}

/** Patient visit data for PV1 segment */
export interface VisitData {
  /** PV1-2: Patient class (I=Inpatient, O=Outpatient, E=Emergency, P=Preadmit) */
  patientClass: string;
  /** PV1-3: Assigned patient location (point of care) */
  assignedLocation?: string;
  /** PV1-3.2: Room */
  room?: string;
  /** PV1-3.3: Bed */
  bed?: string;
  /** PV1-3.4: Facility */
  facility?: string;
  /** PV1-4: Admission type (E=Emergency, U=Urgent, R=Routine) */
  admissionType?: string;
  /** PV1-7: Attending doctor ID */
  attendingDoctorId?: string;
  /** PV1-7.2: Attending doctor last name */
  attendingDoctorLastName?: string;
  /** PV1-7.3: Attending doctor first name */
  attendingDoctorFirstName?: string;
  /** PV1-8: Referring doctor ID */
  referringDoctorId?: string;
  /** PV1-8.2: Referring doctor last name */
  referringDoctorLastName?: string;
  /** PV1-8.3: Referring doctor first name */
  referringDoctorFirstName?: string;
  /** PV1-10: Hospital service */
  hospitalService?: string;
  /** PV1-14: Admit source */
  admitSource?: string;
  /** PV1-17: Admitting doctor ID */
  admittingDoctorId?: string;
  /** PV1-17.2: Admitting doctor last name */
  admittingDoctorLastName?: string;
  /** PV1-17.3: Admitting doctor first name */
  admittingDoctorFirstName?: string;
  /** PV1-19: Visit number */
  visitNumber?: string;
  /** PV1-36: Discharge disposition */
  dischargeDisposition?: string;
  /** PV1-44: Admit date/time */
  admitDateTime?: string;
  /** PV1-45: Discharge date/time */
  dischargeDateTime?: string;
}

/** Order data for OBR (Observation Request) segment */
export interface OrderData {
  /** OBR-1: Set ID */
  setId?: string;
  /** OBR-2: Placer order number */
  placerOrderNumber?: string;
  /** OBR-3: Filler order number */
  fillerOrderNumber?: string;
  /** OBR-4: Universal service identifier (code) */
  serviceCode: string;
  /** OBR-4.2: Universal service identifier (text) */
  serviceText: string;
  /** OBR-4.3: Coding system (e.g., 'LOINC') */
  codingSystem?: string;
  /** OBR-7: Observation date/time */
  observationDateTime?: string;
  /** OBR-14: Specimen received date/time */
  specimenReceivedDateTime?: string;
  /** OBR-16: Ordering provider ID */
  orderingProviderId?: string;
  /** OBR-16.2: Ordering provider last name */
  orderingProviderLastName?: string;
  /** OBR-16.3: Ordering provider first name */
  orderingProviderFirstName?: string;
  /** OBR-22: Results report/status change date/time */
  resultsDateTime?: string;
  /** OBR-25: Result status (F=Final, P=Preliminary, C=Correction) */
  resultStatus?: string;
  /** OBR-27: Quantity/timing */
  priority?: string;
}

/** Observation data for OBX (Observation Result) segment */
export interface ObservationData {
  /** OBX-1: Set ID */
  setId?: string;
  /** OBX-2: Value type (NM=Numeric, ST=String, TX=Text, CE=Coded, etc.) */
  valueType: string;
  /** OBX-3: Observation identifier (code) */
  observationCode: string;
  /** OBX-3.2: Observation identifier (text) */
  observationText: string;
  /** OBX-3.3: Coding system */
  codingSystem?: string;
  /** OBX-4: Observation sub-ID */
  subId?: string;
  /** OBX-5: Observation value */
  value: string;
  /** OBX-6: Units (identifier) */
  units?: string;
  /** OBX-6.2: Units (text) */
  unitsText?: string;
  /** OBX-7: Reference range */
  referenceRange?: string;
  /** OBX-8: Abnormal flags (H=High, L=Low, N=Normal, A=Abnormal, etc.) */
  abnormalFlags?: string;
  /** OBX-11: Observation result status (F=Final, P=Preliminary, C=Corrected) */
  resultStatus?: string;
  /** OBX-14: Date/time of observation */
  observationDateTime?: string;
}

/** Allergy data for AL1 segment */
export interface AllergyData {
  /** AL1-1: Set ID */
  setId?: string;
  /** AL1-2: Allergen type code (DA=Drug, FA=Food, MA=Miscellaneous, MC=Environmental) */
  allergenType: string;
  /** AL1-3: Allergen code/description (code) */
  allergenCode?: string;
  /** AL1-3.2: Allergen text description */
  allergenText: string;
  /** AL1-3.3: Coding system */
  codingSystem?: string;
  /** AL1-4: Allergy severity (SV=Severe, MO=Moderate, MI=Mild, U=Unknown) */
  severity?: string;
  /** AL1-5: Allergy reaction */
  reaction?: string;
  /** AL1-6: Identification date */
  identificationDate?: string;
}

/** Diagnosis data for DG1 segment */
export interface DiagnosisData {
  /** DG1-1: Set ID */
  setId?: string;
  /** DG1-2: Diagnosis coding method */
  codingMethod?: string;
  /** DG1-3: Diagnosis code (identifier) */
  diagnosisCode: string;
  /** DG1-3.2: Diagnosis text */
  diagnosisText: string;
  /** DG1-3.3: Coding system (e.g., 'ICD-10') */
  codingSystem?: string;
  /** DG1-5: Diagnosis date/time */
  diagnosisDateTime?: string;
  /** DG1-6: Diagnosis type (A=Admitting, W=Working, F=Final) */
  diagnosisType?: string;
  /** DG1-16: Diagnosing clinician ID */
  clinicianId?: string;
  /** DG1-16.2: Diagnosing clinician last name */
  clinicianLastName?: string;
  /** DG1-16.3: Diagnosing clinician first name */
  clinicianFirstName?: string;
}

/** Prescription data for RXE (Pharmacy/Treatment Encoded Order) segment */
export interface PrescriptionData {
  /** RXE-1: Quantity/timing (priority) */
  priority?: string;
  /** RXE-2: Give code (identifier) */
  giveCode: string;
  /** RXE-2.2: Give code (text) */
  giveCodeText: string;
  /** RXE-2.3: Coding system (e.g., 'NDC', 'RxNorm') */
  codingSystem?: string;
  /** RXE-3: Give amount - minimum */
  giveAmountMin: string;
  /** RXE-4: Give amount - maximum */
  giveAmountMax?: string;
  /** RXE-5: Give units (identifier) */
  giveUnits: string;
  /** RXE-5.2: Give units (text) */
  giveUnitsText?: string;
  /** RXE-6: Give dosage form (e.g., TAB, CAP, INJ) */
  dosageForm?: string;
  /** RXE-7: Provider's administration instructions */
  adminInstructions?: string;
  /** RXE-10: Dispense amount */
  dispenseAmount?: string;
  /** RXE-11: Dispense units */
  dispenseUnits?: string;
  /** RXE-12: Number of refills */
  numberOfRefills?: string;
  /** RXE-15: Prescription number */
  prescriptionNumber?: string;
  /** RXE-21: Pharmacy/treatment supplier's special dispensing instructions */
  specialDispensingInstructions?: string;
  /** RXE-25: Give strength */
  giveStrength?: string;
  /** RXE-26: Give strength units */
  giveStrengthUnits?: string;
  /** RXE-31: Supplementary code */
  supplementaryCode?: string;
}

/** Insurance data for IN1 segment */
export interface InsuranceData {
  /** IN1-1: Set ID */
  setId?: string;
  /** IN1-2: Insurance plan ID (identifier) */
  insurancePlanId: string;
  /** IN1-2.2: Insurance plan text */
  insurancePlanText?: string;
  /** IN1-3: Insurance company ID */
  insuranceCompanyId: string;
  /** IN1-4: Insurance company name */
  insuranceCompanyName?: string;
  /** IN1-5: Insurance company address */
  insuranceCompanyAddress?: string;
  /** IN1-8: Group number */
  groupNumber?: string;
  /** IN1-9: Group name */
  groupName?: string;
  /** IN1-12: Plan effective date */
  planEffectiveDate?: string;
  /** IN1-13: Plan expiration date */
  planExpirationDate?: string;
  /** IN1-15: Plan type (e.g., HMO, PPO) */
  planType?: string;
  /** IN1-16: Insured's name (last) */
  insuredLastName?: string;
  /** IN1-16.2: Insured's name (first) */
  insuredFirstName?: string;
  /** IN1-17: Insured's relationship to patient */
  insuredRelationship?: string;
  /** IN1-36: Policy number */
  policyNumber?: string;
  /** IN1-46: Prior insurance plan ID */
  priorInsurancePlanId?: string;
}

/** Next of kin / emergency contact data for NK1 segment */
export interface ContactData {
  /** NK1-1: Set ID */
  setId?: string;
  /** NK1-2: Contact last name */
  lastName: string;
  /** NK1-2.2: Contact first name */
  firstName: string;
  /** NK1-2.3: Contact middle name */
  middleName?: string;
  /** NK1-3: Relationship (code) */
  relationship: string;
  /** NK1-3.2: Relationship text */
  relationshipText?: string;
  /** NK1-4: Address (street) */
  addressStreet?: string;
  /** NK1-4.3: City */
  addressCity?: string;
  /** NK1-4.4: State */
  addressState?: string;
  /** NK1-4.5: ZIP */
  addressZip?: string;
  /** NK1-5: Phone number */
  phoneNumber?: string;
  /** NK1-6: Business phone */
  businessPhone?: string;
  /** NK1-7: Contact role */
  contactRole?: string;
}

/** Event type data for EVN segment */
export interface EventData {
  /** EVN-1: Event type code (e.g., 'A01', 'A02') */
  eventTypeCode?: string;
  /** EVN-2: Recorded date/time (HL7 timestamp) */
  recordedDateTime?: string;
  /** EVN-3: Date/time planned event */
  plannedDateTime?: string;
  /** EVN-4: Event reason code */
  eventReasonCode?: string;
  /** EVN-5: Operator ID */
  operatorId?: string;
  /** EVN-5.2: Operator last name */
  operatorLastName?: string;
  /** EVN-5.3: Operator first name */
  operatorFirstName?: string;
  /** EVN-6: Event occurred date/time */
  eventOccurredDateTime?: string;
}

/** Scheduling data for SCH segment */
export interface ScheduleData {
  /** SCH-1: Placer appointment ID */
  placerAppointmentId?: string;
  /** SCH-2: Filler appointment ID */
  fillerAppointmentId?: string;
  /** SCH-6: Event reason (code) */
  eventReasonCode?: string;
  /** SCH-6.2: Event reason text */
  eventReasonText?: string;
  /** SCH-7: Appointment reason (code) */
  appointmentReasonCode?: string;
  /** SCH-7.2: Appointment reason text */
  appointmentReasonText?: string;
  /** SCH-8: Appointment type (code) */
  appointmentTypeCode?: string;
  /** SCH-8.2: Appointment type text */
  appointmentTypeText?: string;
  /** SCH-9: Appointment duration */
  appointmentDuration?: string;
  /** SCH-10: Appointment duration units */
  appointmentDurationUnits?: string;
  /** SCH-11: Appointment timing quantity (start datetime) */
  startDateTime?: string;
  /** SCH-11: Appointment timing quantity (end datetime) */
  endDateTime?: string;
  /** SCH-12: Placer contact person ID */
  placerContactId?: string;
  /** SCH-12.2: Placer contact last name */
  placerContactLastName?: string;
  /** SCH-12.3: Placer contact first name */
  placerContactFirstName?: string;
  /** SCH-16: Filler contact person ID */
  fillerContactId?: string;
  /** SCH-16.2: Filler contact last name */
  fillerContactLastName?: string;
  /** SCH-16.3: Filler contact first name */
  fillerContactFirstName?: string;
  /** SCH-25: Filler status code */
  fillerStatusCode?: string;
}

/** Document data for TXA segment (used with MDM messages) */
export interface DocumentData {
  /** TXA-1: Set ID */
  setId?: string;
  /** TXA-2: Document type */
  documentType: string;
  /** TXA-3: Document content presentation */
  contentPresentation?: string;
  /** TXA-4: Activity date/time */
  activityDateTime?: string;
  /** TXA-5: Primary activity provider (ID) */
  primaryProviderId?: string;
  /** TXA-5.2: Primary provider last name */
  primaryProviderLastName?: string;
  /** TXA-5.3: Primary provider first name */
  primaryProviderFirstName?: string;
  /** TXA-12: Unique document number */
  uniqueDocumentNumber?: string;
  /** TXA-17: Document completion status (AU=Authenticated, DI=Dictated, DO=Documented, IP=InProgress) */
  completionStatus?: string;
  /** TXA-19: Document availability status (AV=Available, UN=Unavailable) */
  availabilityStatus?: string;
  /** Document content (placed in OBX segments) */
  content?: string;
}

/** Immunization administration data for RXA segment (used with VXU messages) */
export interface ImmunizationData {
  /** RXA-1: Give sub-ID counter */
  subIdCounter?: string;
  /** RXA-2: Administration sub-ID counter */
  adminSubIdCounter?: string;
  /** RXA-3: Date/time start of administration */
  adminStartDateTime: string;
  /** RXA-4: Date/time end of administration */
  adminEndDateTime?: string;
  /** RXA-5: Administered code (identifier) */
  administeredCode: string;
  /** RXA-5.2: Administered code (text) */
  administeredCodeText: string;
  /** RXA-5.3: Coding system (e.g., 'CVX') */
  codingSystem?: string;
  /** RXA-6: Administered amount */
  administeredAmount?: string;
  /** RXA-7: Administered units */
  administeredUnits?: string;
  /** RXA-9: Administration notes */
  adminNotes?: string;
  /** RXA-10: Administering provider ID */
  adminProviderId?: string;
  /** RXA-10.2: Administering provider last name */
  adminProviderLastName?: string;
  /** RXA-10.3: Administering provider first name */
  adminProviderFirstName?: string;
  /** RXA-11: Administered-at location */
  adminLocation?: string;
  /** RXA-15: Substance lot number */
  lotNumber?: string;
  /** RXA-16: Substance expiration date */
  expirationDate?: string;
  /** RXA-17: Substance manufacturer name */
  manufacturerName?: string;
  /** RXA-20: Completion status (CP=Complete, RE=Refused, NA=Not Administered) */
  completionStatus?: string;
  /** RXA-21: Action code (A=Add, D=Delete, U=Update) */
  actionCode?: string;
}

/** Lab-specific order data extending OrderData for OML messages */
export interface LabOrderData extends OrderData {
  /** Specimen type */
  specimenType?: string;
  /** Specimen type text */
  specimenTypeText?: string;
  /** Collection date/time */
  collectionDateTime?: string;
  /** Specimen source site */
  specimenSourceSite?: string;
}
