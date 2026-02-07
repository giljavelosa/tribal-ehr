// =============================================================================
// Training Routes - SAFER Guide 5, Practice 2.2
// Courses, training records, competency assessments, compliance reports
// =============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { trainingService } from '../services/training.service';
import { ValidationError } from '../utils/errors';

const router = Router();

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

router.get(
  '/courses',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courses = await trainingService.getCourses({
        category: req.query.category as string,
        active: req.query.active === 'false' ? false : true,
      });
      res.json({ data: courses });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/courses',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const course = await trainingService.createCourse(req.body);
      res.status(201).json({ data: course });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/courses/:id',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const course = await trainingService.updateCourse(req.params.id, req.body);
      res.json({ data: course });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Training Records
// ---------------------------------------------------------------------------

router.get(
  '/records',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.query.userId as string) || req.user!.id;
      const records = await trainingService.getTrainingForUser(userId);
      res.json({ data: records });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/records',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await trainingService.assignTraining(req.body);
      res.status(201).json({ data: record });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/records/bulk-assign',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, userIds } = req.body;
      if (!courseId || !Array.isArray(userIds)) {
        throw new ValidationError('courseId and userIds array are required');
      }
      const result = await trainingService.bulkAssignTraining(courseId, userIds);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/records/:id',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await trainingService.updateTrainingStatus(req.params.id, {
        status: req.body.status,
        score: req.body.score,
        verifiedBy: req.body.verifiedBy || req.user!.id,
      });
      res.json({ data: record });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Compliance Report
// ---------------------------------------------------------------------------

router.get(
  '/compliance',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await trainingService.getTrainingComplianceReport();
      res.json({ data: report });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/expired',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expired = await trainingService.getExpiredTraining();
      res.json({ data: expired });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Competency Assessments
// ---------------------------------------------------------------------------

router.post(
  '/assessments',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assessment = await trainingService.recordAssessment({
        ...req.body,
        assessedBy: req.body.assessedBy || req.user!.id,
      });
      res.status(201).json({ data: assessment });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/assessments',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.query.userId as string) || req.user!.id;
      const assessments = await trainingService.getAssessmentsForUser(userId);
      res.json({ data: assessments });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/assessments/overdue',
  authenticate,
  requireRole('ADMIN', 'SYSTEM_ADMIN', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const overdue = await trainingService.getOverdueAssessments();
      res.json({ data: overdue });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
