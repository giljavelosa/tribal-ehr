/**
 * OAuth 2.0 Authorization Server with SMART on FHIR support
 *
 * Implements the complete OAuth 2.0 authorization code flow with PKCE,
 * refresh tokens, client credentials, and SMART App Launch context parameters.
 * Designed for ONC certification compliance.
 *
 * References:
 * - RFC 6749 (OAuth 2.0)
 * - RFC 7636 (PKCE)
 * - RFC 7662 (Token Introspection)
 * - RFC 7009 (Token Revocation)
 * - SMART App Launch Framework v2
 */

import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { isValidScope, validateScopeAccess } from './scope-validator';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface AuthServerConfig {
  /** Issuer identifier (e.g., "https://ehr.tribal.health/fhir") */
  issuer: string;
  /** RSA or EC private key (PEM) for signing JWTs */
  signingKey: string;
  /** Key ID placed in JWT header for JWKS matching */
  signingKeyId: string;
  /** Algorithm used for JWT signing (default: RS256) */
  signingAlgorithm?: jwt.Algorithm;
  /** Access token lifetime in seconds (default: 3600) */
  accessTokenTTL?: number;
  /** Refresh token lifetime in seconds (default: 86400) */
  refreshTokenTTL?: number;
  /** Authorization code lifetime in seconds (default: 600) */
  authCodeTTL?: number;
  /** ID token lifetime in seconds (default: 3600) */
  idTokenTTL?: number;
}

export interface OAuthClient {
  clientId: string;
  clientSecret?: string;
  clientName: string;
  redirectUris: string[];
  grantTypes: string[];
  scopes: string[];
  isConfidential: boolean;
  /** Public key (JWK) for private_key_jwt authentication */
  jwks?: Record<string, unknown>;
}

export interface OAuthUser {
  id: string;
  username: string;
  email?: string;
  name?: string;
  fhirUser?: string; // e.g., "Practitioner/123"
  roles: string[];
}

export interface AuthorizationCode {
  code: string;
  clientId: string;
  redirectUri: string;
  userId: string;
  scopes: string[];
  codeChallenge?: string;
  codeChallengeMethod?: string;
  launchContext?: LaunchContext;
  nonce?: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

export interface LaunchContext {
  patient?: string;
  encounter?: string;
  intent?: string;
  needPatientBanner?: boolean;
  smartStyleUrl?: string;
  [key: string]: unknown;
}

export interface TokenRecord {
  token: string;
  tokenType: 'access' | 'refresh';
  clientId: string;
  userId: string;
  scopes: string[];
  launchContext?: LaunchContext;
  createdAt: Date;
  expiresAt: Date;
  revoked: boolean;
}

export interface AuthorizationRequest {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  /** SMART on FHIR: launch token from EHR launch flow */
  launch?: string;
  /** SMART on FHIR: audience / FHIR server URL */
  aud?: string;
  /** PKCE code challenge */
  code_challenge?: string;
  /** PKCE code challenge method (must be S256) */
  code_challenge_method?: string;
  /** OIDC nonce */
  nonce?: string;
}

export interface TokenRequest {
  grant_type: string;
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  client_secret?: string;
  code_verifier?: string;
  refresh_token?: string;
  scope?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
  patient?: string;
  encounter?: string;
  id_token?: string;
  need_patient_banner?: boolean;
  smart_style_url?: string;
}

export interface IntrospectionResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  sub?: string;
  aud?: string;
  iss?: string;
}

/**
 * Store interface for authorization codes and tokens.
 * Implement this interface to plug in your persistence layer (Redis, Postgres, etc.).
 */
export interface TokenStore {
  saveAuthorizationCode(code: AuthorizationCode): Promise<void>;
  getAuthorizationCode(code: string): Promise<AuthorizationCode | null>;
  markAuthorizationCodeUsed(code: string): Promise<void>;

  saveToken(record: TokenRecord): Promise<void>;
  getToken(token: string): Promise<TokenRecord | null>;
  revokeToken(token: string): Promise<void>;
  revokeAllTokensForUser(userId: string): Promise<void>;
  getTokensByRefreshToken(refreshToken: string): Promise<TokenRecord | null>;
}

/**
 * Store interface for OAuth clients and users.
 */
