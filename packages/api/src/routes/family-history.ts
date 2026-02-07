// =============================================================================
// Family Health History Routes - ONC §170.315(a)(12)
// CRUD operations for family health history with FHIR export
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { familyHistoryService } from '../services/family-history.service';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET / - List all family history for a patient
// ---------------------------------------------------------------------------

router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId = req.query.patientId as string;
      if (!patientId) {
        return res.status(400).json({ error: { message: 'patientId query parameter is required' } });
      }
      const records = await familyHistoryService.getByPatient(patientId);
      res.json({ data: records });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:id - Get single family history record
// ---------------------------------------------------------------------------

router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await familyHistoryService.getById(req.params.id);
      res.json({ data: record });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST / - Create new family history record
// ---------------------------------------------------------------------------

router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await familyHistoryService.create({
        ...req.body,
        recordedBy: req.user!.id,
      });
      res.status(201).json({ data: record });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /:id - Update family history record
// ---------------------------------------------------------------------------

router.put(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await familyHistoryService.update(req.params.id, req.body);
      res.json({ data: record });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:id - Soft delete (set status to entered-in-error)
// ---------------------------------------------------------------------------

router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await familyHistoryService.delete(req.params.id);
      res.json({ data: record });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:patientId/fhir - Get as FHIR Bundle of FamilyMemberHistory resources
// ---------------------------------------------------------------------------

router.get(
  '/:patientId/fhir',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const records = await familyHistoryService.getByPatient(req.params.patientId);
      const bundle = familyHistoryService.toFHIRBundle(records);
      res.json(bundle);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
