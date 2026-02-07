// =============================================================================
// SAFER Assessment Routes - Annual self-assessment for all 8 SAFER Guides
// Required by CY 2026 IPPS rule
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { saferAssessmentService } from '../services/safer-assessment.service';

const router = Router();

// ---------------------------------------------------------------------------
// Guides & Practices (read-only reference data)
// ---------------------------------------------------------------------------

router.get(
  '/guides',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guides = await saferAssessmentService.getGuides();
      res.json({ data: guides });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/practices',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const practices = await saferAssessmentService.getPractices(
        req.query.guideId as string,
      );
      res.json({ data: practices });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Assessment CRUD
// ---------------------------------------------------------------------------

router.get(
  '/history',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const history = await saferAssessmentService.getAssessmentHistory();
      res.json({ data: history });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assessment = await saferAssessmentService.createAssessment(
        req.body.year,
        req.user!.id,
      );
      res.status(201).json({ data: assessment });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assessment = await saferAssessmentService.getAssessment(req.params.id);
      res.json({ data: assessment });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:id/items',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await saferAssessmentService.getAssessmentItems(req.params.id);
      res.json({ data: items });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:id/summary',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await saferAssessmentService.getComplianceSummary(req.params.id);
      res.json({ data: summary });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Assessment Item Updates
// ---------------------------------------------------------------------------

router.put(
  '/items/:itemId',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await saferAssessmentService.updateAssessmentItem(
        req.params.itemId,
        req.body,
      );
      res.json({ data: item });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Assessment Lifecycle
// ---------------------------------------------------------------------------

router.post(
  '/:id/complete',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assessment = await saferAssessmentService.completeAssessment(req.params.id);
      res.json({ data: assessment });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:id/approve',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assessment = await saferAssessmentService.approveAssessment(
        req.params.id,
        req.user!.id,
      );
      res.json({ data: assessment });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
