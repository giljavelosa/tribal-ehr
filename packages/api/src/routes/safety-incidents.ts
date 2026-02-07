// =============================================================================
// Safety Incident Routes - SAFER Guide 5, Practice 1.5
// Incident reporting, investigation, resolution, analytics
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { safetyIncidentService } from '../services/safety-incident.service';

const router = Router();

// ---------------------------------------------------------------------------
// Search / List incidents
// ---------------------------------------------------------------------------

router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await safetyIncidentService.search({
        status: req.query.status as string,
        severity: req.query.severity as string,
        type: req.query.type as string,
        ehrRelated: req.query.ehrRelated === 'true' ? true : req.query.ehrRelated === 'false' ? false : undefined,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Report a new incident (any authenticated user)
// ---------------------------------------------------------------------------

router.post(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const incident = await safetyIncidentService.create({
        ...req.body,
        reporterId: req.user!.id,
      });
      res.status(201).json({ data: incident });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Update incident (admin only for investigation fields)
// ---------------------------------------------------------------------------

router.put(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const incident = await safetyIncidentService.update(req.params.id, req.body);
      res.json({ data: incident });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Assign investigator (admin only)
// ---------------------------------------------------------------------------

router.post(
  '/:id/assign',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const incident = await safetyIncidentService.assignInvestigator(
        req.params.id,
        req.body.assignedTo,
      );
      res.json({ data: incident });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Resolve incident (admin only)
// ---------------------------------------------------------------------------

router.post(
  '/:id/resolve',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const incident = await safetyIncidentService.resolve(req.params.id, req.body);
      res.json({ data: incident });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

router.get(
  '/analytics',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const analytics = await safetyIncidentService.getAnalytics();
      res.json({ data: analytics });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
