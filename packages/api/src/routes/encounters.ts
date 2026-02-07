// =============================================================================
// Encounters Routes
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { encounterService } from '../services/encounter.service';

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

const encounterCreateSchema = z.object({
  patientId: z.string().uuid(),
  status: z.enum(['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled', 'entered-in-error', 'unknown']),
  class: z.enum(['AMB', 'EMER', 'FLD', 'HH', 'IMP', 'ACUTE', 'NONAC', 'OBSENC', 'PRENC', 'SS', 'VR']),
  type: z.array(codeableConceptSchema).optional(),
  priority: codeableConceptSchema.optional(),
  period: periodSchema.optional(),
  reasonCode: z.array(codeableConceptSchema).optional(),
  diagnosis: z.array(z.object({
    condition: referenceSchema,
    use: codeableConceptSchema.optional(),
    rank: z.number().int().positive().optional(),
  })).optional(),
  participant: z.array(z.object({
    type: z.array(codeableConceptSchema).optional(),
    period: periodSchema.optional(),
    individual: referenceSchema.optional(),
  })).optional(),
  location: z.array(z.object({
    location: referenceSchema,
    status: z.enum(['planned', 'active', 'reserved', 'completed']).optional(),
    period: periodSchema.optional(),
  })).optional(),
  serviceProvider: referenceSchema.optional(),
  hospitalization: z.object({
    preAdmissionIdentifier: z.object({
      system: z.string().optional(),
      value: z.string().optional(),
    }).optional(),
    origin: referenceSchema.optional(),
    admitSource: codeableConceptSchema.optional(),
    reAdmission: codeableConceptSchema.optional(),
    dietPreference: z.array(codeableConceptSchema).optional(),
    specialCourtesy: z.array(codeableConceptSchema).optional(),
    specialArrangement: z.array(codeableConceptSchema).optional(),
    destination: referenceSchema.optional(),
    dischargeDisposition: codeableConceptSchema.optional(),
  }).optional(),
});

const encounterUpdateSchema = encounterCreateSchema.partial();

const encounterSearchSchema = z.object({
  patientId: z.string(),
  status: z.string().optional(),
  encounterClass: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  provider: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Search encounters (GET /)
router.get(
  '/',
  authenticate,
  requirePermission('encounters', 'read'),
  validateQuery(encounterSearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await encounterService.search(req.query as never);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get current encounter for a patient (GET /current/:patientId)
router.get(
  '/current/:patientId',
  authenticate,
  requirePermission('encounters', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const encounter = await encounterService.getCurrentEncounter(req.params.patientId);
      if (!encounter) {
        res.json({ data: null });
        return;
      }
      res.json({ data: encounter });
    } catch (error) {
      next(error);
    }
  }
);

// Get encounter by ID (GET /:id)
router.get(
  '/:id',
  authenticate,
  requirePermission('encounters', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const encounter = await encounterService.getById(req.params.id);
      res.json(encounter);
    } catch (error) {
      next(error);
    }
  }
);

// Create encounter (POST /)
router.post(
  '/',
  authenticate,
  requirePermission('encounters', 'write'),
  validate(encounterCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const encounter = await encounterService.create(req.body);
      res.status(201).json(encounter);
    } catch (error) {
      next(error);
    }
  }
);

// Update encounter (PUT /:id)
router.put(
  '/:id',
  authenticate,
  requirePermission('encounters', 'write'),
  validate(encounterUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const encounter = await encounterService.update(req.params.id, req.body);
      res.json(encounter);
    } catch (error) {
      next(error);
    }
  }
);

// Delete encounter (DELETE /:id)
router.delete(
  '/:id',
  authenticate,
  requirePermission('encounters', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await encounterService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
