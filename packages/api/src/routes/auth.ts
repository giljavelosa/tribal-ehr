// =============================================================================
// Auth Routes - Authentication, MFA, OAuth 2.0, and session management
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { config } from '../config';
import { db } from '../config/database';
import { logger } from '../utils/logger';
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from '../utils/errors';
import { authenticate } from '../middleware/auth';
import {
  verifyPassword,
  verifyToken as verifyTOTP,
  SessionManager,
  AuthorizationServer,
  Role,
} from '@tribal-ehr/auth';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// ---------------------------------------------------------------------------
// Zod validation schemas
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1, 'Password is required'),
}).refine(data => data.email || data.username, {
  message: 'Email or username is required',
});

const mfaVerifySchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  token: z.string().min(6, 'MFA token is required').max(6),
  tempToken: z.string().min(1, 'Temporary token is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const authorizeSchema = z.object({
  response_type: z.string(),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  scope: z.string(),
  state: z.string(),
  launch: z.string().optional(),
  aud: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.string().optional(),
  nonce: z.string().optional(),
});

const tokenSchema = z.object({
  grant_type: z.string(),
  code: z.string().optional(),
  redirect_uri: z.string().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  code_verifier: z.string().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

const clientRegistrationSchema = z.object({
  client_name: z.string().min(1, 'Client name is required'),
  redirect_uris: z.array(z.string().url()).min(1, 'At least one redirect URI is required'),
  grant_types: z.array(z.string()).optional(),
  scope: z.string().optional(),
  token_endpoint_auth_method: z.enum(['client_secret_basic', 'client_secret_post', 'none']).optional(),
  jwks: z.record(z.unknown()).optional(),
});

const revokeSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  token_type_hint: z.enum(['access_token', 'refresh_token']).optional(),
});

const introspectSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  token_type_hint: z.enum(['access_token', 'refresh_token']).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a JWT payload for a given user row.
 */
function buildUserTokenPayload(user: Record<string, unknown>) {
  return {
    id: user.id as string,
    email: user.email as string,
    role: user.role as string,
    firstName: user.first_name as string,
    lastName: user.last_name as string,
  };
}

/**
 * Sign an access token for the given payload.
 */
function signAccessToken(payload: Record<string, unknown>, sessionId: string): string {
  return jwt.sign(
    {
      ...payload,
      sessionId,
      permissions: getRolePermissions(payload.role as string),
    },
    config.auth.jwtSecret,
    { expiresIn: config.auth.tokenExpiry } as jwt.SignOptions,
  );
}

/**
 * Sign a refresh token for the given user id.
 */
function signRefreshToken(userId: string, sessionId: string): string {
  return jwt.sign(
    { id: userId, sessionId, type: 'refresh' },
    config.auth.jwtSecret,
    { expiresIn: config.auth.refreshExpiry } as jwt.SignOptions,
  );
}

/**
 * Sign a short-lived temporary token used during MFA verification.
 */
function signMfaTempToken(userId: string): string {
  return jwt.sign(
    { id: userId, type: 'mfa_pending' },
    config.auth.jwtSecret,
    { expiresIn: '5m' } as jwt.SignOptions,
  );
}

/**
 * Derive a simplified permission list from a role string.
 */
