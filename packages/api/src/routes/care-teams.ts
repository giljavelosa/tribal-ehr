// =============================================================================
// Care Teams Routes
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { careTeamService } from '../services/careteam.service';

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

const participantSchema = z.object({
  role: z.array(codeableConceptSchema).optional(),
  member: referenceSchema.optional(),
  period: periodSchema.optional(),
});

const careTeamCreateSchema = z.object({
  patientId: z.string().uuid(),
  status: z.enum(['proposed', 'active', 'suspended', 'inactive', 'entered-in-error']),
  name: z.string().optional(),
  period: periodSchema.optional(),
  participant: z.array(participantSchema).optional(),
});

const careTeamUpdateSchema = careTeamCreateSchema.partial();

const careTeamSearchSchema = z.object({
  patientId: z.string(),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

const addParticipantSchema = participantSchema;

const removeParticipantSchema = z.object({
  memberReference: z.string(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Search care teams (GET /)
router.get(
  '/',
  authenticate,
  requirePermission('care-teams', 'read'),
  validateQuery(careTeamSearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await careTeamService.search(req.query as never);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get care team by ID (GET /:id)
router.get(
  '/:id',
  authenticate,
  requirePermission('care-teams', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const careTeam = await careTeamService.getById(req.params.id);
      res.json(careTeam);
    } catch (error) {
      next(error);
    }
  }
);

// Create care team (POST /)
router.post(
  '/',
  authenticate,
  requirePermission('care-teams', 'write'),
  validate(careTeamCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const careTeam = await careTeamService.create(req.body);
      res.status(201).json(careTeam);
    } catch (error) {
      next(error);
    }
  }
);

// Add participant (POST /:id/participants)
router.post(
  '/:id/participants',
  authenticate,
  requirePermission('care-teams', 'write'),
  validate(addParticipantSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const careTeam = await careTeamService.addParticipant(req.params.id, req.body);
      res.json(careTeam);
    } catch (error) {
      next(error);
    }
  }
);

// Remove participant (DELETE /:id/participants)
router.delete(
  '/:id/participants',
  authenticate,
  requirePermission('care-teams', 'write'),
  validate(removeParticipantSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const careTeam = await careTeamService.removeParticipant(
        req.params.id,
        req.body.memberReference
      );
      res.json(careTeam);
    } catch (error) {
      next(error);
    }
  }
);

// Update care team (PUT /:id)
router.put(
  '/:id',
  authenticate,
  requirePermission('care-teams', 'write'),
  validate(careTeamUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const careTeam = await careTeamService.update(req.params.id, req.body);
      res.json(careTeam);
    } catch (error) {
      next(error);
    }
  }
);

// Delete care team (DELETE /:id)
router.delete(
  '/:id',
  authenticate,
  requirePermission('care-teams', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await careTeamService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
