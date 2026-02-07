// =============================================================================
// Order Set Management Service
// Manages reusable order set templates that can be applied to patients to
// create multiple draft orders at once. Supports approval workflows and
// versioning for clinical governance.
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService } from './base.service';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface OrderSet {
  id: string;
  name: string;
  category?: string;
  description?: string;
  diagnosisCodes: string[];
  orders: unknown[];
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  version: number;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Database Row
// -----------------------------------------------------------------------------

interface OrderSetRow {
  id: string;
  name: string;
  category?: string;
  description?: string;
  diagnosis_codes?: string;
  orders: string;
  approved: boolean;
  approved_by?: string;
  approved_at?: string;
  version: number;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class OrderSetService extends BaseService {
  constructor() {
    super('OrderSetService');
  }

  // ---------------------------------------------------------------------------
  // Create Order Set
  // ---------------------------------------------------------------------------

  async createOrderSet(data: {
    name: string;
    category?: string;
    description?: string;
    diagnosisCodes?: string[];
    orders: unknown[];
    createdBy: string;
  }): Promise<OrderSet> {
    try {
      if (!data.name || !data.name.trim()) {
        throw new ValidationError('Order set name is required');
      }
      if (!data.orders || !Array.isArray(data.orders) || data.orders.length === 0) {
        throw new ValidationError('At least one order is required in the order set');
      }
      if (!data.createdBy) {
        throw new ValidationError('createdBy is required');
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      const row: OrderSetRow = {
        id,
        name: data.name.trim(),
        category: data.category || undefined,
        description: data.description || undefined,
        diagnosis_codes: data.diagnosisCodes ? JSON.stringify(data.diagnosisCodes) : JSON.stringify([]),
        orders: JSON.stringify(data.orders),
        approved: false,
        version: 1,
        active: true,
        created_by: data.createdBy,
        created_at: now,
        updated_at: now,
      };

      await this.db('order_sets').insert(row);

      this.logger.info('Order set created', {
        orderSetId: id,
        name: data.name,
        orderCount: data.orders.length,
        createdBy: data.createdBy,
      });

      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to create order set', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Order Sets
  // ---------------------------------------------------------------------------

  async getOrderSets(
    filters?: { category?: string; active?: boolean; approved?: boolean }
  ): Promise<OrderSet[]> {
    try {
      const query = this.db('order_sets').select('*');

      if (filters) {
        if (filters.category) {
          query.where('category', filters.category);
        }
        if (filters.active !== undefined) {
          query.where('active', filters.active);
        }
        if (filters.approved !== undefined) {
          query.where('approved', filters.approved);
        }
      }

      query.orderBy('name', 'asc');

      const rows = await query as OrderSetRow[];
      return rows.map((row) => this.fromRow(row));
    } catch (error) {
      this.handleError('Failed to get order sets', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Order Set By ID
  // ---------------------------------------------------------------------------

  async getOrderSetById(id: string): Promise<OrderSet> {
    try {
      const row = await this.db('order_sets')
        .where({ id })
        .first<OrderSetRow>();

      if (!row) {
        throw new NotFoundError('Order Set', id);
      }

      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get order set', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Approve Order Set
  // ---------------------------------------------------------------------------

  async approveOrderSet(id: string, approvedBy: string): Promise<OrderSet> {
    try {
      const row = await this.db('order_sets')
        .where({ id })
        .first<OrderSetRow>();

      if (!row) {
        throw new NotFoundError('Order Set', id);
      }

      if (!approvedBy) {
        throw new ValidationError('approvedBy is required');
      }

      const now = new Date().toISOString();

      await this.db('order_sets')
        .where({ id })
        .update({
          approved: true,
          approved_by: approvedBy,
          approved_at: now,
          updated_at: now,
        });

      this.logger.info('Order set approved', {
        orderSetId: id,
        approvedBy,
      });

      const updated = await this.db('order_sets')
        .where({ id })
        .first<OrderSetRow>();

      return this.fromRow(updated!);
    } catch (error) {
      this.handleError('Failed to approve order set', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Deactivate Order Set
  // ---------------------------------------------------------------------------

  async deactivateOrderSet(id: string): Promise<void> {
    try {
      const row = await this.db('order_sets')
        .where({ id })
        .first<OrderSetRow>();

      if (!row) {
        throw new NotFoundError('Order Set', id);
      }

      const now = new Date().toISOString();

      await this.db('order_sets')
        .where({ id })
        .update({
          active: false,
          updated_at: now,
        });

      this.logger.info('Order set deactivated', { orderSetId: id });
    } catch (error) {
      this.handleError('Failed to deactivate order set', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Apply Order Set
  // ---------------------------------------------------------------------------

  async applyOrderSet(
    orderSetId: string,
    patientId: string,
    encounterId: string | undefined,
    orderedBy: string
  ): Promise<{ ordersCreated: number }> {
    try {
      const orderSet = await this.getOrderSetById(orderSetId);

      if (!orderSet.active) {
        throw new ValidationError('Cannot apply an inactive order set');
      }

      if (!patientId) {
        throw new ValidationError('patientId is required');
      }
      if (!orderedBy) {
        throw new ValidationError('orderedBy is required');
      }

      // Verify patient exists
      await this.requireExists('patients', patientId, 'Patient');

      const orders = orderSet.orders as Array<Record<string, unknown>>;
      let ordersCreated = 0;

      await this.withTransaction(async (trx) => {
        const now = new Date().toISOString();

        for (const orderTemplate of orders) {
          const orderId = uuidv4();

          await trx('orders').insert({
            id: orderId,
            patient_id: patientId,
            encounter_id: encounterId || null,
            order_type: orderTemplate.orderType || 'medication',
            status: 'draft',
            priority: orderTemplate.priority || 'routine',
            code_code: orderTemplate.code || null,
            code_system: orderTemplate.codeSystem || null,
            code_display: orderTemplate.codeDisplay || null,
            clinical_indication: orderTemplate.clinicalIndication || null,
            details: JSON.stringify({
              ...orderTemplate,
              sourceOrderSetId: orderSetId,
              sourceOrderSetName: orderSet.name,
            }),
            ordered_by_id: orderedBy,
            ordered_at: now,
            created_at: now,
            updated_at: now,
          });

          ordersCreated++;
        }
      });

      this.logger.info('Order set applied', {
        orderSetId,
        orderSetName: orderSet.name,
        patientId,
        orderedBy,
        ordersCreated,
      });

      return { ordersCreated };
    } catch (error) {
      this.handleError('Failed to apply order set', error);
    }
  }

  // ===========================================================================
  // Row Mapping
  // ===========================================================================

  private fromRow(row: OrderSetRow): OrderSet {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      diagnosisCodes: row.diagnosis_codes ? JSON.parse(row.diagnosis_codes) : [],
      orders: row.orders ? JSON.parse(row.orders) : [],
      approved: row.approved,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      version: row.version,
      active: row.active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const orderSetService = new OrderSetService();
