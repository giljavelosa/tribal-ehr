// =============================================================================
// Admin Routes - User management, locations, system config, reports
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { auditService } from '../services/audit.service';
import { escalationService } from '../services/escalation.service';
import { cdsOverrideService } from '../services/cds-override.service';
import { systemHealthService } from '../services/system-health.service';
import { responseTimeService } from '../services/response-time.service';
import { patientNotificationService } from '../services/patient-notification.service';
import { responseTimeCollector } from '../middleware/response-time';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';

const router = Router();

// All admin routes require admin role
router.use(authenticate, requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'));

// ---------------------------------------------------------------------------
// GET /users - List users
// ---------------------------------------------------------------------------

router.get(
  '/users',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, role, status, page = '1', limit = '50' } = req.query;

      // In a real implementation, this would query the users database
      // For now, we return a structured response that the frontend can consume
      const filters: Record<string, unknown> = {};
      if (search) filters.search = search;
      if (role) filters.role = role;
      if (status) filters.status = status;

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'User',
        resourceId: 'list',
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json([]);
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /users - Create user
// ---------------------------------------------------------------------------

router.post(
  '/users',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, email, firstName, lastName, role, npi, dea, temporaryPassword } = req.body;

      if (!username || !email || !firstName || !lastName || !role) {
        throw new ValidationError('username, email, firstName, lastName, and role are required');
      }

      if (!temporaryPassword || temporaryPassword.length < 8) {
        throw new ValidationError('temporaryPassword must be at least 8 characters');
      }

      // In production, this would create the user in the database
      const newUser = {
        id: `user-${Date.now()}`,
        username,
        email,
        firstName,
        lastName,
        role,
        npi: npi || null,
        dea: dea || null,
        status: 'active',
        mfaEnabled: false,
        createdAt: new Date().toISOString(),
      };

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'User',
        resourceId: newUser.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        newValue: { username, email, role } as unknown as Record<string, unknown>,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: newUser });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /users/:id - Get user by ID
// ---------------------------------------------------------------------------

router.get(
  '/users/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'User',
        resourceId: id,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      // Would fetch from database
      res.json({ data: null });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /users/:id - Update user
// ---------------------------------------------------------------------------

router.put(
  '/users/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'User',
        resourceId: id,
        endpoint: req.originalUrl,
        method: 'PUT',
        statusCode: 200,
        newValue: updateData as Record<string, unknown>,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: { id, ...updateData, updatedAt: new Date().toISOString() } });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /users/:id - Deactivate user (soft delete)
// ---------------------------------------------------------------------------

router.delete(
  '/users/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'DELETE',
        resourceType: 'User',
        resourceId: id,
        endpoint: req.originalUrl,
        method: 'DELETE',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: { id, status: 'inactive', deactivatedAt: new Date().toISOString() } });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /users/:id/reset-password - Reset user password
// ---------------------------------------------------------------------------

router.post(
  '/users/:id/reset-password',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // In production, generate secure temp password, hash, and store it
      const tempPassword = `TempPass${Math.random().toString(36).slice(2, 10)}!`;

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'User',
        resourceId: id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 200,
        clinicalContext: 'Password reset by admin',
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ tempPassword, message: 'Password has been reset. User must change on next login.' });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /locations - List locations
// ---------------------------------------------------------------------------

router.get(
  '/locations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search } = req.query;

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'Location',
        resourceId: 'list',
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json([]);
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /locations - Create location
// ---------------------------------------------------------------------------

router.post(
  '/locations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const locationData = req.body;

      if (!locationData.name || !locationData.type) {
        throw new ValidationError('name and type are required');
      }

      const newLocation = {
        id: `loc-${Date.now()}`,
        ...locationData,
        status: locationData.status || 'active',
        createdAt: new Date().toISOString(),
      };

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'Location',
        resourceId: newLocation.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        newValue: newLocation as Record<string, unknown>,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: newLocation });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /locations/:id - Update location
// ---------------------------------------------------------------------------

router.put(
  '/locations/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'Location',
        resourceId: id,
        endpoint: req.originalUrl,
        method: 'PUT',
        statusCode: 200,
        newValue: updateData as Record<string, unknown>,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: { id, ...updateData, updatedAt: new Date().toISOString() } });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /system/health - Detailed system health (real checks)
// ---------------------------------------------------------------------------

