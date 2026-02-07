// =============================================================================
// Order Set Routes
// GET    /                     - List order sets
// GET    /:id                  - Get order set
// POST   /                     - Create order set
// POST   /:id/approve          - Approve order set
// POST   /:id/apply            - Apply order set to patient
// DELETE /:id                  - Deactivate order set
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { orderSetService } from '../services/order-set.service';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// ---------------------------------------------------------------------------
// List Order Sets
// ---------------------------------------------------------------------------
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sets = await orderSetService.getOrderSets({
        category: req.query.category as string,
        active: req.query.active === 'false' ? false : true,
        approved: req.query.approved ? req.query.approved === 'true' : undefined,
      });
      res.json({ data: sets });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Order Set
// ---------------------------------------------------------------------------
router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const set = await orderSetService.getOrderSetById(req.params.id);
      res.json({ data: set });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Create Order Set
// ---------------------------------------------------------------------------
router.post(
  '/',
  authenticate,
  requireRole('physician', 'nurse_practitioner', 'physician_assistant', 'attending', 'ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const set = await orderSetService.createOrderSet({
        name: req.body.name,
        category: req.body.category,
        description: req.body.description,
        diagnosisCodes: req.body.diagnosisCodes,
        orders: req.body.orders,
        createdBy: req.user!.id,
      });
      res.status(201).json({ data: set });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Approve Order Set
// ---------------------------------------------------------------------------
router.post(
  '/:id/approve',
  authenticate,
  requireRole('physician', 'attending', 'ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const set = await orderSetService.approveOrderSet(req.params.id, req.user!.id);
      res.json({ data: set });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Apply Order Set to Patient
// ---------------------------------------------------------------------------
router.post(
  '/:id/apply',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await orderSetService.applyOrderSet(
        req.params.id,
        req.body.patientId,
        req.body.encounterId,
        req.user!.id
      );
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Deactivate Order Set
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await orderSetService.deactivateOrderSet(req.params.id);
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