function getRolePermissions(role: string): string[] {
  const permissionMap: Record<string, string[]> = {
    [Role.SYSTEM_ADMIN]: ['*:*'],
    [Role.ADMIN]: [
      'patient:*', 'encounters:*', 'conditions:*', 'observations:*',
      'medications:*', 'allergies:*', 'procedures:*', 'immunizations:*',
      'care-plans:*', 'care-teams:*', 'goals:*', 'documents:*', 'devices:*', 'quality-measures:*', 'public-health:*',
      'orders:*', 'scheduling:*', 'admin:*', 'audit:*', 'clinical-notes:*',
      'messages:*', 'public-health:*', 'quality-measures:*', 'eprescribing:*',
      'referrals:*', 'portal:*', 'users:*', 'organization:*',
    ],
    [Role.PHYSICIAN]: [
      'patient:read', 'patient:create', 'patient:update', 'patient:delete',
      'encounters:*', 'observations:*', 'conditions:*', 'medications:*',
      'allergies:*', 'procedures:*', 'immunizations:*', 'care-plans:*',
      'care-teams:*', 'goals:*', 'documents:*', 'clinical-notes:*',
      'orders:*', 'scheduling:read', 'scheduling:write', 'referrals:*', 'devices:*', 'quality-measures:*', 'public-health:*',
    ],
    [Role.NURSE]: [
      'patient:read', 'patient:update', 'encounters:read', 'encounters:update',
      'observations:*', 'medications:read', 'allergies:read', 'immunizations:*',
      'clinical-notes:*', 'scheduling:read',
    ],
    [Role.MEDICAL_ASSISTANT]: [
      'patient:read', 'patient:update', 'encounters:read', 'observations:*',
      'scheduling:*', 'immunizations:read', 'allergies:read',
    ],
    [Role.FRONT_DESK]: [
      'patient:read', 'patient:create', 'patient:update',
      'scheduling:*', 'encounters:read',
    ],
    [Role.BILLING]: [
      'patient:read', 'encounters:read', 'claims:*', 'coverage:*', 'invoices:*',
    ],
    [Role.PATIENT]: ['patient:read', 'portal:*'],
  };

  return permissionMap[role] || [];
}

/**
 * Check whether an account is currently locked and return relevant info.
 */
