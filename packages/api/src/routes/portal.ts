// =============================================================================
// Patient Portal Routes - All patient-facing API endpoints
// Mounted at /api/v1/portal
//
// GET    /me                       - Get current patient basic info
// GET    /me/dashboard             - Get dashboard summary data
// GET    /me/health-summary        - Get full health summary (conditions, meds, etc.)
// GET    /me/care-team             - Get patient's care team
// GET    /me/medications            - Get medications (active/inactive)
// GET    /me/allergies              - Get allergy list
// GET    /me/conditions             - Get conditions list
// GET    /me/immunizations          - Get immunizations list
// GET    /me/vitals                 - Get recent vitals
// GET    /me/results                - Get lab/test results
// GET    /me/results/:id            - Get single result detail
// GET    /me/results/:id/trend      - Get trend data for a result
// GET    /me/appointments           - Get appointments (upcoming/past)
// POST   /me/appointment-requests   - Request a new appointment
// DELETE /me/appointment-requests/:id - Cancel an appointment request
// GET    /me/documents              - Get patient documents
// GET    /me/documents/:id/download - Download a document
// POST   /me/refill-requests        - Request medication refill
// GET    /me/refill-requests        - Get refill request history
// GET    /me/messages               - Get messages (inbox)
// GET    /me/messages/:threadId     - Get message thread
// POST   /me/messages               - Send new message
// POST   /me/messages/:threadId/reply - Reply to a message thread
// GET    /me/export/ccda            - Export records as C-CDA XML
// GET    /me/export/fhir            - Export records as FHIR JSON Bundle
// GET    /me/export/pdf             - Export health summary as PDF-ready JSON
// GET    /me/profile                - Get full patient profile
// PUT    /me/profile                - Update patient demographics
// GET    /me/preferences            - Get notification preferences
// PUT    /me/preferences            - Update notification preferences
// PUT    /me/password               - Change password
// GET    /me/proxies                - Get proxy access list
// POST   /me/proxies                - Add proxy user
// DELETE /me/proxies/:id            - Remove proxy user
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { auditService } from '../services/audit.service';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';

const router = Router();

// All portal routes require authentication and patient role
router.use(authenticate, requireRole('PATIENT', 'patient'));

// Helper: get patientId from authenticated user or throw
function getPatientId(req: Request): string {
  const patientId = (req.user as any)?.patientId || (req.user as any)?.id;
  if (!patientId) {
    throw new ValidationError('User is not linked to a patient record');
  }
  return patientId;
}

