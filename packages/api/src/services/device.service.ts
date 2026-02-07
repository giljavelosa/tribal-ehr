// =============================================================================
// Device Service - Implantable Device List (UDI)
// FHIR R4 Device | US Core 6.1 Implantable Device profile
// Per ONC certification criteria section 170.315(a)(14)
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import {
  Device,
  DeviceStatus,
  UdiCarrier,
  CodeableConcept,
  Reference,
  CODE_SYSTEMS,
} from '@tribal-ehr/shared';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

const US_CORE_IMPLANTABLE_DEVICE =
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-implantable-device';

// -----------------------------------------------------------------------------
// Database Row Interface
// -----------------------------------------------------------------------------

interface DeviceRow {
  id: string;
  patient_id: string;
  udi_carrier?: string; // JSON
  status?: string;
  type_code?: string;
  type_system?: string;
  type_display?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  expiration_date?: string;
  fhir_id?: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Search Parameters
// -----------------------------------------------------------------------------

export interface DeviceSearchParams extends PaginationParams {
  patientId: string;
  type?: string;
  status?: string;
  udi?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class DeviceService extends BaseService {
  constructor() {
    super('DeviceService');
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(data: Omit<Device, 'id'>): Promise<Device> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      const row: DeviceRow = {
        id,
        patient_id: data.patientId,
        udi_carrier: data.udiCarrier ? JSON.stringify(data.udiCarrier) : undefined,
        status: data.status,
        type_code: data.type?.coding?.[0]?.code,
        type_system: data.type?.coding?.[0]?.system || CODE_SYSTEMS.SNOMED_CT,
        type_display: data.type?.coding?.[0]?.display || data.type?.text,
        manufacturer: data.manufacturer,
        model: data.model,
        serial_number: data.serialNumber,
        expiration_date: data.expirationDate,
        created_at: now,
        updated_at: now,
      };

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('devices').insert(row);

        const fhirResource = this.toFHIR({ ...data, id });
        const fhirResult = await this.fhirClient.create<Record<string, unknown>>(
          'Device',
          fhirResource
        );
        if (fhirResult.id) {
          await trx('devices').where({ id }).update({ fhir_id: fhirResult.id as string });
        }
      });

