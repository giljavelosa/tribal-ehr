// =============================================================================
// Consent Enforcement & Break-Glass Emergency Access Service
// ONC §170.315(b)(7) consent management and HIPAA §164.308(a)(4) break-glass
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService } from './base.service';
import { ValidationError, NotFoundError, AuthorizationError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type SensitivityLevel = 'normal' | 'restricted' | 'very-restricted';
export type SensitivityCategory =
  | 'substance-abuse'
  | 'mental-health'
  | 'hiv-sti'
  | 'reproductive'
  | 'genetic'
  | 'general';

export type ConsentType = 'treatment' | 'research' | 'disclosure' | 'opt-out';
export type ConsentStatus = 'active' | 'inactive' | 'rejected' | 'revoked';
export type ReasonCategory = 'emergency-treatment' | 'danger-to-self-others' | 'public-health-emergency';

export interface DataSensitivityTag {
  id: string;
  resourceType: string;
  resourceId: string;
  sensitivityLevel: SensitivityLevel;
  sensitivityCategory: SensitivityCategory;
  taggedBy: string;
  taggedAt: string;
}

export interface BreakGlassEvent {
  id: string;
  userId: string;
  patientId: string;
  reason: string;
  reasonCategory: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  accessGrantedAt: string;
  accessExpiresAt: string;
  revoked: boolean;
  revokedBy: string | null;
  revokedAt: string | null;
  resourcesAccessed: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface ConsentDirective {
  id: string;
  patientId: string;
  consentType: ConsentType;
  status: ConsentStatus;
  scope: string | null;
  actorType: string | null;
  actorId: string | null;
  dataCategories: string[];
  periodStart: string | null;
  periodEnd: string | null;
  recordedBy: string;
  verified: boolean;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason: string;
  requiresBreakGlass: boolean;
}

// -----------------------------------------------------------------------------
// Database Rows
// -----------------------------------------------------------------------------

interface SensitivityTagRow {
  id: string;
  resource_type: string;
  resource_id: string;
  sensitivity_level: string;
  sensitivity_category: string;
  tagged_by: string;
  tagged_at: string;
}

interface BreakGlassRow {
  id: string;
  user_id: string;
  patient_id: string;
  reason: string;
  reason_category: string | null;
  approved_by: string | null;
  approved_at: string | null;
  access_granted_at: string;
  access_expires_at: string;
  revoked: boolean;
  revoked_by: string | null;
  revoked_at: string | null;
  resources_accessed: unknown[];
  created_at: string;
  updated_at: string;
}

interface ConsentDirectiveRow {
  id: string;
  patient_id: string;
  consent_type: string;
  status: string;
  scope: string | null;
  actor_type: string | null;
  actor_id: string | null;
  data_categories: string[];
  period_start: string | null;
  period_end: string | null;
  recorded_by: string;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

const BREAK_GLASS_DURATION_HOURS = 4;

const VALID_SENSITIVITY_LEVELS: SensitivityLevel[] = ['normal', 'restricted', 'very-restricted'];
const VALID_SENSITIVITY_CATEGORIES: SensitivityCategory[] = [
  'substance-abuse', 'mental-health', 'hiv-sti', 'reproductive', 'genetic', 'general',
];
const VALID_CONSENT_TYPES: ConsentType[] = ['treatment', 'research', 'disclosure', 'opt-out'];
const VALID_CONSENT_STATUSES: ConsentStatus[] = ['active', 'inactive', 'rejected', 'revoked'];
const VALID_REASON_CATEGORIES: ReasonCategory[] = [
  'emergency-treatment', 'danger-to-self-others', 'public-health-emergency',
];

export class ConsentEnforcementService extends BaseService {
  constructor() {
    super('ConsentEnforcementService');
  }

  // ---------------------------------------------------------------------------
  // Consent Directives
  // ---------------------------------------------------------------------------

  async createConsentDirective(data: {
    patientId: string;
    consentType: ConsentType;
    status: ConsentStatus;
    scope?: string;
    actorType?: string;
    actorId?: string;
    dataCategories?: string[];
    periodStart?: string;
    periodEnd?: string;
    recordedBy: string;
  }): Promise<ConsentDirective> {
    try {
      if (!data.patientId) {
        throw new ValidationError('patientId is required');
      }
      if (!data.consentType || !VALID_CONSENT_TYPES.includes(data.consentType)) {
        throw new ValidationError(
          `consentType must be one of: ${VALID_CONSENT_TYPES.join(', ')}`
        );
      }
      if (!data.status || !VALID_CONSENT_STATUSES.includes(data.status)) {
        throw new ValidationError(
          `status must be one of: ${VALID_CONSENT_STATUSES.join(', ')}`
        );
      }
      if (!data.recordedBy) {
        throw new ValidationError('recordedBy is required');
      }

      await this.requireExists('patients', data.patientId, 'Patient');
      await this.requireExists('users', data.recordedBy, 'User');

      const id = uuidv4();
      const now = new Date().toISOString();

      const row: ConsentDirectiveRow = {
        id,
        patient_id: data.patientId,
        consent_type: data.consentType,
        status: data.status,
        scope: data.scope || null,
        actor_type: data.actorType || null,
        actor_id: data.actorId || null,
        data_categories: data.dataCategories || [],
        period_start: data.periodStart || null,
        period_end: data.periodEnd || null,
        recorded_by: data.recordedBy,
        verified: false,
        verified_at: null,
        created_at: now,
        updated_at: now,
      };

      await this.db('consent_directives').insert({
        ...row,
        data_categories: JSON.stringify(row.data_categories),
      });

      this.logger.info('Consent directive created', {
        directiveId: id,
        patientId: data.patientId,
        consentType: data.consentType,
        status: data.status,
      });

      return this.consentFromRow(row);
    } catch (error) {
      this.handleError('Failed to create consent directive', error);
    }
  }

  async updateConsentDirective(
    id: string,
    data: {
      status?: ConsentStatus;
      scope?: string;
      actorType?: string;
      actorId?: string;
      dataCategories?: string[];
      periodStart?: string;
      periodEnd?: string;
      verified?: boolean;
    }
  ): Promise<ConsentDirective> {
    try {
      const existing = await this.db('consent_directives')
        .where({ id })
        .first<ConsentDirectiveRow>();

      if (!existing) {
        throw new NotFoundError('Consent Directive', id);
      }

      if (data.status && !VALID_CONSENT_STATUSES.includes(data.status)) {
        throw new ValidationError(
          `status must be one of: ${VALID_CONSENT_STATUSES.join(', ')}`
        );
      }

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (data.status !== undefined) updates.status = data.status;
      if (data.scope !== undefined) updates.scope = data.scope;
      if (data.actorType !== undefined) updates.actor_type = data.actorType;
      if (data.actorId !== undefined) updates.actor_id = data.actorId;
      if (data.dataCategories !== undefined) updates.data_categories = JSON.stringify(data.dataCategories);
      if (data.periodStart !== undefined) updates.period_start = data.periodStart;
      if (data.periodEnd !== undefined) updates.period_end = data.periodEnd;
      if (data.verified !== undefined) {
        updates.verified = data.verified;
        if (data.verified) {
          updates.verified_at = new Date().toISOString();
        }
      }

      await this.db('consent_directives').where({ id }).update(updates);

      const updated = await this.db('consent_directives')
        .where({ id })
        .first<ConsentDirectiveRow>();

      this.logger.info('Consent directive updated', { directiveId: id });

      return this.consentFromRow(updated!);
    } catch (error) {
      this.handleError('Failed to update consent directive', error);
    }
  }

  async getPatientConsents(patientId: string): Promise<ConsentDirective[]> {
    try {
      if (!patientId) {
        throw new ValidationError('patientId is required');
      }

      const rows = await this.db('consent_directives')
        .where({ patient_id: patientId })
        .orderBy('created_at', 'desc') as ConsentDirectiveRow[];

      return rows.map((row) => this.consentFromRow(row));
    } catch (error) {
      this.handleError('Failed to get patient consents', error);
    }
  }

  async revokeConsent(id: string, revokedBy: string): Promise<ConsentDirective> {
    try {
      const existing = await this.db('consent_directives')
        .where({ id })
        .first<ConsentDirectiveRow>();

      if (!existing) {
        throw new NotFoundError('Consent Directive', id);
      }

      if (existing.status === 'revoked') {
        throw new ValidationError('Consent directive is already revoked');
      }

      const now = new Date().toISOString();

      await this.db('consent_directives').where({ id }).update({
        status: 'revoked',
        updated_at: now,
      });

      this.logger.info('Consent directive revoked', {
        directiveId: id,
        revokedBy,
        patientId: existing.patient_id,
      });

      const updated = await this.db('consent_directives')
        .where({ id })
        .first<ConsentDirectiveRow>();

      return this.consentFromRow(updated!);
    } catch (error) {
      this.handleError('Failed to revoke consent', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Access Check
  // ---------------------------------------------------------------------------

  async checkAccess(
    userId: string,
    patientId: string,
    resourceType: string,
    sensitivityCategory?: string
  ): Promise<AccessCheckResult> {
    try {
      if (!userId || !patientId || !resourceType) {
        throw new ValidationError('userId, patientId, and resourceType are required');
      }

      // Check for active break-glass override first
      const activeBreakGlass = await this.getActiveBreakGlass(userId, patientId);
      if (activeBreakGlass) {
        return {
          allowed: true,
          reason: 'Access granted via break-glass emergency override',
          requiresBreakGlass: false,
        };
      }

      // Get active consent directives for this patient
      const consents = await this.db('consent_directives')
        .where({ patient_id: patientId, status: 'active' })
        .orderBy('created_at', 'desc') as ConsentDirectiveRow[];

      // Check for opt-out consents that restrict the category
      for (const consent of consents) {
        if (consent.consent_type === 'opt-out') {
          const categories: string[] = Array.isArray(consent.data_categories)
            ? consent.data_categories
            : JSON.parse(consent.data_categories as unknown as string || '[]');

          // If the consent has specific categories, check if our category matches
          if (categories.length > 0 && sensitivityCategory) {
            if (categories.includes(sensitivityCategory)) {
              // Check if this consent is actor-specific
              if (consent.actor_id && consent.actor_id !== userId) {
                continue; // This opt-out doesn't apply to this user
              }

              // Check if the consent period is still valid
              if (consent.period_end) {
                const endDate = new Date(consent.period_end);
                if (endDate < new Date()) {
                  continue; // Consent period has ended
                }
              }

              return {
                allowed: false,
                reason: `Patient has opted out of sharing ${sensitivityCategory} data`,
                requiresBreakGlass: true,
              };
            }
          }

          // If consent has no specific categories, it applies to all data
          if (categories.length === 0) {
            if (consent.actor_id && consent.actor_id !== userId) {
              continue;
            }

            if (consent.period_end) {
              const endDate = new Date(consent.period_end);
              if (endDate < new Date()) {
                continue;
              }
            }

            return {
              allowed: false,
              reason: 'Patient has opted out of data sharing',
              requiresBreakGlass: true,
            };
          }
        }
      }

      // No restrictions found - access allowed
      return {
        allowed: true,
        reason: 'Access permitted - no consent restrictions apply',
        requiresBreakGlass: false,
      };
    } catch (error) {
      this.handleError('Failed to check access', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Sensitivity Tags
  // ---------------------------------------------------------------------------

  async tagResource(
    resourceType: string,
    resourceId: string,
    sensitivityLevel: SensitivityLevel,
    sensitivityCategory: SensitivityCategory,
    taggedBy: string
  ): Promise<DataSensitivityTag> {
    try {
      if (!resourceType || !resourceId) {
        throw new ValidationError('resourceType and resourceId are required');
      }
      if (!VALID_SENSITIVITY_LEVELS.includes(sensitivityLevel)) {
        throw new ValidationError(
          `sensitivityLevel must be one of: ${VALID_SENSITIVITY_LEVELS.join(', ')}`
        );
      }
      if (!VALID_SENSITIVITY_CATEGORIES.includes(sensitivityCategory)) {
        throw new ValidationError(
          `sensitivityCategory must be one of: ${VALID_SENSITIVITY_CATEGORIES.join(', ')}`
        );
      }
      if (!taggedBy) {
        throw new ValidationError('taggedBy is required');
      }

      await this.requireExists('users', taggedBy, 'User');

      // Check if tag already exists for this resource + category
      const existingTag = await this.db('data_sensitivity_tags')
        .where({
          resource_type: resourceType,
          resource_id: resourceId,
          sensitivity_category: sensitivityCategory,
        })
        .first<SensitivityTagRow>();

      if (existingTag) {
        // Update existing tag
        await this.db('data_sensitivity_tags')
          .where({ id: existingTag.id })
          .update({
            sensitivity_level: sensitivityLevel,
            tagged_by: taggedBy,
            tagged_at: new Date().toISOString(),
          });

        const updated = await this.db('data_sensitivity_tags')
          .where({ id: existingTag.id })
          .first<SensitivityTagRow>();

        this.logger.info('Sensitivity tag updated', {
          tagId: existingTag.id,
          resourceType,
          resourceId,
          sensitivityLevel,
          sensitivityCategory,
        });

        return this.tagFromRow(updated!);
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      const row: SensitivityTagRow = {
        id,
        resource_type: resourceType,
        resource_id: resourceId,
        sensitivity_level: sensitivityLevel,
        sensitivity_category: sensitivityCategory,
        tagged_by: taggedBy,
        tagged_at: now,
      };

      await this.db('data_sensitivity_tags').insert(row);

      this.logger.info('Resource tagged with sensitivity', {
        tagId: id,
        resourceType,
        resourceId,
        sensitivityLevel,
        sensitivityCategory,
      });

      return this.tagFromRow(row);
    } catch (error) {
      this.handleError('Failed to tag resource', error);
    }
  }

  async getResourceTags(
    resourceType: string,
    resourceId: string
  ): Promise<DataSensitivityTag[]> {
    try {
      if (!resourceType || !resourceId) {
        throw new ValidationError('resourceType and resourceId are required');
      }

      const rows = await this.db('data_sensitivity_tags')
        .where({
          resource_type: resourceType,
          resource_id: resourceId,
        })
        .orderBy('tagged_at', 'desc') as SensitivityTagRow[];

      return rows.map((row) => this.tagFromRow(row));
    } catch (error) {
      this.handleError('Failed to get resource tags', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Break-Glass Emergency Access
  // ---------------------------------------------------------------------------

  async requestBreakGlass(
    userId: string,
    patientId: string,
    reason: string,
    reasonCategory?: ReasonCategory
  ): Promise<BreakGlassEvent> {
    try {
      if (!userId) {
        throw new ValidationError('userId is required');
      }
      if (!patientId) {
        throw new ValidationError('patientId is required');
      }
      if (!reason || reason.trim().length < 10) {
        throw new ValidationError('reason is required and must be at least 10 characters');
      }
      if (reasonCategory && !VALID_REASON_CATEGORIES.includes(reasonCategory)) {
        throw new ValidationError(
          `reasonCategory must be one of: ${VALID_REASON_CATEGORIES.join(', ')}`
        );
      }

      await this.requireExists('users', userId, 'User');
      await this.requireExists('patients', patientId, 'Patient');

      // Check for existing active break-glass
      const existing = await this.getActiveBreakGlass(userId, patientId);
      if (existing) {
        throw new ValidationError(
          'An active break-glass session already exists for this user and patient'
        );
      }

      const id = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + BREAK_GLASS_DURATION_HOURS * 60 * 60 * 1000);

      const row: BreakGlassRow = {
        id,
        user_id: userId,
        patient_id: patientId,
        reason: reason.trim(),
        reason_category: reasonCategory || null,
        approved_by: null,
        approved_at: null,
        access_granted_at: now.toISOString(),
        access_expires_at: expiresAt.toISOString(),
        revoked: false,
        revoked_by: null,
        revoked_at: null,
        resources_accessed: [],
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      await this.db('break_glass_events').insert({
        ...row,
        resources_accessed: JSON.stringify(row.resources_accessed),
      });

      this.logger.warn('Break-glass emergency access requested', {
        eventId: id,
        userId,
        patientId,
        reasonCategory,
        expiresAt: expiresAt.toISOString(),
      });

      return this.breakGlassFromRow(row);
    } catch (error) {
      this.handleError('Failed to request break-glass access', error);
    }
  }

  async approveBreakGlass(eventId: string, approvedBy: string): Promise<BreakGlassEvent> {
    try {
      const existing = await this.db('break_glass_events')
        .where({ id: eventId })
        .first<BreakGlassRow>();

      if (!existing) {
        throw new NotFoundError('Break-Glass Event', eventId);
      }

      if (existing.revoked) {
        throw new ValidationError('This break-glass event has been revoked');
      }

      if (existing.approved_by) {
        throw new ValidationError('This break-glass event has already been approved');
      }

      if (existing.user_id === approvedBy) {
        throw new ValidationError('A break-glass event cannot be self-approved');
      }

      await this.requireExists('users', approvedBy, 'Approving User');

      const now = new Date().toISOString();

      await this.db('break_glass_events').where({ id: eventId }).update({
        approved_by: approvedBy,
        approved_at: now,
        updated_at: now,
      });

      const updated = await this.db('break_glass_events')
        .where({ id: eventId })
        .first<BreakGlassRow>();

      this.logger.info('Break-glass event approved', {
        eventId,
        approvedBy,
        userId: existing.user_id,
        patientId: existing.patient_id,
      });

      return this.breakGlassFromRow(updated!);
    } catch (error) {
      this.handleError('Failed to approve break-glass event', error);
    }
  }

  async revokeBreakGlass(eventId: string, revokedBy: string): Promise<BreakGlassEvent> {
    try {
      const existing = await this.db('break_glass_events')
        .where({ id: eventId })
        .first<BreakGlassRow>();

      if (!existing) {
        throw new NotFoundError('Break-Glass Event', eventId);
      }

      if (existing.revoked) {
        throw new ValidationError('This break-glass event has already been revoked');
      }

      await this.requireExists('users', revokedBy, 'Revoking User');

      const now = new Date().toISOString();

      await this.db('break_glass_events').where({ id: eventId }).update({
        revoked: true,
        revoked_by: revokedBy,
        revoked_at: now,
        updated_at: now,
      });

      const updated = await this.db('break_glass_events')
        .where({ id: eventId })
        .first<BreakGlassRow>();

      this.logger.warn('Break-glass event revoked', {
        eventId,
        revokedBy,
        userId: existing.user_id,
        patientId: existing.patient_id,
      });

      return this.breakGlassFromRow(updated!);
    } catch (error) {
      this.handleError('Failed to revoke break-glass event', error);
    }
  }

  async getActiveBreakGlass(
    userId: string,
    patientId: string
  ): Promise<BreakGlassEvent | null> {
    try {
      const now = new Date().toISOString();

      const row = await this.db('break_glass_events')
        .where({
          user_id: userId,
          patient_id: patientId,
          revoked: false,
        })
        .where('access_expires_at', '>', now)
        .orderBy('access_granted_at', 'desc')
        .first<BreakGlassRow>();

      if (!row) {
        return null;
      }

      return this.breakGlassFromRow(row);
    } catch (error) {
      this.handleError('Failed to get active break-glass', error);
    }
  }

  async getBreakGlassHistory(filters: {
    userId?: string;
    patientId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<BreakGlassEvent[]> {
    try {
      const query = this.db('break_glass_events').orderBy('created_at', 'desc');

      if (filters.userId) {
        query.where('user_id', filters.userId);
      }
      if (filters.patientId) {
        query.where('patient_id', filters.patientId);
      }
      if (filters.startDate) {
        query.where('created_at', '>=', filters.startDate);
      }
      if (filters.endDate) {
        query.where('created_at', '<=', filters.endDate);
      }

      const rows = await query as BreakGlassRow[];

      return rows.map((row) => this.breakGlassFromRow(row));
    } catch (error) {
      this.handleError('Failed to get break-glass history', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Filter Sensitive Data
  // ---------------------------------------------------------------------------

  async filterSensitiveData(
    data: Record<string, unknown>[],
    userId: string,
    patientId: string
  ): Promise<Record<string, unknown>[]> {
    try {
      if (!data || data.length === 0) {
        return data;
      }

      // Check for active break-glass (bypasses filtering)
      const activeBreakGlass = await this.getActiveBreakGlass(userId, patientId);
      if (activeBreakGlass) {
        return data;
      }

      // Get all active opt-out consents for the patient
      const consents = await this.db('consent_directives')
        .where({ patient_id: patientId, status: 'active', consent_type: 'opt-out' }) as ConsentDirectiveRow[];

      if (consents.length === 0) {
        return data; // No restrictions
      }

      // Collect all restricted categories
      const restrictedCategories = new Set<string>();
      for (const consent of consents) {
        // Apply actor filtering
        if (consent.actor_id && consent.actor_id !== userId) {
          continue;
        }

        // Check period validity
        if (consent.period_end) {
          const endDate = new Date(consent.period_end);
          if (endDate < new Date()) {
            continue;
          }
        }

        const categories: string[] = Array.isArray(consent.data_categories)
          ? consent.data_categories
          : JSON.parse(consent.data_categories as unknown as string || '[]');

        for (const cat of categories) {
          restrictedCategories.add(cat);
        }
      }

      if (restrictedCategories.size === 0) {
        return data;
      }

      // Filter out resources that have restricted sensitivity tags
      const filtered: Record<string, unknown>[] = [];

      for (const item of data) {
        const resourceId = (item.id as string) || '';
        const resourceType = (item.resourceType as string) || '';

        if (!resourceId || !resourceType) {
          filtered.push(item);
          continue;
        }

        const tags = await this.db('data_sensitivity_tags')
          .where({
            resource_type: resourceType,
            resource_id: resourceId,
          }) as SensitivityTagRow[];

        const isRestricted = tags.some(
          (tag) => restrictedCategories.has(tag.sensitivity_category)
        );

        if (!isRestricted) {
          filtered.push(item);
        }
      }

      return filtered;
    } catch (error) {
      this.handleError('Failed to filter sensitive data', error);
    }
  }

  // ===========================================================================
  // Row Mapping
  // ===========================================================================

  private tagFromRow(row: SensitivityTagRow): DataSensitivityTag {
    return {
      id: row.id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      sensitivityLevel: row.sensitivity_level as SensitivityLevel,
      sensitivityCategory: row.sensitivity_category as SensitivityCategory,
      taggedBy: row.tagged_by,
      taggedAt: row.tagged_at,
    };
  }

  private breakGlassFromRow(row: BreakGlassRow): BreakGlassEvent {
    return {
      id: row.id,
      userId: row.user_id,
      patientId: row.patient_id,
      reason: row.reason,
      reasonCategory: row.reason_category,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      accessGrantedAt: row.access_granted_at,
      accessExpiresAt: row.access_expires_at,
      revoked: row.revoked,
      revokedBy: row.revoked_by,
      revokedAt: row.revoked_at,
      resourcesAccessed: Array.isArray(row.resources_accessed)
        ? row.resources_accessed
        : JSON.parse(row.resources_accessed as unknown as string || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private consentFromRow(row: ConsentDirectiveRow): ConsentDirective {
    return {
      id: row.id,
      patientId: row.patient_id,
      consentType: row.consent_type as ConsentType,
      status: row.status as ConsentStatus,
      scope: row.scope,
      actorType: row.actor_type,
      actorId: row.actor_id,
      dataCategories: Array.isArray(row.data_categories)
        ? row.data_categories
        : JSON.parse(row.data_categories as unknown as string || '[]'),
      periodStart: row.period_start,
      periodEnd: row.period_end,
      recordedBy: row.recorded_by,
      verified: row.verified,
      verifiedAt: row.verified_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const consentEnforcementService = new ConsentEnforcementService();
