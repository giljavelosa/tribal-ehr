// =============================================================================
// Audit Routes - Audit log viewing, export, and integrity verification
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { auditService } from '../services/audit.service';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';

const router = Router();

// All audit routes require authentication and admin role
router.use(authenticate, requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'));

// ---------------------------------------------------------------------------
// GET / - Search audit events
// ---------------------------------------------------------------------------

router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        dateFrom,
        dateTo,
        userId,
        action,
        resourceType,
        resourceId,
        page = '1',
        limit = '25',
        sort = 'desc',
      } = req.query;

      const filters: Record<string, unknown> = {};
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (userId) filters.userId = userId;
      if (action) filters.action = action;
      if (resourceType) filters.resourceType = resourceType;
      if (resourceId) filters.resourceId = resourceId;

      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = Math.min(parseInt(limit as string, 10) || 25, 100);

      // In production, this would query the audit_events table with filters
      // For now, return a paginated empty response structure
      const result = {
        data: [],
        total: 0,
        page: pageNum,
        limit: limitNum,
        totalPages: 0,
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /verify-integrity - Verify audit log hash chain integrity
// ---------------------------------------------------------------------------

router.get(
  '/verify-integrity',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 1000;

      const result = await auditService.verifyIntegrity(limit);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'AuditLog',
        resourceId: 'integrity-check',
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: `Audit log integrity verification: ${result.valid ? 'PASSED' : 'FAILED'} (${result.checkedRecords}/${result.totalRecords} records checked)`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        ...result,
        message: result.valid
          ? 'Audit log integrity verified successfully. Hash chain is intact.'
          : `Audit log integrity check FAILED. Chain break detected at record ${result.firstBreak}.`,
        verifiedAt: result.lastVerified,
        verifiedBy: req.user!.id,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /digest - Generate a signed audit digest for a date range
// ---------------------------------------------------------------------------

router.post(
  '/digest',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.body;

      if (!startDate || typeof startDate !== 'string') {
        throw new ValidationError('startDate is required (ISO 8601 format)');
      }
      if (!endDate || typeof endDate !== 'string') {
        throw new ValidationError('endDate is required (ISO 8601 format)');
      }

      // Validate date formats
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime())) {
        throw new ValidationError('startDate is not a valid date');
      }
      if (isNaN(end.getTime())) {
        throw new ValidationError('endDate is not a valid date');
      }
      if (start >= end) {
        throw new ValidationError('startDate must be before endDate');
      }

      const digest = await auditService.generateDigest(
        startDate,
        endDate,
        req.user!.id
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'AuditDigest',
        resourceId: digest.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: `Audit digest generated for ${startDate} to ${endDate} (${digest.recordCount} records)`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: digest });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /anomalies - Detect audit anomalies
// ---------------------------------------------------------------------------

router.get(
  '/anomalies',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const hours = parseInt(req.query.hours as string, 10) || 24;

      if (hours < 1 || hours > 720) {
        throw new ValidationError('hours must be between 1 and 720 (30 days)');
      }

      const anomalies = await auditService.detectAnomalies(hours);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'AuditAnomaly',
        resourceId: 'anomaly-detection',
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: `Audit anomaly detection: ${anomalies.length} anomalies found in last ${hours} hours`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        data: anomalies,
        total: anomalies.length,
        period: {
          hours,
          from: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /export - Export audit events (CSV or FHIR AuditEvent Bundle)
// ---------------------------------------------------------------------------

router.get(
  '/export',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        format = 'csv',
        dateFrom,
        dateTo,
        userId,
        action,
        resourceType,
      } = req.query;

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'EXPORT' as any,
        resourceType: 'AuditLog',
        resourceId: 'export',
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: `Audit log export as ${format}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      if (format === 'csv') {
        const csvHeader = 'Timestamp,User,Action,ResourceType,ResourceID,IPAddress,Status\n';
        // In production, would iterate over filtered audit records

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
        res.send(csvHeader);
      } else if (format === 'fhir') {
        // Return as FHIR AuditEvent Bundle
        const bundle = {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 0,
          entry: [],
          timestamp: new Date().toISOString(),
        };

        res.setHeader('Content-Type', 'application/fhir+json');
        res.setHeader('Content-Disposition', 'attachment; filename="audit-log.json"');
        res.json(bundle);
      } else {
        res.status(400).json({
          error: { code: 'INVALID_FORMAT', message: 'Format must be "csv" or "fhir"' },
        });
      }
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:id - Get audit event detail
// ---------------------------------------------------------------------------

router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // In production, this would fetch the specific audit event by ID
      // Including old/new values for change tracking

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'AuditEvent',
        resourceId: id,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      // Would return the actual event
      res.json({ data: null });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