export interface UserStore {
  getClient(clientId: string): Promise<OAuthClient | null>;
  getUser(userId: string): Promise<OAuthUser | null>;
  getUserByUsername(username: string): Promise<OAuthUser | null>;
  /** Resolves a launch token to launch context (for EHR launch flow) */
  resolveLaunchContext(launchToken: string): Promise<LaunchContext | null>;
}

export interface AuthorizationResult {
  redirectUri: string;
  code: string;
  state: string;
}

export class OAuthError extends Error {
  constructor(
    public readonly errorCode: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

// ---------------------------------------------------------------------------
// Authorization Server
// ---------------------------------------------------------------------------

export class AuthorizationServer {
  private readonly config: Required<AuthServerConfig>;

  constructor(
    config: AuthServerConfig,
    private readonly tokenStore: TokenStore,
    private readonly userStore: UserStore,
  ) {
    this.config = {
      signingAlgorithm: 'RS256',
      accessTokenTTL: 3600,
      refreshTokenTTL: 86400,
      authCodeTTL: 600,
      idTokenTTL: 3600,
      ...config,
    };
  }

  // -------------------------------------------------------------------------
  // Authorization endpoint
  // -------------------------------------------------------------------------

  /**
   * Handles the authorization endpoint (/auth/authorize).
   *
   * Validates request parameters, verifies the client, checks scopes, validates
   * PKCE and SMART launch parameters, and returns an authorization code.
   *
   * @param req - The authorization request parameters
   * @param authenticatedUserId - The ID of the user who has authenticated and consented
   * @returns The redirect URI with code and state
   */
  async authorize(
    req: AuthorizationRequest,
    authenticatedUserId: string,
  ): Promise<AuthorizationResult> {
    // Validate response_type
    if (req.response_type !== 'code') {
      throw new OAuthError(
        'unsupported_response_type',
        'Only "code" response_type is supported',
      );
    }

    // Validate client
    const client = await this.userStore.getClient(req.client_id);
    if (!client) {
      throw new OAuthError('invalid_request', 'Unknown client_id', 400);
    }

    // Validate redirect_uri
    if (!client.redirectUris.includes(req.redirect_uri)) {
      throw new OAuthError(
        'invalid_request',
        'redirect_uri is not registered for this client',
      );
    }

    // Validate state
    if (!req.state) {
      throw new OAuthError('invalid_request', 'state parameter is required');
    }

    // Validate scopes
    const requestedScopes = req.scope ? req.scope.split(/\s+/).filter(Boolean) : [];
    if (requestedScopes.length === 0) {
      throw new OAuthError('invalid_scope', 'At least one scope is required');
    }

    const validatedScopes = this.validateScopes(requestedScopes, client.scopes);

    // Validate PKCE for public clients (required) and confidential clients (optional but recommended)
    if (!client.isConfidential && !req.code_challenge) {
      throw new OAuthError(
        'invalid_request',
        'PKCE code_challenge is required for public clients',
      );
    }

    if (req.code_challenge) {
      if (req.code_challenge_method !== 'S256') {
        throw new OAuthError(
          'invalid_request',
          'Only S256 code_challenge_method is supported',
        );
      }
    }

    // Validate SMART on FHIR aud parameter
    if (req.aud && req.aud !== this.config.issuer) {
      throw new OAuthError(
        'invalid_request',
        `aud parameter must match the FHIR server URL: ${this.config.issuer}`,
      );
    }

    // Resolve launch context if present (EHR launch flow)
    let launchContext: LaunchContext | undefined;
    if (req.launch) {
      const resolved = await this.userStore.resolveLaunchContext(req.launch);
      if (!resolved) {
        throw new OAuthError('invalid_request', 'Invalid or expired launch token');
      }
      launchContext = resolved;
    }

    // Generate authorization code
    const code = this.generateAuthorizationCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.authCodeTTL * 1000);

    const authCode: AuthorizationCode = {
      code,
      clientId: req.client_id,
      redirectUri: req.redirect_uri,
      userId: authenticatedUserId,
      scopes: validatedScopes,
      codeChallenge: req.code_challenge,
      codeChallengeMethod: req.code_challenge_method,
      launchContext,
      nonce: req.nonce,
      createdAt: now,
      expiresAt,
      used: false,
    };

    await this.tokenStore.saveAuthorizationCode(authCode);

    return {
      redirectUri: req.redirect_uri,
      code,
      state: req.state,
    };
  }

  // -------------------------------------------------------------------------
  // Token endpoint
  // -------------------------------------------------------------------------

  /**
   * Handles the token endpoint (/auth/token).
   *
   * Supports authorization_code, refresh_token, and client_credentials grant types.
   *
   * @param req - The token request parameters
   * @returns The token response including access_token, refresh_token, etc.
   */
  async token(req: TokenRequest): Promise<TokenResponse> {
    switch (req.grant_type) {
      case 'authorization_code':
        return this.handleAuthorizationCodeGrant(req);
      case 'refresh_token':
        return this.handleRefreshTokenGrant(req);
      case 'client_credentials':
        return this.handleClientCredentialsGrant(req);
      default:
        throw new OAuthError('unsupported_grant_type', `Unsupported grant_type: ${req.grant_type}`);
    }
  }

  // -------------------------------------------------------------------------
  // Token introspection (RFC 7662)
  // -------------------------------------------------------------------------

  /**
   * Introspects a token and returns its metadata.
   *
   * @param token - The token string to introspect
   * @returns The introspection response
   */
  async introspect(token: string): Promise<IntrospectionResponse> {
    if (!token) {
      return { active: false };
    }

    // Try to find the token in the store
    const record = await this.tokenStore.getToken(token);

    if (!record) {
      // Try to verify as a JWT (access tokens are JWTs)
      try {
        const decoded = jwt.verify(token, this.config.signingKey, {
          algorithms: [this.config.signingAlgorithm],
          issuer: this.config.issuer,
        }) as jwt.JwtPayload;

        return {
          active: true,
          scope: decoded.scope as string,
          client_id: decoded.client_id as string,
          username: decoded.username as string,
          token_type: 'Bearer',
          exp: decoded.exp,
          iat: decoded.iat,
          sub: decoded.sub,
          aud: decoded.aud as string,
          iss: decoded.iss,
        };
      } catch {
        return { active: false };
      }
    }

    if (record.revoked) {
      return { active: false };
    }

    if (new Date() > record.expiresAt) {
      return { active: false };
    }

    const user = await this.userStore.getUser(record.userId);

    return {
      active: true,
      scope: record.scopes.join(' '),
      client_id: record.clientId,
      username: user?.username,
      token_type: 'Bearer',
      exp: Math.floor(record.expiresAt.getTime() / 1000),
      iat: Math.floor(record.createdAt.getTime() / 1000),
      sub: record.userId,
      aud: this.config.issuer,
      iss: this.config.issuer,
    };
  }

  // -------------------------------------------------------------------------
  // Token revocation (RFC 7009)
  // -------------------------------------------------------------------------

  /**
   * Revokes a token (access or refresh).
   *
   * @param token - The token string to revoke
   */
  async revoke(token: string): Promise<void> {
    if (!token) {
      throw new OAuthError('invalid_request', 'token parameter is required');
    }

    await this.tokenStore.revokeToken(token);
  }

  // -------------------------------------------------------------------------
  // Token generation
  // -------------------------------------------------------------------------

  /**
   * Generates a signed JWT access token.
   *
   * @param payload - Custom claims to include in the token
   * @param expiresIn - Token lifetime in seconds
   * @returns The signed JWT string
   */
  generateAccessToken(
    payload: Record<string, unknown>,
    expiresIn?: number,
  ): string {
    const ttl = expiresIn ?? this.config.accessTokenTTL;

    return jwt.sign(payload, this.config.signingKey, {
      algorithm: this.config.signingAlgorithm,
      expiresIn: ttl,
      issuer: this.config.issuer,
      jwtid: uuidv4(),
      keyid: this.config.signingKeyId,
    });
  }

  /**
   * Generates a cryptographically random opaque refresh token.
   *
   * @returns A hex-encoded random token (64 characters)
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generates an OIDC ID token for the given user and client.
   *
   * @param user - The authenticated user
   * @param client - The requesting client
   * @param nonce - Optional nonce from the authorization request
   * @returns The signed ID token JWT
   */
  generateIdToken(
    user: OAuthUser,
    client: OAuthClient,
    nonce?: string,
  ): string {
    const now = Math.floor(Date.now() / 1000);

    const claims: Record<string, unknown> = {
      iss: this.config.issuer,
      sub: user.id,
      aud: client.clientId,
      exp: now + this.config.idTokenTTL,
      iat: now,
      auth_time: now,
      fhirUser: user.fhirUser,
    };

    if (nonce) {
      claims.nonce = nonce;
    }

    if (user.name) {
      claims.name = user.name;
    }

    if (user.email) {
      claims.email = user.email;
    }

    if (user.username) {
      claims.preferred_username = user.username;
    }

    return jwt.sign(claims, this.config.signingKey, {
      algorithm: this.config.signingAlgorithm,
      keyid: this.config.signingKeyId,
    });
  }

  // -------------------------------------------------------------------------
  // Scope validation
  // -------------------------------------------------------------------------

  /**
   * Validates requested scopes against the client's allowed scopes.
   *
   * @param requested - Scopes requested by the client
   * @param allowed - Scopes the client is permitted to request
   * @returns Array of validated scopes (intersection of requested and allowed)
   * @throws OAuthError if any requested scope is invalid
   */
  validateScopes(requested: string[], allowed: string[]): string[] {
    const validated: string[] = [];
    const allowedSet = new Set(allowed);

    for (const scope of requested) {
      if (!isValidScope(scope)) {
        throw new OAuthError('invalid_scope', `Invalid scope: "${scope}"`);
      }

      if (!allowedSet.has(scope)) {
        throw new OAuthError(
          'invalid_scope',
          `Scope "${scope}" is not permitted for this client`,
        );
      }

      validated.push(scope);
    }

    return validated;
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  /**
   * Handles the authorization_code grant type.
   */
  private async handleAuthorizationCodeGrant(
    req: TokenRequest,
  ): Promise<TokenResponse> {
    if (!req.code) {
      throw new OAuthError('invalid_request', 'code parameter is required');
    }

    if (!req.redirect_uri) {
      throw new OAuthError('invalid_request', 'redirect_uri parameter is required');
    }

    // Retrieve and validate the authorization code
    const authCode = await this.tokenStore.getAuthorizationCode(req.code);
    if (!authCode) {
      throw new OAuthError('invalid_grant', 'Invalid authorization code');
    }

    if (authCode.used) {
      // Code replay detected -- revoke all tokens issued from this code
      throw new OAuthError('invalid_grant', 'Authorization code has already been used');
    }

    if (new Date() > authCode.expiresAt) {
      throw new OAuthError('invalid_grant', 'Authorization code has expired');
    }

    if (authCode.redirectUri !== req.redirect_uri) {
      throw new OAuthError('invalid_grant', 'redirect_uri mismatch');
    }

    // Authenticate the client
    const client = await this.authenticateClient(
      req.client_id ?? authCode.clientId,
      req.client_secret,
    );

    if (client.clientId !== authCode.clientId) {
      throw new OAuthError('invalid_grant', 'client_id mismatch');
    }

    // Validate PKCE code_verifier
    if (authCode.codeChallenge) {
      if (!req.code_verifier) {
        throw new OAuthError(
          'invalid_request',
          'code_verifier is required when PKCE was used in the authorization request',
        );
      }
      this.validatePKCE(
        req.code_verifier,
        authCode.codeChallenge,
        authCode.codeChallengeMethod ?? 'S256',
      );
    }

    // Mark the code as used
    await this.tokenStore.markAuthorizationCodeUsed(req.code);

    // Get user info
    const user = await this.userStore.getUser(authCode.userId);
    if (!user) {
      throw new OAuthError('invalid_grant', 'User not found');
    }

    // Generate tokens
    const accessTokenPayload: Record<string, unknown> = {
      sub: user.id,
      client_id: client.clientId,
      scope: authCode.scopes.join(' '),
      username: user.username,
      fhirUser: user.fhirUser,
    };

    if (authCode.launchContext?.patient) {
      accessTokenPayload.patient = authCode.launchContext.patient;
    }

    if (authCode.launchContext?.encounter) {
      accessTokenPayload.encounter = authCode.launchContext.encounter;
    }

    const accessToken = this.generateAccessToken(accessTokenPayload);
    const now = new Date();

    // Save access token record
    await this.tokenStore.saveToken({
      token: accessToken,
      tokenType: 'access',
      clientId: client.clientId,
      userId: user.id,
      scopes: authCode.scopes,
      launchContext: authCode.launchContext,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.accessTokenTTL * 1000),
      revoked: false,
    });

    // Build response
    const response: TokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.accessTokenTTL,
      scope: authCode.scopes.join(' '),
    };

    // Generate refresh token if offline_access scope is present
    if (authCode.scopes.includes('offline_access')) {
      const refreshToken = this.generateRefreshToken();
      await this.tokenStore.saveToken({
        token: refreshToken,
        tokenType: 'refresh',
        clientId: client.clientId,
        userId: user.id,
        scopes: authCode.scopes,
        launchContext: authCode.launchContext,
        createdAt: now,
        expiresAt: new Date(now.getTime() + this.config.refreshTokenTTL * 1000),
        revoked: false,
      });
      response.refresh_token = refreshToken;
    }

    // Add SMART on FHIR launch context to response
    if (authCode.launchContext?.patient) {
      response.patient = authCode.launchContext.patient;
    }
    if (authCode.launchContext?.encounter) {
      response.encounter = authCode.launchContext.encounter;
    }
    if (authCode.launchContext?.needPatientBanner !== undefined) {
      response.need_patient_banner = authCode.launchContext.needPatientBanner;
    }
    if (authCode.launchContext?.smartStyleUrl) {
      response.smart_style_url = authCode.launchContext.smartStyleUrl;
    }

    // Generate ID token if openid scope is present
    if (authCode.scopes.includes('openid')) {
      response.id_token = this.generateIdToken(user, client, authCode.nonce);
    }

    return response;
  }

