// =============================================================================
// Consent Enforcement & Break-Glass Routes
// ONC §170.315(b)(7) and HIPAA §164.308(a)(4)
//
// GET    /directives?patientId=...          - list patient consents
// POST   /directives                        - create consent directive
// PUT    /directives/:id                    - update consent
// DELETE /directives/:id                    - revoke consent
// POST   /break-glass                       - request emergency access
// POST   /break-glass/:id/approve           - approve break-glass (admin only)
// POST   /break-glass/:id/revoke            - revoke break-glass
// GET    /break-glass/active                - check active break-glass
// GET    /break-glass/history               - break-glass audit trail (admin only)
// POST   /sensitivity-tags                  - tag a resource
// GET    /sensitivity-tags                  - get tags for a resource
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { consentEnforcementService } from '../services/consent-enforcement.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/auth';

const router = Router();

// ---------------------------------------------------------------------------
// GET /directives?patientId=...
// ---------------------------------------------------------------------------
router.get(
  '/directives',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = req.query.patientId as string;
      if (!patientId) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'patientId query parameter is required' } });
        return;
      }

      const consents = await consentEnforcementService.getPatientConsents(patientId);
      res.json({ data: consents });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /directives
// ---------------------------------------------------------------------------
router.post(
  '/directives',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const directive = await consentEnforcementService.createConsentDirective({
        patientId: req.body.patientId,
        consentType: req.body.consentType,
        status: req.body.status,
        scope: req.body.scope,
        actorType: req.body.actorType,
        actorId: req.body.actorId,
        dataCategories: req.body.dataCategories,
        periodStart: req.body.periodStart,
        periodEnd: req.body.periodEnd,
        recordedBy: req.user!.id,
      });

      res.status(201).json({ data: directive });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /directives/:id
// ---------------------------------------------------------------------------
router.put(
  '/directives/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const directive = await consentEnforcementService.updateConsentDirective(
        req.params.id,
        {
          status: req.body.status,
          scope: req.body.scope,
          actorType: req.body.actorType,
          actorId: req.body.actorId,
          dataCategories: req.body.dataCategories,
          periodStart: req.body.periodStart,
          periodEnd: req.body.periodEnd,
          verified: req.body.verified,
        }
      );

      res.json({ data: directive });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /directives/:id
// ---------------------------------------------------------------------------
router.delete(
  '/directives/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const directive = await consentEnforcementService.revokeConsent(
        req.params.id,
        req.user!.id
      );

      res.json({ data: directive });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /break-glass
// ---------------------------------------------------------------------------
router.post(
  '/break-glass',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await consentEnforcementService.requestBreakGlass(
        req.user!.id,
        req.body.patientId,
        req.body.reason,
        req.body.reasonCategory
      );

      res.status(201).json({ data: event });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /break-glass/:id/approve (admin only)
// ---------------------------------------------------------------------------
router.post(
  '/break-glass/:id/approve',
  authenticate,
  requireRole('admin', 'supervisor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await consentEnforcementService.approveBreakGlass(
        req.params.id,
        req.user!.id
      );

      res.json({ data: event });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /break-glass/:id/revoke
// ---------------------------------------------------------------------------
router.post(
  '/break-glass/:id/revoke',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await consentEnforcementService.revokeBreakGlass(
        req.params.id,
        req.user!.id
      );

      res.json({ data: event });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /break-glass/active?userId=...&patientId=...
// ---------------------------------------------------------------------------
router.get(
  '/break-glass/active',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.query.userId as string) || req.user!.id;
      const patientId = req.query.patientId as string;

      if (!patientId) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'patientId query parameter is required' } });
        return;
      }

      const event = await consentEnforcementService.getActiveBreakGlass(userId, patientId);
      res.json({ data: event });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /break-glass/history (admin only)
// ---------------------------------------------------------------------------
router.get(
  '/break-glass/history',
  authenticate,
  requireRole('admin', 'supervisor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await consentEnforcementService.getBreakGlassHistory({
        userId: req.query.userId as string,
        patientId: req.query.patientId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      });

      res.json({ data: events });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /sensitivity-tags
// ---------------------------------------------------------------------------
router.post(
  '/sensitivity-tags',
  authenticate,
  requireRole('admin', 'physician', 'provider'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tag = await consentEnforcementService.tagResource(
        req.body.resourceType,
        req.body.resourceId,
        req.body.sensitivityLevel,
        req.body.sensitivityCategory,
        req.user!.id
      );

      res.status(201).json({ data: tag });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /sensitivity-tags?resourceType=...&resourceId=...
// ---------------------------------------------------------------------------
router.get(
  '/sensitivity-tags',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resourceType = req.query.resourceType as string;
      const resourceId = req.query.resourceId as string;

      if (!resourceType || !resourceId) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'resourceType and resourceId query parameters are required' } });
        return;
      }

      const tags = await consentEnforcementService.getResourceTags(resourceType, resourceId);
      res.json({ data: tags });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
