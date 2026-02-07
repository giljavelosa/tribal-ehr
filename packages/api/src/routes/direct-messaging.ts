// =============================================================================
// Direct Messaging Routes - ONC §170.315(h)(1)-(h)(2) Direct Protocol
// GET    /addresses            - List Direct addresses
// POST   /addresses            - Register new address (admin)
// PUT    /addresses/:id/verify - Verify address (admin)
// DELETE /addresses/:id        - Deactivate address
// GET    /messages             - List messages (with filters)
// GET    /messages/:id         - Get single message
// POST   /messages             - Send Direct message
// POST   /messages/ccda        - Send C-CDA document via Direct
// GET    /stats                - Delivery statistics
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission, requireRole } from '../middleware/auth';
import { directMessagingService } from '../services/direct-messaging.service';
import { auditService } from '../services/audit.service';
import { ValidationError } from '../utils/errors';

const router = Router();

// ---------------------------------------------------------------------------
// GET /addresses - List Direct addresses
// ---------------------------------------------------------------------------

router.get(
  '/addresses',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, active, verified } = req.query;

      const filters: { userId?: string; active?: boolean; verified?: boolean } = {};
      if (userId) filters.userId = userId as string;
      if (active !== undefined) filters.active = active === 'true';
      if (verified !== undefined) filters.verified = verified === 'true';

      const addresses = await directMessagingService.getAddresses(filters);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'DirectAddress',
        resourceId: 'list',
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: addresses });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /addresses - Register new Direct address (admin)
// ---------------------------------------------------------------------------

router.post(
  '/addresses',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, directAddress, displayName, organization } = req.body;

      if (!directAddress || typeof directAddress !== 'string') {
        throw new ValidationError('directAddress is required');
      }
      if (!displayName || typeof displayName !== 'string') {
        throw new ValidationError('displayName is required');
      }

      const address = await directMessagingService.registerAddress(
        userId || null,
        directAddress,
        displayName,
        organization
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'DirectAddress',
        resourceId: address.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: `Direct address registered: ${directAddress}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: address });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /addresses/:id/verify - Verify Direct address (admin)
// ---------------------------------------------------------------------------

router.put(
  '/addresses/:id/verify',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = await directMessagingService.verifyAddress(req.params.id);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'UPDATE',
        resourceType: 'DirectAddress',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'PUT',
        statusCode: 200,
        clinicalContext: `Direct address verified: ${address.directAddress}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: address });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /addresses/:id - Deactivate Direct address
// ---------------------------------------------------------------------------

router.delete(
  '/addresses/:id',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = await directMessagingService.deactivateAddress(req.params.id);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'DELETE',
        resourceType: 'DirectAddress',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'DELETE',
        statusCode: 200,
        clinicalContext: `Direct address deactivated: ${address.directAddress}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: address, message: 'Direct address deactivated' });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /messages - List Direct messages (with filters)
// ---------------------------------------------------------------------------

router.get(
  '/messages',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        direction,
        status,
        fromAddress,
        toAddress,
        relatedPatientId,
        page,
        limit,
      } = req.query;

      const filters: Record<string, unknown> = {};
      if (direction) filters.direction = direction;
      if (status) filters.status = status;
      if (fromAddress) filters.fromAddress = fromAddress;
      if (toAddress) filters.toAddress = toAddress;
      if (relatedPatientId) filters.relatedPatientId = relatedPatientId;
      if (page) filters.page = parseInt(page as string, 10);
      if (limit) filters.limit = parseInt(limit as string, 10);

      const result = await directMessagingService.getMessages(
        filters as Parameters<typeof directMessagingService.getMessages>[0]
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'DirectMessage',
        resourceId: 'list',
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /stats - Delivery statistics
// ---------------------------------------------------------------------------

router.get(
  '/stats',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await directMessagingService.getMessageStats();

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'DirectMessageStats',
        resourceId: 'stats',
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: stats });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /messages/:id - Get single message
// ---------------------------------------------------------------------------

router.get(
  '/messages/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await directMessagingService.getMessage(req.params.id);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'DirectMessage',
        resourceId: req.params.id,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.json({ data: message });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /messages - Send Direct message
// ---------------------------------------------------------------------------

router.post(
  '/messages',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to, cc, subject, body, contentType, attachments, relatedPatientId } = req.body;

      if (!from || typeof from !== 'string') {
        throw new ValidationError('from address is required');
      }
      if (!to || !Array.isArray(to) || to.length === 0) {
        throw new ValidationError('At least one recipient (to) address is required');
      }

      const message = await directMessagingService.sendMessage({
        from,
        to,
        cc,
        subject,
        body,
        contentType,
        attachments,
        relatedPatientId,
      });

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'DirectMessage',
        resourceId: message.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: `Direct message sent from ${from} to ${to.join(', ')}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: message });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /messages/ccda - Send C-CDA document via Direct
// ---------------------------------------------------------------------------

router.post(
  '/messages/ccda',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientId, toAddress, documentType } = req.body;

      if (!patientId || typeof patientId !== 'string') {
        throw new ValidationError('patientId is required');
      }
      if (!toAddress || typeof toAddress !== 'string') {
        throw new ValidationError('toAddress is required');
      }
      if (!documentType || typeof documentType !== 'string') {
        throw new ValidationError('documentType is required');
      }

      const message = await directMessagingService.sendCCDA(
        patientId,
        toAddress,
        documentType
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'DirectMessage',
        resourceId: message.id,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: `C-CDA ${documentType} sent to ${toAddress} for patient ${patientId}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: message });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
