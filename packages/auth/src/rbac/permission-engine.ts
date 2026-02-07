/**
 * Role-Based Access Control (RBAC) Permission Engine
 *
 * Implements a comprehensive RBAC system for healthcare EHR environments.
 * Supports standard role-based permissions as well as emergency ("break-the-glass")
 * access with full audit logging. Roles are modeled after typical healthcare
 * organization structures and designed for ONC certification compliance.
 */

import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Types and interfaces
// ---------------------------------------------------------------------------

export type Action = 'create' | 'read' | 'update' | 'delete' | 'search' | 'manage';

export interface Permission {
  resource: string;
  actions: Action[];
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  /** Type of condition (e.g., "own_data" means only if the data belongs to the user) */
  type: 'own_data' | 'department' | 'care_team' | 'assigned';
  /** Additional parameter for the condition */
  value?: string;
}

export interface EmergencyAccessGrant {
  id: string;
  userId: string;
  patientId: string;
  reason: string;
  grantedAt: Date;
  expiresAt: Date;
  revoked: boolean;
  revokedAt?: Date;
  revokedBy?: string;
}

export interface EmergencyAccessStore {
  saveGrant(grant: EmergencyAccessGrant): Promise<void>;
  getGrant(grantId: string): Promise<EmergencyAccessGrant | null>;
  getActiveGrantsForUser(userId: string): Promise<EmergencyAccessGrant[]>;
  revokeGrant(grantId: string, revokedBy: string): Promise<void>;
}

export interface AuditLogger {
  logEmergencyAccess(grant: EmergencyAccessGrant): Promise<void>;
  logEmergencyRevocation(grantId: string, revokedBy: string): Promise<void>;
  logPermissionCheck(
    userId: string,
    role: string,
    resource: string,
    action: string,
    allowed: boolean,
  ): Promise<void>;
}

/**
 * Default no-op audit logger. Replace with a real implementation in production.
 */
const noopAuditLogger: AuditLogger = {
  async logEmergencyAccess(): Promise<void> {},
  async logEmergencyRevocation(): Promise<void> {},
  async logPermissionCheck(): Promise<void> {},
};

// ---------------------------------------------------------------------------
// Role definitions
// ---------------------------------------------------------------------------

export enum Role {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  ADMIN = 'ADMIN',
  PHYSICIAN = 'PHYSICIAN',
  NURSE = 'NURSE',
  MEDICAL_ASSISTANT = 'MEDICAL_ASSISTANT',
  FRONT_DESK = 'FRONT_DESK',
  BILLING = 'BILLING',
  PATIENT = 'PATIENT',
}

/**
 * Resource categories used in the RBAC matrix.
 */
export enum Resource {
  // Clinical resources
  PATIENT = 'Patient',
  ENCOUNTER = 'Encounter',
  CONDITION = 'Condition',
  OBSERVATION = 'Observation',
  PROCEDURE = 'Procedure',
  MEDICATION_REQUEST = 'MedicationRequest',
  MEDICATION_ADMINISTRATION = 'MedicationAdministration',
  ALLERGY_INTOLERANCE = 'AllergyIntolerance',
  IMMUNIZATION = 'Immunization',
  DIAGNOSTIC_REPORT = 'DiagnosticReport',
  DOCUMENT_REFERENCE = 'DocumentReference',
  CARE_PLAN = 'CarePlan',
  CARE_TEAM = 'CareTeam',
  GOAL = 'Goal',
  CLINICAL_NOTE = 'ClinicalNote',
  DEVICE = 'Device',

  // Administrative resources
  PRACTITIONER = 'Practitioner',
  ORGANIZATION = 'Organization',
  LOCATION = 'Location',
  SCHEDULE = 'Schedule',
  APPOINTMENT = 'Appointment',
  SLOT = 'Slot',

  // Billing resources
  COVERAGE = 'Coverage',
  CLAIM = 'Claim',
  CLAIM_RESPONSE = 'ClaimResponse',
  EXPLANATION_OF_BENEFIT = 'ExplanationOfBenefit',
  INVOICE = 'Invoice',

