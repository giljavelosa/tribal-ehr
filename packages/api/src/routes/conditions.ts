// =============================================================================
// Conditions Routes - Problems, Diagnoses, Health Concerns
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { conditionService } from '../services/condition.service';
import { consentEnforcementService, SensitivityCategory, SensitivityLevel } from '../services/consent-enforcement.service';
import { logger } from '../utils/logger';

const router = Router();

// ---------------------------------------------------------------------------
// Sensitive Condition Auto-Tagging
// ICD-10 code ranges that require automatic sensitivity tagging per 42 CFR Part 2
// and state-level consent laws for substance abuse, mental health, HIV/STI
// ---------------------------------------------------------------------------

interface SensitiveCodeRange {
  prefix: string;
  category: SensitivityCategory;
  level: SensitivityLevel;
}

const SENSITIVE_CODE_RANGES: SensitiveCodeRange[] = [
  // Substance abuse: ICD-10 F10-F19
  { prefix: 'F10', category: 'substance-abuse', level: 'very-restricted' },
  { prefix: 'F11', category: 'substance-abuse', level: 'very-restricted' },
  { prefix: 'F12', category: 'substance-abuse', level: 'very-restricted' },
  { prefix: 'F13', category: 'substance-abuse', level: 'very-restricted' },
  { prefix: 'F14', category: 'substance-abuse', level: 'very-restricted' },
  { prefix: 'F15', category: 'substance-abuse', level: 'very-restricted' },
  { prefix: 'F16', category: 'substance-abuse', level: 'very-restricted' },
  { prefix: 'F17', category: 'substance-abuse', level: 'very-restricted' },
  { prefix: 'F18', category: 'substance-abuse', level: 'very-restricted' },
  { prefix: 'F19', category: 'substance-abuse', level: 'very-restricted' },
  // Mental health: ICD-10 F20-F48
  { prefix: 'F20', category: 'mental-health', level: 'restricted' },
  { prefix: 'F21', category: 'mental-health', level: 'restricted' },
  { prefix: 'F22', category: 'mental-health', level: 'restricted' },
  { prefix: 'F23', category: 'mental-health', level: 'restricted' },
  { prefix: 'F24', category: 'mental-health', level: 'restricted' },
  { prefix: 'F25', category: 'mental-health', level: 'restricted' },
  { prefix: 'F28', category: 'mental-health', level: 'restricted' },
  { prefix: 'F29', category: 'mental-health', level: 'restricted' },
  { prefix: 'F30', category: 'mental-health', level: 'restricted' },
  { prefix: 'F31', category: 'mental-health', level: 'restricted' },
  { prefix: 'F32', category: 'mental-health', level: 'restricted' },
  { prefix: 'F33', category: 'mental-health', level: 'restricted' },
  { prefix: 'F34', category: 'mental-health', level: 'restricted' },
  { prefix: 'F39', category: 'mental-health', level: 'restricted' },
  { prefix: 'F40', category: 'mental-health', level: 'restricted' },
  { prefix: 'F41', category: 'mental-health', level: 'restricted' },
  { prefix: 'F42', category: 'mental-health', level: 'restricted' },
  { prefix: 'F43', category: 'mental-health', level: 'restricted' },
  { prefix: 'F44', category: 'mental-health', level: 'restricted' },
  { prefix: 'F45', category: 'mental-health', level: 'restricted' },
  { prefix: 'F48', category: 'mental-health', level: 'restricted' },
  // HIV: ICD-10 B20, Z21
  { prefix: 'B20', category: 'hiv-sti', level: 'very-restricted' },
  { prefix: 'Z21', category: 'hiv-sti', level: 'very-restricted' },
  // STI: ICD-10 A50-A64
  { prefix: 'A50', category: 'hiv-sti', level: 'restricted' },
  { prefix: 'A51', category: 'hiv-sti', level: 'restricted' },
  { prefix: 'A52', category: 'hiv-sti', level: 'restricted' },
  { prefix: 'A53', category: 'hiv-sti', level: 'restricted' },
  { prefix: 'A54', category: 'hiv-sti', level: 'restricted' },
  { prefix: 'A55', category: 'hiv-sti', level: 'restricted' },
  { prefix: 'A56', category: 'hiv-sti', level: 'restricted' },
  { prefix: 'A57', category: 'hiv-sti', level: 'restricted' },
  { prefix: 'A58', category: 'hiv-sti', level: 'restricted' },
  { prefix: 'A59', category: 'hiv-sti', level: 'restricted' },
  { prefix: 'A60', category: 'hiv-sti', level: 'restricted' },
  { prefix: 'A63', category: 'hiv-sti', level: 'restricted' },
  { prefix: 'A64', category: 'hiv-sti', level: 'restricted' },
];

/**
 * Check if a condition code falls into a sensitive category and return the
 * matching sensitivity information, or null if the code is not sensitive.
 */
function detectSensitiveCondition(
  codeCode: string | undefined,
): { category: SensitivityCategory; level: SensitivityLevel } | null {
  if (!codeCode) return null;

  const upperCode = codeCode.toUpperCase();
  for (const range of SENSITIVE_CODE_RANGES) {
    if (upperCode.startsWith(range.prefix)) {
      return { category: range.category, level: range.level };
    }
  }
  return null;
}

/**
 * Auto-tag a condition resource with sensitivity metadata if its ICD-10 code
 * falls into a protected category. Fire-and-forget: failures are logged but
 * do not block the response.
 */
async function autoTagSensitiveCondition(
  conditionId: string,
  codeCode: string | undefined,
  taggedBy: string,
): Promise<void> {
  try {
    const sensitivity = detectSensitiveCondition(codeCode);
    if (!sensitivity) return;

    await consentEnforcementService.tagResource(
      'Condition',
      conditionId,
      sensitivity.level,
      sensitivity.category,
      taggedBy,
    );

    logger.info('Auto-tagged sensitive condition', {
      conditionId,
      code: codeCode,
      category: sensitivity.category,
      level: sensitivity.level,
    });
  } catch (error) {
    logger.error('Failed to auto-tag sensitive condition', {
      conditionId,
      code: codeCode,
      error,
    });
  }
}

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

      // Auto-tag sensitive conditions (fire-and-forget)
      const conditionCode = req.body.code?.coding?.[0]?.code;
      autoTagSensitiveCondition(condition.id, conditionCode, req.user!.id);

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
