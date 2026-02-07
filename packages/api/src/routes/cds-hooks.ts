// =============================================================================
// CDS Hooks Routes (§170.315(a)(9) Clinical Decision Support)
// GET  /cds-services           - Discovery endpoint
// POST /cds-services/:hookId   - Service invocation
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import {
  CDSEngine,
  DrugInteractionHandler,
  DrugInteractionMedicationPrescribeHandler,
  DrugAllergyHandler,
  DrugAllergyMedicationPrescribeHandler,
  VitalSignAlertHandler,
  ImmunizationAlertHandler,
  PreventiveCareHandler,
  OrderSignHandler,
  OrderSignDrugInteractionHandler,
} from '@tribal-ehr/cds-hooks';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { cdsOverrideService } from '../services/cds-override.service';
import { logger } from '../utils/logger';

const router = Router();

// Create and configure the CDS Engine singleton
const cdsEngine = new CDSEngine(logger);

// Register built-in handlers
cdsEngine.registerService(new DrugInteractionHandler());
cdsEngine.registerService(new DrugInteractionMedicationPrescribeHandler());
cdsEngine.registerService(new DrugAllergyHandler());
cdsEngine.registerService(new DrugAllergyMedicationPrescribeHandler());
cdsEngine.registerService(new VitalSignAlertHandler());
cdsEngine.registerService(new ImmunizationAlertHandler());
cdsEngine.registerService(new PreventiveCareHandler());
cdsEngine.registerService(new OrderSignHandler());
cdsEngine.registerService(new OrderSignDrugInteractionHandler());

// ---------------------------------------------------------------------------
// GET /cds-services - Discovery endpoint
// Returns the list of available CDS services
// ---------------------------------------------------------------------------
router.get('/', (req: Request, res: Response) => {
  const discovery = cdsEngine.getDiscovery();
  res.json(discovery);
});

// ---------------------------------------------------------------------------
// CDS Override / Feedback Schemas
// ---------------------------------------------------------------------------

const overrideSchema = z.object({
  cardId: z.string(),
  patientId: z.string().uuid(),
  hookInstance: z.string(),
  reasonCode: z.string(),
  reasonText: z.string().optional(),
  cardSummary: z.string(),
});

const feedbackSchema = z.object({
  cardId: z.string(),
  outcome: z.string(),
  outcomeTimestamp: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /cds-services/overrides - Record a CDS override
// ---------------------------------------------------------------------------
router.post(
  '/overrides',
  authenticate,
  requirePermission('cds', 'write'),
  validate(overrideSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const override = await cdsOverrideService.recordOverride({
        ...req.body,
        userId,
      });
      res.status(201).json(override);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /cds-services/feedback - Record CDS feedback
// ---------------------------------------------------------------------------
router.post(
  '/feedback',
  authenticate,
  requirePermission('cds', 'write'),
  validate(feedbackSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const feedback = await cdsOverrideService.recordFeedback({
        ...req.body,
        userId,
      });
      res.status(201).json(feedback);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /cds-services/overrides/:patientId - Get overrides for a patient
// ---------------------------------------------------------------------------
router.get(
  '/overrides/:patientId',
  authenticate,
  requirePermission('cds', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const overrides = await cdsOverrideService.getOverridesForPatient(
        req.params.patientId
      );
      res.json(overrides);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /cds-services/:hookId - Service invocation
// Invokes all services registered for the given hook
// ---------------------------------------------------------------------------
router.post(
  '/:hookId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hookId } = req.params;
      const cdsRequest = req.body;

      // Validate request has required fields per CDS Hooks spec
      if (!cdsRequest.hook || !cdsRequest.hookInstance) {
        return res.status(400).json({
          error: 'Missing required fields: hook and hookInstance',
        });
      }

      const response = await cdsEngine.invoke(hookId, cdsRequest);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
export { cdsEngine };
