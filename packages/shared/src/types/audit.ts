// =============================================================================
// Audit Event Types - HIPAA Compliant Audit Logging
// =============================================================================

import { UserRole } from './auth';

export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  userRole: UserRole;
  ipAddress: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  endpoint: string;
  method: HttpMethod;
  statusCode: number;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  clinicalContext?: string;
  userAgent?: string;
  sessionId: string;
  hashPrevious?: string;
  hash?: string;
}