      this.logger.info('Device created', { deviceId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to create device', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get by ID
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<Device> {
    try {
      const row = await this.db('devices').where({ id }).first<DeviceRow>();
      if (!row) {
        throw new NotFoundError('Device', id);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get device', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  async search(params: DeviceSearchParams): Promise<PaginatedResult<Device>> {
    try {
      if (!params.patientId) {
        throw new ValidationError('patientId is required for device search');
      }

      const query = this.db('devices')
        .where('patient_id', params.patientId)
        .select('*')
        .orderBy('created_at', 'desc');

      if (params.type) {
        query.where('type_code', params.type);
      }

      if (params.status) {
        query.where('status', params.status);
      }

      if (params.udi) {
        query.whereRaw("udi_carrier::text LIKE ?", [`%${params.udi}%`]);
      }

      const allowedSortColumns: Record<string, string> = {
        type: 'type_display',
        status: 'status',
        manufacturer: 'manufacturer',
        expirationDate: 'expiration_date',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      const result = await this.paginate<DeviceRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to search devices', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(id: string, data: Partial<Device>): Promise<Device> {
    try {
      const existing = await this.db('devices').where({ id }).first<DeviceRow>();
      if (!existing) {
        throw new NotFoundError('Device', id);
      }

      const now = new Date().toISOString();
      const updates: Partial<DeviceRow> = { updated_at: now };

      if (data.udiCarrier !== undefined) updates.udi_carrier = JSON.stringify(data.udiCarrier);
      if (data.status !== undefined) updates.status = data.status;
      if (data.type !== undefined) {
        updates.type_code = data.type?.coding?.[0]?.code;
        updates.type_system = data.type?.coding?.[0]?.system || CODE_SYSTEMS.SNOMED_CT;
        updates.type_display = data.type?.coding?.[0]?.display || data.type?.text;
      }
      if (data.manufacturer !== undefined) updates.manufacturer = data.manufacturer;
      if (data.model !== undefined) updates.model = data.model;
      if (data.serialNumber !== undefined) updates.serial_number = data.serialNumber;
      if (data.expirationDate !== undefined) updates.expiration_date = data.expirationDate;

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('devices').where({ id }).update(updates);

        const updated = await trx('devices').where({ id }).first<DeviceRow>();
        if (updated) {
          const device = this.fromRow(updated);
          const fhirResource = this.toFHIR(device);
          const fhirId = updated.fhir_id || id;
          await this.fhirClient.update('Device', fhirId, fhirResource);
        }
      });

      this.logger.info('Device updated', { deviceId: id });
      return this.getById(id);
    } catch (error) {
      this.handleError('Failed to update device', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    try {
      const existing = await this.db('devices').where({ id }).first<DeviceRow>();
      if (!existing) {
        throw new NotFoundError('Device', id);
      }

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('devices').where({ id }).delete();

        if (existing.fhir_id) {
          try {
            await this.fhirClient.delete('Device', existing.fhir_id);
          } catch (fhirError) {
            this.logger.warn('Failed to delete device from FHIR server', {
              deviceId: id,
              fhirId: existing.fhir_id,
            });
          }
        }
      });

      this.logger.info('Device deleted', { deviceId: id });
    } catch (error) {
      this.handleError('Failed to delete device', error);
    }
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: Internal -> FHIR R4 Device
  // ---------------------------------------------------------------------------

  toFHIR(device: Device): Record<string, unknown> {
    const fhirDevice: Record<string, unknown> = {
      resourceType: 'Device',
      id: device.id,
      meta: {
        profile: [US_CORE_IMPLANTABLE_DEVICE],
      },
      patient: {
        reference: `Patient/${device.patientId}`,
      },
    };

    if (device.udiCarrier?.length) {
      fhirDevice.udiCarrier = device.udiCarrier.map((udi) => {
        const carrier: Record<string, unknown> = {};
        if (udi.deviceIdentifier) carrier.deviceIdentifier = udi.deviceIdentifier;
        if (udi.issuer) carrier.issuer = udi.issuer;
        if (udi.jurisdiction) carrier.jurisdiction = udi.jurisdiction;
        if (udi.carrierAIDC) carrier.carrierAIDC = udi.carrierAIDC;
        if (udi.carrierHRF) carrier.carrierHRF = udi.carrierHRF;
        return carrier;
      });
    }

    if (device.status) {
      fhirDevice.status = device.status;
    }

    if (device.type) {
      fhirDevice.type = device.type;
    }

    if (device.manufacturer) {
      fhirDevice.manufacturer = device.manufacturer;
    }

    if (device.model) {
      fhirDevice.modelNumber = device.model;
    }

    if (device.serialNumber) {
      fhirDevice.serialNumber = device.serialNumber;
    }

    if (device.expirationDate) {
      fhirDevice.expirationDate = device.expirationDate;
    }

    return fhirDevice;
  }

  // ---------------------------------------------------------------------------
  // FHIR Mapping: FHIR R4 Device -> Internal
  // ---------------------------------------------------------------------------

  fromFHIR(fhirDevice: Record<string, unknown>): Omit<Device, 'id'> {
    return {
      patientId: ((fhirDevice.patient as Reference)?.reference || '').replace('Patient/', ''),
      udiCarrier: fhirDevice.udiCarrier as UdiCarrier[] | undefined,
      status: fhirDevice.status as DeviceStatus | undefined,
      type: fhirDevice.type as CodeableConcept | undefined,
      manufacturer: fhirDevice.manufacturer as string | undefined,
      model: fhirDevice.modelNumber as string | undefined,
      serialNumber: fhirDevice.serialNumber as string | undefined,
      expirationDate: fhirDevice.expirationDate as string | undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private fromRow(row: DeviceRow): Device {
    const type: CodeableConcept | undefined = row.type_code
      ? {
          coding: [
            {
              system: row.type_system,
              code: row.type_code,
              display: row.type_display,
            },
          ],
          text: row.type_display,
        }
      : undefined;

    return {
      id: row.id,
      patientId: row.patient_id,
      udiCarrier: row.udi_carrier ? JSON.parse(row.udi_carrier) : undefined,
      status: row.status as DeviceStatus | undefined,
      type,
      manufacturer: row.manufacturer,
      model: row.model,
      serialNumber: row.serial_number,
      expirationDate: row.expiration_date,
    };
  }
}

export const deviceService = new DeviceService();
