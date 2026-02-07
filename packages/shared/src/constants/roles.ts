// =============================================================================
// Role-Based Access Control (RBAC) Default Permissions
// =============================================================================

import { UserRole, Permission, RolePermissions, ResourceAction } from '../types/auth';

const ALL_ACTIONS: ResourceAction[] = ['create', 'read', 'update', 'delete'];
const READ_ONLY: ResourceAction[] = ['read'];
const READ_CREATE: ResourceAction[] = ['create', 'read'];
const READ_CREATE_UPDATE: ResourceAction[] = ['create', 'read', 'update'];

const CLINICAL_RESOURCES = [
  'Patient',
  'AllergyIntolerance',
  'Condition',
  'Procedure',
  'Observation',
  'Encounter',
  'CarePlan',
  'CareTeam',
  'Goal',
  'Immunization',
  'MedicationRequest',
  'DocumentReference',
  'Device',
  'DiagnosticReport',
  'ServiceRequest',
];

const ADMIN_RESOURCES = [
  'User',
  'AuditEvent',
  'Organization',
  'Location',
  'Practitioner',
  'PractitionerRole',
  'Schedule',
  'Slot',
];

const BILLING_RESOURCES = [
  'Coverage',
  'Claim',
  'ExplanationOfBenefit',
  'Invoice',
  'Account',
];

function buildPermissions(resource: string, actions: ResourceAction[]): Permission {
  return { resource, actions };
}

