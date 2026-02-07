// =============================================================================
// CPOE Order Routes
// POST /medications          - Create medication order (CPOE)
// POST /laboratory           - Create lab order
// POST /imaging              - Create imaging order
// POST /:id/sign             - Sign an order
// POST /:id/cancel           - Cancel an order
// POST /:id/acknowledge      - Acknowledge order result
// POST /:id/amend            - Amend order result
// POST /:id/critical-notify  - Record critical result notification
// POST /:id/forward          - Forward result to another provider
// PUT  /:id/lifecycle        - Update order lifecycle stage
// GET  /                     - List orders (with filters)
// GET  /pending              - Get pending orders for current provider
// GET  /lab-panels           - Get available lab panel definitions
// GET  /:id                  - Get order details
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { orderService, OrderStatus } from '../services/order.service';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// ---------------------------------------------------------------------------
// Create Medication Order (CPOE)
// ---------------------------------------------------------------------------
router.post(
  '/medications',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.createMedicationOrder({
        patientId: req.body.patientId,
        encounterId: req.body.encounterId,
        priority: req.body.priority,
        orderedBy: req.user!.id,
        medication: req.body.medication,
      });

      res.status(201).json({ data: order });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Create Lab Order
// ---------------------------------------------------------------------------
router.post(
  '/laboratory',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.createLabOrder({
        patientId: req.body.patientId,
        encounterId: req.body.encounterId,
        priority: req.body.priority,
        orderedBy: req.user!.id,
        lab: req.body.lab,
      });

      res.status(201).json({ data: order });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Create Imaging Order
// ---------------------------------------------------------------------------
router.post(
  '/imaging',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.createImagingOrder({
        patientId: req.body.patientId,
        encounterId: req.body.encounterId,
        priority: req.body.priority,
        orderedBy: req.user!.id,
        imaging: req.body.imaging,
      });

      res.status(201).json({ data: order });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Sign an Order
// ---------------------------------------------------------------------------
router.post(
  '/:id/sign',
  authenticate,
  requireRole('physician', 'nurse_practitioner', 'physician_assistant', 'attending', 'resident'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.signOrder(req.params.id, req.user!.id);
      res.json({ data: order });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Cancel an Order
// ---------------------------------------------------------------------------
router.post(
  '/:id/cancel',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.cancelOrder(
        req.params.id,
        req.body.reason,
        req.user!.id
      );
      res.json({ data: order });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Pending Orders for Current Provider
// ---------------------------------------------------------------------------
router.get(
  '/pending',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orders = await orderService.getPendingOrders(req.user!.id);
      res.json({ data: orders });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Lab Panel Definitions
// ---------------------------------------------------------------------------
router.get(
  '/lab-panels',
  authenticate,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const panels = orderService.getLabPanels();
      res.json({ data: panels });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// List Orders (with filters)
// ---------------------------------------------------------------------------
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await orderService.getPatientOrders({
        patientId: req.query.patientId as string,
        orderType: req.query.type as 'medication' | 'laboratory' | 'imaging' | undefined,
        status: req.query.status as OrderStatus | undefined,
        providerId: req.query.providerId as string,
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
// Acknowledge Order Result
// ---------------------------------------------------------------------------
router.post(
  '/:id/acknowledge',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.acknowledgeResult(req.params.id, req.user!.id);
      res.json({ data: order });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Amend Order Result
// ---------------------------------------------------------------------------
router.post(
  '/:id/amend',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.amendResult(
        req.params.id,
        req.user!.id,
        req.body.reason,
        req.body.updatedResults
      );
      res.json({ data: order });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Record Critical Result Notification
// ---------------------------------------------------------------------------
router.post(
  '/:id/critical-notify',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.recordCriticalResult(
        req.params.id,
        req.user!.id,
        req.body.notifiedTo
      );
      res.json({ data: order });
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

// ---------------------------------------------------------------------------
// Update Order Lifecycle
// ---------------------------------------------------------------------------
router.put(
  '/:id/lifecycle',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.updateOrderLifecycle(
        req.params.id,
        req.body.stage,
        req.user!.id
      );
      res.json({ data: order });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Order Details
// ---------------------------------------------------------------------------
router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.getOrder(req.params.id);
      res.json({ data: order });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
