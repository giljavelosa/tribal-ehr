// =============================================================================
// Goals Routes
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { goalService } from '../services/goal.service';

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

const goalCreateSchema = z.object({
  patientId: z.string().uuid(),
  lifecycleStatus: z.enum(['proposed', 'planned', 'accepted', 'active', 'on-hold', 'completed', 'cancelled', 'entered-in-error', 'rejected']),
  achievementStatus: z.enum(['in-progress', 'improving', 'worsening', 'no-change', 'achieved', 'sustaining', 'not-achieved', 'no-progress', 'not-attainable']).optional(),
  description: codeableConceptSchema,
  subject: referenceSchema,
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  statusDate: z.string().optional(),
  expressedBy: referenceSchema.optional(),
  addresses: z.array(referenceSchema).optional(),
  note: z.array(z.object({
    authorReference: referenceSchema.optional(),
    authorString: z.string().optional(),
    time: z.string().optional(),
    text: z.string(),
  })).optional(),
});

const goalUpdateSchema = goalCreateSchema.partial();

const goalSearchSchema = z.object({
  patientId: z.string(),
  lifecycleStatus: z.string().optional(),
  achievementStatus: z.string().optional(),
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

// Search goals (GET /)
router.get(
  '/',
  authenticate,
  requirePermission('goals', 'read'),
  validateQuery(goalSearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await goalService.search(req.query as never);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get goal by ID (GET /:id)
router.get(
  '/:id',
  authenticate,
  requirePermission('goals', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const goal = await goalService.getById(req.params.id);
      res.json(goal);
    } catch (error) {
      next(error);
    }
  }
);

// Create goal (POST /)
router.post(
  '/',
  authenticate,
  requirePermission('goals', 'write'),
  validate(goalCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const goal = await goalService.create(req.body);
      res.status(201).json(goal);
    } catch (error) {
      next(error);
    }
  }
);

// Update goal (PUT /:id)
router.put(
  '/:id',
  authenticate,
  requirePermission('goals', 'write'),
  validate(goalUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const goal = await goalService.update(req.params.id, req.body);
      res.json(goal);
    } catch (error) {
      next(error);
    }
  }
);

// Delete goal (DELETE /:id)
router.delete(
  '/:id',
  authenticate,
  requirePermission('goals', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await goalService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
