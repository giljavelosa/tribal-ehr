// =============================================================================
// USCDI v3 Demographics Coded Value Sets
// Standardized codes for gender identity, sexual orientation, race, ethnicity,
// and preferred language per ONC HTI-1 certification requirements.
// =============================================================================

export interface DemographicsCode {
  code: string;
  system: string;
  display: string;
}

export interface LanguageCode {
  code: string;
  display: string;
}

// Gender Identity - SNOMED CT + HL7 gender-identity value set
export const GENDER_IDENTITY_CODES: DemographicsCode[] = [
  { code: '446151000124109', system: 'http://snomed.info/sct', display: 'Identifies as male gender' },
  { code: '446141000124107', system: 'http://snomed.info/sct', display: 'Identifies as female gender' },
  { code: '33791000087105', system: 'http://snomed.info/sct', display: 'Identifies as nonbinary gender' },
  { code: 'OTH', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Other' },
  { code: 'ASKU', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Asked but unknown' },
  { code: 'UNK', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Unknown' },
];

// Sexual Orientation - SNOMED CT
export const SEXUAL_ORIENTATION_CODES: DemographicsCode[] = [
  { code: '38628009', system: 'http://snomed.info/sct', display: 'Lesbian, gay, or homosexual' },
  { code: '20430005', system: 'http://snomed.info/sct', display: 'Heterosexual' },
  { code: '42035005', system: 'http://snomed.info/sct', display: 'Bisexual' },
  { code: 'OTH', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Other' },
  { code: 'ASKU', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Asked but unknown' },
  { code: 'UNK', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Unknown' },
];

// Race - CDC Race & Ethnicity Code Set (OMB categories)
export const RACE_CODES: DemographicsCode[] = [
  { code: '1002-5', system: 'urn:oid:2.16.840.1.113883.6.238', display: 'American Indian or Alaska Native' },
  { code: '2028-9', system: 'urn:oid:2.16.840.1.113883.6.238', display: 'Asian' },
  { code: '2054-5', system: 'urn:oid:2.16.840.1.113883.6.238', display: 'Black or African American' },
  { code: '2076-8', system: 'urn:oid:2.16.840.1.113883.6.238', display: 'Native Hawaiian or Other Pacific Islander' },
  { code: '2106-3', system: 'urn:oid:2.16.840.1.113883.6.238', display: 'White' },
  { code: 'ASKU', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Asked but unknown' },
  { code: 'UNK', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Unknown' },
];

// Ethnicity - CDC
export const ETHNICITY_CODES: DemographicsCode[] = [
  { code: '2135-2', system: 'urn:oid:2.16.840.1.113883.6.238', display: 'Hispanic or Latino' },
  { code: '2186-5', system: 'urn:oid:2.16.840.1.113883.6.238', display: 'Not Hispanic or Latino' },
  { code: 'ASKU', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Asked but unknown' },
  { code: 'UNK', system: 'http://terminology.hl7.org/CodeSystem/v3-NullFlavor', display: 'Unknown' },
];

// Preferred Language - BCP-47 (most common US)
export const LANGUAGE_CODES: LanguageCode[] = [
  { code: 'en', display: 'English' },
  { code: 'es', display: 'Spanish' },
  { code: 'zh', display: 'Chinese' },
  { code: 'vi', display: 'Vietnamese' },
  { code: 'ko', display: 'Korean' },
  { code: 'tl', display: 'Tagalog' },
  { code: 'ar', display: 'Arabic' },
  { code: 'fr', display: 'French' },
  { code: 'de', display: 'German' },
  { code: 'ru', display: 'Russian' },
  { code: 'ja', display: 'Japanese' },
  { code: 'nv', display: 'Navajo' },
  { code: 'chr', display: 'Cherokee' },
  { code: 'oj', display: 'Ojibwe' },
  { code: 'dak', display: 'Dakota' },
];

/**
 * Look up a demographics code by its code value within a given code set.
 */
export function findDemographicsCode(
  codes: DemographicsCode[],
  codeValue: string,
): DemographicsCode | undefined {
  return codes.find((c) => c.code === codeValue);
}
