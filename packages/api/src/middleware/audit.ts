import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { generateChainHash } from '../utils/encryption';
import { logger } from '../utils/logger';

interface AuditEvent {
  id: string;
  timestamp: string;
  user_id: string | null;
  user_role: string | null;
  session_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  http_method: string;
  endpoint: string;
  ip_address: string;
  user_agent: string;
  status_code: number;
  hash_previous: string;
  hash: string;
}

let lastChainHash = 'GENESIS';

function extractResourceInfo(path: string): { resourceType: string | null; resourceId: string | null } {
  // Match patterns like /api/v1/patients/:id or /api/v1/patients
  const match = path.match(/\/api\/v\d+\/([a-z-]+)(?:\/([a-f0-9-]+))?/i);

  if (match) {
    return {
      resourceType: match[1] || null,
      resourceId: match[2] || null,
    };
  }

  return { resourceType: null, resourceId: null };
}

function methodToAction(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'READ';
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return 'READ';
  }
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const auditId = uuidv4();

  // Capture the response finish
  const originalEnd = res.end;
  (res as any).end = function (this: Response, ...args: Parameters<Response['end']>): Response {
    const responseTime = Date.now() - startTime;

    // Use setImmediate to avoid blocking the response
    setImmediate(() => {
      recordAuditEvent(req, res, auditId, responseTime);
    });

    return originalEnd.apply(this, args);
  };

  next();
}

async function recordAuditEvent(
  req: Request,
  res: Response,
  auditId: string,
  responseTimeMs: number
): Promise<void> {
  try {
    const { resourceType, resourceId } = extractResourceInfo(req.path);
    const timestamp = new Date().toISOString();
    const action = methodToAction(req.method);

    // Build the audit data string for hashing (no PHI included)
    const auditData = `${auditId}:${timestamp}:${req.user?.id || 'anonymous'}:${action}:${resourceType}:${resourceId}:${res.statusCode}`;
    const chainHash = generateChainHash(auditData, lastChainHash);
    lastChainHash = chainHash;

    const auditEvent: AuditEvent = {
      id: auditId,
      timestamp,
      user_id: req.user?.id || null,
      user_role: req.user?.role || null,
      session_id: req.user?.sessionId || null,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      http_method: req.method,
      endpoint: req.path,
      ip_address: req.ip || req.socket.remoteAddress || 'unknown',
      user_agent: req.get('user-agent') || 'unknown',
      status_code: res.statusCode,
      hash_previous: lastChainHash,
      hash: chainHash,
    };

    await db('audit_events').insert(auditEvent);
  } catch (error) {
    // Audit logging failure should not impact request processing
    logger.error('Failed to record audit event', {
      auditId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export default auditMiddleware;
