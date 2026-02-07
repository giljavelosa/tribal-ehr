// =============================================================================
// E-Prescribing Routes
// ONC Certification: 170.315(b)(3) - Electronic Prescribing
// POST   /new-rx/:orderId            - Generate NewRx NCPDP SCRIPT message
// POST   /refill/:orderId            - Generate RefillRequest
// POST   /renewal/:orderId           - Generate RxRenewalRequest
// POST   /cancel/:orderId            - Generate CancelRx
// POST   /change/:orderId            - Generate RxChangeRequest
// GET    /history/:patientId         - Query medication history
// POST   /formulary-check            - Check formulary coverage
// POST   /prior-auth/:orderId        - Submit prior authorization
// POST   /epcs-verify                - Verify EPCS for controlled substances
// GET    /controlled-substance/:code - Check if medication is controlled
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { ePrescribingService } from '../services/eprescribing.service';
import { auditService } from '../services/audit.service';
import { ValidationError } from '../utils/errors';

const router = Router();

// ---------------------------------------------------------------------------
// POST /new-rx/:orderId - Generate NewRx NCPDP SCRIPT message
// ---------------------------------------------------------------------------

router.post(
  '/new-rx/:orderId',
  authenticate,
  requirePermission('eprescribing', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ePrescribingService.generateNewRx(req.params.orderId);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'EPrescription',
        resourceId: result.messageId,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: `NewRx generated for order ${req.params.orderId}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /refill/:orderId - Generate RefillRequest
// ---------------------------------------------------------------------------

router.post(
  '/refill/:orderId',
  authenticate,
  requirePermission('eprescribing', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ePrescribingService.generateRefillRequest(req.params.orderId);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'EPrescription',
        resourceId: result.messageId,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: `RefillRequest generated for order ${req.params.orderId}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /renewal/:orderId - Generate RxRenewalRequest
// ---------------------------------------------------------------------------

router.post(
  '/renewal/:orderId',
  authenticate,
  requirePermission('eprescribing', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ePrescribingService.generateRenewalRequest(req.params.orderId);

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'EPrescription',
        resourceId: result.messageId,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: `RxRenewalRequest generated for order ${req.params.orderId}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /cancel/:orderId - Generate CancelRx
// ---------------------------------------------------------------------------

router.post(
  '/cancel/:orderId',
  authenticate,
  requirePermission('eprescribing', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body;

      if (!reason || typeof reason !== 'string') {
        throw new ValidationError('A cancellation reason is required in the request body');
      }

      const result = await ePrescribingService.generateCancelRx(
        req.params.orderId,
        reason
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'EPrescription',
        resourceId: result.messageId,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: `CancelRx generated for order ${req.params.orderId}: ${reason}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /change/:orderId - Generate RxChangeRequest
// ---------------------------------------------------------------------------

router.post(
  '/change/:orderId',
  authenticate,
  requirePermission('eprescribing', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason, newMedicationCode, newMedicationDisplay, newDosage } = req.body;

      if (!reason || typeof reason !== 'string') {
        throw new ValidationError('A change reason is required in the request body');
      }

      const result = await ePrescribingService.generateRxChange(
        req.params.orderId,
        { reason, newMedicationCode, newMedicationDisplay, newDosage }
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'EPrescription',
        resourceId: result.messageId,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: `RxChangeRequest generated for order ${req.params.orderId}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /history/:patientId - Query medication history
// ---------------------------------------------------------------------------

router.get(
  '/history/:patientId',
  authenticate,
  requirePermission('eprescribing', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await ePrescribingService.queryMedicationHistory(
        req.params.patientId
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'MedicationHistory',
        resourceId: req.params.patientId,
        endpoint: req.originalUrl,
        method: 'GET',
        statusCode: 200,
        clinicalContext: 'RxHistory query',
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
// POST /formulary-check - Check formulary coverage
// ---------------------------------------------------------------------------

router.post(
  '/formulary-check',
  authenticate,
  requirePermission('eprescribing', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { medicationCode, insuranceId } = req.body;

      if (!medicationCode || typeof medicationCode !== 'string') {
        throw new ValidationError('medicationCode (RxNorm) is required');
      }
      if (!insuranceId || typeof insuranceId !== 'string') {
        throw new ValidationError('insuranceId is required');
      }

      const result = await ePrescribingService.checkFormulary(
        medicationCode,
        insuranceId
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'READ',
        resourceType: 'Formulary',
        resourceId: medicationCode,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 200,
        clinicalContext: `Formulary check for ${medicationCode}`,
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
// POST /prior-auth/:orderId - Submit prior authorization
// ---------------------------------------------------------------------------

router.post(
  '/prior-auth/:orderId',
  authenticate,
  requirePermission('eprescribing', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clinicalInfo = req.body || {};

      const result = await ePrescribingService.submitPriorAuth(
        req.params.orderId,
        clinicalInfo
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'PriorAuthorization',
        resourceId: result.authId,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 201,
        clinicalContext: `Prior auth submitted for order ${req.params.orderId}`,
        sessionId: req.user!.sessionId,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /epcs-verify - Verify EPCS for controlled substances
// ---------------------------------------------------------------------------

router.post(
  '/epcs-verify',
  authenticate,
  requirePermission('eprescribing', 'create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { prescriberId, medicationOrderId, mfaToken } = req.body;

      if (!prescriberId || typeof prescriberId !== 'string') {
        throw new ValidationError('prescriberId is required');
      }
      if (!medicationOrderId || typeof medicationOrderId !== 'string') {
        throw new ValidationError('medicationOrderId is required');
      }
      if (!mfaToken || typeof mfaToken !== 'string') {
        throw new ValidationError('mfaToken is required for EPCS verification');
      }

      const result = await ePrescribingService.verifyEPCS(
        prescriberId,
        medicationOrderId,
        mfaToken
      );

      auditService.log({
        userId: req.user!.id,
        userRole: req.user!.role,
        ipAddress: req.ip || 'unknown',
        action: 'CREATE',
        resourceType: 'EPCSVerification',
        resourceId: medicationOrderId,
        endpoint: req.originalUrl,
        method: 'POST',
        statusCode: 200,
        clinicalContext: `EPCS verification ${result.verified ? 'succeeded' : 'failed'} for order ${medicationOrderId}`,
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
// GET /controlled-substance/:code - Check if a medication is controlled
// ---------------------------------------------------------------------------

router.get(
  '/controlled-substance/:code',
  authenticate,
  requirePermission('eprescribing', 'read'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const code = req.params.code;
      const isControlled = ePrescribingService.isControlledSubstance(code);
      const schedule = ePrescribingService.getSchedule(code);

      res.json({
        data: {
          rxnormCode: code,
          isControlledSubstance: isControlled,
          deaSchedule: schedule,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
