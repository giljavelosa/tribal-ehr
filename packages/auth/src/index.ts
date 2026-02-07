/**
 * @tribal-ehr/auth
 *
 * OAuth 2.0 + SMART on FHIR authentication and authorization package
 * for the Tribal EHR system. Provides complete support for:
 *
 * - OAuth 2.0 Authorization Server with PKCE
 * - SMART on FHIR App Launch (EHR launch + standalone launch)
 * - SMART on FHIR v2 scope validation
 * - OIDC ID tokens
 * - TOTP-based multi-factor authentication with backup codes
 * - Role-based access control (RBAC) with emergency access
 * - Session management with idle and absolute timeouts
 * - Password policy enforcement with history-based reuse prevention
 */

// OAuth 2.0 / SMART on FHIR
export {
  AuthorizationServer,
  OAuthError,
  type AuthServerConfig,
  type OAuthClient,
  type OAuthUser,
  type AuthorizationCode,
  type LaunchContext,
  type TokenRecord,
  type AuthorizationRequest,
  type TokenRequest,
  type TokenResponse,
  type IntrospectionResponse,
  type TokenStore,
  type UserStore,
  type AuthorizationResult,
} from './oauth/authorization-server';

export {
  generateSmartConfiguration,
  type SmartConfiguration,
} from './oauth/smart-configuration';

export {
  parseSMARTScope,
  isValidScope,
  validateScopeAccess,
  filterResourceByScopes,
  validateScopeString,
  SMART_SCOPES,
  type ParsedSMARTScope,
  type ScopeValidationResult,
} from './oauth/scope-validator';

// Multi-factor authentication
export {
  generateSecret,
  verifyToken,
  generateBackupCodes,
  verifyBackupCode,
  type TOTPSecret,
  type BackupCodeVerificationResult,
} from './mfa/totp';

// Role-based access control
export {
  PermissionEngine,
  Role,
  Resource,
  type Permission,
  type PermissionCondition,
  type EmergencyAccessGrant,
  type EmergencyAccessStore,
  type AuditLogger,
  type Action,
} from './rbac/permission-engine';

// Session management
export {
  SessionManager,
  type Session,
  type SessionMetadata,
  type SessionStoreConfig,
  type SessionStore,
} from './session/session-manager';

// Password policy
export {
  validatePasswordStrength,
  isPasswordExpired,
  checkPasswordHistory,
  generateTemporaryPassword,
  hashPassword,
  verifyPassword,
  type PasswordValidationResult,
  type PasswordPolicyConfig,
} from './password/password-policy';
