/**
 * SMART on FHIR v2 Scope Validator
 *
 * Parses, validates, and enforces SMART scopes per the SMART App Launch v2 specification.
 * Supports patient-level, user-level, and system-level scopes as well as
 * launch, openid, fhirUser, and offline/online access scopes.
 */

export interface ParsedSMARTScope {
  context: 'patient' | 'user' | 'system';
  resourceType: string;
  interactions: string[];
  raw: string;
}

export interface ScopeValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * All FHIR resource types commonly used in EHR contexts.
 */
const FHIR_RESOURCE_TYPES: ReadonlySet<string> = new Set([
  'Patient', 'Practitioner', 'PractitionerRole', 'Organization',
  'Encounter', 'Condition', 'Observation', 'Procedure',
  'MedicationRequest', 'MedicationAdministration', 'MedicationDispense', 'Medication',
  'AllergyIntolerance', 'Immunization', 'DiagnosticReport',
  'DocumentReference', 'CarePlan', 'CareTeam', 'Goal',
  'ServiceRequest', 'Coverage', 'Claim', 'ClaimResponse',
  'ExplanationOfBenefit', 'Appointment', 'Schedule', 'Slot',
  'Location', 'Device', 'Consent', 'Provenance',
  'AuditEvent', 'Communication', 'QuestionnaireResponse', 'Questionnaire',
  'RelatedPerson', 'Person', 'Group', 'Bundle',
  'OperationOutcome', 'Binary', 'Composition',
  '*',
]);

/**
 * Valid interaction types for SMART v2 granular scopes.
 */
const VALID_INTERACTIONS: ReadonlySet<string> = new Set([
  'read', 'write', 'create', 'update', 'delete', 'search',
  'cruds', // shorthand for create, read, update, delete, search
  '*',     // legacy wildcard
]);

/**
 * Special (non-resource) scopes supported by SMART on FHIR.
 */
const SPECIAL_SCOPES: ReadonlySet<string> = new Set([
  'launch',
  'launch/patient',
  'launch/encounter',
  'openid',
  'fhirUser',
  'profile',
  'offline_access',
  'online_access',
]);

/**
 * Full list of supported SMART v2 scopes.
 */
export const SMART_SCOPES: readonly string[] = [
  // Special scopes
  'launch',
  'launch/patient',
  'launch/encounter',
  'openid',
  'fhirUser',
  'profile',
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
];

/**
 * Expands shorthand interaction specifiers into individual interactions.
 */
function expandInteractions(interaction: string): string[] {
  switch (interaction) {
    case 'cruds':
      return ['create', 'read', 'update', 'delete', 'search'];
    case '*':
      return ['create', 'read', 'update', 'delete', 'search'];
    case 'read':
      return ['read', 'search'];
    case 'write':
      return ['create', 'update', 'delete'];
    default:
      return [interaction];
  }
}

/**
 * Parses a single SMART scope string into its structured components.
 *
 * Handles both resource scopes (e.g., "patient/Observation.read") and
 * special scopes (e.g., "launch", "openid").
 *
 * @param scope - A single SMART scope string
 * @returns The parsed scope object, or null if the scope is a special scope
 * @throws Error if the scope string is malformed
 */
export function parseSMARTScope(scope: string): ParsedSMARTScope | null {
  if (!scope || typeof scope !== 'string') {
    throw new Error('Scope must be a non-empty string');
  }

  const trimmed = scope.trim();

  // Handle special scopes
  if (SPECIAL_SCOPES.has(trimmed)) {
    return null;
  }

  // Resource scopes follow the pattern: context/ResourceType.interaction
  const resourceScopeRegex = /^(patient|user|system)\/([A-Za-z*]+)\.([a-z*]+)$/;
  const match = trimmed.match(resourceScopeRegex);

  if (!match) {
    throw new Error(`Invalid SMART scope format: "${scope}". Expected format: context/ResourceType.interaction`);
  }

  const [, context, resourceType, interaction] = match;

  if (!FHIR_RESOURCE_TYPES.has(resourceType)) {
    throw new Error(`Unknown FHIR resource type in scope: "${resourceType}"`);
  }

  if (!VALID_INTERACTIONS.has(interaction)) {
    throw new Error(`Invalid interaction in scope: "${interaction}". Valid interactions: ${Array.from(VALID_INTERACTIONS).join(', ')}`);
  }

  return {
    context: context as 'patient' | 'user' | 'system',
    resourceType,
    interactions: expandInteractions(interaction),
    raw: trimmed,
  };
}

