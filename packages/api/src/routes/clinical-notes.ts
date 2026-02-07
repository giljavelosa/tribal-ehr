// =============================================================================
// Clinical Notes Routes
// POST   /                      - Create clinical note
// PUT    /:id                   - Update note (draft only)
// POST   /:id/sign              - Sign note
// POST   /:id/cosign            - Co-sign note
// POST   /:id/amend             - Amend signed note
// GET    /                      - List notes (with filters)
// GET    /templates             - Get note templates
// GET    /encounter/:encounterId - Get notes for encounter
// GET    /:id                   - Get note by ID
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { clinicalNotesService, NoteType, NoteStatus } from '../services/clinical-notes.service';
import { authenticate } from '../middleware/auth';

const router = Router();

// ---------------------------------------------------------------------------
// Get Note Templates
// ---------------------------------------------------------------------------
router.get(
  '/templates',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const templates = clinicalNotesService.getTemplates(
        req.query.noteType as NoteType | undefined
      );
      res.json({ data: templates });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Encounter Notes
// ---------------------------------------------------------------------------
router.get(
  '/encounter/:encounterId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notes = await clinicalNotesService.getEncounterNotes(
        req.params.encounterId
      );
      res.json({ data: notes });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// List Notes (with filters)
// ---------------------------------------------------------------------------
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await clinicalNotesService.getPatientNotes({
        patientId: req.query.patientId as string,
        encounterId: req.query.encounterId as string,
        noteType: req.query.noteType as NoteType | undefined,
        status: req.query.status as NoteStatus | undefined,
        authorId: req.query.authorId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        sort: req.query.sort as string,
        order: req.query.order as 'asc' | 'desc' | undefined,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Get Note by ID
// ---------------------------------------------------------------------------
router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await clinicalNotesService.getNote(req.params.id);
      res.json({ data: note });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Create Note
// ---------------------------------------------------------------------------
router.post(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await clinicalNotesService.createNote({
        patientId: req.body.patientId,
        encounterId: req.body.encounterId,
        noteType: req.body.noteType,
        title: req.body.title,
        sections: req.body.sections,
        plainText: req.body.plainText,
        templateId: req.body.templateId,
        authorId: req.user!.id,
      });

      res.status(201).json({ data: note });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Update Note (draft only)
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await clinicalNotesService.updateNote(req.params.id, {
        title: req.body.title,
        sections: req.body.sections,
        plainText: req.body.plainText,
      });

      res.json({ data: note });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Sign Note
// ---------------------------------------------------------------------------
router.post(
  '/:id/sign',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await clinicalNotesService.signNote(
        req.params.id,
        req.user!.id
      );
      res.json({ data: note });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Co-Sign Note
// ---------------------------------------------------------------------------
router.post(
  '/:id/cosign',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await clinicalNotesService.cosignNote(
        req.params.id,
        req.user!.id
      );
      res.json({ data: note });
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Amend Signed Note
// ---------------------------------------------------------------------------
router.post(
  '/:id/amend',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await clinicalNotesService.amendNote(
        req.params.id,
        {
          reason: req.body.reason,
          sections: req.body.sections,
          plainText: req.body.plainText,
          title: req.body.title,
        },
        req.user!.id
      );
      res.json({ data: note });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
