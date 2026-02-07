// =============================================================================
// Conditions Routes - Problems, Diagnoses, Health Concerns
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { conditionService } from '../services/condition.service';

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

const conditionCreateSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  clinicalStatus: z.enum(['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved']),
  verificationStatus: z.enum(['unconfirmed', 'provisional', 'differential', 'confirmed', 'refuted', 'entered-in-error']),
  category: z.array(z.enum(['problem-list-item', 'encounter-diagnosis', 'health-concern'])).optional(),
  severity: codeableConceptSchema.optional(),
  code: codeableConceptSchema,
  bodySite: z.array(codeableConceptSchema).optional(),
  onsetDateTime: z.string().optional(),
  abatementDateTime: z.string().optional(),
  recordedDate: z.string().optional(),
  recorder: referenceSchema.optional(),
  evidence: z.array(z.object({
    code: z.array(codeableConceptSchema).optional(),
    detail: z.array(referenceSchema).optional(),
  })).optional(),
});

const conditionUpdateSchema = conditionCreateSchema.partial();

const conditionSearchSchema = z.object({
  patientId: z.string(),
  clinicalStatus: z.string().optional(),
  verificationStatus: z.string().optional(),
  category: z.string().optional(),
  code: z.string().optional(),
  onsetDateFrom: z.string().optional(),
  onsetDateTo: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Search conditions (GET /)
router.get(
  '/',
  authenticate,
  requirePermission('conditions', 'read'),
  validateQuery(conditionSearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await conditionService.search(req.query as never);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get condition by ID (GET /:id)
router.get(
  '/:id',
  authenticate,
  requirePermission('conditions', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const condition = await conditionService.getById(req.params.id);
      res.json(condition);
    } catch (error) {
      next(error);
    }
  }
);

// Create condition (POST /)
router.post(
  '/',
  authenticate,
  requirePermission('conditions', 'write'),
  validate(conditionCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const condition = await conditionService.create(req.body);
      res.status(201).json(condition);
    } catch (error) {
      next(error);
    }
  }
);

// Update condition (PUT /:id)
router.put(
  '/:id',
  authenticate,
  requirePermission('conditions', 'write'),
  validate(conditionUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const condition = await conditionService.update(req.params.id, req.body);
      res.json(condition);
    } catch (error) {
      next(error);
    }
  }
);

// Reconcile conditions (POST /reconcile) — §170.315(b)(2)
const conditionReconcileSchema = z.object({
  patientId: z.string().uuid(),
  conditions: z.array(z.object({
    id: z.string().uuid().optional(),
    action: z.enum(['confirm', 'modify', 'resolve']),
    clinicalStatus: z.enum(['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved']).optional(),
    verificationStatus: z.enum(['unconfirmed', 'provisional', 'differential', 'confirmed', 'refuted', 'entered-in-error']).optional(),
    severity: codeableConceptSchema.optional(),
    code: codeableConceptSchema.optional(),
  })),
});

router.post(
  '/reconcile',
  authenticate,
  requirePermission('conditions', 'write'),
  validate(conditionReconcileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientId, conditions } = req.body;
      const result = await conditionService.reconcile(patientId, conditions);
      res.json({ reconciled: result });
    } catch (error) {
      next(error);
    }
  }
);

// Delete condition (DELETE /:id)
router.delete(
  '/:id',
  authenticate,
  requirePermission('conditions', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await conditionService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
