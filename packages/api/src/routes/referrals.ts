// =============================================================================
// Referral Management Routes
// POST   /                              - Create referral
// GET    /                              - List referrals (filtered)
// GET    /:id                           - Get referral by ID
// PUT    /:id/status                    - Update referral status
// PUT    /:id/close                     - Close referral loop with consult note
// GET    /patient/:patientId            - Get referrals for a patient
// GET    /provider/:providerId/:dir     - Get referrals for a provider
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { referralService } from '../services/referral.service';
import { auditService } from '../services/audit.service';
import { ValidationError } from '../utils/errors';

const router = Router();

// ---------------------------------------------------------------------------
// GET / - List referrals with optional filters
// ---------------------------------------------------------------------------

router.get(
  '/',
  authenticate,
  requirePermission('referrals', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientId, providerId, direction, status, page, limit } = req.query;

      let result;

      if (patientId) {
        result = await referralService.getPatientReferrals(patientId as string);
      } else if (providerId) {
        result = await referralService.getProviderReferrals(
          providerId as string,
          (direction as 'sent' | 'received') || 'sent'
        );
      } else {
        // General listing - default to the current user's sent referrals
        result = await referralService.getProviderReferrals(
          req.user!.id,
          'sent'
        );
      }

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'Referral',
        resourceId: 'list',
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      // Normalize the response format
      const referrals = Array.isArray(result) ? result : result;
      res.json({ data: referrals });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /patient/:patientId - Get referrals for a patient
// ---------------------------------------------------------------------------

router.get(
  '/patient/:patientId',
  authenticate,
  requirePermission('referrals', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const referrals = await referralService.getPatientReferrals(
        req.params.patientId
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'Referral',
        resourceId: `patient/${req.params.patientId}`,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: `Patient referrals for ${req.params.patientId}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: referrals });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /provider/:providerId/:direction - Get referrals for a provider
// ---------------------------------------------------------------------------

router.get(
  '/provider/:providerId/:direction',
  authenticate,
  requirePermission('referrals', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const direction = req.params.direction as 'sent' | 'received';
      if (!['sent', 'received'].includes(direction)) {
        throw new ValidationError('Direction must be "sent" or "received"');
      }

      const referrals = await referralService.getProviderReferrals(
        req.params.providerId,
        direction
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'Referral',
        resourceId: `provider/${req.params.providerId}`,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: `Provider ${direction} referrals for ${req.params.providerId}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: referrals });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /:id - Get referral by ID
// ---------------------------------------------------------------------------

router.get(
  '/:id',
  authenticate,
  requirePermission('referrals', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const referral = await referralService.getById(req.params.id);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'Referral',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: referral });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST / - Create a new referral
// ---------------------------------------------------------------------------

router.post(
  '/',
  authenticate,
  requirePermission('referrals', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        patientId,
        toProviderName,
        toProviderNPI,
        toFacility,
        specialty,
        priority,
        reason,
        clinicalNotes,
        includeCCDA,
      } = req.body;

      if (!patientId || typeof patientId !== 'string') {
        throw new ValidationError('patientId is required');
      }
      if (!toProviderName || typeof toProviderName !== 'string') {
        throw new ValidationError('toProviderName is required');
      }
      if (!specialty || typeof specialty !== 'string') {
        throw new ValidationError('specialty is required');
      }
      if (!reason || typeof reason !== 'string') {
        throw new ValidationError('reason is required');
      }

      const referral = await referralService.createReferral({
        patientId,
        fromProviderId: req.user!.id,
        toProviderName,
        toProviderNPI,
        toFacility,
        specialty,
        priority: priority || 'routine',
        reason,
        clinicalNotes,
        includeCCDA: includeCCDA === true,
      });

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'Referral',
        resourceId: referral.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: `Referral to ${specialty}: ${toProviderName}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: referral });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /:id/status - Update referral status
// ---------------------------------------------------------------------------

router.put(
  '/:id/status',
  authenticate,
  requirePermission('referrals', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, notes } = req.body;

      if (!status || typeof status !== 'string') {
        throw new ValidationError('status is required');
      }

      const referral = await referralService.updateStatus(
        req.params.id,
        status,
        notes
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'Referral',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'PUT',
        statusCode: 200,
        clinicalContext: `Referral status changed to ${status}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: referral });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /:id/close - Close referral loop with optional consult note
// ---------------------------------------------------------------------------

router.put(
  '/:id/close',
  authenticate,
  requirePermission('referrals', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { consultNote } = req.body;

      const referral = await referralService.closeReferral(
        req.params.id,
        consultNote
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'Referral',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'PUT',
        statusCode: 200,
        clinicalContext: `Referral closed${consultNote ? ' with consult note' : ''}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: referral });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
