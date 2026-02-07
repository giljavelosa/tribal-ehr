// =============================================================================
// Observations Routes - Vitals, Labs, Smoking Status, SDOH
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { observationService } from '../services/observation.service';

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
  comparator: z.enum(['<', '<=', '>=', '>']).optional(),
  unit: z.string().optional(),
  system: z.string().optional(),
  code: z.string().optional(),
});

const observationCreateSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  status: z.enum(['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown']),
  category: z.array(codeableConceptSchema).optional(),
  code: codeableConceptSchema,
  effectiveDateTime: z.string().optional(),
  issued: z.string().optional(),
  valueQuantity: quantitySchema.optional(),
  valueCodeableConcept: codeableConceptSchema.optional(),
  valueString: z.string().optional(),
  valueBoolean: z.boolean().optional(),
  interpretation: z.array(codeableConceptSchema).optional(),
  referenceRange: z.array(z.object({
    low: quantitySchema.optional(),
    high: quantitySchema.optional(),
    type: codeableConceptSchema.optional(),
    text: z.string().optional(),
  })).optional(),
  component: z.array(z.object({
    code: codeableConceptSchema,
    valueQuantity: quantitySchema.optional(),
    valueCodeableConcept: codeableConceptSchema.optional(),
    valueString: z.string().optional(),
    valueBoolean: z.boolean().optional(),
  })).optional(),
  note: z.array(z.object({ text: z.string() })).optional(),
  performer: z.array(referenceSchema).optional(),
  device: referenceSchema.optional(),
});

const observationUpdateSchema = observationCreateSchema.partial();

const observationSearchSchema = z.object({
  patientId: z.string(),
  category: z.string().optional(),
  code: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  encounterId: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

const vitalsCreateSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  systolicBP: z.number().positive().optional(),
  diastolicBP: z.number().positive().optional(),
  heartRate: z.number().positive().optional(),
  respiratoryRate: z.number().positive().optional(),
  temperature: z.number().positive().optional(),
  temperatureUnit: z.enum(['Cel', '[degF]']).optional(),
  spO2: z.number().min(0).max(100).optional(),
  heightValue: z.number().positive().optional(),
  heightUnit: z.enum(['cm', '[in_i]']).optional(),
  weightValue: z.number().positive().optional(),
  weightUnit: z.enum(['kg', '[lb_av]']).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Search observations (GET /)
router.get(
  '/',
  authenticate,
  requirePermission('observations', 'read'),
  validateQuery(observationSearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await observationService.search(req.query as never);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Create batch vital signs (POST /vitals)
router.post(
  '/vitals',
  authenticate,
  requirePermission('observations', 'write'),
  validate(vitalsCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientId, encounterId, ...vitals } = req.body;
      const observations = await observationService.createVitalSigns(
        patientId,
        encounterId,
        vitals
      );
      res.status(201).json({ data: observations, count: observations.length });
    } catch (error) {
      next(error);
    }
  }
);

// Get latest vitals for patient (GET /vitals/:patientId/latest)
router.get(
  '/vitals/:patientId/latest',
  authenticate,
  requirePermission('observations', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const latestVitals = await observationService.getLatestVitals(req.params.patientId);
      res.json({ data: latestVitals });
    } catch (error) {
      next(error);
    }
  }
);

// Get vitals trending data (GET /vitals/:patientId/trending)
router.get(
  '/vitals/:patientId/trending',
  authenticate,
  requirePermission('observations', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, dateFrom, dateTo, limit } = req.query as {
        code?: string;
        dateFrom?: string;
        dateTo?: string;
        limit?: string;
      };

      if (!code) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'code query parameter is required for trending data',
          },
        });
        return;
      }

      const trendingData = await observationService.getVitalsTrending(
        req.params.patientId,
        code,
        dateFrom,
        dateTo,
        limit ? parseInt(limit, 10) : undefined
      );
      res.json({ data: trendingData });
    } catch (error) {
      next(error);
    }
  }
);

// Get observation by ID (GET /:id)
router.get(
  '/:id',
  authenticate,
  requirePermission('observations', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const observation = await observationService.getById(req.params.id);
      res.json(observation);
    } catch (error) {
      next(error);
    }
  }
);

// Create observation (POST /)
router.post(
  '/',
  authenticate,
  requirePermission('observations', 'write'),
  validate(observationCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const observation = await observationService.create(req.body);
      res.status(201).json(observation);
    } catch (error) {
      next(error);
    }
  }
);

// Update observation (PUT /:id)
router.put(
  '/:id',
  authenticate,
  requirePermission('observations', 'write'),
  validate(observationUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const observation = await observationService.update(req.params.id, req.body);
      res.json(observation);
    } catch (error) {
      next(error);
    }
  }
);

// Delete observation (DELETE /:id)
router.delete(
  '/:id',
  authenticate,
  requirePermission('observations', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await observationService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
