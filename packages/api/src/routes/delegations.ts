// =============================================================================
// Clinician Delegation Routes
// POST   /                     - Create delegation
// DELETE /:id                  - Revoke delegation
// GET    /                     - Get my delegations (outgoing)
// GET    /received             - Get delegations received
// PUT    /out-of-office        - Set out-of-office
// DELETE /out-of-office        - Clear out-of-office
// GET    /out-of-office/:userId - Get out-of-office status
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { delegationService } from '../services/delegation.service';
import { authenticate } from '../middleware/auth';

const router = Router();

// ---------------------------------------------------------------------------
// Create Delegation
// ---------------------------------------------------------------------------
router.post(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const delegation = await delegationService.createDelegation({
        delegatorId: req.user!.id,
        delegateId: req.body.delegateId,
        delegationType: req.body.delegationType,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        reason: req.body.reason,
      });

      res.status(201).json({ data: delegation });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Revoke Delegation
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await delegationService.revokeDelegation(req.params.id, req.user!.id);
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get My Delegations (outgoing)
// ---------------------------------------------------------------------------
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const delegations = await delegationService.getActiveDelegatesFor(
        req.user!.id,
        req.query.type as string | undefined
      );
      res.json({ data: delegations });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Delegations Received
// ---------------------------------------------------------------------------
router.get(
  '/received',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const delegations = await delegationService.getDelegationsReceived(req.user!.id);
      res.json({ data: delegations });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Set Out-of-Office
// ---------------------------------------------------------------------------
router.put(
  '/out-of-office',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await delegationService.setOutOfOffice(req.user!.id, {
        message: req.body.message,
        start: req.body.start,
        end: req.body.end,
        autoForwardTo: req.body.autoForwardTo,
      });
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Clear Out-of-Office
// ---------------------------------------------------------------------------
router.delete(
  '/out-of-office',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await delegationService.clearOutOfOffice(req.user!.id);
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Out-of-Office Status
// ---------------------------------------------------------------------------
router.get(
  '/out-of-office/:userId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await delegationService.getOutOfOfficeStatus(req.params.userId);
      res.json({ data: status });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