function bulkPermissions(resources: string[], actions: ResourceAction[]): Permission[] {
  return resources.map((resource) => buildPermissions(resource, actions));
}

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  [UserRole.SYSTEM_ADMIN]: [
    ...bulkPermissions(CLINICAL_RESOURCES, ALL_ACTIONS),
    ...bulkPermissions(ADMIN_RESOURCES, ALL_ACTIONS),
    ...bulkPermissions(BILLING_RESOURCES, ALL_ACTIONS),
    buildPermissions('Provenance', ALL_ACTIONS),
    buildPermissions('Configuration', ALL_ACTIONS),
  ],

  [UserRole.ADMIN]: [
    ...bulkPermissions(CLINICAL_RESOURCES, READ_ONLY),
    ...bulkPermissions(ADMIN_RESOURCES, ALL_ACTIONS),
    ...bulkPermissions(BILLING_RESOURCES, READ_ONLY),
    buildPermissions('Provenance', READ_ONLY),
    buildPermissions('AuditEvent', READ_ONLY),
    buildPermissions('User', ALL_ACTIONS),
    buildPermissions('Schedule', ALL_ACTIONS),
    buildPermissions('Slot', ALL_ACTIONS),
  ],

  [UserRole.PHYSICIAN]: [
    ...bulkPermissions(CLINICAL_RESOURCES, ALL_ACTIONS),
    buildPermissions('Provenance', READ_CREATE),
    buildPermissions('AuditEvent', READ_ONLY),
    buildPermissions('Schedule', READ_ONLY),
    buildPermissions('Slot', ['read', 'update']),
    ...bulkPermissions(BILLING_RESOURCES, READ_ONLY),
    buildPermissions('User', READ_ONLY),
    buildPermissions('Organization', READ_ONLY),
    buildPermissions('Location', READ_ONLY),
    buildPermissions('Practitioner', READ_ONLY),
    buildPermissions('PractitionerRole', READ_ONLY),
  ],

  [UserRole.NURSE]: [
    ...bulkPermissions(CLINICAL_RESOURCES, READ_CREATE_UPDATE),
    buildPermissions('Provenance', READ_CREATE),
    buildPermissions('AuditEvent', READ_ONLY),
    buildPermissions('Schedule', READ_ONLY),
    buildPermissions('Slot', READ_ONLY),
    ...bulkPermissions(BILLING_RESOURCES, READ_ONLY),
    buildPermissions('User', READ_ONLY),
    buildPermissions('Organization', READ_ONLY),
    buildPermissions('Location', READ_ONLY),
    buildPermissions('Practitioner', READ_ONLY),
    buildPermissions('PractitionerRole', READ_ONLY),
  ],

  [UserRole.MEDICAL_ASSISTANT]: [
    buildPermissions('Patient', READ_CREATE_UPDATE),
    buildPermissions('AllergyIntolerance', READ_CREATE_UPDATE),
    buildPermissions('Condition', READ_ONLY),
    buildPermissions('Procedure', READ_ONLY),
    buildPermissions('Observation', READ_CREATE_UPDATE),
    buildPermissions('Encounter', READ_CREATE_UPDATE),
    buildPermissions('CarePlan', READ_ONLY),
    buildPermissions('CareTeam', READ_ONLY),
    buildPermissions('Goal', READ_ONLY),
    buildPermissions('Immunization', READ_CREATE_UPDATE),
    buildPermissions('MedicationRequest', READ_ONLY),
    buildPermissions('DocumentReference', READ_CREATE),
    buildPermissions('Device', READ_ONLY),
    buildPermissions('DiagnosticReport', READ_ONLY),
    buildPermissions('ServiceRequest', READ_ONLY),
    buildPermissions('Provenance', READ_ONLY),
    buildPermissions('Schedule', READ_ONLY),
    buildPermissions('Slot', READ_ONLY),
    buildPermissions('Organization', READ_ONLY),
    buildPermissions('Location', READ_ONLY),
    buildPermissions('Practitioner', READ_ONLY),
    buildPermissions('PractitionerRole', READ_ONLY),
  ],

  [UserRole.FRONT_DESK]: [
    buildPermissions('Patient', READ_CREATE_UPDATE),
    buildPermissions('Encounter', READ_CREATE_UPDATE),
    buildPermissions('Coverage', READ_CREATE_UPDATE),
    buildPermissions('Schedule', ['read', 'update']),
    buildPermissions('Slot', ['read', 'update']),
    buildPermissions('DocumentReference', READ_CREATE),
    buildPermissions('Organization', READ_ONLY),
    buildPermissions('Location', READ_ONLY),
    buildPermissions('Practitioner', READ_ONLY),
    buildPermissions('PractitionerRole', READ_ONLY),
  ],

  [UserRole.BILLING]: [
    buildPermissions('Patient', READ_ONLY),
    buildPermissions('Encounter', READ_ONLY),
    buildPermissions('Condition', READ_ONLY),
    buildPermissions('Procedure', READ_ONLY),
    buildPermissions('MedicationRequest', READ_ONLY),
    buildPermissions('DiagnosticReport', READ_ONLY),
    buildPermissions('ServiceRequest', READ_ONLY),
    ...bulkPermissions(BILLING_RESOURCES, ALL_ACTIONS),
    buildPermissions('Organization', READ_ONLY),
    buildPermissions('Practitioner', READ_ONLY),
    buildPermissions('PractitionerRole', READ_ONLY),
  ],

  [UserRole.PATIENT]: [
    buildPermissions('Patient', READ_ONLY),
    buildPermissions('AllergyIntolerance', READ_ONLY),
    buildPermissions('Condition', READ_ONLY),
    buildPermissions('Procedure', READ_ONLY),
    buildPermissions('Observation', READ_ONLY),
    buildPermissions('Encounter', READ_ONLY),
    buildPermissions('CarePlan', READ_ONLY),
    buildPermissions('CareTeam', READ_ONLY),
    buildPermissions('Goal', READ_ONLY),
    buildPermissions('Immunization', READ_ONLY),
    buildPermissions('MedicationRequest', READ_ONLY),
    buildPermissions('DocumentReference', READ_ONLY),
    buildPermissions('Device', READ_ONLY),
    buildPermissions('DiagnosticReport', READ_ONLY),
    buildPermissions('Coverage', READ_ONLY),
    buildPermissions('Provenance', READ_ONLY),
  ],
};