function isAccountLocked(user: Record<string, unknown>): { locked: boolean; remainingMs: number } {
  const lockedUntil = user.locked_until as Date | null;
  if (!lockedUntil) {
    return { locked: false, remainingMs: 0 };
  }

  const now = Date.now();
  const lockedUntilMs = new Date(lockedUntil).getTime();

  if (now < lockedUntilMs) {
    return { locked: true, remainingMs: lockedUntilMs - now };
  }

  return { locked: false, remainingMs: 0 };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = Router();

// ---------------------------------------------------------------------------
// GET / - Status endpoint (preserved from original stub)
// ---------------------------------------------------------------------------

router.get('/', (_req: Request, res: Response) => {
  res.json({ resource: 'auth', status: 'operational' });
});

// ---------------------------------------------------------------------------
// POST /login - Authenticate user with email and password
// ---------------------------------------------------------------------------

router.post(
  '/login',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate input
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid login input', parsed.error.flatten().fieldErrors);
      }

      const { email, username, password } = parsed.data;

      // Look up user by email or username
      const user = email
        ? await db('users').where({ email: email.toLowerCase() }).first()
        : await db('users').where({ username: username!.toLowerCase() }).first();

      if (!user) {
        logger.warn('Login attempt for non-existent account', { email });
        throw new AuthenticationError('Invalid email or password');
      }

      // Check if account is active
      if (!user.active) {
        logger.warn('Login attempt for deactivated account', { userId: user.id });
        throw new AuthenticationError('Account is deactivated. Contact your administrator.');
      }

      // Check account lockout
      const lockStatus = isAccountLocked(user);
      if (lockStatus.locked) {
        const remainingMinutes = Math.ceil(lockStatus.remainingMs / 60000);
        logger.warn('Login attempt on locked account', {
          userId: user.id,
          remainingMinutes,
        });
        throw new AuthenticationError(
          `Account is locked due to too many failed login attempts. Try again in ${remainingMinutes} minute(s).`,
        );
      }

      // Verify password
      const passwordValid = await verifyPassword(password, user.password_hash);

      if (!passwordValid) {
        // Increment failed login attempts
        const newAttempts = (user.failed_login_attempts || 0) + 1;
        const updateFields: Record<string, unknown> = {
          failed_login_attempts: newAttempts,
          updated_at: new Date(),
        };

        // Lock account if threshold is reached
        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
          const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
          updateFields.locked_until = lockUntil;
          logger.warn('Account locked due to failed login attempts', {
            userId: user.id,
            failedAttempts: newAttempts,
            lockedUntil: lockUntil.toISOString(),
          });
        }

        await db('users').where({ id: user.id }).update(updateFields);

        logger.warn('Failed login attempt', {
          userId: user.id,
          failedAttempts: newAttempts,
        });

        throw new AuthenticationError('Invalid email or password');
      }

      // Successful authentication: reset failed attempts and lockout
      await db('users').where({ id: user.id }).update({
        failed_login_attempts: 0,
        locked_until: null,
        updated_at: new Date(),
      });

      // Check if MFA is required
      if (user.mfa_enabled && user.mfa_secret) {
        const tempToken = signMfaTempToken(user.id);

        logger.info('MFA verification required for login', { userId: user.id });

        res.json({
          mfaRequired: true,
          userId: user.id,
          tempToken,
        });
        return;
      }

      // No MFA: issue tokens directly
      const sessionId = `sess_${Date.now()}_${user.id}`;
      const payload = buildUserTokenPayload(user);
      const accessToken = signAccessToken(payload, sessionId);
      const refreshTokenValue = signRefreshToken(user.id, sessionId);

      logger.info('User logged in successfully', { userId: user.id });

      res.json({
        token: accessToken,
        accessToken,
        refreshToken: refreshTokenValue,
        tokenType: 'Bearer',
        expiresIn: config.auth.tokenExpiry,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
          mfaEnabled: user.mfa_enabled,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /logout - Invalidate the current session
// ---------------------------------------------------------------------------

router.post(
  '/logout',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const sessionId = req.user!.sessionId;

      // Record the session invalidation in the database
      await db('revoked_tokens').insert({
        token_id: sessionId,
        user_id: userId,
        revoked_at: new Date(),
        reason: 'logout',
      }).onConflict('token_id').ignore();

      logger.info('User logged out', { userId, sessionId });

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /mfa/verify - Verify MFA token after initial login
// ---------------------------------------------------------------------------

router.post(
  '/mfa/verify',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate input
      const parsed = mfaVerifySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid MFA verification input', parsed.error.flatten().fieldErrors);
      }

      const { userId, token, tempToken } = parsed.data;

      // Verify the temporary token
      let decodedTemp: Record<string, unknown>;
      try {
        decodedTemp = jwt.verify(tempToken, config.auth.jwtSecret) as Record<string, unknown>;
      } catch {
        throw new AuthenticationError('MFA session has expired. Please log in again.');
      }

      if (decodedTemp.type !== 'mfa_pending' || decodedTemp.id !== userId) {
        throw new AuthenticationError('Invalid MFA session');
      }

      // Look up the user
      const user = await db('users').where({ id: userId }).first();
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      if (!user.mfa_enabled || !user.mfa_secret) {
        throw new AuthenticationError('MFA is not enabled for this account');
      }

      // Verify TOTP token
      const isValid = verifyTOTP(user.mfa_secret, token);

      if (!isValid) {
        logger.warn('Failed MFA verification attempt', { userId });
        throw new AuthenticationError('Invalid MFA token');
      }

      // MFA verified: issue full tokens
      const sessionId = `sess_${Date.now()}_${user.id}`;
      const payload = buildUserTokenPayload(user);
      const accessToken = signAccessToken(payload, sessionId);
      const refreshToken = signRefreshToken(user.id, sessionId);

      logger.info('MFA verification successful', { userId: user.id });

      res.json({
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: config.auth.tokenExpiry,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
          mfaEnabled: user.mfa_enabled,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /refresh - Refresh an access token using a refresh token
// ---------------------------------------------------------------------------

router.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate input
      const parsed = refreshSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid refresh input', parsed.error.flatten().fieldErrors);
      }

      const { refreshToken } = parsed.data;

      // Verify the refresh token
      let decoded: Record<string, unknown>;
      try {
        decoded = jwt.verify(refreshToken, config.auth.jwtSecret) as Record<string, unknown>;
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          throw new AuthenticationError('Refresh token has expired. Please log in again.');
        }
        throw new AuthenticationError('Invalid refresh token');
      }

      if (decoded.type !== 'refresh') {
        throw new AuthenticationError('Invalid token type');
      }

      const userId = decoded.id as string;
      const oldSessionId = decoded.sessionId as string;

      // Check if the refresh token has been revoked
      const revoked = await db('revoked_tokens')
        .where({ token_id: oldSessionId })
        .first();

      if (revoked) {
        logger.warn('Attempt to use revoked refresh token', { userId, sessionId: oldSessionId });
        throw new AuthenticationError('Refresh token has been revoked');
      }

      // Look up the user to ensure they are still active
      const user = await db('users').where({ id: userId }).first();
      if (!user || !user.active) {
        throw new AuthenticationError('User account is no longer active');
      }

      // Issue new tokens with a new session ID
      const newSessionId = `sess_${Date.now()}_${user.id}`;
      const payload = buildUserTokenPayload(user);
      const newAccessToken = signAccessToken(payload, newSessionId);
      const newRefreshToken = signRefreshToken(user.id, newSessionId);

      logger.info('Token refreshed', { userId: user.id });

      res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        tokenType: 'Bearer',
        expiresIn: config.auth.tokenExpiry,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me - Get current authenticated user info
// ---------------------------------------------------------------------------

router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      const user = await db('users')
        .where({ id: userId })
        .select(
          'id',
          'username',
          'email',
          'role',
          'first_name',
          'last_name',
          'mfa_enabled',
          'active',
          'password_changed_at',
          'created_at',
          'updated_at',
        )
        .first();

      if (!user) {
        throw new AuthenticationError('User not found');
      }

      if (!user.active) {
        throw new AuthenticationError('Account is deactivated');
      }

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
          mfaEnabled: user.mfa_enabled,
          isActive: user.active,
          passwordChangedAt: user.password_changed_at,
          permissions: getRolePermissions(user.role),
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /authorize - OAuth 2.0 authorization endpoint (SMART on FHIR)
// Returns 400 for missing required parameters per OAuth 2.0 spec
// ---------------------------------------------------------------------------

router.get(
  '/authorize',
  (req: Request, res: Response) => {
    const { client_id, redirect_uri, response_type, scope, state } = req.query;
    
    if (!client_id || !redirect_uri || !response_type) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters: client_id, redirect_uri, response_type',
      });
      return;
    }
    
    // For a full implementation, this would render a consent page
    // For now, redirect to login with the OAuth parameters preserved
    const params = new URLSearchParams(req.query as Record<string, string>);
    res.redirect(`/auth/login?${params.toString()}`);
  }
);

