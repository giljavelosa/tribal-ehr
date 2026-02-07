// =============================================================================
// Clinical Quality Measures Routes
// ONC Certification: 170.315(c)(1)-(3)
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission, requireRole } from '../middleware/auth';
import { qualityMeasuresService } from '../services/quality-measures.service';
import { auditService } from '../services/audit.service';
import { ValidationError } from '../utils/errors';

const router = Router();

// ---------------------------------------------------------------------------
// Helper: parse and validate period query parameters
// ---------------------------------------------------------------------------

function parsePeriod(req: Request): { start: string; end: string } {
  const start = req.query.start as string;
  const end = req.query.end as string;

  if (!start || !end) {
    throw new ValidationError(
      'Query parameters "start" and "end" are required (ISO date format, e.g. 2025-01-01)'
    );
  }

  // Basic date validation
  if (isNaN(Date.parse(start)) || isNaN(Date.parse(end))) {
    throw new ValidationError('Invalid date format for start or end parameter');
  }

  if (new Date(start) >= new Date(end)) {
    throw new ValidationError('Start date must be before end date');
  }

  return { start, end };
}

// ---------------------------------------------------------------------------
// GET /calculate/:measureId - Calculate a specific quality measure
// ---------------------------------------------------------------------------

router.get(
  '/calculate/:measureId',
  authenticate,
  requirePermission('quality-measures', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = parsePeriod(req);
      const result = await qualityMeasuresService.calculateMeasure(
        req.params.measureId,
        period
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'QualityMeasure',
        resourceId: req.params.measureId,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: `CQM calculation: ${req.params.measureId}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /calculate-all - Calculate all quality measures
// ---------------------------------------------------------------------------

router.get(
  '/calculate-all',
  authenticate,
  requirePermission('quality-measures', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = parsePeriod(req);
      const results = await qualityMeasuresService.calculateAllMeasures(period);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'QualityMeasure',
        resourceId: 'all',
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: 'CQM calculation: all measures',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: results });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /export/qrda-i/:patientId/:measureId - Export QRDA Category I
// ---------------------------------------------------------------------------

router.get(
  '/export/qrda-i/:patientId/:measureId',
  authenticate,
  requirePermission('quality-measures', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = parsePeriod(req);
      const document = await qualityMeasuresService.exportQRDAI(
        req.params.patientId,
        req.params.measureId,
        period
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'QualityMeasure',
        resourceId: `${req.params.measureId}/${req.params.patientId}`,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: `QRDA-I export: ${req.params.measureId} for patient ${req.params.patientId}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      // Return as XML if Accept header requests it, otherwise JSON wrapper
      const acceptsXml =
        req.accepts('application/xml') || req.accepts('text/xml');

      if (acceptsXml) {
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="QRDA-I_${req.params.measureId}_${req.params.patientId}.xml"`
        );
        res.send(document.content);
      } else {
        res.json({ data: document });
      }
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /export/qrda-iii - Export QRDA Category III
// ---------------------------------------------------------------------------

router.get(
  '/export/qrda-iii',
  authenticate,
  requirePermission('quality-measures', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = parsePeriod(req);

      // Optional: specify measure IDs as comma-separated list
      const measureIdsParam = req.query.measureIds as string | undefined;
      const measureIds = measureIdsParam
        ? measureIdsParam.split(',').map((id) => id.trim())
        : [];

      const document = await qualityMeasuresService.exportQRDAIII(
        measureIds,
        period
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'QualityMeasure',
        resourceId: 'qrda-iii',
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: 'QRDA-III aggregate export',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      const acceptsXml =
        req.accepts('application/xml') || req.accepts('text/xml');

      if (acceptsXml) {
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="QRDA-III_${period.start}_${period.end}.xml"`
        );
        res.send(document.content);
      } else {
        res.json({ data: document });
      }
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /dashboard - Quality measures dashboard data
// ---------------------------------------------------------------------------

router.get(
  '/dashboard',
  authenticate,
  requirePermission('quality-measures', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = parsePeriod(req);
      const dashboard = await qualityMeasuresService.getDashboard(period);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'QualityMeasure',
        resourceId: 'dashboard',
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: 'Quality measures dashboard',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: dashboard });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
