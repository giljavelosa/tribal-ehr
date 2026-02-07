// =============================================================================
// Procedures Routes
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { procedureService } from '../services/procedure.service';

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

const procedureCreateSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  status: z.enum(['preparation', 'in-progress', 'not-done', 'on-hold', 'stopped', 'completed', 'entered-in-error', 'unknown']),
  code: codeableConceptSchema,
  performedDateTime: z.string().optional(),
  performedPeriod: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
  }).optional(),
  recorder: referenceSchema.optional(),
  performer: z.array(z.object({
    function: codeableConceptSchema.optional(),
    actor: referenceSchema,
  })).optional(),
  location: referenceSchema.optional(),
  reasonCode: z.array(codeableConceptSchema).optional(),
  bodySite: z.array(codeableConceptSchema).optional(),
  outcome: codeableConceptSchema.optional(),
  report: z.array(referenceSchema).optional(),
  complication: z.array(codeableConceptSchema).optional(),
  note: z.array(z.object({
    authorReference: referenceSchema.optional(),
    authorString: z.string().optional(),
    time: z.string().optional(),
    text: z.string(),
  })).optional(),
});

const procedureUpdateSchema = procedureCreateSchema.partial();

const procedureSearchSchema = z.object({
  patientId: z.string(),
  status: z.string().optional(),
  code: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  encounterId: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Search procedures (GET /)
router.get(
  '/',
  authenticate,
  requirePermission('procedures', 'read'),
  validateQuery(procedureSearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await procedureService.search(req.query as never);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get procedure by ID (GET /:id)
router.get(
  '/:id',
  authenticate,
  requirePermission('procedures', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const procedure = await procedureService.getById(req.params.id);
      res.json(procedure);
    } catch (error) {
      next(error);
    }
  }
);

// Create procedure (POST /)
router.post(
  '/',
  authenticate,
  requirePermission('procedures', 'write'),
  validate(procedureCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const procedure = await procedureService.create(req.body);
      res.status(201).json(procedure);
    } catch (error) {
      next(error);
    }
  }
);

// Update procedure (PUT /:id)
router.put(
  '/:id',
  authenticate,
  requirePermission('procedures', 'write'),
  validate(procedureUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const procedure = await procedureService.update(req.params.id, req.body);
      res.json(procedure);
    } catch (error) {
      next(error);
    }
  }
);

// Delete procedure (DELETE /:id)
router.delete(
  '/:id',
  authenticate,
  requirePermission('procedures', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await procedureService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
