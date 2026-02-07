// =============================================================================
// FHIR Constants
// =============================================================================

export const FHIR_VERSION = 'R4' as const;

export const FHIR_MIME_TYPE = 'application/fhir+json' as const;

export const US_CORE_PROFILE_BASE = 'http://hl7.org/fhir/us/core/StructureDefinition/' as const;

// ---------------------------------------------------------------------------
// US Core Profile URLs
// ---------------------------------------------------------------------------

export const US_CORE_PROFILES = {
  PATIENT: `${US_CORE_PROFILE_BASE}us-core-patient`,
  ALLERGY_INTOLERANCE: `${US_CORE_PROFILE_BASE}us-core-allergyintolerance`,
  CARE_PLAN: `${US_CORE_PROFILE_BASE}us-core-careplan`,
  CARE_TEAM: `${US_CORE_PROFILE_BASE}us-core-careteam`,
  CONDITION_ENCOUNTER_DIAGNOSIS: `${US_CORE_PROFILE_BASE}us-core-condition-encounter-diagnosis`,
  CONDITION_PROBLEMS_HEALTH_CONCERNS: `${US_CORE_PROFILE_BASE}us-core-condition-problems-health-concerns`,
  DIAGNOSTIC_REPORT_LAB: `${US_CORE_PROFILE_BASE}us-core-diagnosticreport-lab`,
  DIAGNOSTIC_REPORT_NOTE: `${US_CORE_PROFILE_BASE}us-core-diagnosticreport-note`,
  DOCUMENT_REFERENCE: `${US_CORE_PROFILE_BASE}us-core-documentreference`,
  ENCOUNTER: `${US_CORE_PROFILE_BASE}us-core-encounter`,
  GOAL: `${US_CORE_PROFILE_BASE}us-core-goal`,
  IMMUNIZATION: `${US_CORE_PROFILE_BASE}us-core-immunization`,
  IMPLANTABLE_DEVICE: `${US_CORE_PROFILE_BASE}us-core-implantable-device`,
  MEDICATION_REQUEST: `${US_CORE_PROFILE_BASE}us-core-medicationrequest`,
  OBSERVATION_LAB: `${US_CORE_PROFILE_BASE}us-core-observation-lab`,
  OBSERVATION_CLINICAL_RESULT: `${US_CORE_PROFILE_BASE}us-core-observation-clinical-result`,
  VITAL_SIGNS: `${US_CORE_PROFILE_BASE}us-core-vital-signs`,
  BLOOD_PRESSURE: `${US_CORE_PROFILE_BASE}us-core-blood-pressure`,
  BMI: `${US_CORE_PROFILE_BASE}us-core-bmi`,
  BODY_HEIGHT: `${US_CORE_PROFILE_BASE}us-core-body-height`,
  BODY_WEIGHT: `${US_CORE_PROFILE_BASE}us-core-body-weight`,
  BODY_TEMPERATURE: `${US_CORE_PROFILE_BASE}us-core-body-temperature`,
  HEAD_CIRCUMFERENCE: `${US_CORE_PROFILE_BASE}us-core-head-circumference`,
  HEART_RATE: `${US_CORE_PROFILE_BASE}us-core-heart-rate`,
  PULSE_OXIMETRY: `${US_CORE_PROFILE_BASE}us-core-pulse-oximetry`,
  RESPIRATORY_RATE: `${US_CORE_PROFILE_BASE}us-core-respiratory-rate`,
  SMOKING_STATUS: `${US_CORE_PROFILE_BASE}us-core-smokingstatus`,
  PEDIATRIC_BMI_FOR_AGE: `${US_CORE_PROFILE_BASE}pediatric-bmi-for-age`,
  PEDIATRIC_WEIGHT_FOR_HEIGHT: `${US_CORE_PROFILE_BASE}pediatric-weight-for-height`,
  OBSERVATION_SDOH_ASSESSMENT: `${US_CORE_PROFILE_BASE}us-core-observation-sdoh-assessment`,
  PROCEDURE: `${US_CORE_PROFILE_BASE}us-core-procedure`,
  PROVENANCE: `${US_CORE_PROFILE_BASE}us-core-provenance`,
  PRACTITIONER: `${US_CORE_PROFILE_BASE}us-core-practitioner`,
  PRACTITIONER_ROLE: `${US_CORE_PROFILE_BASE}us-core-practitionerrole`,
  ORGANIZATION: `${US_CORE_PROFILE_BASE}us-core-organization`,
  LOCATION: `${US_CORE_PROFILE_BASE}us-core-location`,
  COVERAGE: `${US_CORE_PROFILE_BASE}us-core-coverage`,
  MEDICATION_DISPENSE: `${US_CORE_PROFILE_BASE}us-core-medicationdispense`,
  SERVICE_REQUEST: `${US_CORE_PROFILE_BASE}us-core-servicerequest`,
  RELATED_PERSON: `${US_CORE_PROFILE_BASE}us-core-relatedperson`,
} as const;

// ---------------------------------------------------------------------------
// FHIR Resource Types
// ---------------------------------------------------------------------------

export const FHIR_RESOURCE_TYPES = {
  PATIENT: 'Patient',
  ALLERGY_INTOLERANCE: 'AllergyIntolerance',
  CARE_PLAN: 'CarePlan',
  CARE_TEAM: 'CareTeam',
  CONDITION: 'Condition',
  COVERAGE: 'Coverage',
  DEVICE: 'Device',
  DIAGNOSTIC_REPORT: 'DiagnosticReport',
  DOCUMENT_REFERENCE: 'DocumentReference',
  ENCOUNTER: 'Encounter',
  GOAL: 'Goal',
  IMMUNIZATION: 'Immunization',
  LOCATION: 'Location',
  MEDICATION: 'Medication',
  MEDICATION_REQUEST: 'MedicationRequest',
  MEDICATION_DISPENSE: 'MedicationDispense',
  OBSERVATION: 'Observation',
  ORGANIZATION: 'Organization',
  PRACTITIONER: 'Practitioner',
  PRACTITIONER_ROLE: 'PractitionerRole',
  PROCEDURE: 'Procedure',
  PROVENANCE: 'Provenance',
  RELATED_PERSON: 'RelatedPerson',
  SERVICE_REQUEST: 'ServiceRequest',
  BUNDLE: 'Bundle',
  OPERATION_OUTCOME: 'OperationOutcome',
} as const;

export type FHIRResourceType = (typeof FHIR_RESOURCE_TYPES)[keyof typeof FHIR_RESOURCE_TYPES];
