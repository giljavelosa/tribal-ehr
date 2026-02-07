// =============================================================================
// Training & Competency Service - SAFER Guide 5, Practice 2.2
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService } from './base.service';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TrainingCourse {
  id: string;
  title: string;
  description?: string;
  category: string;
  required: boolean;
  recurrenceMonths?: number;
  passingScore: number;
  active: boolean;
  createdAt: string;
}

export interface TrainingRecord {
  id: string;
  userId: string;
  courseId: string;
  courseTitle?: string;
  status: string;
  score?: number;
  passed?: boolean;
  assignedAt: string;
  completedAt?: string;
  expiresAt?: string;
  verifiedBy?: string;
}

export interface CompetencyAssessment {
  id: string;
  userId: string;
  competencyArea: string;
  proficiencyLevel: string;
  assessedBy: string;
  assessedAt: string;
  nextAssessmentDue?: string;
  notes?: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

class TrainingService extends BaseService {
  constructor() {
    super('TrainingService');
  }

  // -- Courses --

  async createCourse(data: {
    title: string;
    description?: string;
    category: string;
    required?: boolean;
    recurrenceMonths?: number;
    passingScore?: number;
  }): Promise<TrainingCourse> {
    if (!data.title || !data.category) {
      throw new ValidationError('title and category are required');
    }

    const id = uuidv4();
    await this.db('training_courses').insert({
      id,
      title: data.title,
      description: data.description || null,
      category: data.category,
      required: data.required || false,
      recurrence_months: data.recurrenceMonths || null,
      passing_score: data.passingScore || 80,
    });

    return this.getCourse(id);
  }

  async getCourse(id: string): Promise<TrainingCourse> {
    const row = await this.db('training_courses').where({ id }).first();
    if (!row) throw new NotFoundError('TrainingCourse', id);
    return this.toCourseModel(row);
  }

  async getCourses(filters?: { category?: string; active?: boolean }): Promise<TrainingCourse[]> {
    let query = this.db('training_courses').orderBy('title');
    if (filters?.category) query = query.where({ category: filters.category });
    if (filters?.active !== undefined) query = query.where({ active: filters.active });
    const rows = await query;
    return rows.map((r: Record<string, unknown>) => this.toCourseModel(r));
  }

  async updateCourse(id: string, data: Partial<{
    title: string;
    description: string;
    category: string;
    required: boolean;
    recurrenceMonths: number;
    passingScore: number;
    active: boolean;
  }>): Promise<TrainingCourse> {
    await this.requireExists('training_courses', id, 'TrainingCourse');
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) update.title = data.title;
    if (data.description !== undefined) update.description = data.description;
    if (data.category !== undefined) update.category = data.category;
    if (data.required !== undefined) update.required = data.required;
    if (data.recurrenceMonths !== undefined) update.recurrence_months = data.recurrenceMonths;
    if (data.passingScore !== undefined) update.passing_score = data.passingScore;
    if (data.active !== undefined) update.active = data.active;

    await this.db('training_courses').where({ id }).update(update);
    return this.getCourse(id);
  }

  // -- Training Records --

  async assignTraining(data: {
    userId: string;
    courseId: string;
  }): Promise<TrainingRecord> {
    await this.requireExists('training_courses', data.courseId, 'TrainingCourse');

    const id = uuidv4();
    await this.db('training_records').insert({
      id,
      user_id: data.userId,
      course_id: data.courseId,
      status: 'assigned',
    });

    return this.getTrainingRecord(id);
  }

  async bulkAssignTraining(courseId: string, userIds: string[]): Promise<{ assigned: number }> {
    await this.requireExists('training_courses', courseId, 'TrainingCourse');
    const rows = userIds.map((userId) => ({
      id: uuidv4(),
      user_id: userId,
      course_id: courseId,
      status: 'assigned',
    }));

    if (rows.length > 0) {
      await this.db('training_records').insert(rows);
    }
    return { assigned: rows.length };
  }

  async updateTrainingStatus(recordId: string, data: {
    status: string;
    score?: number;
    verifiedBy?: string;
  }): Promise<TrainingRecord> {
    const existing = await this.db('training_records').where({ id: recordId }).first();
    if (!existing) throw new NotFoundError('TrainingRecord', recordId);

    const update: Record<string, unknown> = { status: data.status };

    if (data.status === 'completed') {
      update.completed_at = new Date().toISOString();
      if (data.score !== undefined) {
        update.score = data.score;
        // Look up passing score
        const course = await this.db('training_courses').where({ id: existing.course_id }).first();
        update.passed = data.score >= (course?.passing_score || 80);
      }
      if (data.verifiedBy) update.verified_by = data.verifiedBy;

      // Calculate expiration if course has recurrence
      const course = await this.db('training_courses').where({ id: existing.course_id }).first();
      if (course?.recurrence_months) {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + course.recurrence_months);
        update.expires_at = expiresAt.toISOString();
      }
    }