// ---------------------------------------------------------------------------
// POST /authorize - OAuth 2.0 authorization endpoint
// ---------------------------------------------------------------------------

router.post(
  '/authorize',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate input
      const parsed = authorizeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid authorization request', parsed.error.flatten().fieldErrors);
      }

      const authRequest = parsed.data;

      // Verify the client exists
      const client = await db('oauth_clients')
        .where({ client_id: authRequest.client_id })
        .first();

      if (!client) {
        res.status(400).json({
          error: 'invalid_client',
          error_description: 'Unknown client_id',
        });
        return;
      }

      // Validate redirect_uri against registered URIs
      const registeredUris: string[] = Array.isArray(client.redirect_uris)
        ? client.redirect_uris
        : JSON.parse(client.redirect_uris || '[]');

      if (!registeredUris.includes(authRequest.redirect_uri)) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'redirect_uri is not registered for this client',
        });
        return;
      }

      // Generate authorization code
      const code = require('crypto').randomBytes(32).toString('base64url');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

      await db('authorization_codes').insert({
        code,
        client_id: authRequest.client_id,
        user_id: req.user!.id,
        redirect_uri: authRequest.redirect_uri,
        scope: authRequest.scope,
        code_challenge: authRequest.code_challenge || null,
        code_challenge_method: authRequest.code_challenge_method || null,
        nonce: authRequest.nonce || null,
        created_at: now,
        expires_at: expiresAt,
        used: false,
      });

      logger.info('Authorization code issued', {
        clientId: authRequest.client_id,
        userId: req.user!.id,
        scope: authRequest.scope,
      });

      res.json({
        code,
        state: authRequest.state,
        redirect_uri: authRequest.redirect_uri,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /token - OAuth 2.0 token endpoint (method not allowed)
// Per OAuth 2.0 spec, token endpoint only accepts POST
// ---------------------------------------------------------------------------

router.get(
  '/token',
  (_req: Request, res: Response) => {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'Token endpoint requires POST method',
    });
  }
);