  /**
   * Handles the refresh_token grant type.
   */
  private async handleRefreshTokenGrant(req: TokenRequest): Promise<TokenResponse> {
    if (!req.refresh_token) {
      throw new OAuthError('invalid_request', 'refresh_token parameter is required');
    }

    const refreshRecord = await this.tokenStore.getTokensByRefreshToken(req.refresh_token);
    if (!refreshRecord) {
      throw new OAuthError('invalid_grant', 'Invalid refresh token');
    }

    if (refreshRecord.revoked) {
      throw new OAuthError('invalid_grant', 'Refresh token has been revoked');
    }

    if (new Date() > refreshRecord.expiresAt) {
      throw new OAuthError('invalid_grant', 'Refresh token has expired');
    }

    // Authenticate the client
    const client = await this.authenticateClient(
      req.client_id ?? refreshRecord.clientId,
      req.client_secret,
    );

    if (client.clientId !== refreshRecord.clientId) {
      throw new OAuthError('invalid_grant', 'client_id mismatch');
    }

    // Determine scopes -- may be narrowed by the request
    let scopes = refreshRecord.scopes;
    if (req.scope) {
      const requestedScopes = req.scope.split(/\s+/).filter(Boolean);
      const originalSet = new Set(refreshRecord.scopes);
      for (const s of requestedScopes) {
        if (!originalSet.has(s)) {
          throw new OAuthError(
            'invalid_scope',
            `Scope "${s}" was not in the original grant`,
          );
        }
      }
      scopes = requestedScopes;
    }

    const user = await this.userStore.getUser(refreshRecord.userId);
    if (!user) {
      throw new OAuthError('invalid_grant', 'User not found');
    }

    // Generate new access token
    const accessTokenPayload: Record<string, unknown> = {
      sub: user.id,
      client_id: client.clientId,
      scope: scopes.join(' '),
      username: user.username,
      fhirUser: user.fhirUser,
    };

    if (refreshRecord.launchContext?.patient) {
      accessTokenPayload.patient = refreshRecord.launchContext.patient;
    }

    if (refreshRecord.launchContext?.encounter) {
      accessTokenPayload.encounter = refreshRecord.launchContext.encounter;
    }

    const accessToken = this.generateAccessToken(accessTokenPayload);
    const now = new Date();

    await this.tokenStore.saveToken({
      token: accessToken,
      tokenType: 'access',
      clientId: client.clientId,
      userId: user.id,
      scopes,
      launchContext: refreshRecord.launchContext,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.accessTokenTTL * 1000),
      revoked: false,
    });