    await this.db('training_records').where({ id: recordId }).update(update);
    return this.getTrainingRecord(recordId);
  }

  async getTrainingRecord(id: string): Promise<TrainingRecord> {
    const row = await this.db('training_records')
      .leftJoin('training_courses', 'training_records.course_id', 'training_courses.id')
      .where('training_records.id', id)
      .select('training_records.*', 'training_courses.title as course_title')
      .first();
    if (!row) throw new NotFoundError('TrainingRecord', id);
    return this.toRecordModel(row);
  }

  async getTrainingForUser(userId: string): Promise<TrainingRecord[]> {
    const rows = await this.db('training_records')
      .leftJoin('training_courses', 'training_records.course_id', 'training_courses.id')
      .where('training_records.user_id', userId)
      .select('training_records.*', 'training_courses.title as course_title')
      .orderBy('training_records.assigned_at', 'desc');
    return rows.map((r: Record<string, unknown>) => this.toRecordModel(r));
  }

  async getExpiredTraining(): Promise<TrainingRecord[]> {
    const rows = await this.db('training_records')
      .leftJoin('training_courses', 'training_records.course_id', 'training_courses.id')
      .where('training_records.expires_at', '<', new Date().toISOString())
      .whereNot('training_records.status', 'expired')
      .select('training_records.*', 'training_courses.title as course_title');
    return rows.map((r: Record<string, unknown>) => this.toRecordModel(r));
  }

  async getTrainingComplianceReport(): Promise<{
    totalCourses: number;
    requiredCourses: number;
    totalAssignments: number;
    completedCount: number;
    overdueCount: number;
    completionRate: number;
    byCategory: { category: string; total: number; completed: number }[];
  }> {
    const totalCourses = await this.db('training_courses').where({ active: true }).count('id as count').first();
    const requiredCourses = await this.db('training_courses').where({ active: true, required: true }).count('id as count').first();
    const totalAssignments = await this.db('training_records').count('id as count').first();
    const completedCount = await this.db('training_records').where({ status: 'completed' }).count('id as count').first();
    const overdueCount = await this.db('training_records')
      .where('expires_at', '<', new Date().toISOString())
      .whereNot('status', 'completed')
      .count('id as count')
      .first();

    const byCategory = await this.db('training_records')
      .leftJoin('training_courses', 'training_records.course_id', 'training_courses.id')
      .select('training_courses.category')
      .count('training_records.id as total')
      .countDistinct(this.db.raw("CASE WHEN training_records.status = 'completed' THEN training_records.id END as completed"))
      .groupBy('training_courses.category');

    const total = Number(totalAssignments?.count || 0);
    const completed = Number(completedCount?.count || 0);

    return {
      totalCourses: Number(totalCourses?.count || 0),
      requiredCourses: Number(requiredCourses?.count || 0),
      totalAssignments: total,
      completedCount: completed,
      overdueCount: Number(overdueCount?.count || 0),
      completionRate: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
      byCategory: byCategory.map((r: Record<string, unknown>) => ({
        category: (r.category as string) || 'Unknown',
        total: Number(r.total || 0),
        completed: Number(r.completed || 0),
      })),
    };
  }

  // -- Competency Assessments --

  async recordAssessment(data: {
    userId: string;
    competencyArea: string;
    proficiencyLevel: string;
    assessedBy: string;
    nextAssessmentDue?: string;
    notes?: string;
  }): Promise<CompetencyAssessment> {
    if (!data.userId || !data.competencyArea || !data.proficiencyLevel) {
      throw new ValidationError('userId, competencyArea, and proficiencyLevel are required');
    }

    const id = uuidv4();
    await this.db('competency_assessments').insert({
      id,
      user_id: data.userId,
      competency_area: data.competencyArea,
      proficiency_level: data.proficiencyLevel,
      assessed_by: data.assessedBy,
      next_assessment_due: data.nextAssessmentDue || null,
      notes: data.notes || null,
    });

    const row = await this.db('competency_assessments').where({ id }).first();
    return this.toAssessmentModel(row);
  }

  async getAssessmentsForUser(userId: string): Promise<CompetencyAssessment[]> {
    const rows = await this.db('competency_assessments')
      .where({ user_id: userId })
      .orderBy('assessed_at', 'desc');
    return rows.map((r: Record<string, unknown>) => this.toAssessmentModel(r));
  }

  async getOverdueAssessments(): Promise<CompetencyAssessment[]> {
    const rows = await this.db('competency_assessments')
      .where('next_assessment_due', '<', new Date().toISOString())
      .orderBy('next_assessment_due', 'asc');
    return rows.map((r: Record<string, unknown>) => this.toAssessmentModel(r));
  }

  // -- Mappers --

  private toCourseModel(row: Record<string, unknown>): TrainingCourse {
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string | undefined,
      category: row.category as string,
      required: row.required as boolean,
      recurrenceMonths: row.recurrence_months as number | undefined,
      passingScore: row.passing_score as number,
      active: row.active as boolean,
      createdAt: row.created_at as string,
    };
  }

  private toRecordModel(row: Record<string, unknown>): TrainingRecord {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      courseId: row.course_id as string,
      courseTitle: row.course_title as string | undefined,
      status: row.status as string,
      score: row.score as number | undefined,
      passed: row.passed as boolean | undefined,
      assignedAt: row.assigned_at as string,
      completedAt: row.completed_at as string | undefined,
      expiresAt: row.expires_at as string | undefined,
      verifiedBy: row.verified_by as string | undefined,
    };
  }

  private toAssessmentModel(row: Record<string, unknown>): CompetencyAssessment {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      competencyArea: row.competency_area as string,
      proficiencyLevel: row.proficiency_level as string,
      assessedBy: row.assessed_by as string,
      assessedAt: row.assessed_at as string,
      nextAssessmentDue: row.next_assessment_due as string | undefined,
      notes: row.notes as string | undefined,
    };
  }
}

export const trainingService = new TrainingService();