// ---------------------------------------------------------------------------
// POST /token - OAuth 2.0 token endpoint
// ---------------------------------------------------------------------------

router.post(
  '/token',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate input
      const parsed = tokenSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Invalid token request parameters',
        });
        return;
      }

      const tokenRequest = parsed.data;

      switch (tokenRequest.grant_type) {
        case 'authorization_code': {
          if (!tokenRequest.code) {
            res.status(400).json({
              error: 'invalid_request',
              error_description: 'code parameter is required',
            });
            return;
          }

          // Look up the authorization code
          const authCode = await db('authorization_codes')
            .where({ code: tokenRequest.code })
            .first();

          if (!authCode) {
            res.status(400).json({
              error: 'invalid_grant',
              error_description: 'Invalid authorization code',
            });
            return;
          }

          if (authCode.used) {
            res.status(400).json({
              error: 'invalid_grant',
              error_description: 'Authorization code has already been used',
            });
            return;
          }

          if (new Date() > new Date(authCode.expires_at)) {
            res.status(400).json({
              error: 'invalid_grant',
              error_description: 'Authorization code has expired',
            });
            return;
          }

          if (tokenRequest.redirect_uri && authCode.redirect_uri !== tokenRequest.redirect_uri) {
            res.status(400).json({
              error: 'invalid_grant',
              error_description: 'redirect_uri mismatch',
            });
            return;
          }

          // Validate PKCE if code_challenge was used
          if (authCode.code_challenge) {
            if (!tokenRequest.code_verifier) {
              res.status(400).json({
                error: 'invalid_request',
                error_description: 'code_verifier is required for PKCE',
              });
              return;
            }

            const crypto = require('crypto');
            const computedChallenge = crypto
              .createHash('sha256')
              .update(tokenRequest.code_verifier, 'ascii')
              .digest('base64url');

            if (computedChallenge !== authCode.code_challenge) {
              res.status(400).json({
                error: 'invalid_grant',
                error_description: 'PKCE code_verifier validation failed',
              });
              return;
            }
          }

          // Authenticate the client if confidential
          if (tokenRequest.client_id) {
            const client = await db('oauth_clients')
              .where({ client_id: tokenRequest.client_id })
              .first();

            if (client && client.is_confidential && tokenRequest.client_secret) {
              // Compare provided secret against bcrypt hash
              const clientSecretValid = await bcrypt.compare(
                tokenRequest.client_secret,
                client.client_secret,
              );
              if (!clientSecretValid) {
                res.status(401).json({
                  error: 'invalid_client',
                  error_description: 'Client authentication failed',
                });
                return;
              }
            }
          }

          // Mark the code as used
          await db('authorization_codes')
            .where({ code: tokenRequest.code })
            .update({ used: true });

          // Look up the user
          const user = await db('users').where({ id: authCode.user_id }).first();
          if (!user) {
            res.status(400).json({
              error: 'invalid_grant',
              error_description: 'User not found',
            });
            return;
          }

          // Generate tokens
          const sessionId = `sess_${Date.now()}_${user.id}`;
          const payload = buildUserTokenPayload(user);
          const accessToken = signAccessToken(payload, sessionId);

          const scopes = (authCode.scope || '').split(/\s+/).filter(Boolean);
          const response: Record<string, unknown> = {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: config.auth.tokenExpiry,
            scope: authCode.scope,
          };

          // Include refresh token if offline_access scope was requested
          if (scopes.includes('offline_access')) {
            response.refresh_token = signRefreshToken(user.id, sessionId);
          }

          // Include ID token if openid scope was requested
          if (scopes.includes('openid')) {
            const idTokenPayload = {
              sub: user.id,
              email: user.email,
              name: `${user.first_name} ${user.last_name}`,
              iss: `${req.protocol}://${req.get('host')}`,
              aud: tokenRequest.client_id || authCode.client_id,
              nonce: authCode.nonce,
            };
            response.id_token = jwt.sign(idTokenPayload, config.auth.jwtSecret, {
              expiresIn: config.auth.tokenExpiry,
            } as jwt.SignOptions);
          }

          logger.info('OAuth token issued via authorization_code', {
            clientId: authCode.client_id,
            userId: user.id,
          });

          res.json(response);
          break;
        }

        case 'refresh_token': {
          if (!tokenRequest.refresh_token) {
            res.status(400).json({
              error: 'invalid_request',
              error_description: 'refresh_token parameter is required',
            });
            return;
          }

          let decoded: Record<string, unknown>;
          try {
            decoded = jwt.verify(tokenRequest.refresh_token, config.auth.jwtSecret) as Record<string, unknown>;
          } catch {
            res.status(400).json({
              error: 'invalid_grant',
              error_description: 'Invalid or expired refresh token',
            });
            return;
          }

          if (decoded.type !== 'refresh') {
            res.status(400).json({
              error: 'invalid_grant',
              error_description: 'Invalid token type',
            });
            return;
          }

          const user = await db('users').where({ id: decoded.id }).first();
          if (!user || !user.active) {
            res.status(400).json({
              error: 'invalid_grant',
              error_description: 'User not found or inactive',
            });
            return;
          }

          const newSessionId = `sess_${Date.now()}_${user.id}`;
          const payload = buildUserTokenPayload(user);
          const newAccessToken = signAccessToken(payload, newSessionId);
          const newRefreshToken = signRefreshToken(user.id, newSessionId);

          logger.info('OAuth token refreshed', { userId: user.id });

          res.json({
            access_token: newAccessToken,
            token_type: 'Bearer',
            expires_in: config.auth.tokenExpiry,
            refresh_token: newRefreshToken,
            scope: tokenRequest.scope || '',
          });
          break;
        }

        case 'client_credentials': {
          if (!tokenRequest.client_id || !tokenRequest.client_secret) {
            res.status(400).json({
              error: 'invalid_request',
              error_description: 'client_id and client_secret are required',
            });
            return;
          }

          const client = await db('oauth_clients')
            .where({ client_id: tokenRequest.client_id })
            .first();

          if (!client || !client.client_secret) {
            res.status(401).json({
              error: 'invalid_client',
              error_description: 'Client authentication failed',
            });
            return;
          }

          // Compare provided secret against bcrypt hash
          const secretValid = await bcrypt.compare(tokenRequest.client_secret, client.client_secret);
          if (!secretValid) {
            res.status(401).json({
              error: 'invalid_client',
              error_description: 'Client authentication failed',
            });
            return;
          }

          const clientAccessToken = jwt.sign(
            {
              sub: client.client_id,
              client_id: client.client_id,
              scope: tokenRequest.scope || client.scopes || '',
              type: 'client_credentials',
            },
            config.auth.jwtSecret,
            { expiresIn: config.auth.tokenExpiry } as jwt.SignOptions,
          );

          logger.info('OAuth client_credentials token issued', {
            clientId: client.client_id,
          });

          res.json({
            access_token: clientAccessToken,
            token_type: 'Bearer',
            expires_in: config.auth.tokenExpiry,
            scope: tokenRequest.scope || client.scopes || '',
          });
          break;
        }

        default:
          res.status(400).json({
            error: 'unsupported_grant_type',
            error_description: `Unsupported grant_type: ${tokenRequest.grant_type}`,
          });
      }
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /register - OAuth 2.0 dynamic client registration (RFC 7591)
// ---------------------------------------------------------------------------

