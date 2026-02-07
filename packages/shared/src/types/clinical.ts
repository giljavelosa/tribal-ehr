// =============================================================================
// Clinical Data Types - USCDI v3 / US Core 6.1 Compliant
// =============================================================================

import {
  CodeableConcept,
  Reference,
  Period,
  Quantity,
  Annotation,
  Attachment,
  Dosage,
  Range,
  Identifier,
} from './fhir';

// -----------------------------------------------------------------------------
// AllergyIntolerance
// -----------------------------------------------------------------------------

export enum AllergyClinicalStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  RESOLVED = 'resolved',
}

export enum AllergyVerificationStatus {
  UNCONFIRMED = 'unconfirmed',
  PRESUMED = 'presumed',
  CONFIRMED = 'confirmed',
  REFUTED = 'refuted',
  ENTERED_IN_ERROR = 'entered-in-error',
}

export enum AllergyType {
  ALLERGY = 'allergy',
  INTOLERANCE = 'intolerance',
}

export enum AllergyCategory {
  FOOD = 'food',
  MEDICATION = 'medication',
  ENVIRONMENT = 'environment',
  BIOLOGIC = 'biologic',
}

export enum AllergyCriticality {
  LOW = 'low',
  HIGH = 'high',
  UNABLE_TO_ASSESS = 'unable-to-assess',
}

export enum AllergyReactionSeverity {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
}

export interface AllergyReaction {
  substance?: CodeableConcept;
  manifestation: CodeableConcept[];
  severity?: AllergyReactionSeverity;
  exposureRoute?: CodeableConcept;
  note?: string;
}

export interface AllergyIntolerance {
  id: string;
  patientId: string;
  clinicalStatus: AllergyClinicalStatus;
  verificationStatus: AllergyVerificationStatus;
  type?: AllergyType;
  category?: AllergyCategory[];
  criticality?: AllergyCriticality;
  code: CodeableConcept;
  onsetDateTime?: string;
  recordedDate?: string;
  recorder?: Reference;
  reactions?: AllergyReaction[];
}

// -----------------------------------------------------------------------------
// Condition (Problems, Diagnoses, Health Concerns)
// -----------------------------------------------------------------------------

export enum ConditionClinicalStatus {
  ACTIVE = 'active',
  RECURRENCE = 'recurrence',
  RELAPSE = 'relapse',
  INACTIVE = 'inactive',
  REMISSION = 'remission',
  RESOLVED = 'resolved',
}

export enum ConditionVerificationStatus {
  UNCONFIRMED = 'unconfirmed',
  PROVISIONAL = 'provisional',
  DIFFERENTIAL = 'differential',
  CONFIRMED = 'confirmed',
  REFUTED = 'refuted',
  ENTERED_IN_ERROR = 'entered-in-error',
}

export enum ConditionCategory {
  PROBLEM_LIST_ITEM = 'problem-list-item',
  ENCOUNTER_DIAGNOSIS = 'encounter-diagnosis',
  HEALTH_CONCERN = 'health-concern',
}

export interface ConditionEvidence {
  code?: CodeableConcept[];
  detail?: Reference[];
}

export interface Condition {
  id: string;
  patientId: string;
  clinicalStatus: ConditionClinicalStatus;
  verificationStatus: ConditionVerificationStatus;
  category?: ConditionCategory[];
  severity?: CodeableConcept;
  code: CodeableConcept;
  bodySite?: CodeableConcept[];
  onsetDateTime?: string;
  abatementDateTime?: string;
  recordedDate?: string;
  recorder?: Reference;
  evidence?: ConditionEvidence[];
}

// -----------------------------------------------------------------------------
// Procedure
// -----------------------------------------------------------------------------

export enum ProcedureStatus {
  PREPARATION = 'preparation',
  IN_PROGRESS = 'in-progress',
  NOT_DONE = 'not-done',
  ON_HOLD = 'on-hold',
  STOPPED = 'stopped',
  COMPLETED = 'completed',
  ENTERED_IN_ERROR = 'entered-in-error',
  UNKNOWN = 'unknown',
}

