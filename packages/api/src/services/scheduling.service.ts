// =============================================================================
// Appointment Scheduling Service
// Supports multi-provider, multi-location scheduling with double-booking
// prevention and FHIR Appointment resource synchronization.
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type AppointmentStatus =
  | 'proposed'
  | 'pending'
  | 'booked'
  | 'arrived'
  | 'fulfilled'
  | 'cancelled'
  | 'noshow'
  | 'entered-in-error'
  | 'checked-in';

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  locationId?: string;
  encounterId?: string;
  status: AppointmentStatus;
  appointmentType: string;
  reasonCode?: string;
  reasonDisplay?: string;
  description?: string;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  checkInTime?: string;
  checkOutTime?: string;
  cancelReason?: string;
  cancelledBy?: string;
  patientInstructions?: string;
  comment?: string;
  recurringId?: string;
  fhirId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentDTO {
  patientId: string;
  providerId: string;
  locationId?: string;
  appointmentType: string;
  reasonCode?: string;
  reasonDisplay?: string;
  description?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  patientInstructions?: string;
  comment?: string;
}

export interface UpdateAppointmentDTO {
  providerId?: string;
  locationId?: string;
  appointmentType?: string;
  reasonCode?: string;
  reasonDisplay?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  patientInstructions?: string;
  comment?: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  duration: number;
  available: boolean;
}

