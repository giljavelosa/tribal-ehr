// =============================================================================
// Public Health Reporting Routes
// ONC Certification: 170.315(f)(1)-(7)
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission, requireRole } from '../middleware/auth';
import { publicHealthService } from '../services/public-health.service';
import { auditService } from '../services/audit.service';
import { ValidationError } from '../utils/errors';

const router = Router();

// ---------------------------------------------------------------------------
// POST /elr/:labResultId - Generate Electronic Lab Report
// 170.315(f)(1) - Transmission to Public Health Agencies - ELR
// ---------------------------------------------------------------------------

router.post(
  '/elr/:labResultId',
  authenticate,
  requirePermission('public-health', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await publicHealthService.generateELR(req.params.labResultId);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'PublicHealthReport',
        resourceId: report.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: 'Electronic Lab Reporting (ELR)',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: report });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /syndromic/:encounterId - Generate Syndromic Surveillance Report
// 170.315(f)(2) - Syndromic Surveillance
// ---------------------------------------------------------------------------

router.post(
  '/syndromic/:encounterId',
  authenticate,
  requirePermission('public-health', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await publicHealthService.generateSyndromicSurveillance(
        req.params.encounterId
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'PublicHealthReport',
        resourceId: report.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: 'Syndromic Surveillance',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: report });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /immunization-registry/:immunizationId - Report to Immunization Registry
// 170.315(f)(3) - Immunization Registry Reporting
// ---------------------------------------------------------------------------

router.post(
  '/immunization-registry/:immunizationId',
  authenticate,
  requirePermission('public-health', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await publicHealthService.generateImmunizationReport(
        req.params.immunizationId
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'PublicHealthReport',
        resourceId: report.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: 'Immunization Registry Reporting',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: report });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /ecr/:encounterId - Generate Electronic Case Report (eICR)
// 170.315(f)(5) - Electronic Case Reporting
// ---------------------------------------------------------------------------

router.post(
  '/ecr/:encounterId',
  authenticate,
  requirePermission('public-health', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conditionCode } = req.body;

      if (!conditionCode || typeof conditionCode !== 'string') {
        throw new ValidationError(
          'conditionCode (SNOMED-CT) is required in the request body'
        );
      }

      const report = await publicHealthService.generateEICR(
        req.params.encounterId,
        conditionCode
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'PublicHealthReport',
        resourceId: report.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: 'Electronic Case Reporting (eCR)',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: report });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /cancer-case/:patientId/:diagnosisId - Generate Cancer Case Report
// 170.315(f)(6) - Cancer Case Reporting
// ---------------------------------------------------------------------------

router.post(
  '/cancer-case/:patientId/:diagnosisId',
  authenticate,
  requirePermission('public-health', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await publicHealthService.generateCancerCaseReport(
        req.params.patientId,
        req.params.diagnosisId
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'PublicHealthReport',
        resourceId: report.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: 'Cancer Case Reporting',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: report });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /aur - Generate Antimicrobial Use and Resistance Report
// 170.315(f)(7) - AUR Reporting
// ---------------------------------------------------------------------------

router.post(
  '/aur',
  authenticate,
  requirePermission('public-health', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facilityId, dateRange } = req.body;

      if (!facilityId || typeof facilityId !== 'string') {
        throw new ValidationError('facilityId is required in the request body');
      }

      if (!dateRange || !dateRange.start || !dateRange.end) {
        throw new ValidationError(
          'dateRange with start and end dates is required in the request body'
        );
      }

      const report = await publicHealthService.generateAURReport(facilityId, dateRange);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'PublicHealthReport',
        resourceId: report.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: 'Antimicrobial Use and Resistance (AUR) Reporting',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: report });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /reports - Get reporting history
// ---------------------------------------------------------------------------

router.get(
  '/reports',
  authenticate,
  requirePermission('public-health', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = req.query.type as string | undefined;
      const dateRange =
        req.query.startDate && req.query.endDate
          ? {
              start: req.query.startDate as string,
              end: req.query.endDate as string,
            }
          : undefined;

      const reports = await publicHealthService.getReportHistory(type, dateRange);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'PublicHealthReport',
        resourceId: 'list',
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: reports });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /reports/pending - Get pending reports
// ---------------------------------------------------------------------------

router.get(
  '/reports/pending',
  authenticate,
  requirePermission('public-health', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reports = await publicHealthService.getPendingReports();

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'PublicHealthReport',
        resourceId: 'pending',
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: reports });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /reports/:id/sent - Mark report as sent
// ---------------------------------------------------------------------------

router.put(
  '/reports/:id/sent',
  authenticate,
  requirePermission('public-health', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { destination } = req.body;

      if (!destination || typeof destination !== 'string') {
        throw new ValidationError('destination is required in the request body');
      }

      await publicHealthService.markReportSent(req.params.id, destination);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'PublicHealthReport',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'PUT',
        statusCode: 200,
        clinicalContext: `Report sent to ${destination}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ message: 'Report marked as sent', destination });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
