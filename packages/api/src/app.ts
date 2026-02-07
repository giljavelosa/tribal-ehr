import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { checkDatabaseConnection } from './config/database';
import { checkRedisConnection } from './config/redis';
import { checkRabbitMQConnection } from './config/rabbitmq';
import { authenticate } from './middleware/auth';
import { auditMiddleware } from './middleware/audit';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { logger } from './utils/logger';

// Route imports
import patientsRouter from './routes/patients';
import encountersRouter from './routes/encounters';
import conditionsRouter from './routes/conditions';
import observationsRouter from './routes/observations';
import medicationsRouter from './routes/medications';
import allergiesRouter from './routes/allergies';
import proceduresRouter from './routes/procedures';
import immunizationsRouter from './routes/immunizations';
import documentsRouter from './routes/documents';
import carePlansRouter from './routes/care-plans';
import careTeamsRouter from './routes/care-teams';
import goalsRouter from './routes/goals';
import devicesRouter from './routes/devices';
import ordersRouter from './routes/orders';
import schedulingRouter from './routes/scheduling';
import adminRouter from './routes/admin';
import auditRouter from './routes/audit';
import authRouter from './routes/auth';
import fhirProxyRouter from './routes/fhir-proxy';
import clinicalNotesRouter from './routes/clinical-notes';
import messagesRouter from './routes/messages';
import publicHealthRouter from './routes/public-health';
import qualityMeasuresRouter from './routes/quality-measures';
import eprescribingRouter from './routes/eprescribing';
import referralsRouter from './routes/referrals';
import portalRouter from './routes/portal';
import cdsHooksRouter from './routes/cds-hooks';
import delegationsRouter from './routes/delegations';
import resultsInboxRouter from './routes/results-inbox';
import orderSetsRouter from './routes/order-sets';

// Morgan custom format that excludes PHI - only log method, url, status, response time
const morganFormat = ':method :url :status :response-time ms - :res[content-length]';

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later',
    },
  },
});

