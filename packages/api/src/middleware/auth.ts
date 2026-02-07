import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface UserPayload {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  organizationId: string;
  sessionId: string;
  patientId?: string;
}

export interface SMARTOnFHIRPayload {
  sub: string;
  scope: string;
  patient?: string;
  fhirUser?: string;
  iss: string;
  aud: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
      smartToken?: SMARTOnFHIRPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError('No authorization header provided');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new AuthenticationError('Invalid authorization header format. Use: Bearer <token>');
    }

    const token = parts[1];

    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as UserPayload;
      req.user = decoded;
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token has expired');
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token');
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      if (!roles.includes(req.user.role)) {
        logger.warn('Access denied: insufficient role', {
          userId: req.user.id,
          requiredRoles: roles,
          userRole: req.user.role,
          path: req.path,
        });
        throw new AuthorizationError(
          `Role '${req.user.role}' does not have access. Required: ${roles.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requirePermission(resource: string, action: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const requiredPermission = `${resource}:${action}`;
      const hasPermission = req.user.permissions.includes(requiredPermission) ||
        req.user.permissions.includes(`${resource}:*`) ||
        req.user.permissions.includes('*:*');

      if (!hasPermission) {
        logger.warn('Access denied: insufficient permission', {
          userId: req.user.id,
          requiredPermission,
          path: req.path,
        });
        throw new AuthorizationError(
          `Permission '${requiredPermission}' is required for this action`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function smartOnFhirAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError('No authorization header provided');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new AuthenticationError('Invalid authorization header format');
    }

    const token = parts[1];

    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as SMARTOnFHIRPayload;

      if (!decoded.scope) {
        throw new AuthorizationError('No SMART scopes present in token');
      }

      req.smartToken = decoded;
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('SMART on FHIR token has expired');
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid SMART on FHIR token');
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
}