/**
 * Checks whether the given scope string is valid per SMART v2 spec.
 *
 * @param scope - A single scope string to validate
 * @returns true if the scope is syntactically valid
 */
export function isValidScope(scope: string): boolean {
  if (!scope || typeof scope !== 'string') {
    return false;
  }

  const trimmed = scope.trim();

  if (SPECIAL_SCOPES.has(trimmed)) {
    return true;
  }

  const resourceScopeRegex = /^(patient|user|system)\/([A-Za-z*]+)\.([a-z*]+)$/;
  const match = trimmed.match(resourceScopeRegex);

  if (!match) {
    return false;
  }

  const [, , resourceType, interaction] = match;
  return FHIR_RESOURCE_TYPES.has(resourceType) && VALID_INTERACTIONS.has(interaction);
}

/**
 * Validates that a set of scopes grants access to a specific resource type and action.
 *
 * Handles wildcard resource types (*) and checks both the specific resource type
 * and the wildcard. For patient-context scopes, only grants access when the
 * action is within the expanded interaction set.
 *
 * @param scopes - Array of scope strings granted to the client
 * @param resourceType - The FHIR resource type being accessed (e.g., "Observation")
 * @param action - The action being performed (e.g., "read", "create", "update", "delete", "search")
 * @returns true if any scope grants the requested access
 */
export function validateScopeAccess(
  scopes: string[],
  resourceType: string,
  action: string,
): boolean {
  if (!scopes || scopes.length === 0) {
    return false;
  }

  if (!resourceType || !action) {
    return false;
  }

  for (const scope of scopes) {
    let parsed: ParsedSMARTScope | null;
    try {
      parsed = parseSMARTScope(scope);
    } catch {
      continue;
    }

    if (!parsed) {
      // Special scope -- does not grant resource access
      continue;
    }

    // Check if resource type matches (exact match or wildcard)
    const resourceMatches =
      parsed.resourceType === '*' || parsed.resourceType === resourceType;

    if (!resourceMatches) {
      continue;
    }

    // Check if action is within the expanded interactions
    if (parsed.interactions.includes(action)) {
      return true;
    }
  }

  return false;
}

/**
 * Filters a FHIR resource's fields based on the granted scopes.
 *
 * If the scopes include read access to the resource's type, the full resource
 * is returned. If no read access is granted, null is returned. This is a
 * coarse-grained filter; fine-grained field-level filtering can be added
 * as needed for specific resource types.
 *
 * @param resource - The FHIR resource object (must have a resourceType field)
 * @param scopes - Array of scope strings granted to the client
 * @returns The resource if access is permitted, or null if not
 */
export function filterResourceByScopes(
  resource: Record<string, unknown>,
  scopes: string[],
): Record<string, unknown> | null {
  if (!resource || typeof resource !== 'object') {
    return null;
  }

  const resourceType = resource.resourceType as string | undefined;
  if (!resourceType) {
    return null;
  }

  // Check if read or search access is granted
  const hasReadAccess = validateScopeAccess(scopes, resourceType, 'read');
  const hasSearchAccess = validateScopeAccess(scopes, resourceType, 'search');

  if (!hasReadAccess && !hasSearchAccess) {
    return null;
  }

  // Return a shallow copy of the resource.
  // In a production system you might strip sensitive sub-fields here based on
  // additional scope granularity (e.g., restricting mental health notes).
  return { ...resource };
}

/**
 * Validates a full space-delimited scope string, returning structured results.
 *
 * @param scopeString - Space-delimited scope string
 * @returns Validation result with any errors
 */
export function validateScopeString(scopeString: string): ScopeValidationResult {
  const errors: string[] = [];

  if (!scopeString || typeof scopeString !== 'string') {
    return { valid: false, errors: ['Scope string must be a non-empty string'] };
  }

  const scopes = scopeString.trim().split(/\s+/);

  for (const scope of scopes) {
    if (!isValidScope(scope)) {
      errors.push(`Invalid scope: "${scope}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