export interface Procedure {
  id: string;
  patientId: string;
  status: ProcedureStatus;
  code: CodeableConcept;
  performedDateTime?: string;
  performedPeriod?: Period;
  recorder?: Reference;
  performer?: Array<{
    function?: CodeableConcept;
    actor: Reference;
  }>;
  location?: Reference;
  reasonCode?: CodeableConcept[];
  bodySite?: CodeableConcept[];
  outcome?: CodeableConcept;
  report?: Reference[];
  complication?: CodeableConcept[];
  note?: Annotation[];
}

// -----------------------------------------------------------------------------
// Observation (Vitals, Labs, Smoking Status, SDOH)
// -----------------------------------------------------------------------------

export enum ObservationStatus {
  REGISTERED = 'registered',
  PRELIMINARY = 'preliminary',
  FINAL = 'final',
  AMENDED = 'amended',
  CORRECTED = 'corrected',
  CANCELLED = 'cancelled',
  ENTERED_IN_ERROR = 'entered-in-error',
  UNKNOWN = 'unknown',
}

export interface ObservationReferenceRange {
  low?: Quantity;
  high?: Quantity;
  type?: CodeableConcept;
  appliesTo?: CodeableConcept[];
  age?: Range;
  text?: string;
}

export interface ObservationComponent {
  code: CodeableConcept;
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  interpretation?: CodeableConcept[];
  referenceRange?: ObservationReferenceRange[];
}

export interface Observation {
  id: string;
  patientId: string;
  status: ObservationStatus;
  category?: CodeableConcept[];
  code: CodeableConcept;
  effectiveDateTime?: string;
  issued?: string;
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  interpretation?: CodeableConcept[];
  referenceRange?: ObservationReferenceRange[];
  component?: ObservationComponent[];
  note?: Annotation[];
  performer?: Reference[];
  device?: Reference;
}

// -----------------------------------------------------------------------------
// Encounter
// -----------------------------------------------------------------------------

export enum EncounterStatus {
  PLANNED = 'planned',
  ARRIVED = 'arrived',
  TRIAGED = 'triaged',
  IN_PROGRESS = 'in-progress',
  ON_LEAVE = 'onleave',
  FINISHED = 'finished',
  CANCELLED = 'cancelled',
  ENTERED_IN_ERROR = 'entered-in-error',
  UNKNOWN = 'unknown',
}

export enum EncounterClass {
  AMBULATORY = 'AMB',
  EMERGENCY = 'EMER',
  FIELD = 'FLD',
  HOME_HEALTH = 'HH',
  INPATIENT_ENCOUNTER = 'IMP',
  INPATIENT_ACUTE = 'ACUTE',
  INPATIENT_NON_ACUTE = 'NONAC',
  OBSERVATION = 'OBSENC',
  PRE_ADMISSION = 'PRENC',
  SHORT_STAY = 'SS',
  VIRTUAL = 'VR',
}

export interface EncounterDiagnosis {
  condition: Reference;
  use?: CodeableConcept;
  rank?: number;
}

export interface EncounterParticipant {
  type?: CodeableConcept[];
  period?: Period;
  individual?: Reference;
}

export interface EncounterHospitalization {
  preAdmissionIdentifier?: Identifier;
  origin?: Reference;
  admitSource?: CodeableConcept;
  reAdmission?: CodeableConcept;
  dietPreference?: CodeableConcept[];
  specialCourtesy?: CodeableConcept[];
  specialArrangement?: CodeableConcept[];
  destination?: Reference;
  dischargeDisposition?: CodeableConcept;
}

export interface EncounterLocation {
  location: Reference;
  status?: 'planned' | 'active' | 'reserved' | 'completed';
  period?: Period;
}

export interface Encounter {
  id: string;
  patientId: string;
  status: EncounterStatus;
  class: EncounterClass;
  type?: CodeableConcept[];
  priority?: CodeableConcept;
  period?: Period;
  reasonCode?: CodeableConcept[];
  diagnosis?: EncounterDiagnosis[];
  participant?: EncounterParticipant[];
  location?: EncounterLocation[];
  serviceProvider?: Reference;
  hospitalization?: EncounterHospitalization;
}

// -----------------------------------------------------------------------------
// CarePlan
// -----------------------------------------------------------------------------