router.post(
  '/register',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate input
      const parsed = clientRegistrationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid client registration', parsed.error.flatten().fieldErrors);
      }

      const registration = parsed.data;
      const crypto = require('crypto');

      const clientId = crypto.randomBytes(16).toString('hex');
      const clientSecret = crypto.randomBytes(32).toString('hex');
      const isConfidential = registration.token_endpoint_auth_method !== 'none';
      const grantTypes = registration.grant_types || ['authorization_code'];

      // Hash the client secret before storage (like passwords)
      const hashedSecret = isConfidential ? await bcrypt.hash(clientSecret, 12) : null;

      await db('oauth_clients').insert({
        client_id: clientId,
        client_secret: hashedSecret,
        client_name: registration.client_name,
        redirect_uris: JSON.stringify(registration.redirect_uris),
        grant_types: JSON.stringify(grantTypes),
        scopes: registration.scope || '',
        is_confidential: isConfidential,
        token_endpoint_auth_method: registration.token_endpoint_auth_method || 'client_secret_basic',
        jwks: registration.jwks ? JSON.stringify(registration.jwks) : null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      logger.info('OAuth client registered', {
        clientId,
        clientName: registration.client_name,
      });

      const response: Record<string, unknown> = {
        client_id: clientId,
        client_name: registration.client_name,
        redirect_uris: registration.redirect_uris,
        grant_types: grantTypes,
        token_endpoint_auth_method: registration.token_endpoint_auth_method || 'client_secret_basic',
        scope: registration.scope || '',
        client_id_issued_at: Math.floor(Date.now() / 1000),
      };

      if (isConfidential) {
        response.client_secret = clientSecret;
        response.client_secret_expires_at = 0; // Never expires
      }

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /revoke - Token revocation (RFC 7009)
// ---------------------------------------------------------------------------

router.post(
  '/revoke',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate input
      const parsed = revokeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid revocation request', parsed.error.flatten().fieldErrors);
      }

      const { token } = parsed.data;

      // Try to decode the token to get the session ID for revocation tracking
      try {
        const decoded = jwt.verify(token, config.auth.jwtSecret, {
          ignoreExpiration: true,
        }) as Record<string, unknown>;

        const tokenId = (decoded.sessionId as string) || (decoded.jti as string) || token.substring(0, 64);

        await db('revoked_tokens').insert({
          token_id: tokenId,
          user_id: (decoded.id as string) || (decoded.sub as string) || null,
          revoked_at: new Date(),
          reason: 'revocation_endpoint',
        }).onConflict('token_id').ignore();

        logger.info('Token revoked', {
          tokenId,
          userId: decoded.id || decoded.sub,
        });
      } catch {
        // If we cannot decode the token, still accept the request per RFC 7009
        logger.warn('Token revocation for undecodable token');
      }

      // RFC 7009: always return 200 regardless of whether the token was valid
      res.json({ message: 'Token revoked' });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /introspect - Token introspection (RFC 7662)
// ---------------------------------------------------------------------------

router.post(
  '/introspect',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate input
      const parsed = introspectSchema.safeParse(req.body);
      if (!parsed.success) {
        res.json({ active: false });
        return;
      }

      const { token } = parsed.data;

      // Attempt to verify the token
      let decoded: Record<string, unknown>;
      try {
        decoded = jwt.verify(token, config.auth.jwtSecret) as Record<string, unknown>;
      } catch {
        res.json({ active: false });
        return;
      }

      // Check if the token's session has been revoked
      const sessionId = decoded.sessionId as string | undefined;
      if (sessionId) {
        const revoked = await db('revoked_tokens')
          .where({ token_id: sessionId })
          .first();

        if (revoked) {
          res.json({ active: false });
          return;
        }
      }

      // Token is valid
      res.json({
        active: true,
        sub: decoded.id || decoded.sub,
        client_id: decoded.client_id || undefined,
        username: decoded.email,
        scope: decoded.scope || undefined,
        token_type: 'Bearer',
        exp: decoded.exp,
        iat: decoded.iat,
        iss: decoded.iss || undefined,
        aud: decoded.aud || undefined,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /forgot-password - Request a password reset link
// ---------------------------------------------------------------------------

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

router.post(
  '/forgot-password',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = forgotPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid input', parsed.error.flatten().fieldErrors);
      }

      const { email } = parsed.data;

      // Look up user but do not reveal whether the email exists
      const user = await db('users').where({ email: email.toLowerCase() }).first();

      if (user) {
        // In a production system, this would send a password reset email.
        // For now, log the request for auditing purposes.
        logger.info('Password reset requested', { userId: user.id, email });
      } else {
        logger.info('Password reset requested for non-existent email', { email });
      }

      // Always return the same response to avoid email enumeration
      res.json({
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