  // System resources
  AUDIT_EVENT = 'AuditEvent',
  CONSENT = 'Consent',
  PROVENANCE = 'Provenance',
  SYSTEM_CONFIG = 'SystemConfig',
  USER_ACCOUNT = 'UserAccount',

  // Communication
  COMMUNICATION = 'Communication',
  MESSAGE = 'Message',
}

const ALL_ACTIONS: Action[] = ['create', 'read', 'update', 'delete', 'search', 'manage'];
const CRUD: Action[] = ['create', 'read', 'update', 'delete', 'search'];
const READ_ONLY: Action[] = ['read', 'search'];
const READ_UPDATE: Action[] = ['read', 'update', 'search'];
const CREATE_READ: Action[] = ['create', 'read', 'search'];

/**
 * Complete RBAC permission matrix mapping roles to their permissions.
 */
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  // -----------------------------------------------------------------------
  // SYSTEM_ADMIN: full access to everything including system configuration
  // -----------------------------------------------------------------------
  [Role.SYSTEM_ADMIN]: [
    { resource: '*', actions: ALL_ACTIONS },
  ],

  // -----------------------------------------------------------------------
  // ADMIN: full access except system configuration
  // -----------------------------------------------------------------------
  [Role.ADMIN]: [
    { resource: Resource.PATIENT, actions: ALL_ACTIONS },
    { resource: Resource.ENCOUNTER, actions: ALL_ACTIONS },
    { resource: Resource.CONDITION, actions: ALL_ACTIONS },
    { resource: Resource.OBSERVATION, actions: ALL_ACTIONS },
    { resource: Resource.PROCEDURE, actions: ALL_ACTIONS },
    { resource: Resource.MEDICATION_REQUEST, actions: ALL_ACTIONS },
    { resource: Resource.MEDICATION_ADMINISTRATION, actions: ALL_ACTIONS },
    { resource: Resource.ALLERGY_INTOLERANCE, actions: ALL_ACTIONS },
    { resource: Resource.IMMUNIZATION, actions: ALL_ACTIONS },
    { resource: Resource.DIAGNOSTIC_REPORT, actions: ALL_ACTIONS },
    { resource: Resource.DOCUMENT_REFERENCE, actions: ALL_ACTIONS },
    { resource: Resource.CARE_PLAN, actions: ALL_ACTIONS },
    { resource: Resource.CARE_TEAM, actions: ALL_ACTIONS },
    { resource: Resource.GOAL, actions: ALL_ACTIONS },
    { resource: Resource.CLINICAL_NOTE, actions: ALL_ACTIONS },
    { resource: Resource.PRACTITIONER, actions: ALL_ACTIONS },
    { resource: Resource.ORGANIZATION, actions: ALL_ACTIONS },
    { resource: Resource.LOCATION, actions: ALL_ACTIONS },
    { resource: Resource.SCHEDULE, actions: ALL_ACTIONS },
    { resource: Resource.APPOINTMENT, actions: ALL_ACTIONS },
    { resource: Resource.SLOT, actions: ALL_ACTIONS },
    { resource: Resource.COVERAGE, actions: ALL_ACTIONS },
    { resource: Resource.CLAIM, actions: ALL_ACTIONS },
    { resource: Resource.CLAIM_RESPONSE, actions: ALL_ACTIONS },
    { resource: Resource.EXPLANATION_OF_BENEFIT, actions: ALL_ACTIONS },
    { resource: Resource.INVOICE, actions: ALL_ACTIONS },
    { resource: Resource.AUDIT_EVENT, actions: READ_ONLY },
    { resource: Resource.CONSENT, actions: ALL_ACTIONS },
    { resource: Resource.PROVENANCE, actions: READ_ONLY },
    { resource: Resource.USER_ACCOUNT, actions: ALL_ACTIONS },
    { resource: Resource.COMMUNICATION, actions: ALL_ACTIONS },
    { resource: Resource.MESSAGE, actions: ALL_ACTIONS },
  ],

  // -----------------------------------------------------------------------
  // PHYSICIAN: full clinical CRUD, read admin
  // -----------------------------------------------------------------------
  [Role.PHYSICIAN]: [
    { resource: Resource.PATIENT, actions: CRUD },
    { resource: Resource.ENCOUNTER, actions: CRUD },
    { resource: Resource.CONDITION, actions: CRUD },
    { resource: Resource.OBSERVATION, actions: CRUD },
    { resource: Resource.PROCEDURE, actions: CRUD },
    { resource: Resource.MEDICATION_REQUEST, actions: CRUD },
    { resource: Resource.MEDICATION_ADMINISTRATION, actions: CRUD },
    { resource: Resource.ALLERGY_INTOLERANCE, actions: CRUD },
    { resource: Resource.IMMUNIZATION, actions: CRUD },
    { resource: Resource.DIAGNOSTIC_REPORT, actions: CRUD },
    { resource: Resource.DOCUMENT_REFERENCE, actions: CRUD },
    { resource: Resource.CARE_PLAN, actions: CRUD },
    { resource: Resource.CARE_TEAM, actions: CRUD },
    { resource: Resource.GOAL, actions: CRUD },
    { resource: Resource.CLINICAL_NOTE, actions: CRUD },
    { resource: Resource.DEVICE, actions: CRUD },
    { resource: Resource.PRACTITIONER, actions: READ_ONLY },
    { resource: Resource.ORGANIZATION, actions: READ_ONLY },
    { resource: Resource.LOCATION, actions: READ_ONLY },
    { resource: Resource.SCHEDULE, actions: READ_ONLY },
    { resource: Resource.APPOINTMENT, actions: CRUD },
    { resource: Resource.SLOT, actions: READ_ONLY },
    { resource: Resource.COVERAGE, actions: READ_ONLY },
    { resource: Resource.CONSENT, actions: CRUD },
    { resource: Resource.COMMUNICATION, actions: CRUD },
    { resource: Resource.MESSAGE, actions: CRUD },
  ],

  // -----------------------------------------------------------------------
  // NURSE: read/update clinical, create observations/notes, read medications
  // -----------------------------------------------------------------------
  [Role.NURSE]: [
    { resource: Resource.PATIENT, actions: READ_UPDATE },
    { resource: Resource.ENCOUNTER, actions: READ_UPDATE },
    { resource: Resource.CONDITION, actions: READ_ONLY },
    { resource: Resource.OBSERVATION, actions: ['create', 'read', 'update', 'search'] },
    { resource: Resource.PROCEDURE, actions: READ_ONLY },
    { resource: Resource.MEDICATION_REQUEST, actions: READ_ONLY },
    { resource: Resource.MEDICATION_ADMINISTRATION, actions: ['create', 'read', 'update', 'search'] },
    { resource: Resource.ALLERGY_INTOLERANCE, actions: READ_UPDATE },
    { resource: Resource.IMMUNIZATION, actions: ['create', 'read', 'update', 'search'] },
    { resource: Resource.DIAGNOSTIC_REPORT, actions: READ_ONLY },
    { resource: Resource.DOCUMENT_REFERENCE, actions: ['create', 'read', 'search'] },
    { resource: Resource.CARE_PLAN, actions: READ_UPDATE },
    { resource: Resource.CARE_TEAM, actions: READ_ONLY },
    { resource: Resource.GOAL, actions: READ_UPDATE },
    { resource: Resource.CLINICAL_NOTE, actions: ['create', 'read', 'update', 'search'] },
    { resource: Resource.PRACTITIONER, actions: READ_ONLY },
    { resource: Resource.LOCATION, actions: READ_ONLY },
    { resource: Resource.SCHEDULE, actions: READ_ONLY },
    { resource: Resource.APPOINTMENT, actions: READ_UPDATE },
    { resource: Resource.CONSENT, actions: READ_ONLY },
    { resource: Resource.COMMUNICATION, actions: CRUD },
    { resource: Resource.MESSAGE, actions: CRUD },
  ],

  // -----------------------------------------------------------------------
  // MEDICAL_ASSISTANT: create/read vitals, update demographics, scheduling
  // -----------------------------------------------------------------------
  [Role.MEDICAL_ASSISTANT]: [
    { resource: Resource.PATIENT, actions: READ_UPDATE },
    { resource: Resource.ENCOUNTER, actions: CREATE_READ },
    { resource: Resource.OBSERVATION, actions: ['create', 'read', 'update', 'search'] },
    { resource: Resource.ALLERGY_INTOLERANCE, actions: READ_ONLY },
    { resource: Resource.IMMUNIZATION, actions: ['create', 'read', 'search'] },
    { resource: Resource.MEDICATION_REQUEST, actions: READ_ONLY },
    { resource: Resource.DIAGNOSTIC_REPORT, actions: READ_ONLY },
    { resource: Resource.DOCUMENT_REFERENCE, actions: CREATE_READ },
    { resource: Resource.CLINICAL_NOTE, actions: CREATE_READ },
    { resource: Resource.PRACTITIONER, actions: READ_ONLY },
    { resource: Resource.LOCATION, actions: READ_ONLY },
    { resource: Resource.SCHEDULE, actions: CRUD },
    { resource: Resource.APPOINTMENT, actions: CRUD },
    { resource: Resource.SLOT, actions: CRUD },
    { resource: Resource.COMMUNICATION, actions: CREATE_READ },
    { resource: Resource.MESSAGE, actions: CREATE_READ },
  ],

  // -----------------------------------------------------------------------
  // FRONT_DESK: scheduling, demographics, insurance, check-in
  // -----------------------------------------------------------------------
  [Role.FRONT_DESK]: [
    { resource: Resource.PATIENT, actions: ['create', 'read', 'update', 'search'] },
    { resource: Resource.ENCOUNTER, actions: ['create', 'read', 'search'] },
    { resource: Resource.COVERAGE, actions: CRUD },
    { resource: Resource.PRACTITIONER, actions: READ_ONLY },
    { resource: Resource.ORGANIZATION, actions: READ_ONLY },
    { resource: Resource.LOCATION, actions: READ_ONLY },
    { resource: Resource.SCHEDULE, actions: CRUD },
    { resource: Resource.APPOINTMENT, actions: CRUD },
    { resource: Resource.SLOT, actions: CRUD },
    { resource: Resource.COMMUNICATION, actions: CREATE_READ },
    { resource: Resource.MESSAGE, actions: CREATE_READ },
  ],

  // -----------------------------------------------------------------------
  // BILLING: read clinical, full billing access
  // -----------------------------------------------------------------------
  [Role.BILLING]: [
    { resource: Resource.PATIENT, actions: READ_ONLY },
    { resource: Resource.ENCOUNTER, actions: READ_ONLY },
    { resource: Resource.CONDITION, actions: READ_ONLY },
    { resource: Resource.PROCEDURE, actions: READ_ONLY },
    { resource: Resource.MEDICATION_REQUEST, actions: READ_ONLY },
    { resource: Resource.DIAGNOSTIC_REPORT, actions: READ_ONLY },
    { resource: Resource.COVERAGE, actions: CRUD },
    { resource: Resource.CLAIM, actions: CRUD },
    { resource: Resource.CLAIM_RESPONSE, actions: CRUD },
    { resource: Resource.EXPLANATION_OF_BENEFIT, actions: CRUD },
    { resource: Resource.INVOICE, actions: CRUD },
    { resource: Resource.PRACTITIONER, actions: READ_ONLY },
    { resource: Resource.ORGANIZATION, actions: READ_ONLY },
    { resource: Resource.COMMUNICATION, actions: CREATE_READ },
    { resource: Resource.MESSAGE, actions: CREATE_READ },
  ],

  // -----------------------------------------------------------------------
  // PATIENT: read own data only, create messages, request appointments
  // -----------------------------------------------------------------------
  [Role.PATIENT]: [
    {
      resource: Resource.PATIENT,
      actions: READ_ONLY,
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.ENCOUNTER,
      actions: READ_ONLY,
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.CONDITION,
      actions: READ_ONLY,
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.OBSERVATION,
      actions: READ_ONLY,
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.PROCEDURE,
      actions: READ_ONLY,
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.MEDICATION_REQUEST,
      actions: READ_ONLY,
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.ALLERGY_INTOLERANCE,
      actions: READ_ONLY,
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.IMMUNIZATION,
      actions: READ_ONLY,
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.DIAGNOSTIC_REPORT,
      actions: READ_ONLY,
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.DOCUMENT_REFERENCE,
      actions: READ_ONLY,
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.CARE_PLAN,
      actions: READ_ONLY,
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.GOAL,
      actions: READ_ONLY,
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.COVERAGE,
      actions: READ_ONLY,
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.APPOINTMENT,
      actions: ['create', 'read', 'search'],
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.CONSENT,
      actions: ['create', 'read', 'update', 'search'],
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.MESSAGE,
      actions: ['create', 'read', 'search'],
      conditions: [{ type: 'own_data' }],
    },
    {
      resource: Resource.COMMUNICATION,
      actions: ['create', 'read', 'search'],
      conditions: [{ type: 'own_data' }],
    },
  ],
};

