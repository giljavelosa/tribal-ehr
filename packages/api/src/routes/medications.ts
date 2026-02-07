// =============================================================================
// Medications Routes - MedicationRequest
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { medicationService } from '../services/medication.service';

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

const medicationCreateSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  status: z.enum(['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown']),
  intent: z.enum(['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option']),
  medication: codeableConceptSchema,
  authoredOn: z.string().optional(),
  requester: referenceSchema.optional(),
  dosageInstruction: z.array(z.object({
    sequence: z.number().optional(),
    text: z.string().optional(),
    timing: z.object({
      repeat: z.object({
        frequency: z.number().optional(),
        period: z.number().optional(),
        periodUnit: z.enum(['s', 'min', 'h', 'd', 'wk', 'mo', 'a']).optional(),
        when: z.array(z.string()).optional(),
      }).optional(),
      code: codeableConceptSchema.optional(),
    }).optional(),
    route: codeableConceptSchema.optional(),
    method: codeableConceptSchema.optional(),
    doseAndRate: z.array(z.object({
      type: codeableConceptSchema.optional(),
      doseQuantity: quantitySchema.optional(),
    })).optional(),
  })).optional(),
  dispenseRequest: z.object({
    initialFill: z.object({
      quantity: quantitySchema.optional(),
      duration: quantitySchema.optional(),
    }).optional(),
    dispenseInterval: quantitySchema.optional(),
    validityPeriod: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
    numberOfRepeatsAllowed: z.number().int().nonnegative().optional(),
    quantity: quantitySchema.optional(),
    expectedSupplyDuration: quantitySchema.optional(),
    performer: referenceSchema.optional(),
  }).optional(),
  substitution: z.object({
    allowedBoolean: z.boolean().optional(),
    allowedCodeableConcept: codeableConceptSchema.optional(),
    reason: codeableConceptSchema.optional(),
  }).optional(),
  priorPrescription: referenceSchema.optional(),
  note: z.array(z.object({ text: z.string() })).optional(),
});

const medicationUpdateSchema = medicationCreateSchema.partial();

const medicationSearchSchema = z.object({
  patientId: z.string(),
  status: z.string().optional(),
  intent: z.string().optional(),
  code: z.string().optional(),
  requester: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

const reconcileSchema = z.object({
  patientId: z.string().uuid(),
  medications: z.array(z.object({
    id: z.string().uuid().optional(),
    status: z.enum(['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown']),
    medication: codeableConceptSchema,
    dosageInstruction: z.array(z.any()).optional(),
    note: z.string().optional(),
  })),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Search medications (GET /)
router.get(
  '/',
  authenticate,
  requirePermission('medications', 'read'),
  validateQuery(medicationSearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await medicationService.search(req.query as never);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get active medications for a patient (GET /active/:patientId)
router.get(
  '/active/:patientId',
  authenticate,
  requirePermission('medications', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const medications = await medicationService.getActiveMedications(req.params.patientId);
      res.json({ data: medications });
    } catch (error) {
      next(error);
    }
  }
);

// Medication reconciliation (POST /reconcile)
router.post(
  '/reconcile',
  authenticate,
  requirePermission('medications', 'write'),
  validate(reconcileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientId, medications } = req.body;
      const result = await medicationService.reconcile(patientId, medications);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

// Get medication by ID (GET /:id)
router.get(
  '/:id',
  authenticate,
  requirePermission('medications', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const medication = await medicationService.getById(req.params.id);
      res.json(medication);
    } catch (error) {
      next(error);
    }
  }
);

// Create medication (POST /)
router.post(
  '/',
  authenticate,
  requirePermission('medications', 'write'),
  validate(medicationCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const medication = await medicationService.create(req.body);
      res.status(201).json(medication);
    } catch (error) {
      next(error);
    }
  }
);

// Update medication (PUT /:id)
router.put(
  '/:id',
  authenticate,
  requirePermission('medications', 'write'),
  validate(medicationUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const medication = await medicationService.update(req.params.id, req.body);
      res.json(medication);
    } catch (error) {
      next(error);
    }
  }
);

// Delete medication (DELETE /:id)
router.delete(
  '/:id',
  authenticate,
  requirePermission('medications', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await medicationService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
