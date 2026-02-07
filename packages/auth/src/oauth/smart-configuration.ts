/**
 * SMART on FHIR Well-Known Configuration
 *
 * Generates the .well-known/smart-configuration document required by the
 * SMART App Launch Framework v2 specification. This endpoint is used by
 * SMART-enabled applications to discover OAuth 2.0 endpoints and capabilities
 * of the authorization server.
 *
 * Reference: https://hl7.org/fhir/smart-app-launch/conformance.html
 */

export interface SmartConfiguration {
  issuer: string;
  jwks_uri: string;
  authorization_endpoint: string;
  token_endpoint: string;
  token_endpoint_auth_methods_supported: string[];
  grant_types_supported: string[];
  registration_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  introspection_endpoint: string;
  revocation_endpoint: string;
  capabilities: string[];
  code_challenge_methods_supported: string[];
  management_endpoint: string;
  userinfo_endpoint: string;
}

/**
 * Generates the SMART on FHIR well-known configuration document.
 *
 * This configuration document advertises the authorization server's
 * capabilities and endpoints to SMART client applications, enabling
 * automatic discovery for EHR launch and standalone launch flows.
 *
 * @param baseUrl - The base URL of the FHIR server (e.g., "https://ehr.tribal.health/fhir")
 * @returns The complete SMART configuration object
 * @throws Error if baseUrl is not provided or is invalid
 */
export function generateSmartConfiguration(baseUrl: string): SmartConfiguration {
  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('baseUrl must be a non-empty string');
  }

  // Strip trailing slashes for consistency
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  return {
    issuer: normalizedBaseUrl,
    jwks_uri: `${normalizedBaseUrl}/.well-known/jwks.json`,
    authorization_endpoint: `${normalizedBaseUrl}/auth/authorize`,
    token_endpoint: `${normalizedBaseUrl}/auth/token`,
    token_endpoint_auth_methods_supported: [
      'client_secret_basic',
      'client_secret_post',
      'private_key_jwt',
    ],
    grant_types_supported: [
      'authorization_code',
      'client_credentials',
      'refresh_token',
    ],
    registration_endpoint: `${normalizedBaseUrl}/auth/register`,
    scopes_supported: [
      // Launch scopes
      'launch',
      'launch/patient',
      'launch/encounter',

      // OpenID Connect scopes
      'openid',
      'fhirUser',
      'profile',

      // Access duration scopes
      'offline_access',
      'online_access',

      // Patient-level scopes
      'patient/*.read',
      'patient/*.write',
      'patient/*.cruds',
      'patient/Patient.read',
      'patient/Patient.write',
      'patient/Patient.cruds',
      'patient/Observation.read',
      'patient/Observation.write',
      'patient/Observation.cruds',
      'patient/Condition.read',
      'patient/Condition.write',
      'patient/Condition.cruds',
      'patient/MedicationRequest.read',
      'patient/MedicationRequest.write',
      'patient/MedicationRequest.cruds',
      'patient/AllergyIntolerance.read',
      'patient/AllergyIntolerance.write',
      'patient/AllergyIntolerance.cruds',
      'patient/Immunization.read',
      'patient/Immunization.write',
      'patient/Immunization.cruds',
      'patient/Procedure.read',
      'patient/Procedure.write',
      'patient/Procedure.cruds',
      'patient/Encounter.read',
      'patient/Encounter.write',
      'patient/Encounter.cruds',
      'patient/DiagnosticReport.read',
      'patient/DiagnosticReport.write',
      'patient/DiagnosticReport.cruds',
      'patient/DocumentReference.read',
      'patient/DocumentReference.write',
      'patient/DocumentReference.cruds',
      'patient/CarePlan.read',
      'patient/CarePlan.write',
      'patient/CarePlan.cruds',
      'patient/CareTeam.read',
      'patient/CareTeam.write',
      'patient/CareTeam.cruds',
      'patient/Goal.read',
      'patient/Goal.write',
      'patient/Goal.cruds',
      'patient/Coverage.read',
      'patient/Coverage.write',
      'patient/Coverage.cruds',

      // User-level scopes
      'user/*.read',
      'user/*.write',
      'user/*.cruds',
      'user/Patient.read',
      'user/Patient.write',
      'user/Patient.cruds',
      'user/Practitioner.read',
      'user/Practitioner.write',
      'user/Practitioner.cruds',
      'user/Organization.read',
      'user/Organization.write',
      'user/Organization.cruds',
      'user/Observation.read',
      'user/Observation.write',
      'user/Observation.cruds',
      'user/Condition.read',
      'user/Condition.write',
      'user/Condition.cruds',
      'user/MedicationRequest.read',
      'user/MedicationRequest.write',
      'user/MedicationRequest.cruds',
      'user/Encounter.read',
      'user/Encounter.write',
      'user/Encounter.cruds',
      'user/AllergyIntolerance.read',
      'user/AllergyIntolerance.write',
      'user/AllergyIntolerance.cruds',
      'user/Immunization.read',
      'user/Immunization.write',
      'user/Immunization.cruds',
      'user/Procedure.read',
      'user/Procedure.write',
      'user/Procedure.cruds',
      'user/DiagnosticReport.read',
      'user/DiagnosticReport.write',
      'user/DiagnosticReport.cruds',
      'user/DocumentReference.read',
      'user/DocumentReference.write',
      'user/DocumentReference.cruds',
      'user/CarePlan.read',
      'user/CarePlan.write',
      'user/CarePlan.cruds',
      'user/CareTeam.read',
      'user/CareTeam.write',
      'user/CareTeam.cruds',
      'user/Schedule.read',
      'user/Schedule.write',
      'user/Appointment.read',
      'user/Appointment.write',
      'user/Appointment.cruds',

      // System-level scopes
      'system/*.read',
      'system/*.write',
      'system/*.cruds',
      'system/Patient.read',
      'system/Patient.write',
      'system/Observation.read',
      'system/Observation.write',
    ],
    response_types_supported: [
      'code',
    ],
    introspection_endpoint: `${normalizedBaseUrl}/auth/introspect`,
    revocation_endpoint: `${normalizedBaseUrl}/auth/revoke`,
    capabilities: [
      'launch-ehr',
      'launch-standalone',
      'client-public',
      'client-confidential-symmetric',
      'sso-openid-connect',
      'context-ehr-patient',
      'context-ehr-encounter',
      'context-standalone-patient',
      'permission-offline',
      'permission-patient',
      'permission-user',
      'permission-v2',
    ],
    code_challenge_methods_supported: [
      'S256',
    ],
    management_endpoint: `${normalizedBaseUrl}/auth/manage`,
    userinfo_endpoint: `${normalizedBaseUrl}/auth/userinfo`,
  };
}