// ---------------------------------------------------------------------------
// Emergency access defaults
// ---------------------------------------------------------------------------

/** Duration of emergency access grants in minutes */
const EMERGENCY_ACCESS_DURATION_MINUTES = 60;

// ---------------------------------------------------------------------------
// Permission Engine
// ---------------------------------------------------------------------------

export class PermissionEngine {
  private readonly emergencyStore: EmergencyAccessStore;
  private readonly auditLogger: AuditLogger;

  constructor(
    emergencyStore: EmergencyAccessStore,
    auditLogger: AuditLogger = noopAuditLogger,
  ) {
    this.emergencyStore = emergencyStore;
    this.auditLogger = auditLogger;
  }

  /**
   * Checks whether a user with the given role has permission to perform
   * an action on a resource.
   *
   * @param userRole - The user's role (e.g., "PHYSICIAN")
   * @param resource - The resource type (e.g., "Patient")
   * @param action - The action (e.g., "read", "create")
   * @returns true if the permission is granted
   */
  checkPermission(userRole: string, resource: string, action: string): boolean {
    const permissions = ROLE_PERMISSIONS[userRole];
    if (!permissions) {
      return false;
    }

    for (const perm of permissions) {
      // Wildcard resource (SYSTEM_ADMIN)
      if (perm.resource === '*' && perm.actions.includes(action as Action)) {
        return true;
      }

      if (perm.resource === resource && perm.actions.includes(action as Action)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Returns the full list of permissions for a given role.
   *
   * @param userRole - The role to look up
   * @returns Array of Permission objects, or empty array if role is unknown
   */
  getPermissions(userRole: string): Permission[] {
    return ROLE_PERMISSIONS[userRole] ? [...ROLE_PERMISSIONS[userRole]] : [];
  }

  /**
   * Checks whether a user currently has an active emergency access grant.
   *
   * @param userId - The user ID to check
   * @returns true if the user has at least one active (non-expired, non-revoked) grant
   */
  async hasEmergencyAccess(userId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }

    const grants = await this.emergencyStore.getActiveGrantsForUser(userId);
    const now = new Date();

    return grants.some(
      (grant) => !grant.revoked && grant.expiresAt > now,
    );
  }

  /**
   * Grants emergency ("break-the-glass") access to a patient's record.
   *
   * Emergency access bypasses normal RBAC controls and grants full read access
   * to a specific patient's data for a limited time. Every grant is logged
   * for audit purposes and must include a clinical justification.
   *
   * @param userId - The user requesting emergency access
   * @param reason - Clinical justification for the emergency access
   * @param patientId - The patient whose record is being accessed
   * @returns The emergency access grant object
   * @throws Error if parameters are missing
   */
  async grantEmergencyAccess(
    userId: string,
    reason: string,
    patientId: string,
  ): Promise<EmergencyAccessGrant> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required');
    }
    if (!reason || typeof reason !== 'string') {
      throw new Error('reason is required for emergency access');
    }
    if (reason.trim().length < 10) {
      throw new Error('Emergency access reason must be at least 10 characters');
    }
    if (!patientId || typeof patientId !== 'string') {
      throw new Error('patientId is required');
    }

    const now = new Date();
    const grant: EmergencyAccessGrant = {
      id: uuidv4(),
      userId,
      patientId,
      reason: reason.trim(),
      grantedAt: now,
      expiresAt: new Date(now.getTime() + EMERGENCY_ACCESS_DURATION_MINUTES * 60 * 1000),
      revoked: false,
    };

    await this.emergencyStore.saveGrant(grant);
    await this.auditLogger.logEmergencyAccess(grant);

    return grant;
  }

