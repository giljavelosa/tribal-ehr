// =============================================================================
// Immunizations Routes
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { immunizationService } from '../services/immunization.service';

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

const quantitySchema = z.object({
  value: z.number().optional(),
  unit: z.string().optional(),
  system: z.string().optional(),
  code: z.string().optional(),
});

const immunizationCreateSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  status: z.enum(['completed', 'entered-in-error', 'not-done']),
  vaccineCode: codeableConceptSchema,
  occurrenceDateTime: z.string(),
  recorded: z.string().optional(),
  primarySource: z.boolean().optional(),
  lotNumber: z.string().optional(),
  expirationDate: z.string().optional(),
  site: codeableConceptSchema.optional(),
  route: codeableConceptSchema.optional(),
  doseQuantity: quantitySchema.optional(),
  performer: z.array(z.object({
    function: codeableConceptSchema.optional(),
    actor: referenceSchema,
  })).optional(),
  note: z.array(z.object({
    authorReference: referenceSchema.optional(),
    authorString: z.string().optional(),
    time: z.string().optional(),
    text: z.string(),
  })).optional(),
  reaction: z.array(z.object({
    date: z.string().optional(),
    detail: referenceSchema.optional(),
    reported: z.boolean().optional(),
  })).optional(),
  protocolApplied: z.array(z.object({
    series: z.string().optional(),
    authority: referenceSchema.optional(),
    targetDisease: z.array(codeableConceptSchema).optional(),
    doseNumberPositiveInt: z.number().int().positive().optional(),
    doseNumberString: z.string().optional(),
    seriesDosesPositiveInt: z.number().int().positive().optional(),
    seriesDosesString: z.string().optional(),
  })).optional(),
});

const immunizationUpdateSchema = immunizationCreateSchema.partial();

const immunizationSearchSchema = z.object({
  patientId: z.string(),
  vaccineCode: z.string().optional(),
  status: z.string().optional(),
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

// Search immunizations (GET /)
router.get(
  '/',
  authenticate,
  requirePermission('immunizations', 'read'),
  validateQuery(immunizationSearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await immunizationService.search(req.query as never);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get immunization history (GET /history/:patientId)
router.get(
  '/history/:patientId',
  authenticate,
  requirePermission('immunizations', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const history = await immunizationService.getImmunizationHistory(req.params.patientId);
      res.json({ data: history });
    } catch (error) {
      next(error);
    }
  }
);

// Get immunization by ID (GET /:id)
router.get(
  '/:id',
  authenticate,
  requirePermission('immunizations', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const immunization = await immunizationService.getById(req.params.id);
      res.json(immunization);
    } catch (error) {
      next(error);
    }
  }
);

// Create immunization (POST /)
router.post(
  '/',
  authenticate,
  requirePermission('immunizations', 'write'),
  validate(immunizationCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const immunization = await immunizationService.create(req.body);
      res.status(201).json(immunization);
    } catch (error) {
      next(error);
    }
  }
);

// Update immunization (PUT /:id)
router.put(
  '/:id',
  authenticate,
  requirePermission('immunizations', 'write'),
  validate(immunizationUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const immunization = await immunizationService.update(req.params.id, req.body);
      res.json(immunization);
    } catch (error) {
      next(error);
    }
  }
);

// Delete immunization (DELETE /:id)
router.delete(
  '/:id',
  authenticate,
  requirePermission('immunizations', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await immunizationService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
