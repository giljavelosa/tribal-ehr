// =============================================================================
// FHIR R4 Proxy Routes with SMART on FHIR Scope Validation
// ONC §170.315(g)(10) - Standardized API for Patient and Population Services
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import axios, { AxiosError } from 'axios';
import { authenticate, smartOnFhirAuth } from '../middleware/auth';
import {
  validateFhirAccess,
  getPatientCompartmentId,
  isPatientCompartmentResource,
} from '../middleware/smart-scope';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();
const FHIR_BASE = config.fhir.serverUrl;
const PROXY_TIMEOUT = 30000;

// Allowed FHIR resource types (US Core R4 + common administrative resources)
const ALLOWED_RESOURCE_TYPES = new Set([
  'Patient',
  'Observation',
  'Condition',
  'MedicationRequest',
  'MedicationStatement',
  'AllergyIntolerance',
  'Procedure',
  'Immunization',
  'CarePlan',
  'CareTeam',
  'Goal',
  'Device',
  'DocumentReference',
  'DiagnosticReport',
  'Encounter',
  'Provenance',
  'Practitioner',
  'PractitionerRole',
  'Organization',
  'Location',
  'HealthcareService',
  'Medication',
  'Coverage',
  'ExplanationOfBenefit',
  'RelatedPerson',
  'Schedule',
  'Slot',
  'Appointment',
]);

// Fields that tie a resource to a patient for compartment enforcement
const PATIENT_REFERENCE_PARAMS: Record<string, string> = {
  Patient: '_id',
  Observation: 'patient',
  Condition: 'patient',
  MedicationRequest: 'patient',
  MedicationStatement: 'patient',
  AllergyIntolerance: 'patient',
  Procedure: 'patient',
  Immunization: 'patient',
  CarePlan: 'patient',
  CareTeam: 'patient',
  Goal: 'patient',
  Device: 'patient',
  DocumentReference: 'patient',
  DiagnosticReport: 'patient',
  Encounter: 'patient',
  Provenance: 'patient',
};

// =============================================================================
// Helper: Build FHIR-compliant OperationOutcome for errors
// =============================================================================
function operationOutcome(
  severity: 'fatal' | 'error' | 'warning' | 'information',
  code: string,
  diagnostics: string
): Record<string, unknown> {
  return {
    resourceType: 'OperationOutcome',
    issue: [
      {
        severity,
        code,
        diagnostics,
      },
    ],
  };
}

// =============================================================================
// Helper: Proxy a request to the HAPI FHIR server
// =============================================================================
async function proxyToFhir(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  query?: Record<string, string>
): Promise<{ status: number; data: unknown; headers: Record<string, string> }> {
  const queryString = query
    ? new URLSearchParams(query).toString()
    : '';
  const url = `${FHIR_BASE}${path}${queryString ? '?' + queryString : ''}`;

  const headers: Record<string, string> = {
    Accept: 'application/fhir+json',
    'Content-Type': 'application/fhir+json',
  };

  const response = await axios({
    method,
    url,
    headers,
    data: body,
    timeout: PROXY_TIMEOUT,
    validateStatus: () => true, // Don't throw on non-2xx; we forward the status
  });

  // Extract relevant response headers for the client
  const responseHeaders: Record<string, string> = {};
  if (response.headers['etag']) {
    responseHeaders['etag'] = response.headers['etag'] as string;
  }
  if (response.headers['last-modified']) {
    responseHeaders['last-modified'] = response.headers['last-modified'] as string;
  }
  if (response.headers['location']) {
    responseHeaders['location'] = response.headers['location'] as string;
  }
  if (response.headers['content-location']) {
    responseHeaders['content-location'] = response.headers['content-location'] as string;
  }

  return {
    status: response.status,
    data: response.data,
    headers: responseHeaders,
  };
}

// =============================================================================
// Helper: Validate resource type
// =============================================================================
function isValidResourceType(resourceType: string): boolean {
  return ALLOWED_RESOURCE_TYPES.has(resourceType);
}

// =============================================================================
// Helper: Apply patient compartment filter to search queries
// =============================================================================
function applyPatientCompartment(
  resourceType: string,
  query: Record<string, string>,
  patientId: string
): Record<string, string> {
  const paramName = PATIENT_REFERENCE_PARAMS[resourceType];
  if (!paramName) {
    return query;
  }

  const filtered = { ...query };
  if (resourceType === 'Patient') {
    // For Patient resource, restrict _id to the patient's own ID
    filtered['_id'] = patientId;
  } else {
    // For other resources, add patient parameter
    filtered[paramName] = `Patient/${patientId}`;
  }
  return filtered;
}

