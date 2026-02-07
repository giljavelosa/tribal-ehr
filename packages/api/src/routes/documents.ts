// =============================================================================
// Documents Routes - DocumentReference CRUD + C-CDA Generation/Consumption
//
// CRUD:
// GET    /                               - Search documents
// GET    /:id                            - Get document by ID
// POST   /                               - Create document
// PUT    /:id                            - Update document
// DELETE /:id                            - Delete document
//
// C-CDA:
// GET    /:patientId/ccda/ccd            - Generate CCD
// GET    /:patientId/ccda/referral       - Generate Referral Note
// POST   /:patientId/ccda/referral       - Generate Referral Note (POST body)
// GET    /:patientId/ccda/discharge      - Generate Discharge Summary
// GET    /:patientId/ccda/transfer       - Generate Transfer Summary
// POST   /ccda/import                    - Import/parse C-CDA document
// POST   /ccda/reconcile                 - Reconcile imported data
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate, validateQuery } from '../middleware/validation';
import { documentService } from '../services/document.service';
import { ccdaService } from '../services/ccda.service';

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

const referenceSchema = z.object({
  reference: z.string().optional(),
  type: z.string().optional(),
  display: z.string().optional(),
});

const periodSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

const attachmentSchema = z.object({
  contentType: z.string().optional(),
  language: z.string().optional(),
  data: z.string().optional(),
  url: z.string().optional(),
  size: z.number().optional(),
  hash: z.string().optional(),
  title: z.string().optional(),
  creation: z.string().optional(),
});

const documentCreateSchema = z.object({
  patientId: z.string().uuid(),
  status: z.enum(['current', 'superseded', 'entered-in-error']),
  type: codeableConceptSchema.optional(),
  category: z.array(codeableConceptSchema).optional(),
  date: z.string().optional(),
  author: z.array(referenceSchema).optional(),
  description: z.string().optional(),
  content: z.array(z.object({
    attachment: attachmentSchema,
    format: codeableConceptSchema.optional(),
  })),
  context: z.object({
    encounter: z.array(referenceSchema).optional(),
    event: z.array(codeableConceptSchema).optional(),
    period: periodSchema.optional(),
    facilityType: codeableConceptSchema.optional(),
    practiceSetting: codeableConceptSchema.optional(),
    related: z.array(referenceSchema).optional(),
  }).optional(),
});

const documentUpdateSchema = documentCreateSchema.partial();

const documentSearchSchema = z.object({
  patientId: z.string(),
  type: z.string().optional(),
  category: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  author: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// ===========================================================================
// C-CDA Routes (placed before parameterized routes to avoid conflicts)
// ===========================================================================

// ---------------------------------------------------------------------------
// Import / Parse C-CDA Document
// ---------------------------------------------------------------------------
router.post(
  '/ccda/import',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let xmlString: string;

      if (req.is('application/xml') || req.is('text/xml')) {
        xmlString = req.body as string;
      } else if (req.body.xml) {
        xmlString = req.body.xml;
      } else if (req.body.document) {
        xmlString = req.body.document;
      } else {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request must contain C-CDA XML in the body, or in a "xml" or "document" JSON field',
          },
        });
      }

      const parsed = await ccdaService.parseCCDA(xmlString);

      res.json({
        data: parsed,
        summary: {
          allergies: parsed.allergies.length,
          medications: parsed.medications.length,
          problems: parsed.problems.length,
          procedures: parsed.procedures.length,
          results: parsed.results.length,
          vitals: parsed.vitals.length,
          immunizations: parsed.immunizations.length,
          encounters: parsed.encounters.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Reconcile Imported C-CDA Data with Patient Records
// ---------------------------------------------------------------------------
router.post(
  '/ccda/reconcile',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientId, parsedData } = req.body;

      if (!patientId) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'patientId is required' },
        });
      }

      if (!parsedData) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'parsedData is required (output from /ccda/import)' },
        });
      }

      const result = await ccdaService.reconcile(patientId, parsedData);

      res.json({
        data: result,
        summary: {
          newItems: result.newItems.length,
          matchedItems: result.matchedItems.length,
          conflictItems: result.conflictItems.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Generate CCD (Continuity of Care Document)
// ---------------------------------------------------------------------------
router.get(
  '/:patientId/ccda/ccd',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const xml = await ccdaService.generateCCD(req.params.patientId);

      const format = req.query.format as string;
      if (format === 'download') {
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="CCD_${req.params.patientId}_${new Date().toISOString().split('T')[0]}.xml"`
        );
        return res.send(xml);
      }

      res.setHeader('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Generate Referral Note (GET - simple params)
// ---------------------------------------------------------------------------
router.get(
  '/:patientId/ccda/referral',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const referralData = {
        referringProvider: req.query.referringProvider
          ? JSON.parse(req.query.referringProvider as string)
          : undefined,
        referredToProvider: req.query.referredToProvider
          ? JSON.parse(req.query.referredToProvider as string)
          : undefined,
        reason: req.query.reason as string,
        urgency: req.query.urgency as 'routine' | 'urgent' | 'stat' | undefined,
        clinicalHistory: req.query.clinicalHistory as string,
        requestedServices: req.query.requestedServices as string,
      };

      const xml = await ccdaService.generateReferralNote(
        req.params.patientId,
        referralData
      );

      res.setHeader('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Generate Referral Note (POST - complex body)
// ---------------------------------------------------------------------------
router.post(
  '/:patientId/ccda/referral',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const xml = await ccdaService.generateReferralNote(
        req.params.patientId,
        req.body
      );

      res.setHeader('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Generate Discharge Summary
// ---------------------------------------------------------------------------
router.get(
  '/:patientId/ccda/discharge',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const encounterId = req.query.encounterId as string;
      if (!encounterId) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'encounterId query parameter is required' },
        });
      }

      const xml = await ccdaService.generateDischargeSummary(
        req.params.patientId,
        encounterId
      );

      res.setHeader('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Generate Transfer Summary
// ---------------------------------------------------------------------------
router.get(
  '/:patientId/ccda/transfer',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const encounterId = req.query.encounterId as string;
      if (!encounterId) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'encounterId query parameter is required' },
        });
      }

      const xml = await ccdaService.generateTransferSummary(
        req.params.patientId,
        encounterId
      );

      res.setHeader('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      next(error);
    }
  }
);

// ===========================================================================
// DocumentReference CRUD Routes
// ===========================================================================

// Search documents (GET /)
router.get(
  '/',
  authenticate,
  requirePermission('documents', 'read'),
  validateQuery(documentSearchSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await documentService.search(req.query as never);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get document by ID (GET /:id)
router.get(
  '/:id',
  authenticate,
  requirePermission('documents', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = await documentService.getById(req.params.id);
      res.json(document);
    } catch (error) {
      next(error);
    }
  }
);

// Create document (POST /)
router.post(
  '/',
  authenticate,
  requirePermission('documents', 'write'),
  validate(documentCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = await documentService.create(req.body);
      res.status(201).json(document);
    } catch (error) {
      next(error);
    }
  }
);

// Update document (PUT /:id)
router.put(
  '/:id',
  authenticate,
  requirePermission('documents', 'write'),
  validate(documentUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = await documentService.update(req.params.id, req.body);
      res.json(document);
    } catch (error) {
      next(error);
    }
  }
);

// Delete document (DELETE /:id)
router.delete(
  '/:id',
  authenticate,
  requirePermission('documents', 'delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await documentService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