    // Rotate refresh token (issue new one, revoke old)
    const newRefreshToken = this.generateRefreshToken();
    await this.tokenStore.revokeToken(req.refresh_token);
    await this.tokenStore.saveToken({
      token: newRefreshToken,
      tokenType: 'refresh',
      clientId: client.clientId,
      userId: user.id,
      scopes,
      launchContext: refreshRecord.launchContext,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.refreshTokenTTL * 1000),
      revoked: false,
    });

    const response: TokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.accessTokenTTL,
      scope: scopes.join(' '),
      refresh_token: newRefreshToken,
    };

    if (refreshRecord.launchContext?.patient) {
      response.patient = refreshRecord.launchContext.patient;
    }
    if (refreshRecord.launchContext?.encounter) {
      response.encounter = refreshRecord.launchContext.encounter;
    }

    // Generate ID token if openid scope is present
    if (scopes.includes('openid')) {
      response.id_token = this.generateIdToken(user, client);
    }

    return response;
  }

  /**
   * Handles the client_credentials grant type.
   * Used for system-to-system (backend service) authorization.
   */
  private async handleClientCredentialsGrant(
    req: TokenRequest,
  ): Promise<TokenResponse> {
    if (!req.client_id || !req.client_secret) {
      throw new OAuthError(
        'invalid_request',
        'client_id and client_secret are required for client_credentials grant',
      );
    }

    const client = await this.authenticateClient(req.client_id, req.client_secret);

    if (!client.grantTypes.includes('client_credentials')) {
      throw new OAuthError(
        'unauthorized_client',
        'Client is not authorized for client_credentials grant',
      );
    }

    // Determine scopes
    let scopes: string[] = [];
    if (req.scope) {
      scopes = this.validateScopes(
        req.scope.split(/\s+/).filter(Boolean),
        client.scopes,
      );
    } else {
      scopes = client.scopes.filter((s) => s.startsWith('system/'));
    }

    const accessTokenPayload: Record<string, unknown> = {
      sub: client.clientId,
      client_id: client.clientId,
      scope: scopes.join(' '),
    };

    const accessToken = this.generateAccessToken(accessTokenPayload);
    const now = new Date();

    await this.tokenStore.saveToken({
      token: accessToken,
      tokenType: 'access',
      clientId: client.clientId,
      userId: client.clientId, // For client_credentials, userId is the clientId
      scopes,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.accessTokenTTL * 1000),
      revoked: false,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.accessTokenTTL,
      scope: scopes.join(' '),
    };
  }

  /**
   * Authenticates a client using client_secret_post or client_secret_basic.
   */
  private async authenticateClient(
    clientId: string,
    clientSecret?: string,
  ): Promise<OAuthClient> {
    const client = await this.userStore.getClient(clientId);
    if (!client) {
      throw new OAuthError('invalid_client', 'Unknown client', 401);
    }

    if (client.isConfidential) {
      if (!clientSecret) {
        throw new OAuthError(
          'invalid_client',
          'Client authentication is required for confidential clients',
          401,
        );
      }

      // Constant-time comparison to prevent timing attacks
      if (!client.clientSecret) {
        throw new OAuthError('invalid_client', 'Client has no secret configured', 401);
      }

      const expectedBuffer = Buffer.from(client.clientSecret, 'utf8');
      const receivedBuffer = Buffer.from(clientSecret, 'utf8');

      if (
        expectedBuffer.length !== receivedBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
      ) {
        throw new OAuthError('invalid_client', 'Client authentication failed', 401);
      }
    }

    return client;
  }

  /**
   * Validates a PKCE code_verifier against the stored code_challenge.
   *
   * Only S256 is supported:
   *   code_challenge = BASE64URL(SHA256(code_verifier))
   */
  private validatePKCE(
    codeVerifier: string,
    codeChallenge: string,
    codeChallengeMethod: string,
  ): void {
    if (codeChallengeMethod !== 'S256') {
      throw new OAuthError('invalid_request', 'Only S256 code_challenge_method is supported');
    }

    const computedChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier, 'ascii')
      .digest('base64url');

    if (computedChallenge !== codeChallenge) {
      throw new OAuthError('invalid_grant', 'PKCE code_verifier validation failed');
    }
  }

  /**
   * Generates a cryptographically random authorization code.
   */
  private generateAuthorizationCode(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
}
