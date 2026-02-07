// =============================================================================
// Allergies Routes - AllergyIntolerance
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { allergyService } from '../services/allergy.service';

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

const allergyCreateSchema = z.object({
  patientId: z.string().uuid(),
  clinicalStatus: z.enum(['active', 'inactive', 'resolved']),
  verificationStatus: z.enum(['unconfirmed', 'presumed', 'confirmed', 'refuted', 'entered-in-error']),
  type: z.enum(['allergy', 'intolerance']).optional(),
  category: z.array(z.enum(['food', 'medication', 'environment', 'biologic'])).optional(),
  criticality: z.enum(['low', 'high', 'unable-to-assess']).optional(),
  code: codeableConceptSchema,
  onsetDateTime: z.string().optional(),
  recordedDate: z.string().optional(),
  recorder: referenceSchema.optional(),
  reactions: z.array(z.object({
    substance: codeableConceptSchema.optional(),
    manifestation: z.array(codeableConceptSchema),
    severity: z.enum(['mild', 'moderate', 'severe']).optional(),
    exposureRoute: codeableConceptSchema.optional(),
    note: z.string().optional(),
  })).optional(),
});

const allergyUpdateSchema = allergyCreateSchema.partial();

const allergySearchSchema = z.object({
  patientId: z.string(),
  clinicalStatus: z.string().optional(),
  category: z.string().optional(),
  criticality: z.string().optional(),
  code: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Search allergies (GET /)
router.get(
  '/',
  authenticate,
  requirePermission('allergies', 'read'),
  validateQuery(allergySearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await allergyService.search(req.query as never);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get allergy by ID (GET /:id)
router.get(
  '/:id',
  authenticate,
  requirePermission('allergies', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allergy = await allergyService.getById(req.params.id);
      res.json(allergy);
    } catch (error) {
      next(error);
    }
  }
);

// Create allergy (POST /)
router.post(
  '/',
  authenticate,
  requirePermission('allergies', 'write'),
  validate(allergyCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allergy = await allergyService.create(req.body);
      res.status(201).json(allergy);
    } catch (error) {
      next(error);
    }
  }
);

// Update allergy (PUT /:id)
router.put(
  '/:id',
  authenticate,
  requirePermission('allergies', 'write'),
  validate(allergyUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allergy = await allergyService.update(req.params.id, req.body);
      res.json(allergy);
    } catch (error) {
      next(error);
    }
  }
);

// Reconcile allergies (POST /reconcile) — §170.315(b)(2)
const allergyReconcileSchema = z.object({
  patientId: z.string().uuid(),
  allergies: z.array(z.object({
    id: z.string().uuid().optional(),
    action: z.enum(['continue', 'modify', 'remove']),
    clinicalStatus: z.enum(['active', 'inactive', 'resolved']).optional(),
    verificationStatus: z.enum(['unconfirmed', 'presumed', 'confirmed', 'refuted', 'entered-in-error']).optional(),
    code: codeableConceptSchema.optional(),
    criticality: z.enum(['low', 'high', 'unable-to-assess']).optional(),
    reactions: z.array(z.object({
      substance: codeableConceptSchema.optional(),
      manifestation: z.array(codeableConceptSchema),
      severity: z.enum(['mild', 'moderate', 'severe']).optional(),
      exposureRoute: codeableConceptSchema.optional(),
      note: z.string().optional(),
    })).optional(),
  })),
});

router.post(
  '/reconcile',
  authenticate,
  requirePermission('allergies', 'write'),
  validate(allergyReconcileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientId, allergies } = req.body;
      const result = await allergyService.reconcile(patientId, allergies);
      res.json({ reconciled: result });
    } catch (error) {
      next(error);
    }
  }
);

// Delete allergy (DELETE /:id)
router.delete(
  '/:id',
  authenticate,
  requirePermission('allergies', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await allergyService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