// ---------------------------------------------------------------------------
// GET /me - Basic patient info
// ---------------------------------------------------------------------------
router.get(
  '/me',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const patient = await db('patients').where({ id: patientId }).first();
      if (!patient) {
        throw new NotFoundError('Patient', patientId);
      }

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'Patient',
        resourceId: patientId,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        data: {
          id: patient.id,
          firstName: patient.first_name,
          lastName: patient.last_name,
          dateOfBirth: patient.date_of_birth,
          gender: patient.gender,
          mrn: patient.mrn,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/dashboard - Dashboard summary data
// ---------------------------------------------------------------------------
router.get(
  '/me/dashboard',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();
      const now = new Date().toISOString();

      const [
        upcomingAppointments,
        unreadMessages,
        recentResults,
        activeMedications,
        pendingRefills,
      ] = await Promise.all([
        db('appointments')
          .where({ patient_id: patientId })
          .where('start_time', '>=', now)
          .whereIn('status', ['booked', 'pending'])
          .orderBy('start_time', 'asc')
          .limit(5),
        db('messages')
          .where({ recipient_id: req.user!.id, read: false })
          .count('* as count')
          .first(),
        db('observations')
          .where({ patient_id: patientId, category: 'laboratory' })
          .orderBy('effective_date', 'desc')
          .limit(5),
        db('medication_requests')
          .where({ patient_id: patientId, status: 'active' })
          .select('*'),
        db('refill_requests')
          .where({ patient_id: patientId, status: 'pending' })
          .count('* as count')
          .first(),
      ]);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'PatientDashboard',
        resourceId: patientId,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        data: {
          upcomingAppointments,
          unreadMessageCount: parseInt(String((unreadMessages as any)?.count || 0), 10),
          recentResults,
          activeMedicationCount: activeMedications.length,
          medicationsNeedingRefill: activeMedications.filter(
            (m: any) => m.refills_remaining !== undefined && m.refills_remaining <= 1,
          ),
          pendingRefillCount: parseInt(String((pendingRefills as any)?.count || 0), 10),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/health-summary - Full health summary
// ---------------------------------------------------------------------------
router.get(
  '/me/health-summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const [conditions, medications, allergies, immunizations, recentVitals] =
        await Promise.all([
          db('conditions')
            .where({ patient_id: patientId, clinical_status: 'active' })
            .select('*')
            .orderBy('onset_date', 'desc'),
          db('medication_requests')
            .where({ patient_id: patientId, status: 'active' })
            .select('*')
            .orderBy('authored_on', 'desc'),
          db('allergy_intolerances')
            .where({ patient_id: patientId, clinical_status: 'active' })
            .select('*'),
          db('immunizations')
            .where({ patient_id: patientId })
            .select('*')
            .orderBy('occurrence_date', 'desc')
            .limit(50),
          db('observations')
            .where({ patient_id: patientId })
            .whereIn('category', ['vital-signs'])
            .select('*')
            .orderBy('effective_date', 'desc')
            .limit(20),
        ]);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'HealthSummary',
        resourceId: patientId,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: 'Patient viewed health summary',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        data: {
          conditions,
          medications,
          allergies,
          immunizations,
          recentVitals,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/care-team - Get patient's care team
// ---------------------------------------------------------------------------
router.get(
  '/me/care-team',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const careTeam = await db('care_team_members')
        .join('providers', 'care_team_members.provider_id', 'providers.id')
        .where({ 'care_team_members.patient_id': patientId })
        .select(
          'providers.id',
          'providers.first_name',
          'providers.last_name',
          'providers.specialty',
          'providers.npi',
          'care_team_members.role as teamRole',
          'providers.user_id',
        );

      res.json({ data: careTeam });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/medications - Get medications
// ---------------------------------------------------------------------------
router.get(
  '/me/medications',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();
      const status = (req.query.status as string) || 'active';

      const query = db('medication_requests')
        .where({ patient_id: patientId })
        .select('*')
        .orderBy('authored_on', 'desc');

      if (status !== 'all') {
        query.andWhere('status', status);
      }

      const medications = await query;
      res.json({ data: medications });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/allergies - Get allergies
// ---------------------------------------------------------------------------
router.get(
  '/me/allergies',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const allergies = await db('allergy_intolerances')
        .where({ patient_id: patientId, clinical_status: 'active' })
        .select('*');

      res.json({ data: allergies });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/conditions - Get conditions
// ---------------------------------------------------------------------------
router.get(
  '/me/conditions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const conditions = await db('conditions')
        .where({ patient_id: patientId })
        .select('*')
        .orderBy('onset_date', 'desc');

      res.json({ data: conditions });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/immunizations - Get immunizations
// ---------------------------------------------------------------------------
router.get(
  '/me/immunizations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const immunizations = await db('immunizations')
        .where({ patient_id: patientId })
        .select('*')
        .orderBy('occurrence_date', 'desc');

      res.json({ data: immunizations });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/vitals - Get recent vitals
// ---------------------------------------------------------------------------
router.get(
  '/me/vitals',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const vitals = await db('observations')
        .where({ patient_id: patientId, category: 'vital-signs' })
        .select('*')
        .orderBy('effective_date', 'desc')
        .limit(50);

      res.json({ data: vitals });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/results - Get lab/test results
// ---------------------------------------------------------------------------
router.get(
  '/me/results',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const category = (req.query.category as string) || 'laboratory';

      const results = await db('observations')
        .where({ patient_id: patientId, category })
        .select('*')
        .orderBy('effective_date', 'desc')
        .limit(200);

      res.json({ data: results });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/results/:id - Get single result detail
// ---------------------------------------------------------------------------
router.get(
  '/me/results/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const result = await db('observations')
        .where({ id: req.params.id, patient_id: patientId })
        .first();

      if (!result) {
        throw new NotFoundError('Observation', req.params.id);
      }

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'Observation',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: 'Patient viewed test result detail',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/results/:id/trend - Get trend data for a specific test
// ---------------------------------------------------------------------------
router.get(
  '/me/results/:id/trend',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      // First get the result to find its code (test type)
      const result = await db('observations')
        .where({ id: req.params.id, patient_id: patientId })
        .first();

      if (!result) {
        throw new NotFoundError('Observation', req.params.id);
      }

      // Then get all historical results for the same test type
      const trendData = await db('observations')
        .where({ patient_id: patientId, code: result.code })
        .select('id', 'value_quantity', 'value_unit', 'effective_date', 'reference_range_low', 'reference_range_high', 'interpretation')
        .orderBy('effective_date', 'asc')
        .limit(50);

      res.json({ data: trendData });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/appointments - Get appointments
// ---------------------------------------------------------------------------
router.get(
  '/me/appointments',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();
      const upcoming = req.query.upcoming === 'true';
      const now = new Date().toISOString();

      const query = db('appointments')
        .where({ patient_id: patientId })
        .select('*');

      if (upcoming) {
        query.andWhere('start_time', '>=', now);
        query.whereIn('status', ['booked', 'pending']);
        query.orderBy('start_time', 'asc');
      } else {
        query.orderBy('start_time', 'desc');
      }

      const appointments = await query.limit(100);
      res.json({ data: appointments });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /me/appointment-requests - Request a new appointment
// ---------------------------------------------------------------------------
router.post(
  '/me/appointment-requests',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);

      const { preferredProvider, preferredDateFrom, preferredDateTo, preferredTimeOfDay, reason, notes } = req.body;

      if (!reason) {
        throw new ValidationError('reason is required');
      }

      const { v4: uuidv4 } = await import('uuid');
      const db = (await import('../config/database')).getDb();
      const now = new Date().toISOString();
      const id = uuidv4();

      await db('appointment_requests').insert({
        id,
        patient_id: patientId,
        provider_id: preferredProvider || null,
        preferred_date_from: preferredDateFrom || null,
        preferred_date_to: preferredDateTo || null,
        preferred_time_of_day: preferredTimeOfDay || null,
        reason,
        notes: notes || '',
        status: 'pending',
        created_at: now,
        updated_at: now,
      });

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'AppointmentRequest',
        resourceId: id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: 'Patient requested appointment',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      const request = await db('appointment_requests').where({ id }).first();
      res.status(201).json({ data: request });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /me/appointment-requests/:id - Cancel an appointment request
// ---------------------------------------------------------------------------
router.delete(
  '/me/appointment-requests/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const appointment = await db('appointments')
        .where({ id: req.params.id, patient_id: patientId })
        .first();

      if (!appointment) {
        throw new NotFoundError('Appointment', req.params.id);
      }

      if (!['booked', 'pending'].includes(appointment.status)) {
        throw new ValidationError('Only booked or pending appointments can be cancelled');
      }

      await db('appointments')
        .where({ id: req.params.id })
        .update({ status: 'cancelled', updated_at: new Date().toISOString() });

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'Appointment',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'DELETE',
        statusCode: 200,
        clinicalContext: 'Patient cancelled appointment',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: { id: req.params.id, status: 'cancelled' } });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /me/appointments/:id/cancel - Cancel a booked appointment
// ---------------------------------------------------------------------------
router.post(
  '/me/appointments/:id/cancel',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const appointment = await db('appointments')
        .where({ id: req.params.id, patient_id: patientId })
        .first();

      if (!appointment) {
        throw new NotFoundError('Appointment', req.params.id);
      }

      if (!['booked', 'pending'].includes(appointment.status)) {
        throw new ValidationError('Only booked or pending appointments can be cancelled');
      }

      await db('appointments')
        .where({ id: req.params.id })
        .update({ status: 'cancelled', cancel_reason: 'Cancelled by patient', updated_at: new Date().toISOString() });

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'Appointment',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 200,
        clinicalContext: 'Patient cancelled appointment via portal',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: { id: req.params.id, status: 'cancelled' } });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/documents - Get patient documents
// ---------------------------------------------------------------------------
router.get(
  '/me/documents',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const documents = await db('document_references')
        .where({ patient_id: patientId, status: 'current' })
        .select('*')
        .orderBy('date', 'desc');

      res.json({ data: documents });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/documents/:id/download - Download a document
// ---------------------------------------------------------------------------
router.get(
  '/me/documents/:id/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const doc = await db('document_references')
        .where({ id: req.params.id, patient_id: patientId })
        .first();

      if (!doc) {
        throw new NotFoundError('Document', req.params.id);
      }

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'DocumentReference',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: 'Patient downloaded document',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        data: {
          id: doc.id,
          url: doc.url,
          contentType: doc.content_type,
          content: doc.content,
          title: doc.title,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /me/refill-requests - Request a medication refill
// ---------------------------------------------------------------------------
router.post(
  '/me/refill-requests',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const { medicationId, pharmacyPreference, notes } = req.body;

      if (!medicationId) {
        throw new ValidationError('medicationId is required');
      }

      const { v4: uuidv4 } = await import('uuid');
      const db = (await import('../config/database')).getDb();
      const now = new Date().toISOString();
      const id = uuidv4();

      // Verify medication belongs to this patient
      const medication = await db('medication_requests')
        .where({ id: medicationId, patient_id: patientId })
        .first();

      if (!medication) {
        throw new NotFoundError('MedicationRequest', medicationId);
      }

      await db('refill_requests').insert({
        id,
        patient_id: patientId,
        medication_request_id: medicationId,
        pharmacy_preference: pharmacyPreference || null,
        notes: notes || '',
        status: 'pending',
        created_at: now,
        updated_at: now,
      });

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'RefillRequest',
        resourceId: id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: `Patient requested refill for medication ${medication.medication_name || medicationId}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      const request = await db('refill_requests').where({ id }).first();
      res.status(201).json({ data: request });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/refill-requests - Get refill request history
// ---------------------------------------------------------------------------
router.get(
  '/me/refill-requests',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const refills = await db('refill_requests')
        .where({ 'refill_requests.patient_id': patientId })
        .leftJoin('medication_requests', 'refill_requests.medication_request_id', 'medication_requests.id')
        .select(
          'refill_requests.*',
          'medication_requests.medication_name',
          'medication_requests.dosage_instruction',
        )
        .orderBy('refill_requests.created_at', 'desc')
        .limit(50);

      res.json({ data: refills });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/messages - Get messages (inbox)
// ---------------------------------------------------------------------------
router.get(
  '/me/messages',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const db = (await import('../config/database')).getDb();

      // Get all messages for this user
      const messages = await db('messages')
        .where('recipient_id', userId)
        .orWhere('sender_id', userId)
        .select('*')
        .orderBy('created_at', 'desc')
        .limit(200);

      // Group by thread_id and return the latest message per thread for inbox
      const threadMap = new Map<string, any>();
      for (const msg of messages) {
        const threadId = msg.thread_id || msg.id;
        if (!threadMap.has(threadId)) {
          threadMap.set(threadId, {
            ...msg,
            threadId,
          });
        }
      }

      const inbox = Array.from(threadMap.values());

      res.json({ data: inbox });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/messages/:threadId - Get message thread
// ---------------------------------------------------------------------------
router.get(
  '/me/messages/:threadId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const db = (await import('../config/database')).getDb();

      const messages = await db('messages')
        .where({ thread_id: req.params.threadId })
        .where(function () {
          this.where('sender_id', userId).orWhere('recipient_id', userId);
        })
        .orderBy('created_at', 'asc');

      if (messages.length === 0) {
        throw new NotFoundError('MessageThread', req.params.threadId);
      }

      // Mark messages as read
      await db('messages')
        .where({ thread_id: req.params.threadId, recipient_id: userId, read: false })
        .update({ read: true, read_at: new Date().toISOString() });

      res.json({ data: messages });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /me/messages - Send a new message
// ---------------------------------------------------------------------------
router.post(
  '/me/messages',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { recipientId, subject, body } = req.body;

      if (!recipientId) {
        throw new ValidationError('recipientId is required');
      }
      if (!subject || !body) {
        throw new ValidationError('subject and body are required');
      }

      const { v4: uuidv4 } = await import('uuid');
      const db = (await import('../config/database')).getDb();
      const now = new Date().toISOString();
      const id = uuidv4();

      await db('messages').insert({
        id,
        sender_id: req.user!.id,
        recipient_id: recipientId,
        patient_id: (req.user as any)?.patientId || null,
        subject,
        body,
        priority: 'normal',
        thread_id: id, // New thread
        read: false,
        created_at: now,
      });

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'Message',
        resourceId: id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: 'Patient sent message to provider',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      const message = await db('messages').where({ id }).first();
      res.status(201).json({ data: message });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /me/messages/:threadId/reply - Reply to a message thread
// ---------------------------------------------------------------------------
router.post(
  '/me/messages/:threadId/reply',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { body } = req.body;

      if (!body) {
        throw new ValidationError('body is required');
      }

      const db = (await import('../config/database')).getDb();
      const userId = req.user!.id;

      // Verify the thread exists and the user is part of it
      const existingMessage = await db('messages')
        .where({ thread_id: req.params.threadId })
        .where(function () {
          this.where('sender_id', userId).orWhere('recipient_id', userId);
        })
        .first();

      if (!existingMessage) {
        throw new NotFoundError('MessageThread', req.params.threadId);
      }

      // Determine recipient (the other party in the thread)
      const recipientId = existingMessage.sender_id === userId
        ? existingMessage.recipient_id
        : existingMessage.sender_id;

      const { v4: uuidv4 } = await import('uuid');
      const now = new Date().toISOString();
      const id = uuidv4();

      await db('messages').insert({
        id,
        sender_id: userId,
        recipient_id: recipientId,
        patient_id: (req.user as any)?.patientId || null,
        subject: `Re: ${existingMessage.subject}`,
        body,
        priority: 'normal',
        thread_id: req.params.threadId,
        read: false,
        created_at: now,
      });

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'Message',
        resourceId: id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: 'Patient replied to message thread',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      const message = await db('messages').where({ id }).first();
      res.status(201).json({ data: message });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/export/ccda - Export records as C-CDA XML
// ---------------------------------------------------------------------------
router.get(
  '/me/export/ccda',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const [patient, conditions, medications, allergies, immunizations, vitals, encounters] =
        await Promise.all([
          db('patients').where({ id: patientId }).first(),
          db('conditions').where({ patient_id: patientId }).select('*'),
          db('medication_requests').where({ patient_id: patientId }).select('*'),
          db('allergy_intolerances').where({ patient_id: patientId }).select('*'),
          db('immunizations').where({ patient_id: patientId }).select('*'),
          db('observations').where({ patient_id: patientId, category: 'vital-signs' }).select('*'),
          db('encounters').where({ patient_id: patientId }).select('*').orderBy('period_start', 'desc').limit(50),
        ]);

      if (!patient) {
        throw new NotFoundError('Patient', patientId);
      }

      // Generate C-CDA XML document
      const now = new Date().toISOString();
      const ccdaXml = generateCCDA({
        patient,
        conditions,
        medications,
        allergies,
        immunizations,
        vitals,
        encounters,
        generatedAt: now,
      });

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'EXPORT' as any,
        resourceType: 'PatientRecord',
        resourceId: patientId,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: 'Patient exported health records as C-CDA',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="health-record-${patientId}.xml"`);
      res.send(ccdaXml);
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/export/fhir - Export records as FHIR JSON Bundle
// ---------------------------------------------------------------------------
router.get(
  '/me/export/fhir',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const [patient, conditions, medications, allergies, immunizations, observations, encounters] =
        await Promise.all([
          db('patients').where({ id: patientId }).first(),
          db('conditions').where({ patient_id: patientId }).select('*'),
          db('medication_requests').where({ patient_id: patientId }).select('*'),
          db('allergy_intolerances').where({ patient_id: patientId }).select('*'),
          db('immunizations').where({ patient_id: patientId }).select('*'),
          db('observations').where({ patient_id: patientId }).select('*'),
          db('encounters').where({ patient_id: patientId }).select('*'),
        ]);

      if (!patient) {
        throw new NotFoundError('Patient', patientId);
      }

      // Build FHIR Bundle
      const entries: any[] = [];

      // Patient resource
      entries.push({
        fullUrl: `urn:uuid:${patient.id}`,
        resource: {
          resourceType: 'Patient',
          id: patient.id,
          name: [{ family: patient.last_name, given: [patient.first_name] }],
          birthDate: patient.date_of_birth,
          gender: patient.gender,
          identifier: [{ system: 'urn:oid:2.16.840.1.113883.4.1', value: patient.mrn }],
        },
      });

      // Condition resources
      for (const c of conditions) {
        entries.push({
          fullUrl: `urn:uuid:${c.id}`,
          resource: {
            resourceType: 'Condition',
            id: c.id,
            clinicalStatus: { coding: [{ code: c.clinical_status }] },
            code: { text: c.display_name || c.code },
            subject: { reference: `Patient/${patient.id}` },
            onsetDateTime: c.onset_date,
          },
        });
      }

      // MedicationRequest resources
      for (const m of medications) {
        entries.push({
          fullUrl: `urn:uuid:${m.id}`,
          resource: {
            resourceType: 'MedicationRequest',
            id: m.id,
            status: m.status,
            medicationCodeableConcept: { text: m.medication_name },
            subject: { reference: `Patient/${patient.id}` },
            authoredOn: m.authored_on,
            dosageInstruction: [{ text: m.dosage_instruction }],
          },
        });
      }

      // AllergyIntolerance resources
      for (const a of allergies) {
        entries.push({
          fullUrl: `urn:uuid:${a.id}`,
          resource: {
            resourceType: 'AllergyIntolerance',
            id: a.id,
            clinicalStatus: { coding: [{ code: a.clinical_status }] },
            code: { text: a.substance_name || a.code },
            patient: { reference: `Patient/${patient.id}` },
            reaction: a.reaction ? [{ manifestation: [{ text: a.reaction }] }] : [],
          },
        });
      }

      // Immunization resources
      for (const i of immunizations) {
        entries.push({
          fullUrl: `urn:uuid:${i.id}`,
          resource: {
            resourceType: 'Immunization',
            id: i.id,
            status: i.status || 'completed',
            vaccineCode: { text: i.vaccine_name || i.code },
            patient: { reference: `Patient/${patient.id}` },
            occurrenceDateTime: i.occurrence_date,
          },
        });
      }

      // Observation resources
      for (const o of observations) {
        entries.push({
          fullUrl: `urn:uuid:${o.id}`,
          resource: {
            resourceType: 'Observation',
            id: o.id,
            status: o.status || 'final',
            category: [{ coding: [{ code: o.category }] }],
            code: { text: o.display_name || o.code },
            subject: { reference: `Patient/${patient.id}` },
            effectiveDateTime: o.effective_date,
            valueQuantity: o.value_quantity
              ? { value: o.value_quantity, unit: o.value_unit }
              : undefined,
          },
        });
      }

      const bundle = {
        resourceType: 'Bundle',
        type: 'document',
        timestamp: new Date().toISOString(),
        total: entries.length,
        entry: entries,
      };

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'EXPORT' as any,
        resourceType: 'PatientRecord',
        resourceId: patientId,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: 'Patient exported health records as FHIR Bundle',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.setHeader('Content-Type', 'application/fhir+json');
      res.setHeader('Content-Disposition', `attachment; filename="health-record-${patientId}.json"`);
      res.json(bundle);
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/export/pdf - Export health summary as structured PDF-ready JSON
// ---------------------------------------------------------------------------
router.get(
  '/me/export/pdf',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const [patient, conditions, medications, allergies, immunizations, vitals, labs] =
        await Promise.all([
          db('patients').where({ id: patientId }).first(),
          db('conditions')
            .where({ patient_id: patientId, clinical_status: 'active' })
            .select('*')
            .orderBy('onset_date', 'desc'),
          db('medication_requests')
            .where({ patient_id: patientId, status: 'active' })
            .select('*')
            .orderBy('authored_on', 'desc'),
          db('allergy_intolerances')
            .where({ patient_id: patientId, clinical_status: 'active' })
            .select('*'),
          db('immunizations')
            .where({ patient_id: patientId })
            .select('*')
            .orderBy('occurrence_date', 'desc')
            .limit(50),
          db('observations')
            .where({ patient_id: patientId, category: 'vital-signs' })
            .select('*')
            .orderBy('effective_date', 'desc')
            .limit(20),
          db('observations')
            .where({ patient_id: patientId, category: 'laboratory' })
            .select('*')
            .orderBy('effective_date', 'desc')
            .limit(20),
        ]);

      if (!patient) {
        throw new NotFoundError('Patient', patientId);
      }

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'EXPORT' as any,
        resourceType: 'PatientRecord',
        resourceId: patientId,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: 'Patient exported health summary for print/PDF',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        data: {
          generatedAt: new Date().toISOString(),
          demographics: {
            firstName: patient.first_name,
            lastName: patient.last_name,
            dateOfBirth: patient.date_of_birth,
            gender: patient.gender,
            mrn: patient.mrn,
          },
          allergies: allergies.map((a: any) => ({
            substance: a.substance_name || a.code || 'Unknown',
            reaction: a.reaction || 'Not specified',
            criticality: a.criticality || 'Unknown',
          })),
          medications: medications.map((m: any) => ({
            name: m.medication_name || m.code || 'Unknown',
            dosage: m.dosage_instruction || 'Not specified',
            status: m.status || 'active',
          })),
          conditions: conditions.map((c: any) => ({
            name: c.display_name || c.code || 'Unknown',
            status: c.clinical_status || 'active',
            onsetDate: c.onset_date || null,
          })),
          immunizations: immunizations.map((i: any) => ({
            vaccine: i.vaccine_name || i.code || 'Unknown',
            date: i.occurrence_date || null,
            status: i.status || 'completed',
          })),
          recentVitals: vitals.map((v: any) => ({
            name: v.display_name || v.code || 'Unknown',
            value: v.value_quantity != null ? `${v.value_quantity} ${v.value_unit || ''}`.trim() : 'N/A',
            date: v.effective_date || null,
          })),
          recentLabs: labs.map((l: any) => ({
            name: l.display_name || l.code || 'Unknown',
            value: l.value_quantity != null ? `${l.value_quantity} ${l.value_unit || ''}`.trim() : (l.value_string || 'N/A'),
            date: l.effective_date || null,
            referenceRange: l.reference_range_low != null && l.reference_range_high != null
              ? `${l.reference_range_low} - ${l.reference_range_high}`
              : null,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/profile - Get full patient profile
// ---------------------------------------------------------------------------
router.get(
  '/me/profile',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const patient = await db('patients').where({ id: patientId }).first();
      if (!patient) {
        throw new NotFoundError('Patient', patientId);
      }

      const [addresses, phones, emails, emergencyContacts] = await Promise.all([
        db('patient_addresses').where({ patient_id: patientId }),
        db('patient_phone_numbers').where({ patient_id: patientId }),
        db('patient_emails').where({ patient_id: patientId }),
        db('patient_contacts').where({ patient_id: patientId }),
      ]);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'PatientProfile',
        resourceId: patientId,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        data: {
          ...patient,
          addresses,
          phones,
          emails,
          emergencyContacts,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /me/profile - Update patient demographics (limited fields)
// ---------------------------------------------------------------------------
router.put(
  '/me/profile',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();
      const now = new Date().toISOString();

      // Patients can update limited fields
      const allowedUpdates: Record<string, any> = {};
      if (req.body.preferredLanguage) allowedUpdates.preferred_language = req.body.preferredLanguage;
      if (req.body.communicationPreference) allowedUpdates.communication_preference = req.body.communicationPreference;

      if (Object.keys(allowedUpdates).length > 0) {
        allowedUpdates.updated_at = now;
        await db('patients').where({ id: patientId }).update(allowedUpdates);
      }

      // Update phone if provided
      if (req.body.phone) {
        const existingPhone = await db('patient_phone_numbers')
          .where({ patient_id: patientId, use: 'home' })
          .first();
        if (existingPhone) {
          await db('patient_phone_numbers').where({ id: existingPhone.id }).update({ value: req.body.phone });
        }
      }

      // Update email if provided
      if (req.body.email) {
        const existingEmail = await db('patient_emails')
          .where({ patient_id: patientId, use: 'home' })
          .first();
        if (existingEmail) {
          await db('patient_emails').where({ id: existingEmail.id }).update({ value: req.body.email });
        }
      }

      // Update address if provided
      if (req.body.address) {
        const existingAddress = await db('patient_addresses')
          .where({ patient_id: patientId, use: 'home' })
          .first();
        if (existingAddress) {
          await db('patient_addresses').where({ id: existingAddress.id }).update({
            line1: req.body.address.line1 || existingAddress.line1,
            line2: req.body.address.line2 || existingAddress.line2,
            city: req.body.address.city || existingAddress.city,
            state: req.body.address.state || existingAddress.state,
            postal_code: req.body.address.postalCode || existingAddress.postal_code,
          });
        }
      }

      // Update emergency contacts if provided
      if (req.body.emergencyContacts && Array.isArray(req.body.emergencyContacts)) {
        await db('patient_contacts').where({ patient_id: patientId }).delete();
        const { v4: uuidv4 } = await import('uuid');
        for (const contact of req.body.emergencyContacts) {
          await db('patient_contacts').insert({
            id: uuidv4(),
            patient_id: patientId,
            name: contact.name,
            relationship: contact.relationship,
            phone: contact.phone,
            created_at: now,
          });
        }
      }

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'PatientProfile',
        resourceId: patientId,
        endpoint: req.originalUrl,
        method: 'PUT',
        statusCode: 200,
        clinicalContext: 'Patient updated profile',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      const patient = await db('patients').where({ id: patientId }).first();
      res.json({ data: patient });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/preferences - Get notification preferences
// ---------------------------------------------------------------------------
router.get(
  '/me/preferences',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const db = (await import('../config/database')).getDb();

      const preferences = await db('user_preferences')
        .where({ user_id: userId })
        .first();

      // Return defaults if no preferences saved
      const defaultPreferences = {
        emailNotifications: true,
        smsNotifications: false,
        phoneNotifications: false,
        portalNotifications: true,
        appointmentReminders: true,
        resultNotifications: true,
        messageNotifications: true,
        medicationReminders: true,
      };

      res.json({
        data: preferences
          ? {
              emailNotifications: preferences.email_notifications ?? true,
              smsNotifications: preferences.sms_notifications ?? false,
              phoneNotifications: preferences.phone_notifications ?? false,
              portalNotifications: preferences.portal_notifications ?? true,
              appointmentReminders: preferences.appointment_reminders ?? true,
              resultNotifications: preferences.result_notifications ?? true,
              messageNotifications: preferences.message_notifications ?? true,
              medicationReminders: preferences.medication_reminders ?? true,
            }
          : defaultPreferences,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /me/preferences - Update notification preferences
// ---------------------------------------------------------------------------
router.put(
  '/me/preferences',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const db = (await import('../config/database')).getDb();
      const now = new Date().toISOString();

      const update = {
        email_notifications: req.body.emailNotifications,
        sms_notifications: req.body.smsNotifications,
        phone_notifications: req.body.phoneNotifications,
        portal_notifications: req.body.portalNotifications,
        appointment_reminders: req.body.appointmentReminders,
        result_notifications: req.body.resultNotifications,
        message_notifications: req.body.messageNotifications,
        medication_reminders: req.body.medicationReminders,
        updated_at: now,
      };

      const existing = await db('user_preferences').where({ user_id: userId }).first();

      if (existing) {
        await db('user_preferences').where({ user_id: userId }).update(update);
      } else {
        const { v4: uuidv4 } = await import('uuid');
        await db('user_preferences').insert({
          id: uuidv4(),
          user_id: userId,
          ...update,
          created_at: now,
        });
      }

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'UserPreferences',
        resourceId: userId,
        endpoint: req.originalUrl,
        method: 'PUT',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: req.body });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /me/password - Change password
// ---------------------------------------------------------------------------
router.put(
  '/me/password',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        throw new ValidationError('currentPassword and newPassword are required');
      }

      if (newPassword.length < 8) {
        throw new ValidationError('New password must be at least 8 characters');
      }

      const db = (await import('../config/database')).getDb();
      const bcrypt = await import('bcryptjs');

      const user = await db('users').where({ id: userId }).first();
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValid) {
        throw new ValidationError('Current password is incorrect');
      }

      // Hash new password and update
      const saltRounds = 12;
      const newHash = await bcrypt.hash(newPassword, saltRounds);
      await db('users').where({ id: userId }).update({
        password_hash: newHash,
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'UserPassword',
        resourceId: userId,
        endpoint: req.originalUrl,
        method: 'PUT',
        statusCode: 200,
        clinicalContext: 'Patient changed password',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: { message: 'Password updated successfully' } });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /me/proxies - Get proxy access list
// ---------------------------------------------------------------------------
router.get(
  '/me/proxies',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const proxies = await db('patient_proxies')
        .where({ patient_id: patientId, status: 'active' })
        .select('*')
        .orderBy('created_at', 'desc');

      res.json({ data: proxies });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /me/proxies - Add proxy user
// ---------------------------------------------------------------------------
router.post(
  '/me/proxies',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const { name, relationship, email, accessLevel } = req.body;

      if (!name || !relationship || !email) {
        throw new ValidationError('name, relationship, and email are required');
      }

      const { v4: uuidv4 } = await import('uuid');
      const db = (await import('../config/database')).getDb();
      const now = new Date().toISOString();
      const id = uuidv4();

      await db('patient_proxies').insert({
        id,
        patient_id: patientId,
        proxy_name: name,
        relationship,
        email,
        access_level: accessLevel || 'read',
        status: 'active',
        created_at: now,
        updated_at: now,
      });

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'PatientProxy',
        resourceId: id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: `Patient added proxy access for ${name} (${relationship})`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      const proxy = await db('patient_proxies').where({ id }).first();
      res.status(201).json({ data: proxy });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /me/proxies/:id - Remove proxy user
// ---------------------------------------------------------------------------
router.delete(
  '/me/proxies/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = getPatientId(req);
      const db = (await import('../config/database')).getDb();

      const proxy = await db('patient_proxies')
        .where({ id: req.params.id, patient_id: patientId })
        .first();

      if (!proxy) {
        throw new NotFoundError('PatientProxy', req.params.id);
      }

      await db('patient_proxies')
        .where({ id: req.params.id })
        .update({ status: 'revoked', updated_at: new Date().toISOString() });

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'DELETE',
        resourceType: 'PatientProxy',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'DELETE',
        statusCode: 200,
        clinicalContext: `Patient removed proxy access for ${proxy.proxy_name}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: { id: req.params.id, status: 'revoked' } });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// C-CDA XML Generator Helper
// ---------------------------------------------------------------------------
function generateCCDA(data: {
  patient: any;
  conditions: any[];
  medications: any[];
  allergies: any[];
  immunizations: any[];
  vitals: any[];
  encounters: any[];
  generatedAt: string;
}): string {
  const { patient, conditions, medications, allergies, immunizations, vitals, encounters, generatedAt } = data;

  const escapeXml = (str: string) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <templateId root="2.16.840.1.113883.10.20.22.1.1"/>
  <templateId root="2.16.840.1.113883.10.20.22.1.2"/>
  <id root="${escapeXml(patient.id)}"/>
  <code code="34133-9" codeSystem="2.16.840.1.113883.6.1" displayName="Summarization of Episode Note"/>
  <title>Continuity of Care Document - ${escapeXml(patient.first_name)} ${escapeXml(patient.last_name)}</title>
  <effectiveTime value="${generatedAt.replace(/[-:T.Z]/g, '').substring(0, 14)}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="en-US"/>
  <recordTarget>
    <patientRole>
      <id root="${escapeXml(patient.mrn || patient.id)}"/>
      <patient>
        <name>
          <given>${escapeXml(patient.first_name)}</given>
          <family>${escapeXml(patient.last_name)}</family>
        </name>
        <administrativeGenderCode code="${escapeXml(patient.gender || 'unknown')}"/>
        <birthTime value="${(patient.date_of_birth || '').replace(/-/g, '')}"/>
      </patient>
    </patientRole>
  </recordTarget>
  <component>
    <structuredBody>`;

  // Allergies section
  xml += `
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.6.1"/>
          <code code="48765-2" codeSystem="2.16.840.1.113883.6.1" displayName="Allergies"/>
          <title>Allergies and Adverse Reactions</title>
          <text>
            <table>
              <thead><tr><th>Substance</th><th>Reaction</th><th>Severity</th></tr></thead>
              <tbody>`;

  for (const a of allergies) {
    xml += `
                <tr>
                  <td>${escapeXml(a.substance_name || a.code || 'Unknown')}</td>
                  <td>${escapeXml(a.reaction || 'Not specified')}</td>
                  <td>${escapeXml(a.criticality || 'Unknown')}</td>
                </tr>`;
  }

  xml += `
              </tbody>
            </table>
          </text>
        </section>
      </component>`;

  // Medications section
  xml += `
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.1.1"/>
          <code code="10160-0" codeSystem="2.16.840.1.113883.6.1" displayName="Medications"/>
          <title>Medications</title>
          <text>
            <table>
              <thead><tr><th>Medication</th><th>Dosage</th><th>Status</th></tr></thead>
              <tbody>`;

  for (const m of medications) {
    xml += `
                <tr>
                  <td>${escapeXml(m.medication_name || m.code || 'Unknown')}</td>
                  <td>${escapeXml(m.dosage_instruction || 'Not specified')}</td>
                  <td>${escapeXml(m.status || 'active')}</td>
                </tr>`;
  }

  xml += `
              </tbody>
            </table>
          </text>
        </section>
      </component>`;

  // Problems section
  xml += `
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.5.1"/>
          <code code="11450-4" codeSystem="2.16.840.1.113883.6.1" displayName="Problem List"/>
          <title>Problems</title>
          <text>
            <table>
              <thead><tr><th>Condition</th><th>Status</th><th>Onset</th></tr></thead>
              <tbody>`;

  for (const c of conditions) {
    xml += `
                <tr>
                  <td>${escapeXml(c.display_name || c.code || 'Unknown')}</td>
                  <td>${escapeXml(c.clinical_status || 'active')}</td>
                  <td>${escapeXml(c.onset_date || 'Unknown')}</td>
                </tr>`;
  }

  xml += `
              </tbody>
            </table>
          </text>
        </section>
      </component>`;

  // Immunizations section
  xml += `
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.2.1"/>
          <code code="11369-6" codeSystem="2.16.840.1.113883.6.1" displayName="Immunizations"/>
          <title>Immunizations</title>
          <text>
            <table>
              <thead><tr><th>Vaccine</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>`;

  for (const i of immunizations) {
    xml += `
                <tr>
                  <td>${escapeXml(i.vaccine_name || i.code || 'Unknown')}</td>
                  <td>${escapeXml(i.occurrence_date || 'Unknown')}</td>
                  <td>${escapeXml(i.status || 'completed')}</td>
                </tr>`;
  }

  xml += `
              </tbody>
            </table>
          </text>
        </section>
      </component>`;

  // Vital Signs section
  xml += `
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.4.1"/>
          <code code="8716-3" codeSystem="2.16.840.1.113883.6.1" displayName="Vital Signs"/>
          <title>Vital Signs</title>
          <text>
            <table>
              <thead><tr><th>Test</th><th>Value</th><th>Date</th></tr></thead>
              <tbody>`;

  for (const v of vitals) {
    xml += `
                <tr>
                  <td>${escapeXml(v.display_name || v.code || 'Unknown')}</td>
                  <td>${escapeXml(String(v.value_quantity || ''))} ${escapeXml(v.value_unit || '')}</td>
                  <td>${escapeXml(v.effective_date || 'Unknown')}</td>
                </tr>`;
  }

  xml += `
              </tbody>
            </table>
          </text>
        </section>
      </component>`;

  xml += `
    </structuredBody>
  </component>
</ClinicalDocument>`;

  return xml;
}

export default router;
