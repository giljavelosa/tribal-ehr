// =============================================================================
// SMART on FHIR Scope Validation Middleware (ONC §170.315(g)(10))
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { AuthorizationError, AuthenticationError } from '../utils/errors';
import { logger } from '../utils/logger';

// FHIR resource types in the Patient compartment (US Core R4)
const PATIENT_COMPARTMENT_RESOURCES = new Set([
  'Patient',
  'Observation',
  'Condition',
  'MedicationRequest',
  'MedicationStatement',
  'AllergyIntolerance',
  'Procedure',
  'Immunization',
  'CarePlan',
  'CareTeam',
  'Goal',
  'Device',
  'DocumentReference',
  'DiagnosticReport',
  'Encounter',
  'Provenance',
]);

// Resources accessible with user-level scopes (includes admin/practitioner resources)
const USER_ACCESSIBLE_RESOURCES = new Set([
  ...PATIENT_COMPARTMENT_RESOURCES,
  'Practitioner',
  'PractitionerRole',
  'Organization',
  'Location',
  'HealthcareService',
  'Schedule',
  'Slot',
  'Appointment',
  'Medication',
  'ValueSet',
  'CodeSystem',
  'StructureDefinition',
]);

// Roles that have full FHIR access
const FULL_ACCESS_ROLES = new Set(['admin', 'physician', 'system']);

// Roles that have read-only access to clinical resources
const READ_ONLY_ROLES = new Set(['nurse', 'medical_assistant', 'lab_tech']);

/**
 * Parse SMART on FHIR v2 scopes into structured form.
 * Scopes follow the pattern: context/ResourceType.action
 * Examples: patient/Patient.read, user/*.write, system/*.read
 */
interface ParsedScope {
  context: 'patient' | 'user' | 'system';
  resourceType: string; // '*' for wildcard
  action: 'read' | 'write' | '*';
}

export function parseSmartScopes(scopeString: string): ParsedScope[] {
  const scopes: ParsedScope[] = [];
  const parts = scopeString.split(/\s+/);

  for (const part of parts) {
    const match = part.match(/^(patient|user|system)\/(\*|[A-Za-z]+)\.(read|write|\*)$/);
    if (match) {
      scopes.push({
        context: match[1] as ParsedScope['context'],
        resourceType: match[2],
        action: match[3] as ParsedScope['action'],
      });
    }
  }

  return scopes;
}

/**
 * Check whether parsed scopes grant the requested access.
 */
function scopesGrantAccess(
  scopes: ParsedScope[],
  resourceType: string,
  action: 'read' | 'write'
): boolean {
  return scopes.some((scope) => {
    // Resource type must match (wildcard or exact)
    const resourceMatch = scope.resourceType === '*' || scope.resourceType === resourceType;
    // Action must match (wildcard or exact)
    const actionMatch = scope.action === '*' || scope.action === action;
    return resourceMatch && actionMatch;
  });
}

/**
 * Check if the requested resource type is in the patient compartment.
 */
export function isPatientCompartmentResource(resourceType: string): boolean {
  return PATIENT_COMPARTMENT_RESOURCES.has(resourceType);
}

/**
 * Middleware factory to validate FHIR access based on SMART scopes and user roles.
 *
 * For SMART on FHIR tokens (req.smartToken), enforces scope-based access.
 * For standard JWT tokens (req.user), enforces role-based access.
 */
export function validateFhirAccess(resourceType: string, action: 'read' | 'write') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // ------------------------------------------------------------------
      // Path 1: SMART on FHIR token-based access
      // ------------------------------------------------------------------
      if (req.smartToken) {
        const scopes = parseSmartScopes(req.smartToken.scope);

        if (!scopesGrantAccess(scopes, resourceType, action)) {
          logger.warn('SMART scope validation failed', {
            requestedResource: resourceType,
            requestedAction: action,
            grantedScopes: req.smartToken.scope,
          });
          throw new AuthorizationError(
            `Insufficient SMART scope for ${action} on ${resourceType}. ` +
            `Required: patient/${resourceType}.${action} or user/${resourceType}.${action}`
          );
        }

        // Patient-context scope: enforce patient compartment
        const patientScopes = scopes.filter((s) => s.context === 'patient');
        if (patientScopes.length > 0 && patientScopes.some((s) =>
          (s.resourceType === '*' || s.resourceType === resourceType) &&
          (s.action === '*' || s.action === action)
        )) {
          // If using patient-level scopes, a patient context must be present
          if (!req.smartToken.patient) {
            throw new AuthorizationError(
              'Patient-level scope requires a patient launch context'
            );
          }
        }

        next();
        return;
      }

      // ------------------------------------------------------------------
      // Path 2: Standard JWT role-based access
      // ------------------------------------------------------------------
      if (req.user) {
        const { role } = req.user;

        // Full access roles
        if (FULL_ACCESS_ROLES.has(role)) {
          next();
          return;
        }

        // Read-only roles
        if (READ_ONLY_ROLES.has(role)) {
          if (action === 'write') {
            logger.warn('Write access denied for read-only role', {
              userId: req.user.id,
              role,
              resourceType,
            });
            throw new AuthorizationError(
              `Role '${role}' does not have write access to FHIR resources`
            );
          }
          next();
          return;
        }

        // Patient role: only own data in patient compartment
        if (role === 'patient') {
          if (action === 'write') {
            throw new AuthorizationError(
              'Patients do not have write access to FHIR resources'
            );
          }
          if (!isPatientCompartmentResource(resourceType)) {
            throw new AuthorizationError(
              `Patients cannot access ${resourceType} resources`
            );
          }
          next();
          return;
        }

        // Unknown role: deny
        logger.warn('FHIR access denied for unknown role', {
          userId: req.user.id,
          role,
          resourceType,
          action,
        });
        throw new AuthorizationError(
          `Role '${role}' is not authorized for FHIR access`
        );
      }

      // No auth context at all
      throw new AuthenticationError('Authentication required for FHIR access');
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Derive the patient compartment filter params for a request.
 * Returns patient ID to scope queries, or null if no patient scoping needed.
 */
export function getPatientCompartmentId(req: Request): string | null {
  // SMART token with patient context
  if (req.smartToken?.patient) {
    return req.smartToken.patient;
  }

  // Standard JWT patient role: scope to own patientId
  if (req.user?.role === 'patient' && req.user.patientId) {
    return req.user.patientId;
  }

  return null;
}