export enum CarePlanStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ON_HOLD = 'on-hold',
  REVOKED = 'revoked',
  COMPLETED = 'completed',
  ENTERED_IN_ERROR = 'entered-in-error',
  UNKNOWN = 'unknown',
}

export enum CarePlanIntent {
  PROPOSAL = 'proposal',
  PLAN = 'plan',
  ORDER = 'order',
  OPTION = 'option',
}

export enum CarePlanActivityStatus {
  NOT_STARTED = 'not-started',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in-progress',
  ON_HOLD = 'on-hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  STOPPED = 'stopped',
  UNKNOWN = 'unknown',
  ENTERED_IN_ERROR = 'entered-in-error',
}

export interface CarePlanActivity {
  outcomeCodeableConcept?: CodeableConcept[];
  outcomeReference?: Reference[];
  progress?: Annotation[];
  reference?: Reference;
  detail?: {
    kind?: string;
    code?: CodeableConcept;
    status: CarePlanActivityStatus;
    reasonCode?: CodeableConcept[];
    goal?: Reference[];
    scheduledPeriod?: Period;
    scheduledString?: string;
    location?: Reference;
    performer?: Reference[];
    description?: string;
  };
}

export interface CarePlan {
  id: string;
  patientId: string;
  status: CarePlanStatus;
  intent: CarePlanIntent;
  title?: string;
  description?: string;
  period?: Period;
  author?: Reference;
  careTeam?: Reference[];
  addresses?: Reference[];
  goal?: Reference[];
  activity?: CarePlanActivity[];
}

// -----------------------------------------------------------------------------
// CareTeam
// -----------------------------------------------------------------------------

export enum CareTeamStatus {
  PROPOSED = 'proposed',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
  ENTERED_IN_ERROR = 'entered-in-error',
}

export interface CareTeamParticipant {
  role?: CodeableConcept[];
  member?: Reference;
  period?: Period;
}

export interface CareTeam {
  id: string;
  patientId: string;
  status: CareTeamStatus;
  name?: string;
  period?: Period;
  participant?: CareTeamParticipant[];
}

// -----------------------------------------------------------------------------
// Goal
// -----------------------------------------------------------------------------

export enum GoalLifecycleStatus {
  PROPOSED = 'proposed',
  PLANNED = 'planned',
  ACCEPTED = 'accepted',
  ACTIVE = 'active',
  ON_HOLD = 'on-hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ENTERED_IN_ERROR = 'entered-in-error',
  REJECTED = 'rejected',
}

export enum GoalAchievementStatus {
  IN_PROGRESS = 'in-progress',
  IMPROVING = 'improving',
  WORSENING = 'worsening',
  NO_CHANGE = 'no-change',
  ACHIEVED = 'achieved',
  SUSTAINING = 'sustaining',
  NOT_ACHIEVED = 'not-achieved',
  NO_PROGRESS = 'no-progress',
  NOT_ATTAINABLE = 'not-attainable',
}

export interface Goal {
  id: string;
  patientId: string;
  lifecycleStatus: GoalLifecycleStatus;
  achievementStatus?: GoalAchievementStatus;
  description: CodeableConcept;
  subject: Reference;
  startDate?: string;
  targetDate?: string;
  statusDate?: string;
  expressedBy?: Reference;
  addresses?: Reference[];
  note?: Annotation[];
}

// -----------------------------------------------------------------------------
// Immunization
// -----------------------------------------------------------------------------

export enum ImmunizationStatus {
  COMPLETED = 'completed',
  ENTERED_IN_ERROR = 'entered-in-error',
  NOT_DONE = 'not-done',
}

export interface ImmunizationPerformer {
  function?: CodeableConcept;
  actor: Reference;
}

export interface ImmunizationReaction {
  date?: string;
  detail?: Reference;
  reported?: boolean;
}

export interface ImmunizationProtocolApplied {
  series?: string;
  authority?: Reference;
  targetDisease?: CodeableConcept[];
  doseNumberPositiveInt?: number;
  doseNumberString?: string;
  seriesDosesPositiveInt?: number;
  seriesDosesString?: string;
}