export interface AppointmentSearchParams extends PaginationParams {
  patientId?: string;
  providerId?: string;
  locationId?: string;
  status?: AppointmentStatus;
  startDate?: string;
  endDate?: string;
  appointmentType?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Appointment Type Configuration
// -----------------------------------------------------------------------------

const APPOINTMENT_TYPES: Record<string, { name: string; defaultDuration: number; color?: string }> = {
  'new-patient': { name: 'New Patient Visit', defaultDuration: 60, color: '#4CAF50' },
  'follow-up': { name: 'Follow-Up Visit', defaultDuration: 30, color: '#2196F3' },
  'annual-wellness': { name: 'Annual Wellness Exam', defaultDuration: 45, color: '#9C27B0' },
  'urgent': { name: 'Urgent Visit', defaultDuration: 30, color: '#F44336' },
  'telehealth': { name: 'Telehealth Visit', defaultDuration: 20, color: '#00BCD4' },
  'procedure': { name: 'Procedure', defaultDuration: 60, color: '#FF9800' },
  'lab-only': { name: 'Lab Only', defaultDuration: 15, color: '#795548' },
  'immunization': { name: 'Immunization Visit', defaultDuration: 15, color: '#607D8B' },
  'prenatal': { name: 'Prenatal Visit', defaultDuration: 30, color: '#E91E63' },
  'well-child': { name: 'Well-Child Check', defaultDuration: 30, color: '#8BC34A' },
  'behavioral-health': { name: 'Behavioral Health', defaultDuration: 45, color: '#673AB7' },
  'dental': { name: 'Dental Visit', defaultDuration: 60, color: '#3F51B5' },
  'physical-therapy': { name: 'Physical Therapy', defaultDuration: 45, color: '#CDDC39' },
  'group-visit': { name: 'Group Visit', defaultDuration: 90, color: '#FFC107' },
};

// Default provider schedule: 8 AM to 5 PM with 1-hour lunch at noon
const DEFAULT_SCHEDULE = {
  startHour: 8,
  startMinute: 0,
  endHour: 17,
  endMinute: 0,
  lunchStartHour: 12,
  lunchStartMinute: 0,
  lunchEndHour: 13,
  lunchEndMinute: 0,
  slotDuration: 15, // minutes
};

// -----------------------------------------------------------------------------
// Database Row
// -----------------------------------------------------------------------------

interface AppointmentRow {
  id: string;
  patient_id: string;
  provider_id: string;
  location_id?: string;
  encounter_id?: string;
  status: string;
  appointment_type: string;
  reason_code?: string;
  reason_display?: string;
  description?: string;
  start_time: string;
  end_time: string;
  duration: number;
  check_in_time?: string;
  check_out_time?: string;
  cancel_reason?: string;
  cancelled_by?: string;
  patient_instructions?: string;
  comment?: string;
  recurring_id?: string;
  fhir_id?: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class SchedulingService extends BaseService {
  constructor() {
    super('SchedulingService');
  }

  // ---------------------------------------------------------------------------
  // Create Appointment
  // ---------------------------------------------------------------------------

  async createAppointment(data: CreateAppointmentDTO): Promise<Appointment> {
    try {
      if (!data.patientId) {
        throw new ValidationError('patientId is required');
      }
      if (!data.providerId) {
        throw new ValidationError('providerId is required');
      }
      if (!data.startTime) {
        throw new ValidationError('startTime is required');
      }
      if (!data.appointmentType) {
        throw new ValidationError('appointmentType is required');
      }

      // Validate patient exists
      await this.requireExists('patients', data.patientId, 'Patient');

      // Determine duration
      const typeConfig = APPOINTMENT_TYPES[data.appointmentType];
      const duration = data.duration || typeConfig?.defaultDuration || 30;

      // Calculate end time
      const startTime = new Date(data.startTime);
      if (isNaN(startTime.getTime())) {
        throw new ValidationError('Invalid startTime format');
      }

      const endTime = data.endTime
        ? new Date(data.endTime)
        : new Date(startTime.getTime() + duration * 60 * 1000);

      if (isNaN(endTime.getTime())) {
        throw new ValidationError('Invalid endTime format');
      }

      if (endTime <= startTime) {
        throw new ValidationError('endTime must be after startTime');
      }

      // Check for double-booking (same provider, overlapping time)
      const conflicts = await this.db('appointments')
        .where('provider_id', data.providerId)
        .whereNotIn('status', ['cancelled', 'noshow', 'entered-in-error'])
        .where(function (this: Knex.QueryBuilder) {
          this.where(function (this: Knex.QueryBuilder) {
            this.where('start_time', '<', endTime.toISOString())
              .where('end_time', '>', startTime.toISOString());
          });
        })
        .select('id', 'start_time', 'end_time', 'patient_id');

      if (conflicts.length > 0) {
        throw new ConflictError(
          `Provider has a conflicting appointment from ${conflicts[0].start_time} to ${conflicts[0].end_time}`,
          { conflictingAppointments: conflicts.map((c: Record<string, unknown>) => c.id) }
        );
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      const row: AppointmentRow = {
        id,
        patient_id: data.patientId,
        provider_id: data.providerId,
        location_id: data.locationId,
        status: 'booked',
        appointment_type: data.appointmentType,
        reason_code: data.reasonCode,
        reason_display: data.reasonDisplay,
        description: data.description,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration,
        patient_instructions: data.patientInstructions,
        comment: data.comment,
        created_at: now,
        updated_at: now,
      };

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('appointments').insert(row);

        // Sync to FHIR Appointment resource
        const fhirAppointment = {
          resourceType: 'Appointment',
          status: 'booked',
          appointmentType: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0276',
                code: data.appointmentType,
                display: typeConfig?.name || data.appointmentType,
              },
            ],
          },
          reasonCode: data.reasonCode
            ? [{ coding: [{ code: data.reasonCode, display: data.reasonDisplay }] }]
            : undefined,
          description: data.description,
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          minutesDuration: duration,
          participant: [
            {
              actor: { reference: `Patient/${data.patientId}` },
              status: 'accepted',
            },
            {
              actor: { reference: `Practitioner/${data.providerId}` },
              status: 'accepted',
            },
          ],
          comment: data.comment,
          patientInstruction: data.patientInstructions,
        };

        try {
          const fhirResult = await this.fhirClient.create<Record<string, unknown>>('Appointment', fhirAppointment);
          if (fhirResult.id) {
            await trx('appointments').where({ id }).update({ fhir_id: fhirResult.id as string });
          }
        } catch (fhirError) {
          this.logger.warn('Failed to sync appointment to FHIR server', { appointmentId: id, error: fhirError });
        }
      });

      this.logger.info('Appointment created', {
        appointmentId: id,
        patientId: data.patientId,
        providerId: data.providerId,
        type: data.appointmentType,
        start: startTime.toISOString(),
      });

