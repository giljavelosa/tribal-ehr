// =============================================================================
// Authentication and Authorization Types
// =============================================================================

export enum UserRole {
  PHYSICIAN = 'PHYSICIAN',
  NURSE = 'NURSE',
  MEDICAL_ASSISTANT = 'MEDICAL_ASSISTANT',
  FRONT_DESK = 'FRONT_DESK',
  BILLING = 'BILLING',
  ADMIN = 'ADMIN',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  PATIENT = 'PATIENT',
}

export type ResourceAction = 'create' | 'read' | 'update' | 'delete';

export interface Permission {
  resource: string;
  actions: ResourceAction[];
}

export type RolePermissions = Record<UserRole, Permission[]>;

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  npi?: string;
  dea?: string;
  specialties?: string[];
  active: boolean;
  mfaEnabled: boolean;
  lastLogin?: string;
  passwordChangedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TokenPayload {
  sub: string;
  role: UserRole;
  sessionId: string;
  iat: number;
  exp: number;
}

export type SmartScope = string;

export interface OAuthClient {
  id: string;
  name: string;
  redirectUris: string[];
  grantTypes: string[];
  scopes: SmartScope[];
  confidential: boolean;
}