  /**
   * Revokes an existing emergency access grant.
   *
   * @param grantId - The ID of the grant to revoke
   * @param revokedBy - The user ID performing the revocation (defaults to "system")
   * @throws Error if the grant is not found or is already revoked
   */
  async revokeEmergencyAccess(grantId: string, revokedBy: string = 'system'): Promise<void> {
    if (!grantId || typeof grantId !== 'string') {
      throw new Error('grantId is required');
    }

    const grant = await this.emergencyStore.getGrant(grantId);
    if (!grant) {
      throw new Error(`Emergency access grant not found: ${grantId}`);
    }

    if (grant.revoked) {
      throw new Error(`Emergency access grant is already revoked: ${grantId}`);
    }

    await this.emergencyStore.revokeGrant(grantId, revokedBy);
    await this.auditLogger.logEmergencyRevocation(grantId, revokedBy);
  }

  /**
   * Checks whether a user has permission to perform an action, considering
   * both their role-based permissions and any active emergency access grants.
   *
   * This is the primary method to use when checking access at runtime.
   *
   * @param userId - The user's ID
   * @param userRole - The user's role
   * @param resource - The resource type being accessed
   * @param action - The action being performed
   * @param patientId - The patient context (for emergency access checks)
   * @returns true if access is permitted
   */
  async checkAccess(
    userId: string,
    userRole: string,
    resource: string,
    action: string,
    patientId?: string,
  ): Promise<boolean> {
    // First check standard RBAC permissions
    const hasPermission = this.checkPermission(userRole, resource, action);

    if (hasPermission) {
      await this.auditLogger.logPermissionCheck(userId, userRole, resource, action, true);
      return true;
    }

    // If standard permissions deny access, check emergency access
    if (patientId && (action === 'read' || action === 'search')) {
      const grants = await this.emergencyStore.getActiveGrantsForUser(userId);
      const now = new Date();
      const activeGrant = grants.find(
        (g) => g.patientId === patientId && !g.revoked && g.expiresAt > now,
      );

      if (activeGrant) {
        await this.auditLogger.logPermissionCheck(userId, userRole, resource, action, true);
        return true;
      }
    }

    await this.auditLogger.logPermissionCheck(userId, userRole, resource, action, false);
    return false;
  }

  /**
   * Returns the permission conditions for a specific role, resource, and action.
   * Useful for building data queries that enforce row-level security (e.g., "own_data").
   *
   * @param userRole - The user's role
   * @param resource - The resource type
   * @param action - The action
   * @returns Array of conditions, or empty array if no conditions apply
   */
  getConditions(userRole: string, resource: string, action: string): PermissionCondition[] {
    const permissions = ROLE_PERMISSIONS[userRole];
    if (!permissions) {
      return [];
    }

    for (const perm of permissions) {
      if (
        (perm.resource === '*' || perm.resource === resource) &&
        perm.actions.includes(action as Action)
      ) {
        return perm.conditions ? [...perm.conditions] : [];
      }
    }

    return [];
  }
}