// =============================================================================
// Auth middleware: Accept either standard JWT or SMART on FHIR token
// =============================================================================
function fhirAuthenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json(
      operationOutcome('error', 'login', 'Authorization header required')
    );
    return;
  }

  // Try standard authenticate first; if it fails, try SMART on FHIR
  authenticate(req, res, (err?: unknown) => {
    if (!err) {
      next();
      return;
    }

    // Standard auth failed, try SMART on FHIR auth
    smartOnFhirAuth(req, res, (smartErr?: unknown) => {
      if (!smartErr) {
        next();
        return;
      }
      // Both failed
      res.status(401).json(
        operationOutcome('error', 'login', 'Invalid or expired authorization token')
      );
    });
  });
}

// =============================================================================
// GET /metadata - CapabilityStatement (no auth required)
// =============================================================================
router.get('/metadata', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await proxyToFhir('GET', '/metadata');

    if (result.status === 200) {
      // Augment the capability statement with SMART security extension
      const capability = result.data as Record<string, unknown>;
      const baseUrl = process.env.API_BASE_URL || `http://localhost:${config.server.port}`;

      // Add SMART security extension to rest[0].security
      const rest = capability.rest as Array<Record<string, unknown>> | undefined;
      if (rest && rest.length > 0) {
        rest[0].security = {
          extension: [
            {
              url: 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris',
              extension: [
                { url: 'authorize', valueUri: `${baseUrl}/auth/authorize` },
                { url: 'token', valueUri: `${baseUrl}/auth/token` },
                { url: 'register', valueUri: `${baseUrl}/auth/register` },
                { url: 'manage', valueUri: `${baseUrl}/auth/manage` },
              ],
            },
          ],
          service: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
                  code: 'SMART-on-FHIR',
                },
              ],
              text: 'SMART on FHIR',
            },
          ],
        };
      }

      res.set('Content-Type', 'application/fhir+json');
      res.json(capability);
    } else {
      res.status(result.status).json(result.data);
    }
  } catch (error) {
    logger.error('Failed to fetch FHIR CapabilityStatement', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Return a minimal capability statement if HAPI is unavailable
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${config.server.port}`;
    res.status(200).json({
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: new Date().toISOString(),
      kind: 'instance',
      fhirVersion: '4.0.1',
      format: ['application/fhir+json'],
      rest: [
        {
          mode: 'server',
          security: {
            extension: [
              {
                url: 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris',
                extension: [
                  { url: 'authorize', valueUri: `${baseUrl}/auth/authorize` },
                  { url: 'token', valueUri: `${baseUrl}/auth/token` },
                  { url: 'register', valueUri: `${baseUrl}/auth/register` },
                ],
              },
            ],
            service: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
                    code: 'SMART-on-FHIR',
                  },
                ],
                text: 'SMART on FHIR',
              },
            ],
          },
          resource: Array.from(ALLOWED_RESOURCE_TYPES).map((type) => ({
            type,
            interaction: [
              { code: 'read' },
              { code: 'search-type' },
              { code: 'create' },
              { code: 'update' },
              { code: 'delete' },
            ],
            versioning: 'versioned',
            readHistory: true,
          })),
        },
      ],
    });
  }
});

// =============================================================================
// All other FHIR endpoints require authentication
// =============================================================================
router.use(fhirAuthenticate);

// =============================================================================
// Resource type validation middleware
// =============================================================================
function validateResourceType(req: Request, res: Response, next: NextFunction): void {
  const { resourceType } = req.params;
  if (!isValidResourceType(resourceType)) {
    res.status(404).json(
      operationOutcome('error', 'not-supported', `Resource type '${resourceType}' is not supported`)
    );
    return;
  }
  next();
}

// =============================================================================
// GET /Patient/:id/$everything - Patient everything operation
// Must be before the generic /:resourceType/:id route
// =============================================================================
router.get(
  '/Patient/:id/\\$everything',
  validateFhirAccess('Patient', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // Patient compartment enforcement
      const patientId = getPatientCompartmentId(req);
      if (patientId && patientId !== id) {
        res.status(403).json(
          operationOutcome('error', 'forbidden', 'Access denied: you can only access your own patient data')
        );
        return;
      }

      logger.info('FHIR $everything operation', { patientId: id });

      const query = req.query as Record<string, string>;
      const result = await proxyToFhir('GET', `/Patient/${id}/$everything`, undefined, query);

      res.set(result.headers);
      res.set('Content-Type', 'application/fhir+json');
      res.status(result.status).json(result.data);
    } catch (error) {
      if (error instanceof AxiosError && !error.response) {
        res.status(502).json(
          operationOutcome('error', 'exception', 'FHIR server is unavailable')
        );
        return;
      }
      next(error);
    }
  }
);

// =============================================================================
// GET /:resourceType/:id/_history - Resource history
// Must be before the generic /:resourceType/:id route
// =============================================================================
router.get(
  '/:resourceType/:id/_history',
  validateResourceType,
  (req: Request, res: Response, next: NextFunction) => {
    const { resourceType } = req.params;
    validateFhirAccess(resourceType, 'read')(req, res, next);
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resourceType, id } = req.params;

      // Patient compartment enforcement for read by ID
      const patientId = getPatientCompartmentId(req);
      if (patientId && isPatientCompartmentResource(resourceType)) {
        if (resourceType === 'Patient' && id !== patientId) {
          res.status(403).json(
            operationOutcome('error', 'forbidden', 'Access denied: patient compartment restriction')
          );
          return;
        }
      }

      const query = req.query as Record<string, string>;
      const result = await proxyToFhir('GET', `/${resourceType}/${id}/_history`, undefined, query);

      res.set(result.headers);
      res.set('Content-Type', 'application/fhir+json');
      res.status(result.status).json(result.data);
    } catch (error) {
      if (error instanceof AxiosError && !error.response) {
        res.status(502).json(
          operationOutcome('error', 'exception', 'FHIR server is unavailable')
        );
        return;
      }
      next(error);
    }
  }
);

// =============================================================================
// GET /:resourceType - Search resources
// =============================================================================
router.get(
  '/:resourceType',
  validateResourceType,
  (req: Request, res: Response, next: NextFunction) => {
    const { resourceType } = req.params;
    validateFhirAccess(resourceType, 'read')(req, res, next);
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resourceType } = req.params;
      let query = { ...(req.query as Record<string, string>) };

      // Enforce patient compartment on search
      const patientId = getPatientCompartmentId(req);
      if (patientId && isPatientCompartmentResource(resourceType)) {
        query = applyPatientCompartment(resourceType, query, patientId);
      }

      logger.info('FHIR search', { resourceType, queryKeys: Object.keys(query) });

      const result = await proxyToFhir('GET', `/${resourceType}`, undefined, query);

      res.set(result.headers);
      res.set('Content-Type', 'application/fhir+json');
      res.status(result.status).json(result.data);
    } catch (error) {
      if (error instanceof AxiosError && !error.response) {
        res.status(502).json(
          operationOutcome('error', 'exception', 'FHIR server is unavailable')
        );
        return;
      }
      next(error);
    }
  }
);

// =============================================================================
// GET /:resourceType/:id - Read a single resource
// =============================================================================
router.get(
  '/:resourceType/:id',
  validateResourceType,
  (req: Request, res: Response, next: NextFunction) => {
    const { resourceType } = req.params;
    validateFhirAccess(resourceType, 'read')(req, res, next);
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resourceType, id } = req.params;

      // Patient compartment enforcement for direct read
      const patientId = getPatientCompartmentId(req);
      if (patientId && isPatientCompartmentResource(resourceType)) {
        if (resourceType === 'Patient' && id !== patientId) {
          res.status(403).json(
            operationOutcome('error', 'forbidden', 'Access denied: patient compartment restriction')
          );
          return;
        }
        // For non-Patient resources, we fetch the resource and verify patient reference
        // after the fact (the HAPI server will have the reference)
      }

      const result = await proxyToFhir('GET', `/${resourceType}/${id}`);

      // Post-fetch patient compartment validation for non-Patient resources
      if (patientId && resourceType !== 'Patient' && isPatientCompartmentResource(resourceType)) {
        const resource = result.data as Record<string, unknown>;
        const subject = resource.subject as Record<string, string> | undefined;
        const patient = resource.patient as Record<string, string> | undefined;
        const ref = subject?.reference || patient?.reference;
        if (ref && ref !== `Patient/${patientId}`) {
          res.status(403).json(
            operationOutcome('error', 'forbidden', 'Access denied: resource belongs to a different patient')
          );
          return;
        }
      }

      res.set(result.headers);
      res.set('Content-Type', 'application/fhir+json');
      res.status(result.status).json(result.data);
    } catch (error) {
      if (error instanceof AxiosError && !error.response) {
        res.status(502).json(
          operationOutcome('error', 'exception', 'FHIR server is unavailable')
        );
        return;
      }
      next(error);
    }
  }
);

// =============================================================================
// POST /:resourceType - Create a resource
// =============================================================================
router.post(
  '/:resourceType',
  validateResourceType,
  (req: Request, res: Response, next: NextFunction) => {
    const { resourceType } = req.params;
    validateFhirAccess(resourceType, 'write')(req, res, next);
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resourceType } = req.params;

      // Validate the resource body has the correct resourceType
      if (req.body?.resourceType && req.body.resourceType !== resourceType) {
        res.status(400).json(
          operationOutcome(
            'error',
            'invalid',
            `Resource type in body '${req.body.resourceType}' does not match URL '${resourceType}'`
          )
        );
        return;
      }

      logger.info('FHIR create', { resourceType, userId: req.user?.id || req.smartToken?.sub });

      const result = await proxyToFhir('POST', `/${resourceType}`, req.body);

      res.set(result.headers);
      res.set('Content-Type', 'application/fhir+json');
      res.status(result.status).json(result.data);
    } catch (error) {
      if (error instanceof AxiosError && !error.response) {
        res.status(502).json(
          operationOutcome('error', 'exception', 'FHIR server is unavailable')
        );
        return;
      }
      next(error);
    }
  }
);

// =============================================================================
// PUT /:resourceType/:id - Update a resource
// =============================================================================
router.put(
  '/:resourceType/:id',
  validateResourceType,
  (req: Request, res: Response, next: NextFunction) => {
    const { resourceType } = req.params;
    validateFhirAccess(resourceType, 'write')(req, res, next);
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resourceType, id } = req.params;

      // Validate the resource body
      if (req.body?.resourceType && req.body.resourceType !== resourceType) {
        res.status(400).json(
          operationOutcome(
            'error',
            'invalid',
            `Resource type in body '${req.body.resourceType}' does not match URL '${resourceType}'`
          )
        );
        return;
      }

      if (req.body?.id && req.body.id !== id) {
        res.status(400).json(
          operationOutcome(
            'error',
            'invalid',
            `Resource id in body '${req.body.id}' does not match URL '${id}'`
          )
        );
        return;
      }

      // Patient compartment enforcement for updates
      const patientId = getPatientCompartmentId(req);
      if (patientId && isPatientCompartmentResource(resourceType)) {
        if (resourceType === 'Patient' && id !== patientId) {
          res.status(403).json(
            operationOutcome('error', 'forbidden', 'Access denied: patient compartment restriction')
          );
          return;
        }
      }

      logger.info('FHIR update', {
        resourceType,
        resourceId: id,
        userId: req.user?.id || req.smartToken?.sub,
      });

      const result = await proxyToFhir('PUT', `/${resourceType}/${id}`, req.body);

      res.set(result.headers);
      res.set('Content-Type', 'application/fhir+json');
      res.status(result.status).json(result.data);
    } catch (error) {
      if (error instanceof AxiosError && !error.response) {
        res.status(502).json(
          operationOutcome('error', 'exception', 'FHIR server is unavailable')
        );
        return;
      }
      next(error);
    }
  }
);

// =============================================================================
// DELETE /:resourceType/:id - Delete a resource
// =============================================================================
router.delete(
  '/:resourceType/:id',
  validateResourceType,
  (req: Request, res: Response, next: NextFunction) => {
    const { resourceType } = req.params;
    validateFhirAccess(resourceType, 'write')(req, res, next);
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resourceType, id } = req.params;

      // Patient compartment enforcement for deletes
      const patientId = getPatientCompartmentId(req);
      if (patientId && isPatientCompartmentResource(resourceType)) {
        if (resourceType === 'Patient' && id !== patientId) {
          res.status(403).json(
            operationOutcome('error', 'forbidden', 'Access denied: patient compartment restriction')
          );
          return;
        }
      }

      logger.info('FHIR delete', {
        resourceType,
        resourceId: id,
        userId: req.user?.id || req.smartToken?.sub,
      });

      const result = await proxyToFhir('DELETE', `/${resourceType}/${id}`);

      res.set(result.headers);
      res.set('Content-Type', 'application/fhir+json');
      res.status(result.status === 204 ? 204 : result.status).json(result.data);
    } catch (error) {
      if (error instanceof AxiosError && !error.response) {
        res.status(502).json(
          operationOutcome('error', 'exception', 'FHIR server is unavailable')
        );
        return;
      }
      next(error);
    }
  }
);

export default router;
