// =============================================================================
// Consent Filter Middleware
// Enforces patient consent directives on data access paths
// ONC §170.315(b)(7) consent management and HIPAA §164.308(a)(4)
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { consentEnforcementService } from '../services/consent-enforcement.service';
import { logger } from '../utils/logger';

/**
 * Middleware factory that filters response data based on patient consent directives.
 * Apply to routes that return patient-specific clinical data.
 *
 * Overrides res.json to intercept the response payload and remove resources
 * whose sensitivity tags match the patient's opt-out consent categories.
 *
 * Usage: router.get('/observations', authenticate, consentFilter('id'), handler)
 * The patientIdParam is the name of the route/query parameter containing the patient ID.
 */
export function consentFilter(patientIdParam: string = 'patientId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override res.json to filter data before sending
    res.json = function (body: unknown) {
      const patientId =
        req.params[patientIdParam] || (req.query[patientIdParam] as string);
      const userId = req.user?.id;

      if (!patientId || !userId) {
        return originalJson(body);
      }

      // Filter the response data asynchronously
      const filterPromise = (async () => {
        try {
          const typedBody = body as Record<string, unknown> | Record<string, unknown>[] | null;

          if (typedBody && typeof typedBody === 'object' && 'data' in typedBody && Array.isArray((typedBody as Record<string, unknown>).data)) {
            const filtered = await consentEnforcementService.filterSensitiveData(
              (typedBody as Record<string, unknown>).data as Record<string, unknown>[],
              userId,
              patientId,
            );
            return originalJson({ ...(typedBody as Record<string, unknown>), data: filtered });
          } else if (Array.isArray(typedBody)) {
            const filtered = await consentEnforcementService.filterSensitiveData(
              typedBody as Record<string, unknown>[],
              userId,
              patientId,
            );
            return originalJson(filtered);
          }
          return originalJson(body);
        } catch (error) {
          logger.error('Consent filter error', { error, patientId, userId });
          // Fail-open: return unfiltered data rather than blocking clinical access
          return originalJson(body);
        }
      })();

      // Void the promise to satisfy the return type
      filterPromise.catch(() => {});
    } as typeof res.json;

    next();
  };
}

/**
 * Middleware that checks if user has access to a specific patient's data.
 * Returns 403 if access denied by consent directive.
 * When break-glass is required but not active, responds with a flag
 * that the frontend can use to prompt for emergency override.
 */
export function requirePatientAccess(patientIdParam: string = 'patientId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const patientId =
        req.params[patientIdParam] || (req.query[patientIdParam] as string);
      const userId = req.user?.id;

      if (!patientId || !userId) {
        return next();
      }

      // checkAccess requires resourceType; use 'Patient' as the default
      const access = await consentEnforcementService.checkAccess(
        userId,
        patientId,
        'Patient',
      );

      if (!access.allowed && !access.requiresBreakGlass) {
        res.status(403).json({
          error: 'Access denied',
          message: access.reason,
        });
        return;
      }

      if (access.requiresBreakGlass) {
        // Check for active break-glass session
        const activeBreakGlass =
          await consentEnforcementService.getActiveBreakGlass(userId, patientId);
        if (!activeBreakGlass) {
          res.status(403).json({
            error: 'Break-glass required',
            message:
              "Emergency access override required for this patient's restricted data",
            requiresBreakGlass: true,
          });
          return;
        }
      }

      next();
    } catch (error) {
      logger.error('Patient access check error', { error });
      // Fail-open: allow access to avoid blocking clinical workflow
      next();
    }
  };
}