      return this.getAppointment(id);
    } catch (error) {
      this.handleError('Failed to create appointment', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update Appointment
  // ---------------------------------------------------------------------------

  async updateAppointment(id: string, data: UpdateAppointmentDTO): Promise<Appointment> {
    try {
      const existing = await this.db('appointments').where({ id }).first<AppointmentRow>();
      if (!existing) {
        throw new NotFoundError('Appointment', id);
      }

      if (['cancelled', 'fulfilled', 'entered-in-error'].includes(existing.status)) {
        throw new ConflictError(`Cannot update appointment with status '${existing.status}'`);
      }

      const now = new Date().toISOString();
      const updates: Partial<AppointmentRow> = { updated_at: now };

      if (data.providerId !== undefined) updates.provider_id = data.providerId;
      if (data.locationId !== undefined) updates.location_id = data.locationId;
      if (data.appointmentType !== undefined) updates.appointment_type = data.appointmentType;
      if (data.reasonCode !== undefined) updates.reason_code = data.reasonCode;
      if (data.reasonDisplay !== undefined) updates.reason_display = data.reasonDisplay;
      if (data.description !== undefined) updates.description = data.description;
      if (data.patientInstructions !== undefined) updates.patient_instructions = data.patientInstructions;
      if (data.comment !== undefined) updates.comment = data.comment;

      // Handle time changes with double-booking check
      if (data.startTime || data.endTime || data.duration) {
        const startTime = data.startTime ? new Date(data.startTime) : new Date(existing.start_time);
        const duration = data.duration || existing.duration;
        const endTime = data.endTime
          ? new Date(data.endTime)
          : new Date(startTime.getTime() + duration * 60 * 1000);

        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          throw new ValidationError('Invalid date format');
        }

        if (endTime <= startTime) {
          throw new ValidationError('endTime must be after startTime');
        }

        const providerId = data.providerId || existing.provider_id;

        // Check double-booking (exclude current appointment)
        const conflicts = await this.db('appointments')
          .where('provider_id', providerId)
          .whereNot('id', id)
          .whereNotIn('status', ['cancelled', 'noshow', 'entered-in-error'])
          .where(function (this: Knex.QueryBuilder) {
            this.where('start_time', '<', endTime.toISOString())
              .where('end_time', '>', startTime.toISOString());
          })
          .select('id');

        if (conflicts.length > 0) {
          throw new ConflictError('Updated time conflicts with an existing appointment', {
            conflictingAppointments: conflicts.map((c: Record<string, unknown>) => c.id),
          });
        }

        updates.start_time = startTime.toISOString();
        updates.end_time = endTime.toISOString();
        updates.duration = duration;
      }

      await this.db('appointments').where({ id }).update(updates);

      this.logger.info('Appointment updated', { appointmentId: id });

      return this.getAppointment(id);
    } catch (error) {
      this.handleError('Failed to update appointment', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Cancel Appointment
  // ---------------------------------------------------------------------------

  async cancelAppointment(id: string, reason: string, cancelledBy: string): Promise<Appointment> {
    try {
      const existing = await this.db('appointments').where({ id }).first<AppointmentRow>();
      if (!existing) {
        throw new NotFoundError('Appointment', id);
      }

      if (['cancelled', 'fulfilled', 'entered-in-error'].includes(existing.status)) {
        throw new ConflictError(`Cannot cancel appointment with status '${existing.status}'`);
      }

      const now = new Date().toISOString();

      await this.db('appointments').where({ id }).update({
        status: 'cancelled',
        cancel_reason: reason,
        cancelled_by: cancelledBy,
        updated_at: now,
      });

      this.logger.info('Appointment cancelled', { appointmentId: id, reason, cancelledBy });

      return this.getAppointment(id);
    } catch (error) {
      this.handleError('Failed to cancel appointment', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Check In
  // ---------------------------------------------------------------------------

  async checkIn(appointmentId: string): Promise<Appointment> {
    try {
      const existing = await this.db('appointments').where({ id: appointmentId }).first<AppointmentRow>();
      if (!existing) {
        throw new NotFoundError('Appointment', appointmentId);
      }

      if (existing.status !== 'booked' && existing.status !== 'arrived') {
        throw new ConflictError(`Cannot check in appointment with status '${existing.status}'. Expected 'booked' or 'arrived'.`);
      }

      const now = new Date().toISOString();

      await this.db('appointments').where({ id: appointmentId }).update({
        status: 'checked-in',
        check_in_time: now,
        updated_at: now,
      });

      this.logger.info('Patient checked in', { appointmentId });

      return this.getAppointment(appointmentId);
    } catch (error) {
      this.handleError('Failed to check in patient', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Check Out
  // ---------------------------------------------------------------------------

  async checkOut(appointmentId: string): Promise<Appointment> {
    try {
      const existing = await this.db('appointments').where({ id: appointmentId }).first<AppointmentRow>();
      if (!existing) {
        throw new NotFoundError('Appointment', appointmentId);
      }

      if (existing.status !== 'checked-in' && existing.status !== 'arrived') {
        throw new ConflictError(`Cannot check out appointment with status '${existing.status}'. Expected 'checked-in' or 'arrived'.`);
      }

      const now = new Date().toISOString();

      await this.db('appointments').where({ id: appointmentId }).update({
        status: 'fulfilled',
        check_out_time: now,
        updated_at: now,
      });

      this.logger.info('Patient checked out', { appointmentId });

      return this.getAppointment(appointmentId);
    } catch (error) {
      this.handleError('Failed to check out patient', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Single Appointment
  // ---------------------------------------------------------------------------

  async getAppointment(id: string): Promise<Appointment> {
    try {
      const row = await this.db('appointments').where({ id }).first<AppointmentRow>();
      if (!row) {
        throw new NotFoundError('Appointment', id);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get appointment', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Provider Schedule (all appointments for a given date)
  // ---------------------------------------------------------------------------

  async getProviderSchedule(providerId: string, date: string): Promise<Appointment[]> {
    try {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(`${date}T23:59:59.999Z`);

      if (isNaN(dayStart.getTime())) {
        throw new ValidationError('Invalid date format. Use YYYY-MM-DD.');
      }

      const rows = await this.db('appointments')
        .where('provider_id', providerId)
        .where('start_time', '>=', dayStart.toISOString())
        .where('start_time', '<=', dayEnd.toISOString())
        .whereNotIn('status', ['cancelled', 'entered-in-error'])
        .orderBy('start_time', 'asc') as AppointmentRow[];

      return rows.map((row) => this.fromRow(row));
    } catch (error) {
      this.handleError('Failed to get provider schedule', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Patient Appointments
  // ---------------------------------------------------------------------------

  async getPatientAppointments(params: AppointmentSearchParams): Promise<PaginatedResult<Appointment>> {
    try {
      const query = this.db('appointments').select('*');

      if (params.patientId) {
        query.where('patient_id', params.patientId);
      }
      if (params.providerId) {
        query.where('provider_id', params.providerId);
      }
      if (params.locationId) {
        query.where('location_id', params.locationId);
      }
      if (params.status) {
        query.where('status', params.status);
      }
      if (params.appointmentType) {
        query.where('appointment_type', params.appointmentType);
      }
      if (params.startDate) {
        query.where('start_time', '>=', params.startDate);
      }
      if (params.endDate) {
        query.where('start_time', '<=', params.endDate);
      }

      const allowedSortColumns: Record<string, string> = {
        startTime: 'start_time',
        status: 'status',
        appointmentType: 'appointment_type',
        createdAt: 'created_at',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      if (!params.sort) {
        query.orderBy('start_time', 'desc');
      }

      const result = await this.paginate<AppointmentRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to get patient appointments', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Available Slots
  // ---------------------------------------------------------------------------

  async getAvailableSlots(providerId: string, date: string, duration?: number): Promise<TimeSlot[]> {
    try {
      const slotDuration = duration || DEFAULT_SCHEDULE.slotDuration;

      const dayStart = new Date(`${date}T00:00:00.000Z`);
      if (isNaN(dayStart.getTime())) {
        throw new ValidationError('Invalid date format. Use YYYY-MM-DD.');
      }

      // Get provider's schedule configuration (or use defaults)
      const providerSchedule = await this.db('provider_schedules')
        .where({ provider_id: providerId })
        .first() as { start_hour?: number; end_hour?: number; lunch_start_hour?: number; lunch_end_hour?: number; slot_duration?: number } | undefined;

      const schedule = {
        startHour: providerSchedule?.start_hour ?? DEFAULT_SCHEDULE.startHour,
        endHour: providerSchedule?.end_hour ?? DEFAULT_SCHEDULE.endHour,
        lunchStartHour: providerSchedule?.lunch_start_hour ?? DEFAULT_SCHEDULE.lunchStartHour,
        lunchEndHour: providerSchedule?.lunch_end_hour ?? DEFAULT_SCHEDULE.lunchEndHour,
      };

      // Get existing appointments for this day
      const dayEnd = new Date(`${date}T23:59:59.999Z`);
      const existingAppointments = await this.db('appointments')
        .where('provider_id', providerId)
        .where('start_time', '>=', dayStart.toISOString())
        .where('start_time', '<=', dayEnd.toISOString())
        .whereNotIn('status', ['cancelled', 'noshow', 'entered-in-error'])
        .orderBy('start_time', 'asc')
        .select('start_time', 'end_time') as Array<{ start_time: string; end_time: string }>;

      // Generate all possible slots
      const slots: TimeSlot[] = [];
      const scheduleStart = new Date(dayStart);
      scheduleStart.setUTCHours(schedule.startHour, 0, 0, 0);

      const scheduleEnd = new Date(dayStart);
      scheduleEnd.setUTCHours(schedule.endHour, 0, 0, 0);

      const lunchStart = new Date(dayStart);
      lunchStart.setUTCHours(schedule.lunchStartHour, 0, 0, 0);

      const lunchEnd = new Date(dayStart);
      lunchEnd.setUTCHours(schedule.lunchEndHour, 0, 0, 0);

      let current = new Date(scheduleStart);

      while (current < scheduleEnd) {
        const slotEnd = new Date(current.getTime() + slotDuration * 60 * 1000);

        if (slotEnd > scheduleEnd) break;

        // Check if slot is during lunch
        const isDuringLunch = current < lunchEnd && slotEnd > lunchStart;

        // Check if slot conflicts with existing appointments
        const hasConflict = existingAppointments.some((appt) => {
          const apptStart = new Date(appt.start_time);
          const apptEnd = new Date(appt.end_time);
          return current < apptEnd && slotEnd > apptStart;
        });

        // Check if slot is in the past
        const isPast = current < new Date();

        const available = !isDuringLunch && !hasConflict && !isPast;

        slots.push({
          startTime: current.toISOString(),
          endTime: slotEnd.toISOString(),
          duration: slotDuration,
          available,
        });

        current = new Date(slotEnd);
      }

      return slots;
    } catch (error) {
      this.handleError('Failed to get available slots', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Appointment Types
  // ---------------------------------------------------------------------------

  getAppointmentTypes(): Record<string, { name: string; defaultDuration: number; color?: string }> {
    return APPOINTMENT_TYPES;
  }

  // ===========================================================================
  // Row Mapping
  // ===========================================================================

  private fromRow(row: AppointmentRow): Appointment {
    return {
      id: row.id,
      patientId: row.patient_id,
      providerId: row.provider_id,
      locationId: row.location_id,
      encounterId: row.encounter_id,
      status: row.status as AppointmentStatus,
      appointmentType: row.appointment_type,
      reasonCode: row.reason_code,
      reasonDisplay: row.reason_display,
      description: row.description,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      checkInTime: row.check_in_time,
      checkOutTime: row.check_out_time,
      cancelReason: row.cancel_reason,
      cancelledBy: row.cancelled_by,
      patientInstructions: row.patient_instructions,
      comment: row.comment,
      recurringId: row.recurring_id,
      fhirId: row.fhir_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const schedulingService = new SchedulingService();
