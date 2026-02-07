// =============================================================================
// Devices Routes - Implantable Device (UDI)
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { deviceService } from '../services/device.service';

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

const udiCarrierSchema = z.object({
  deviceIdentifier: z.string().optional(),
  issuer: z.string().optional(),
  jurisdiction: z.string().optional(),
  carrierAIDC: z.string().optional(),
  carrierHRF: z.string().optional(),
});

const deviceCreateSchema = z.object({
  patientId: z.string().uuid(),
  udiCarrier: z.array(udiCarrierSchema).optional(),
  status: z.enum(['active', 'inactive', 'entered-in-error', 'unknown']).optional(),
  type: codeableConceptSchema.optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  expirationDate: z.string().optional(),
});

const deviceUpdateSchema = deviceCreateSchema.partial();

const deviceSearchSchema = z.object({
  patientId: z.string(),
  type: z.string().optional(),
  status: z.string().optional(),
  udi: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Search devices (GET /)
router.get(
  '/',
  authenticate,
  requirePermission('devices', 'read'),
  validateQuery(deviceSearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await deviceService.search(req.query as never);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get device by ID (GET /:id)
router.get(
  '/:id',
  authenticate,
  requirePermission('devices', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const device = await deviceService.getById(req.params.id);
      res.json(device);
    } catch (error) {
      next(error);
    }
  }
);

// Create device (POST /)
router.post(
  '/',
  authenticate,
  requirePermission('devices', 'write'),
  validate(deviceCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const device = await deviceService.create(req.body);
      res.status(201).json(device);
    } catch (error) {
      next(error);
    }
  }
);

// Update device (PUT /:id)
router.put(
  '/:id',
  authenticate,
  requirePermission('devices', 'write'),
  validate(deviceUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const device = await deviceService.update(req.params.id, req.body);
      res.json(device);
    } catch (error) {
      next(error);
    }
  }
);

// Delete device (DELETE /:id)
router.delete(
  '/:id',
  authenticate,
  requirePermission('devices', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deviceService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
