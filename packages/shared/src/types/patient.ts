// =============================================================================
// Patient Types - USCDI v3 Compliant
// =============================================================================

import { CodeableConcept, Period } from './fhir';

export enum AdministrativeSex {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  UNKNOWN = 'unknown',
}

export enum AddressUse {
  HOME = 'home',
  WORK = 'work',
  TEMP = 'temp',
  OLD = 'old',
  BILLING = 'billing',
}

export enum AddressType {
  POSTAL = 'postal',
  PHYSICAL = 'physical',
  BOTH = 'both',
}

export enum PhoneUse {
  HOME = 'home',
  WORK = 'work',
  TEMP = 'temp',
  OLD = 'old',
  MOBILE = 'mobile',
}

export enum PhoneSystem {
  PHONE = 'phone',
  FAX = 'fax',
  SMS = 'sms',
  PAGER = 'pager',
}

export enum MaritalStatus {
  ANNULLED = 'A',
  DIVORCED = 'D',
  INTERLOCUTORY = 'I',
  LEGALLY_SEPARATED = 'L',
  MARRIED = 'M',
  POLYGAMOUS = 'P',
  NEVER_MARRIED = 'S',
  DOMESTIC_PARTNER = 'T',
  UNMARRIED = 'U',
  WIDOWED = 'W',
  UNKNOWN = 'UNK',
}

export enum SubscriberRelationship {
  SELF = 'self',
  SPOUSE = 'spouse',
  CHILD = 'child',
  OTHER = 'other',
}

export enum InsurancePlanType {
  HMO = 'HMO',
  PPO = 'PPO',
  EPO = 'EPO',
  POS = 'POS',
  HDHP = 'HDHP',
  MEDICAID = 'Medicaid',
  MEDICARE = 'Medicare',
  TRICARE = 'TRICARE',
  OTHER = 'Other',
}

export interface Address {
  use?: AddressUse;
  type?: AddressType;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  period?: Period;
}

export interface PhoneNumber {
  use?: PhoneUse;
  system?: PhoneSystem;
  value: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  address?: Address;
}

export interface InsuranceCoverage {
  payerId: string;
  payerName: string;
  memberId: string;
  groupNumber?: string;
  planName?: string;
  planType?: InsurancePlanType;
  subscriberRelationship?: SubscriberRelationship;
  effectiveDate: string;
  terminationDate?: string;
  copay?: number;
  deductible?: number;
}

export interface RaceCode {
  code: string;
  display: string;
  system: string;
}

export interface CommunicationPreferences {
  preferredMethod?: 'phone' | 'email' | 'sms' | 'mail' | 'portal';
  consentToText?: boolean;
  consentToEmail?: boolean;
  consentToCall?: boolean;
  portalEnabled?: boolean;
}

export interface PatientDemographics {
  id: string;
  mrn: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  dateOfBirth: string;
  sex: AdministrativeSex;
  genderIdentity?: CodeableConcept;
  sexualOrientation?: CodeableConcept;
  race?: RaceCode[];
  ethnicity?: CodeableConcept;
  preferredLanguage?: string;
  maritalStatus?: MaritalStatus;
  addresses?: Address[];
  phoneNumbers?: PhoneNumber[];
  emails?: string[];
  emergencyContacts?: EmergencyContact[];
  insuranceCoverage?: InsuranceCoverage[];
  photo?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  communicationPreferences?: CommunicationPreferences;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
