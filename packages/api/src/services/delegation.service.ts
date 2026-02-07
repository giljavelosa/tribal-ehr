// =============================================================================
// Clinician Delegation & Out-of-Office Service
// Manages delegation of clinical responsibilities (messages, results, orders)
// and out-of-office status with automatic message forwarding.
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService } from './base.service';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type DelegationType = 'messages' | 'results' | 'orders' | 'all';

export interface ClinicianDelegation {
  id: string;
  delegatorId: string;
  delegateId: string;
  delegationType: string;
  startDate: string;
  endDate?: string;
  reason?: string;
  active: boolean;
  createdAt: string;
}

export interface OutOfOfficeStatus {
  outOfOffice: boolean;
  message?: string;
  start?: string;
  end?: string;
  autoForwardTo?: string;
}

// -----------------------------------------------------------------------------
// Database Row
// -----------------------------------------------------------------------------

interface DelegationRow {
  id: string;
  delegator_id: string;
  delegate_id: string;
  delegation_type: string;
  start_date: string;
  end_date?: string;
  reason?: string;
  active: boolean;
  created_at: string;
}

interface UserOutOfOfficeRow {
  out_of_office: boolean;
  out_of_office_message?: string;
  out_of_office_start?: string;
  out_of_office_end?: string;
  auto_forward_to?: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class DelegationService extends BaseService {
  constructor() {
    super('DelegationService');
  }

  // ---------------------------------------------------------------------------
  // Create Delegation
  // ---------------------------------------------------------------------------

  async createDelegation(data: {
    delegatorId: string;
    delegateId: string;
    delegationType: DelegationType;
    startDate?: string;
    endDate?: string;
    reason?: string;
  }): Promise<ClinicianDelegation> {
    try {
      if (!data.delegatorId) {
        throw new ValidationError('delegatorId is required');
      }
      if (!data.delegateId) {
        throw new ValidationError('delegateId is required');
      }
      if (data.delegatorId === data.delegateId) {
        throw new ValidationError('A clinician cannot delegate to themselves');
      }

      // Verify both users exist
      await this.requireExists('users', data.delegatorId, 'Delegator User');
      await this.requireExists('users', data.delegateId, 'Delegate User');

      const id = uuidv4();
      const now = new Date().toISOString();

      const row: DelegationRow = {
        id,
        delegator_id: data.delegatorId,
        delegate_id: data.delegateId,
        delegation_type: data.delegationType,
        start_date: data.startDate || now,
        end_date: data.endDate,
        reason: data.reason,
        active: true,
        created_at: now,
      };

      await this.db('clinician_delegates').insert(row);

      this.logger.info('Delegation created', {
        delegationId: id,
        delegatorId: data.delegatorId,
        delegateId: data.delegateId,
        delegationType: data.delegationType,
      });

      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to create delegation', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Revoke Delegation
  // ---------------------------------------------------------------------------

  async revokeDelegation(id: string, userId: string): Promise<void> {
    try {
      const row = await this.db('clinician_delegates')
        .where({ id })
        .first<DelegationRow>();

      if (!row) {
        throw new NotFoundError('Delegation', id);
      }

      if (row.delegator_id !== userId) {
        throw new ValidationError('Only the delegator can revoke a delegation');
      }

      await this.db('clinician_delegates')
        .where({ id })
        .update({ active: false });

      this.logger.info('Delegation revoked', { delegationId: id, userId });
    } catch (error) {
      this.handleError('Failed to revoke delegation', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Active Delegates For a User
  // ---------------------------------------------------------------------------

  async getActiveDelegatesFor(
    userId: string,
    delegationType?: string
  ): Promise<ClinicianDelegation[]> {
    try {
      const query = this.db('clinician_delegates')
        .where({ delegator_id: userId, active: true });

      if (delegationType) {
        query.where(function () {
          this.where('delegation_type', delegationType)
            .orWhere('delegation_type', 'all');
        });
      }

      const rows = await query.orderBy('created_at', 'desc') as DelegationRow[];

      return rows.map((row) => this.fromRow(row));
    } catch (error) {
      this.handleError('Failed to get active delegates', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Delegations Received
  // ---------------------------------------------------------------------------

  async getDelegationsReceived(userId: string): Promise<ClinicianDelegation[]> {
    try {
      const rows = await this.db('clinician_delegates')
        .where({ delegate_id: userId, active: true })
        .orderBy('created_at', 'desc') as DelegationRow[];

      return rows.map((row) => this.fromRow(row));
    } catch (error) {
      this.handleError('Failed to get delegations received', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Set Out-of-Office
  // ---------------------------------------------------------------------------

  async setOutOfOffice(
    userId: string,
    data: {
      message?: string;
      start?: string;
      end?: string;
      autoForwardTo?: string;
    }
  ): Promise<void> {
    try {
      await this.requireExists('users', userId, 'User');

      if (data.autoForwardTo) {
        await this.requireExists('users', data.autoForwardTo, 'Auto-forward User');
      }

      await this.db('users')
        .where({ id: userId })
        .update({
          out_of_office: true,
          out_of_office_message: data.message || null,
          out_of_office_start: data.start || null,
          out_of_office_end: data.end || null,
          auto_forward_to: data.autoForwardTo || null,
        });

      this.logger.info('Out-of-office set', { userId, autoForwardTo: data.autoForwardTo });
    } catch (error) {
      this.handleError('Failed to set out-of-office', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Clear Out-of-Office
  // ---------------------------------------------------------------------------

  async clearOutOfOffice(userId: string): Promise<void> {
    try {
      await this.requireExists('users', userId, 'User');

      await this.db('users')
        .where({ id: userId })
        .update({
          out_of_office: false,
          out_of_office_message: null,
          out_of_office_start: null,
          out_of_office_end: null,
          auto_forward_to: null,
        });

      this.logger.info('Out-of-office cleared', { userId });
    } catch (error) {
      this.handleError('Failed to clear out-of-office', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Out-of-Office Status
  // ---------------------------------------------------------------------------

  async getOutOfOfficeStatus(userId: string): Promise<OutOfOfficeStatus> {
    try {
      const row = await this.db('users')
        .where({ id: userId })
        .select(
          'out_of_office',
          'out_of_office_message',
          'out_of_office_start',
          'out_of_office_end',
          'auto_forward_to'
        )
        .first<UserOutOfOfficeRow>();

      if (!row) {
        throw new NotFoundError('User', userId);
      }

      return {
        outOfOffice: !!row.out_of_office,
        message: row.out_of_office_message || undefined,
        start: row.out_of_office_start || undefined,
        end: row.out_of_office_end || undefined,
        autoForwardTo: row.auto_forward_to || undefined,
      };
    } catch (error) {
      this.handleError('Failed to get out-of-office status', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Resolve Effective Recipient
  // ---------------------------------------------------------------------------

  async resolveEffectiveRecipient(
    recipientId: string,
    delegationType: string
  ): Promise<string> {
    try {
      // Check if recipient is out-of-office with auto-forward
      const oooStatus = await this.getOutOfOfficeStatus(recipientId);

      if (oooStatus.outOfOffice && oooStatus.autoForwardTo) {
        this.logger.info('Recipient out-of-office, forwarding', {
          originalRecipient: recipientId,
          forwardTo: oooStatus.autoForwardTo,
        });
        return oooStatus.autoForwardTo;
      }

      // Check for active delegation matching the type
      const delegates = await this.getActiveDelegatesFor(recipientId, delegationType);

      if (delegates.length > 0) {
        const delegate = delegates[0];
        this.logger.info('Recipient has active delegation, forwarding', {
          originalRecipient: recipientId,
          delegateId: delegate.delegateId,
          delegationType: delegate.delegationType,
        });
        return delegate.delegateId;
      }

      // No forwarding needed
      return recipientId;
    } catch (error) {
      this.handleError('Failed to resolve effective recipient', error);
    }
  }

  // ===========================================================================
  // Row Mapping
  // ===========================================================================

  private fromRow(row: DelegationRow): ClinicianDelegation {
    return {
      id: row.id,
      delegatorId: row.delegator_id,
      delegateId: row.delegate_id,
      delegationType: row.delegation_type,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      active: row.active,
      createdAt: row.created_at,
    };
  }
}

export const delegationService = new DelegationService();
