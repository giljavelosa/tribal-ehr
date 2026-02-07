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
// Create Appointment
// ---------------------------------------------------------------------------
router.post(
  '/appointments',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appointment = await schedulingService.createAppointment({
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
      });

      res.status(201).json({ data: appointment });
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