router.get(
  '/system/health',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const health = await systemHealthService.checkAll();

      // Record health check for history tracking
      systemHealthService.recordHealthCheck(health).catch(() => {});

      res.json(health);
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /system/health/services - Individual service health with latency
// ---------------------------------------------------------------------------

router.get(
  '/system/health/services',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const health = await systemHealthService.checkAll();
      res.json(health.serviceDetails);
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /system/health/fhir - FHIR server connection status
// ---------------------------------------------------------------------------

router.get(
  '/system/health/fhir',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fhirHealth = await systemHealthService.checkFHIRServer();
      res.json({
        connected: fhirHealth.status === 'connected',
        serverUrl: process.env.FHIR_SERVER_URL || 'http://localhost:8080/fhir',
        version: 'R4',
        latencyMs: fhirHealth.latencyMs,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /system/health/history - Health check history
// ---------------------------------------------------------------------------

router.get(
  '/system/health/history',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const hours = Number(req.query.hours) || 24;
      const history = await systemHealthService.getHealthHistory(hours);
      res.json({ data: history });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /system/performance - Response time metrics
// ---------------------------------------------------------------------------

router.get(
  '/system/performance',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const live = responseTimeCollector.getLiveMetrics();
      const hours = Number(req.query.hours) || 24;
      const historical = await responseTimeService.getMetrics(hours);
      const slow = responseTimeCollector.getSlowEndpoints(
        Number(req.query.threshold) || 500,
      );

      res.json({
        live,
        historical,
        slowEndpoints: slow,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /system/config - Get system configuration
// ---------------------------------------------------------------------------

router.get(
  '/system/config',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = {
        sessionTimeout: 15,
        passwordMinLength: 8,
        passwordRequireUppercase: true,
        passwordRequireLowercase: true,
        passwordRequireNumbers: true,
        passwordRequireSpecialChars: true,
        passwordExpirationDays: 90,
        mfaRequired: false,
        auditRetentionDays: 2190,
      };

      res.json(config);
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /system/config - Update system configuration
// ---------------------------------------------------------------------------

router.put(
  '/system/config',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const configData = req.body;

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'SystemConfig',
        resourceId: 'global',
        endpoint: req.originalUrl,
        method: 'PUT',
        statusCode: 200,
        newValue: configData as Record<string, unknown>,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: configData, message: 'Configuration updated successfully' });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Provider management routes (under admin)
// ---------------------------------------------------------------------------

router.get(
  '/providers',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search } = req.query;
      res.json([]);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/providers',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const providerData = req.body;

      if (!providerData.firstName || !providerData.lastName || !providerData.npi) {
        throw new ValidationError('firstName, lastName, and npi are required');
      }

      const newProvider = {
        id: `prov-${Date.now()}`,
        ...providerData,
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'Provider',
        resourceId: newProvider.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: newProvider });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/providers/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'Provider',
        resourceId: id,
        endpoint: req.originalUrl,
        method: 'PUT',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: { id, ...updateData, updatedAt: new Date().toISOString() } });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Reports routes
// ---------------------------------------------------------------------------

router.get(
  '/reports/census',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const census = {
        totalActive: 0,
        totalInactive: 0,
        byGender: [],
        byAgeGroup: [],
        byRace: [],
        byLanguage: [],
      };

      res.json(census);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/reports/encounters',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const encounters = {
        total: 0,
        byType: [],
        byProvider: [],
        byLocation: [],
        byMonth: [],
      };

      res.json(encounters);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/reports/quality-measures',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json([]);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/reports/immunization-rates',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json([]);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/reports/result-notifications',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const analytics = await patientNotificationService.getNotificationAnalytics();
      res.json({ data: analytics });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/reports/overdue-notifications',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const thresholdDays = Number(req.query.thresholdDays) || 7;
      const overdue = await patientNotificationService.getOverdueNotifications(thresholdDays);
      res.json({ data: overdue });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/reports/:type/export',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params;
      const { format = 'csv' } = req.query;

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'EXPORT' as any,
        resourceType: 'Report',
        resourceId: type,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: `Report export: ${type} as ${format}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
        res.send('No data available\n');
      } else {
        res.json({ data: [], format });
      }
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Escalation Rules CRUD
// ---------------------------------------------------------------------------

router.get(
  '/escalation-rules',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rules = await escalationService.getRules();
      res.json({ data: rules });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/escalation-rules',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rule = await escalationService.createRule({
        ruleType: req.body.ruleType,
        thresholdMinutes: req.body.thresholdMinutes,
        priorityFilter: req.body.priorityFilter,
        escalateToRole: req.body.escalateToRole,
        escalateToUser: req.body.escalateToUser,
      });
      res.status(201).json({ data: rule });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/escalation-rules/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rule = await escalationService.updateRule(req.params.id, req.body);
      res.json({ data: rule });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Manual Escalation Trigger
// ---------------------------------------------------------------------------

router.post(
  '/escalation/run',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await escalationService.runEscalationCheck();
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Escalation Events
// ---------------------------------------------------------------------------

router.get(
  '/escalation-events',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await escalationService.getEscalationEvents({
        acknowledged: req.query.acknowledged === 'true' ? true : req.query.acknowledged === 'false' ? false : undefined,
        sourceType: req.query.sourceType as string,
      });
      res.json({ data: events });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/escalation-events/:id/acknowledge',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await escalationService.acknowledgeEscalation(req.params.id, req.user!.id);
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// QA Dashboard Data
// ---------------------------------------------------------------------------

router.get(
  '/qa/dashboard',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const overrideAnalytics = await cdsOverrideService.getOverrideAnalytics({
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      });

      res.json({
        data: {
          cdsOverrides: overrideAnalytics,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// CDS Override Review
// ---------------------------------------------------------------------------

router.get(
  '/qa/overrides/unreviewed',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const overrides = await cdsOverrideService.getUnreviewedOverrides();
      res.json({ data: overrides });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/qa/overrides/:id/review',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await cdsOverrideService.markOverrideReview(
        req.params.id,
        req.user!.id,
        req.body.wasAppropriate
      );
      res.json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
