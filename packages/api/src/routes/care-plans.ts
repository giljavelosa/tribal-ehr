// =============================================================================
// Care Plans Routes
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { carePlanService } from '../services/careplan.service';

const router = Router();

// ---------------------------------------------------------------------------
// Validation Schemas
// ---------------------------------------------------------------------------

const codeableConceptSchema = z.object({
  coding: z.array(z.object({
    system: z.string().optional(),
    code: z.string().optional(),
    display: z.string().optional(),
  })).optional(),
  text: z.string().optional(),
});

const referenceSchema = z.object({
  reference: z.string().optional(),
  type: z.string().optional(),
  display: z.string().optional(),
});

const periodSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

const carePlanCreateSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  status: z.enum(['draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown']),
  intent: z.enum(['proposal', 'plan', 'order', 'option']),
  title: z.string().optional(),
  description: z.string().optional(),
  period: periodSchema.optional(),
  author: referenceSchema.optional(),
  careTeam: z.array(referenceSchema).optional(),
  addresses: z.array(referenceSchema).optional(),
  goal: z.array(referenceSchema).optional(),
  activity: z.array(z.object({
    outcomeCodeableConcept: z.array(codeableConceptSchema).optional(),
    outcomeReference: z.array(referenceSchema).optional(),
    progress: z.array(z.object({
      authorReference: referenceSchema.optional(),
      authorString: z.string().optional(),
      time: z.string().optional(),
      text: z.string(),
    })).optional(),
    reference: referenceSchema.optional(),
    detail: z.object({
      kind: z.string().optional(),
      code: codeableConceptSchema.optional(),
      status: z.enum(['not-started', 'scheduled', 'in-progress', 'on-hold', 'completed', 'cancelled', 'stopped', 'unknown', 'entered-in-error']),
      reasonCode: z.array(codeableConceptSchema).optional(),
      goal: z.array(referenceSchema).optional(),
      scheduledPeriod: periodSchema.optional(),
      scheduledString: z.string().optional(),
      location: referenceSchema.optional(),
      performer: z.array(referenceSchema).optional(),
      description: z.string().optional(),
    }).optional(),
  })).optional(),
});

const carePlanUpdateSchema = carePlanCreateSchema.partial();

const carePlanSearchSchema = z.object({
  patientId: z.string(),
  status: z.string().optional(),
  category: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Search care plans (GET /)
router.get(
  '/',
  authenticate,
  requirePermission('care-plans', 'read'),
  validateQuery(carePlanSearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await carePlanService.search(req.query as never);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get care plan by ID (GET /:id)
router.get(
  '/:id',
  authenticate,
  requirePermission('care-plans', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const carePlan = await carePlanService.getById(req.params.id);
      res.json(carePlan);
    } catch (error) {
      next(error);
    }
  }
);

// Create care plan (POST /)
router.post(
  '/',
  authenticate,
  requirePermission('care-plans', 'write'),
  validate(carePlanCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const carePlan = await carePlanService.create(req.body);
      res.status(201).json(carePlan);
    } catch (error) {
      next(error);
    }
  }
);

// Update care plan (PUT /:id)
router.put(
  '/:id',
  authenticate,
  requirePermission('care-plans', 'write'),
  validate(carePlanUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const carePlan = await carePlanService.update(req.params.id, req.body);
      res.json(carePlan);
    } catch (error) {
      next(error);
    }
  }
);

// Delete care plan (DELETE /:id)
router.delete(
  '/:id',
  authenticate,
  requirePermission('care-plans', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await carePlanService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