export function createApp(): express.Application {
  const app = express();

  // Trust proxy for rate limiting behind reverse proxy
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  // CORS
  app.use(cors({
    origin: config.server.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 600,
  }));

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Cookie parsing
  app.use(cookieParser());

  // HTTP request logging (no PHI)
  app.use(morgan(morganFormat, {
    stream: {
      write: (message: string) => {
        logger.http(message.trim());
      },
    },
    skip: (req: Request) => req.path === '/health',
  }));

  // General rate limiting
  app.use(generalLimiter);

  // Health check (no auth required, no audit)
  app.get('/health', async (_req: Request, res: Response) => {
    const [dbHealthy, redisHealthy, rabbitmqHealthy] = await Promise.all([
      checkDatabaseConnection(),
      checkRedisConnection(),
      checkRabbitMQConnection(),
    ]);

    let fhirHealthy = false;
    try {
      const axios = await import('axios');
      const response = await axios.default.get(`${config.fhir.serverUrl}/metadata`, {
        timeout: 5000,
      });
      fhirHealthy = response.status === 200;
    } catch {
      fhirHealthy = false;
    }

    const allHealthy = dbHealthy && redisHealthy && rabbitmqHealthy && fhirHealthy;

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        db: dbHealthy ? 'connected' : 'disconnected',
        redis: redisHealthy ? 'connected' : 'disconnected',
        rabbitmq: rabbitmqHealthy ? 'connected' : 'disconnected',
        fhir: fhirHealthy ? 'connected' : 'disconnected',
      },
    });
  });

  // SMART on FHIR discovery endpoint (§170.315(g)(10))
  app.get('/.well-known/smart-configuration', (_req: Request, res: Response) => {
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${config.server.port}`;
    res.json({
      authorization_endpoint: `${baseUrl}/auth/authorize`,
      token_endpoint: `${baseUrl}/auth/token`,
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'private_key_jwt'],
      registration_endpoint: `${baseUrl}/auth/register`,
      scopes_supported: [
        'openid', 'fhirUser', 'launch', 'launch/patient', 'offline_access',
        'patient/*.read', 'patient/*.write', 'patient/*.*',
        'user/*.read', 'user/*.write', 'user/*.*',
        'system/*.read', 'system/*.write', 'system/*.*',
        'patient/Patient.read', 'patient/Observation.read', 'patient/Condition.read',
        'patient/MedicationRequest.read', 'patient/AllergyIntolerance.read',
        'patient/Procedure.read', 'patient/Immunization.read', 'patient/Encounter.read',
        'patient/CarePlan.read', 'patient/CareTeam.read', 'patient/Goal.read',
        'patient/DocumentReference.read', 'patient/DiagnosticReport.read',
        'patient/Device.read', 'patient/Provenance.read',
      ],
      response_types_supported: ['code'],
      management_endpoint: `${baseUrl}/auth/manage`,
      introspection_endpoint: `${baseUrl}/auth/introspect`,
      revocation_endpoint: `${baseUrl}/auth/revoke`,
      code_challenge_methods_supported: ['S256'],
      capabilities: [
        'launch-ehr',
        'launch-standalone',
        'client-public',
        'client-confidential-symmetric',
        'client-confidential-asymmetric',
        'permission-offline',
        'permission-patient',
        'permission-user',
        'context-ehr-patient',
        'context-ehr-encounter',
        'context-standalone-patient',
        'sso-openid-connect',
        'context-banner',
        'context-style',
      ],
    });
  });

  // FHIR CapabilityStatement alias
  app.get('/fhir/metadata', async (_req: Request, res: Response) => {
    try {
      const axios = await import('axios');
      const response = await axios.default.get(`${config.fhir.serverUrl}/metadata`, { timeout: 10000 });
      res.json(response.data);
    } catch {
      res.status(503).json({ error: 'FHIR server unavailable' });
    }
  });

  // Auth routes (with stricter rate limiting, no JWT auth required)
  app.use('/auth', authLimiter, authRouter);

  // FHIR proxy (uses its own auth: SMART on FHIR)
  app.use('/fhir', fhirProxyRouter);

  // CDS Hooks (§170.315(a)(9) - no auth, invoked by EHR)
  app.use('/cds-services', cdsHooksRouter);

  // Authenticated API routes
  app.use('/api/v1', authenticate, auditMiddleware);

  // API v1 resource routes
  app.use('/api/v1/patients', patientsRouter);
  app.use('/api/v1/encounters', encountersRouter);
  app.use('/api/v1/conditions', conditionsRouter);
  app.use('/api/v1/observations', observationsRouter);
  app.use('/api/v1/medications', medicationsRouter);
  app.use('/api/v1/allergies', allergiesRouter);
  app.use('/api/v1/procedures', proceduresRouter);
  app.use('/api/v1/immunizations', immunizationsRouter);
  app.use('/api/v1/documents', documentsRouter);
  app.use('/api/v1/care-plans', carePlansRouter);
  app.use('/api/v1/care-teams', careTeamsRouter);
  app.use('/api/v1/goals', goalsRouter);
  app.use('/api/v1/devices', devicesRouter);
  app.use('/api/v1/orders', ordersRouter);
  app.use('/api/v1/scheduling', schedulingRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/audit', auditRouter);
  app.use('/api/v1/clinical-notes', clinicalNotesRouter);
  app.use('/api/v1/messages', messagesRouter);
  app.use('/api/v1/public-health', publicHealthRouter);
  app.use('/api/v1/quality-measures', qualityMeasuresRouter);
  app.use('/api/v1/eprescribing', eprescribingRouter);
  app.use('/api/v1/referrals', referralsRouter);
  app.use('/api/v1/portal', portalRouter);
  app.use('/api/v1/delegations', delegationsRouter);
  app.use('/api/v1/results-inbox', resultsInboxRouter);
  app.use('/api/v1/order-sets', orderSetsRouter);

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

export default createApp;