export interface Immunization {
  id: string;
  patientId: string;
  status: ImmunizationStatus;
  vaccineCode: CodeableConcept;
  occurrenceDateTime: string;
  recorded?: string;
  primarySource?: boolean;
  lotNumber?: string;
  expirationDate?: string;
  site?: CodeableConcept;
  route?: CodeableConcept;
  doseQuantity?: Quantity;
  performer?: ImmunizationPerformer[];
  note?: Annotation[];
  reaction?: ImmunizationReaction[];
  protocolApplied?: ImmunizationProtocolApplied[];
}

// -----------------------------------------------------------------------------
// MedicationRequest
// -----------------------------------------------------------------------------

export enum MedicationRequestStatus {
  ACTIVE = 'active',
  ON_HOLD = 'on-hold',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  ENTERED_IN_ERROR = 'entered-in-error',
  STOPPED = 'stopped',
  DRAFT = 'draft',
  UNKNOWN = 'unknown',
}

export enum MedicationRequestIntent {
  PROPOSAL = 'proposal',
  PLAN = 'plan',
  ORDER = 'order',
  ORIGINAL_ORDER = 'original-order',
  REFLEX_ORDER = 'reflex-order',
  FILLER_ORDER = 'filler-order',
  INSTANCE_ORDER = 'instance-order',
  OPTION = 'option',
}

export interface MedicationRequestDispenseRequest {
  initialFill?: {
    quantity?: Quantity;
    duration?: Quantity;
  };
  dispenseInterval?: Quantity;
  validityPeriod?: Period;
  numberOfRepeatsAllowed?: number;
  quantity?: Quantity;
  expectedSupplyDuration?: Quantity;
  performer?: Reference;
}

export interface MedicationRequestSubstitution {
  allowedBoolean?: boolean;
  allowedCodeableConcept?: CodeableConcept;
  reason?: CodeableConcept;
}

export interface MedicationRequest {
  id: string;
  patientId: string;
  status: MedicationRequestStatus;
  intent: MedicationRequestIntent;
  medication: CodeableConcept;
  authoredOn?: string;
  requester?: Reference;
  dosageInstruction?: Dosage[];
  dispenseRequest?: MedicationRequestDispenseRequest;
  substitution?: MedicationRequestSubstitution;
  priorPrescription?: Reference;
  note?: Annotation[];
}

// -----------------------------------------------------------------------------
// DocumentReference
// -----------------------------------------------------------------------------

export enum DocumentReferenceStatus {
  CURRENT = 'current',
  SUPERSEDED = 'superseded',
  ENTERED_IN_ERROR = 'entered-in-error',
}

export interface DocumentReferenceContent {
  attachment: Attachment;
  format?: CodeableConcept;
}

export interface DocumentReferenceContext {
  encounter?: Reference[];
  event?: CodeableConcept[];
  period?: Period;
  facilityType?: CodeableConcept;
  practiceSetting?: CodeableConcept;
  related?: Reference[];
}

export interface DocumentReference {
  id: string;
  patientId: string;
  status: DocumentReferenceStatus;
  type?: CodeableConcept;
  category?: CodeableConcept[];
  date?: string;
  author?: Reference[];
  description?: string;
  content: DocumentReferenceContent[];
  context?: DocumentReferenceContext;
}

// -----------------------------------------------------------------------------
// Device (UDI)
// -----------------------------------------------------------------------------

export enum DeviceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ENTERED_IN_ERROR = 'entered-in-error',
  UNKNOWN = 'unknown',
}

export interface UdiCarrier {
  deviceIdentifier?: string;
  issuer?: string;
  jurisdiction?: string;
  carrierAIDC?: string;
  carrierHRF?: string;
}

export interface Device {
  id: string;
  patientId: string;
  udiCarrier?: UdiCarrier[];
  status?: DeviceStatus;
  type?: CodeableConcept;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  expirationDate?: string;
}

// -----------------------------------------------------------------------------
// Provenance
// -----------------------------------------------------------------------------

export interface ProvenanceAgent {
  type?: CodeableConcept;
  who: Reference;
  onBehalfOf?: Reference;
}

export interface ProvenanceEntity {
  role: 'derivation' | 'revision' | 'quotation' | 'source' | 'removal';
  what: Reference;
}

export interface Provenance {
  id: string;
  target: Reference[];
  recorded: string;
  agent: ProvenanceAgent[];
  entity?: ProvenanceEntity[];
}
