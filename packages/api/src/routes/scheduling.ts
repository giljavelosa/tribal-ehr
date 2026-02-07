// =============================================================================
// Scheduling Routes
// POST   /appointments                    - Create appointment
// PUT    /appointments/:id                - Update appointment
// POST   /appointments/:id/check-in       - Check in
// POST   /appointments/:id/check-out      - Check out
// DELETE /appointments/:id                - Cancel appointment
// GET    /appointments                    - Search appointments
// GET    /appointments/:id                - Get single appointment
// GET    /appointment-types               - Get appointment type configuration
// GET    /providers/:id/schedule           - Get provider daily schedule
// GET    /providers/:id/available-slots    - Get available time slots
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { schedulingService, AppointmentStatus } from '../services/scheduling.service';
import { authenticate } from '../middleware/auth';

const router = Router();

// ---------------------------------------------------------------------------
// Recurrence helpers
// ---------------------------------------------------------------------------
interface RecurrenceOptions {
  pattern: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  endDate?: string;
  occurrences?: number;
}

function getRecurrenceIntervalMs(pattern: RecurrenceOptions['pattern']): number {
  const DAY_MS = 24 * 60 * 60 * 1000;
  switch (pattern) {
    case 'weekly':
      return 7 * DAY_MS;
    case 'biweekly':
      return 14 * DAY_MS;
    case 'monthly':
      return 30 * DAY_MS;
    case 'quarterly':
      return 91 * DAY_MS;
    default:
      return 7 * DAY_MS;
  }
}

const MAX_RECURRING_APPOINTMENTS = 52; // Safety cap

// ---------------------------------------------------------------------------
// Create Appointment (with optional recurrence)
// ---------------------------------------------------------------------------
router.post(
  '/appointments',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const baseData = {
        patientId: req.body.patientId,
        providerId: req.body.providerId,
        locationId: req.body.locationId,
        appointmentType: req.body.appointmentType,
        reasonCode: req.body.reasonCode,
        reasonDisplay: req.body.reasonDisplay,
        description: req.body.description,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        duration: req.body.duration,
        patientInstructions: req.body.patientInstructions,
        comment: req.body.comment,
      };

      const recurrence: RecurrenceOptions | undefined = req.body.recurrence;

      // If no recurrence, create a single appointment
      if (!recurrence || !recurrence.pattern) {
        const appointment = await schedulingService.createAppointment(baseData);
        return res.status(201).json({ data: appointment });
      }

      // Validate recurrence pattern
      const validPatterns = ['weekly', 'biweekly', 'monthly', 'quarterly'];
      if (!validPatterns.includes(recurrence.pattern)) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid recurrence pattern. Must be one of: ${validPatterns.join(', ')}`,
          },
        });
      }

      // Determine how many appointments to create
      const intervalMs = getRecurrenceIntervalMs(recurrence.pattern);
      const baseStart = new Date(baseData.startTime);
      let count = recurrence.occurrences || MAX_RECURRING_APPOINTMENTS;

      if (recurrence.endDate) {
        const end = new Date(recurrence.endDate);
        const maxByDate = Math.floor((end.getTime() - baseStart.getTime()) / intervalMs) + 1;
        count = Math.min(count, maxByDate);
      }

      count = Math.min(Math.max(count, 1), MAX_RECURRING_APPOINTMENTS);

      // Calculate base duration for offset on endTime
      const baseDuration = baseData.duration || 30;
      const baseEnd = baseData.endTime ? new Date(baseData.endTime) : null;
      const durationMs = baseDuration * 60 * 1000;

      const appointments = [];
      const errors = [];

      for (let i = 0; i < count; i++) {
        const offsetMs = i * intervalMs;
        const start = new Date(baseStart.getTime() + offsetMs);
        const end = baseEnd
          ? new Date(baseEnd.getTime() + offsetMs)
          : new Date(start.getTime() + durationMs);

        try {
          const appt = await schedulingService.createAppointment({
            ...baseData,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
          });
          appointments.push(appt);
        } catch (err: any) {
          // Log conflict but continue creating remaining appointments
          errors.push({
            index: i,
            date: start.toISOString(),
            message: err.message || 'Failed to create appointment',
          });
        }
      }

      res.status(201).json({
        data: appointments,
        recurrence: {
          pattern: recurrence.pattern,
          requested: count,
          created: appointments.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Update Appointment
// ---------------------------------------------------------------------------
router.put(
  '/appointments/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appointment = await schedulingService.updateAppointment(
        req.params.id,
        {
          providerId: req.body.providerId,
          locationId: req.body.locationId,
          appointmentType: req.body.appointmentType,
          reasonCode: req.body.reasonCode,
          reasonDisplay: req.body.reasonDisplay,
          description: req.body.description,
          startTime: req.body.startTime,
          endTime: req.body.endTime,
          duration: req.body.duration,
          patientInstructions: req.body.patientInstructions,
          comment: req.body.comment,
        }
      );

      res.json({ data: appointment });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Check In
// ---------------------------------------------------------------------------
router.post(
  '/appointments/:id/check-in',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appointment = await schedulingService.checkIn(req.params.id);
      res.json({ data: appointment });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Check Out
// ---------------------------------------------------------------------------
router.post(
  '/appointments/:id/check-out',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appointment = await schedulingService.checkOut(req.params.id);
      res.json({ data: appointment });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Cancel Appointment
// ---------------------------------------------------------------------------
router.delete(
  '/appointments/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appointment = await schedulingService.cancelAppointment(
        req.params.id,
        req.body.reason || req.query.reason as string || 'Cancelled by user',
        req.user!.id
      );
      res.json({ data: appointment });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Appointment Types
// ---------------------------------------------------------------------------
router.get(
  '/appointment-types',
  authenticate,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const types = schedulingService.getAppointmentTypes();
      res.json({ data: types });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Search Appointments
// ---------------------------------------------------------------------------
router.get(
  '/appointments',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await schedulingService.getPatientAppointments({
        patientId: req.query.patientId as string,
        providerId: req.query.providerId as string,
        locationId: req.query.locationId as string,
        status: req.query.status as AppointmentStatus | undefined,
        appointmentType: req.query.appointmentType as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        sort: req.query.sort as string,
        order: req.query.order as 'asc' | 'desc' | undefined,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Single Appointment
// ---------------------------------------------------------------------------
router.get(
  '/appointments/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appointment = await schedulingService.getAppointment(req.params.id);
      res.json({ data: appointment });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Provider Daily Schedule
// ---------------------------------------------------------------------------
router.get(
  '/providers/:id/schedule',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = req.query.date as string;
      if (!date) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'date query parameter is required (YYYY-MM-DD)',
          },
        });
      }

      const schedule = await schedulingService.getProviderSchedule(req.params.id, date);
      res.json({ data: schedule });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Available Time Slots
// ---------------------------------------------------------------------------
router.get(
  '/providers/:id/available-slots',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = req.query.date as string;
      if (!date) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'date query parameter is required (YYYY-MM-DD)',
          },
        });
      }

      const duration = req.query.duration
        ? parseInt(req.query.duration as string, 10)
        : undefined;

      const slots = await schedulingService.getAvailableSlots(
        req.params.id,
        date,
        duration
      );

      res.json({ data: slots });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
