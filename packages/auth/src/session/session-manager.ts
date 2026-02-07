/**
 * Session Manager
 *
 * Manages user sessions with configurable idle and absolute timeout policies.
 * Uses a pluggable session store interface (designed for Redis in production)
 * to persist session data. Supports concurrent session tracking, forced logout,
 * and automatic expired-session cleanup.
 */

import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Session {
  id: string;
  userId: string;
  role: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

export interface SessionMetadata {
  role: string;
  ipAddress: string;
  userAgent: string;
  [key: string]: unknown;
}

export interface SessionStoreConfig {
  /** Idle timeout in seconds (default: 900 = 15 minutes) */
  idleTimeoutSeconds?: number;
  /** Absolute session lifetime in seconds (default: 28800 = 8 hours) */
  absoluteTimeoutSeconds?: number;
  /** Maximum concurrent sessions per user (0 = unlimited, default: 5) */
  maxConcurrentSessions?: number;
}

/**
 * Pluggable session store interface.
 *
 * In production this should be backed by Redis or a similar fast KV store.
 * The interface is designed so that implementations can use Redis commands
 * like SET/GET/DEL with TTLs naturally.
 */
export interface SessionStore {
  /** Save or update a session */
  save(session: Session): Promise<void>;
  /** Retrieve a session by ID, or null if not found */
  get(sessionId: string): Promise<Session | null>;
  /** Delete a session by ID */
  delete(sessionId: string): Promise<void>;
  /** Get all session IDs for a given user */
  getSessionsByUserId(userId: string): Promise<Session[]>;
  /** Delete all sessions for a given user */
  deleteAllForUser(userId: string): Promise<void>;
  /** Delete sessions that have expired (expiresAt < now) */
  deleteExpired(): Promise<number>;
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_IDLE_TIMEOUT_SECONDS = 900; // 15 minutes
const DEFAULT_ABSOLUTE_TIMEOUT_SECONDS = 28800; // 8 hours
const DEFAULT_MAX_CONCURRENT_SESSIONS = 5;

// ---------------------------------------------------------------------------
// Session Manager
// ---------------------------------------------------------------------------

export class SessionManager {
  private readonly store: SessionStore;
  private readonly idleTimeoutMs: number;
  private readonly absoluteTimeoutMs: number;
  private readonly maxConcurrentSessions: number;

  constructor(store: SessionStore, config?: SessionStoreConfig) {
    this.store = store;
    this.idleTimeoutMs =
      ((config?.idleTimeoutSeconds ?? DEFAULT_IDLE_TIMEOUT_SECONDS) * 1000);
    this.absoluteTimeoutMs =
      ((config?.absoluteTimeoutSeconds ?? DEFAULT_ABSOLUTE_TIMEOUT_SECONDS) * 1000);
    this.maxConcurrentSessions =
      config?.maxConcurrentSessions ?? DEFAULT_MAX_CONCURRENT_SESSIONS;
  }

  /**
   * Creates a new session for the given user.
   *
   * If the user already has the maximum number of concurrent sessions,
   * the oldest session is destroyed to make room.
   *
   * @param userId - The authenticated user's ID
   * @param metadata - Session metadata (role, IP, user agent, etc.)
   * @returns The newly created session ID
   */
  async createSession(userId: string, metadata: SessionMetadata): Promise<string> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required');
    }
    if (!metadata || typeof metadata !== 'object') {
      throw new Error('metadata is required');
    }
    if (!metadata.role) {
      throw new Error('metadata.role is required');
    }
    if (!metadata.ipAddress) {
      throw new Error('metadata.ipAddress is required');
    }
    if (!metadata.userAgent) {
      throw new Error('metadata.userAgent is required');
    }

    // Enforce concurrent session limit
    if (this.maxConcurrentSessions > 0) {
      const existingSessions = await this.store.getSessionsByUserId(userId);
      const activeSessions = existingSessions.filter((s) => this.isNotExpired(s));

      if (activeSessions.length >= this.maxConcurrentSessions) {
        // Destroy oldest sessions to make room
        const sortedByAge = [...activeSessions].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        );
        const sessionsToRemove = sortedByAge.slice(
          0,
          activeSessions.length - this.maxConcurrentSessions + 1,
        );
        for (const session of sessionsToRemove) {
          await this.store.delete(session.id);
        }
      }
    }

    const now = new Date();
    const sessionId = uuidv4();

    const { role, ipAddress, userAgent, ...extraMetadata } = metadata;

    const session: Session = {
      id: sessionId,
      userId,
      role,
      ipAddress,
      userAgent,
      createdAt: now,
      lastActivity: now,
      expiresAt: new Date(now.getTime() + this.absoluteTimeoutMs),
      metadata: Object.keys(extraMetadata).length > 0 ? extraMetadata : undefined,
    };

    await this.store.save(session);

    return sessionId;
  }

  /**
   * Retrieves a session by its ID.
   *
   * Returns null if the session does not exist or has expired (idle or absolute).
   * If the session is valid, its lastActivity is NOT updated by this call;
   * use `extendSession` to update activity.
   *
   * @param sessionId - The session ID to look up
   * @returns The session, or null if not found or expired
   */
  async getSession(sessionId: string): Promise<Session | null> {
    if (!sessionId) {
      return null;
    }

    const session = await this.store.get(sessionId);
    if (!session) {
      return null;
    }

    if (!this.isNotExpired(session)) {
      // Clean up expired session
      await this.store.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Extends a session's activity timestamp, resetting the idle timeout.
   *
   * Call this on every authenticated request to keep the session alive.
   * The absolute timeout is never changed.
   *
   * @param sessionId - The session to extend
   * @throws Error if the session is not found or has expired
   */
  async extendSession(sessionId: string): Promise<void> {
    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    const session = await this.store.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (!this.isNotExpired(session)) {
      await this.store.delete(sessionId);
      throw new Error('Session has expired');
    }

    session.lastActivity = new Date();
    await this.store.save(session);
  }

  /**
   * Destroys a single session (logout).
   *
   * @param sessionId - The session to destroy
   */
  async destroySession(sessionId: string): Promise<void> {
    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    await this.store.delete(sessionId);
  }

  /**
   * Destroys all sessions for a given user (force logout everywhere).
   *
   * Used when a user changes their password, is deactivated, or when an
   * administrator forces a global logout.
   *
   * @param userId - The user whose sessions should be destroyed
   */
  async destroyAllUserSessions(userId: string): Promise<void> {
    if (!userId) {
      throw new Error('userId is required');
    }

    await this.store.deleteAllForUser(userId);
  }

  /**
   * Checks whether a session is currently valid (exists, not idle-expired,
   * not absolute-expired).
   *
   * @param sessionId - The session to check
   * @returns true if the session is valid
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    return session !== null;
  }

  /**
   * Returns all active (non-expired) sessions for a given user.
   *
   * @param userId - The user whose sessions to retrieve
   * @returns Array of active sessions
   */
  async getActiveSessions(userId: string): Promise<Session[]> {
    if (!userId) {
      return [];
    }

    const sessions = await this.store.getSessionsByUserId(userId);
    const activeSessions: Session[] = [];

    for (const session of sessions) {
      if (this.isNotExpired(session)) {
        activeSessions.push(session);
      } else {
        // Clean up expired session
        await this.store.delete(session.id);
      }
    }

    return activeSessions;
  }

  /**
   * Cleans up all expired sessions from the store.
   *
   * Should be called periodically (e.g., via a cron job) to prevent
   * unbounded growth of the session store.
   *
   * @returns The number of sessions removed
   */
  async cleanExpiredSessions(): Promise<number> {
    return this.store.deleteExpired();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Checks whether a session has NOT expired (both idle and absolute).
   */
  private isNotExpired(session: Session): boolean {
    const now = Date.now();

    // Check absolute timeout
    if (now >= session.expiresAt.getTime()) {
      return false;
    }

    // Check idle timeout
    const idleDeadline = session.lastActivity.getTime() + this.idleTimeoutMs;
    if (now >= idleDeadline) {
      return false;
    }

    return true;
  }
}
