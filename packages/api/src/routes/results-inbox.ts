// =============================================================================
// Results Inbox Routes
// GET    /                     - Get results inbox for current provider
// GET    /critical             - Get critical results
// POST   /:id/acknowledge      - Acknowledge a result
// POST   /bulk-acknowledge     - Bulk acknowledge results
// GET    /analytics            - Get acknowledgment analytics
// GET    /trending/:patientId  - Get trending data for a patient
// POST   /:id/forward          - Forward a result
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service';
import { authenticate } from '../middleware/auth';

const router = Router();

// ---------------------------------------------------------------------------
// Get Results Inbox
// ---------------------------------------------------------------------------
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const results = await orderService.getUnacknowledgedResults(req.user!.id, {
        status: req.query.status as string,
        orderType: req.query.orderType as string,
        priority: req.query.priority as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      });
      res.json({ data: results });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Critical Results
// ---------------------------------------------------------------------------
router.get(
  '/critical',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const results = await orderService.getCriticalResults(req.user!.id);
      res.json({ data: results });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Acknowledge Result
// ---------------------------------------------------------------------------
router.post(
  '/:id/acknowledge',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await orderService.acknowledgeResult(req.params.id, req.user!.id);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Bulk Acknowledge
// ---------------------------------------------------------------------------
router.post(
  '/bulk-acknowledge',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderIds } = req.body;
      const results = await orderService.bulkAcknowledgeResults(orderIds, req.user!.id);
      res.json({ data: results });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Acknowledgment Analytics
// ---------------------------------------------------------------------------
router.get(
  '/analytics',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const analytics = await orderService.getAcknowledgmentAnalytics(req.user!.id);
      res.json({ data: analytics });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Trending Data for Patient
// ---------------------------------------------------------------------------
router.get(
  '/trending/:patientId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const loincCode = req.query.loincCode as string;
      const trending = await orderService.getResultTrending(
        req.params.patientId,
        loincCode
      );
      res.json({ data: trending });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Forward Result
// ---------------------------------------------------------------------------
router.post(
  '/:id/forward',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await orderService.forwardResult(
        req.params.id,
        req.user!.id,
        req.body.forwardTo,
        req.body.note
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
