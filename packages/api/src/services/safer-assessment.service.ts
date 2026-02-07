// =============================================================================
// SAFER Assessment Service - Annual self-assessment tracking
// Required by CY 2026 IPPS rule for all 8 SAFER Guides
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService } from './base.service';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SaferGuide {
  id: string;
  guideNumber: number;
  title: string;
}

export interface SaferPractice {
  id: string;
  guideId: string;
  practiceNumber: string;
  description: string;
  required: boolean;
}

export interface SaferAssessment {
  id: string;
  assessmentYear: number;
  status: string;
  assessorId?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaferAssessmentItem {
  id: string;
  assessmentId: string;
  practiceId: string;
  implementationPercentage: number;
  status: string;
  ehrLimitation: boolean;
  notes?: string;
  evidence?: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

class SaferAssessmentService extends BaseService {
  constructor() {
    super('SaferAssessmentService');
  }

  // -- Guides & Practices --

  async getGuides(): Promise<SaferGuide[]> {
    const rows = await this.db('safer_guides').orderBy('guide_number');
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      guideNumber: r.guide_number as number,
      title: r.title as string,
    }));
  }

  async getPractices(guideId?: string): Promise<SaferPractice[]> {
    let query = this.db('safer_practices').orderBy('practice_number');
    if (guideId) query = query.where({ guide_id: guideId });
    const rows = await query;
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      guideId: r.guide_id as string,
      practiceNumber: r.practice_number as string,
      description: r.description as string,
      required: r.required as boolean,
    }));
  }

  // -- Assessments --

  async createAssessment(year: number, assessorId: string): Promise<SaferAssessment> {
    if (!year || year < 2024 || year > 2100) {
      throw new ValidationError('Valid assessment year is required');
    }

    // Check for existing assessment for this year
    const existing = await this.db('safer_assessments').where({ assessment_year: year }).first();
    if (existing) {
      throw new ValidationError(`Assessment for year ${year} already exists`);
    }

    const id = uuidv4();
    await this.db('safer_assessments').insert({
      id,
      assessment_year: year,
      status: 'draft',
      assessor_id: assessorId,
    });

    // Create assessment items for all practices
    const practices = await this.getPractices();
    const items = practices.map((p) => ({
      id: uuidv4(),
      assessment_id: id,
      practice_id: p.id,
      implementation_percentage: 0,
      status: 'not_assessed',
    }));

    if (items.length > 0) {
      await this.db('safer_assessment_items').insert(items);
    }

    return this.getAssessment(id);
  }

  async getAssessment(id: string): Promise<SaferAssessment> {
    const row = await this.db('safer_assessments').where({ id }).first();
    if (!row) throw new NotFoundError('SaferAssessment', id);
    return this.toAssessmentModel(row);
  }

  async getAssessmentByYear(year: number): Promise<SaferAssessment | null> {
    const row = await this.db('safer_assessments').where({ assessment_year: year }).first();
    return row ? this.toAssessmentModel(row) : null;
  }

  async getAssessmentItems(assessmentId: string): Promise<(SaferAssessmentItem & { practiceNumber: string; description: string; guideId: string; required: boolean })[]> {
    const rows = await this.db('safer_assessment_items')
      .leftJoin('safer_practices', 'safer_assessment_items.practice_id', 'safer_practices.id')
      .where('safer_assessment_items.assessment_id', assessmentId)
      .select(
        'safer_assessment_items.*',
        'safer_practices.practice_number',
        'safer_practices.description',
        'safer_practices.guide_id',
        'safer_practices.required',
      )
      .orderBy('safer_practices.practice_number');

    return rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      assessmentId: r.assessment_id as string,
      practiceId: r.practice_id as string,
      implementationPercentage: r.implementation_percentage as number,
      status: r.status as string,
      ehrLimitation: r.ehr_limitation as boolean,
      notes: r.notes as string | undefined,
      evidence: r.evidence as string | undefined,
      practiceNumber: r.practice_number as string,
      description: r.description as string,
      guideId: r.guide_id as string,
      required: r.required as boolean,
    }));
  }

  async updateAssessmentItem(itemId: string, data: {
    implementationPercentage?: number;
    status?: string;
    ehrLimitation?: boolean;
    notes?: string;
    evidence?: string;
  }): Promise<SaferAssessmentItem> {
    const existing = await this.db('safer_assessment_items').where({ id: itemId }).first();
    if (!existing) throw new NotFoundError('SaferAssessmentItem', itemId);

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.implementationPercentage !== undefined) update.implementation_percentage = Math.min(100, Math.max(0, data.implementationPercentage));
    if (data.status !== undefined) update.status = data.status;
    if (data.ehrLimitation !== undefined) update.ehr_limitation = data.ehrLimitation;
    if (data.notes !== undefined) update.notes = data.notes;
    if (data.evidence !== undefined) update.evidence = data.evidence;

    await this.db('safer_assessment_items').where({ id: itemId }).update(update);

    // Update parent assessment status to in_progress if it was draft
    await this.db('safer_assessments')
      .where({ id: existing.assessment_id, status: 'draft' })
      .update({ status: 'in_progress', updated_at: new Date().toISOString() });

    const row = await this.db('safer_assessment_items').where({ id: itemId }).first();
    return {
      id: row.id,
      assessmentId: row.assessment_id,
      practiceId: row.practice_id,
      implementationPercentage: row.implementation_percentage,
      status: row.status,
      ehrLimitation: row.ehr_limitation,
      notes: row.notes,
      evidence: row.evidence,
    };
  }

  async completeAssessment(assessmentId: string): Promise<SaferAssessment> {
    await this.requireExists('safer_assessments', assessmentId, 'SaferAssessment');

    // Check all items are assessed
    const unassessed = await this.db('safer_assessment_items')
      .where({ assessment_id: assessmentId, status: 'not_assessed' })
      .count('id as count')
      .first();

    if (Number(unassessed?.count || 0) > 0) {
      throw new ValidationError(`${unassessed?.count} practices are still not assessed`);
    }

    await this.db('safer_assessments').where({ id: assessmentId }).update({
      status: 'completed',
      updated_at: new Date().toISOString(),
    });

    return this.getAssessment(assessmentId);
  }

  async approveAssessment(assessmentId: string, approvedBy: string): Promise<SaferAssessment> {
    const assessment = await this.getAssessment(assessmentId);
    if (assessment.status !== 'completed') {
      throw new ValidationError('Assessment must be completed before approval');
    }

    await this.db('safer_assessments').where({ id: assessmentId }).update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return this.getAssessment(assessmentId);
  }

  async getComplianceSummary(assessmentId: string): Promise<{
    overallPercentage: number;
    byGuide: {
      guideNumber: number;
      guideTitle: string;
      totalPractices: number;
      assessedCount: number;
      fullyImplemented: number;
      avgImplementation: number;
    }[];
    totalPractices: number;
    fullyImplemented: number;
    partiallyImplemented: number;
    notImplemented: number;
    ehrLimitations: number;
  }> {
    const items = await this.getAssessmentItems(assessmentId);
    const guides = await this.getGuides();

    const byGuide = guides.map((guide) => {
      const guideItems = items.filter((i) => i.guideId === guide.id);
      const assessed = guideItems.filter((i) => i.status !== 'not_assessed');
      const fullyImpl = guideItems.filter((i) => i.status === 'fully_implemented');
      const avgImpl = guideItems.length > 0
        ? Math.round(guideItems.reduce((sum, i) => sum + i.implementationPercentage, 0) / guideItems.length)
        : 0;

      return {
        guideNumber: guide.guideNumber,
        guideTitle: guide.title,
        totalPractices: guideItems.length,
        assessedCount: assessed.length,
        fullyImplemented: fullyImpl.length,
        avgImplementation: avgImpl,
      };
    });

    const fullyImplemented = items.filter((i) => i.status === 'fully_implemented').length;
    const partiallyImplemented = items.filter((i) => i.status === 'partially_implemented').length;
    const notImplemented = items.filter((i) => i.status === 'not_implemented').length;
    const ehrLimitations = items.filter((i) => i.ehrLimitation).length;
    const overallPercentage = items.length > 0
      ? Math.round(items.reduce((sum, i) => sum + i.implementationPercentage, 0) / items.length)
      : 0;

    return {
      overallPercentage,
      byGuide,
      totalPractices: items.length,
      fullyImplemented,
      partiallyImplemented,
      notImplemented,
      ehrLimitations,
    };
  }

  async getAssessmentHistory(): Promise<SaferAssessment[]> {
    const rows = await this.db('safer_assessments').orderBy('assessment_year', 'desc');
    return rows.map((r: Record<string, unknown>) => this.toAssessmentModel(r));
  }

  private toAssessmentModel(row: Record<string, unknown>): SaferAssessment {
    return {
      id: row.id as string,
      assessmentYear: row.assessment_year as number,
      status: row.status as string,
      assessorId: row.assessor_id as string | undefined,
      approvedBy: row.approved_by as string | undefined,
      approvedAt: row.approved_at as string | undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

export const saferAssessmentService = new SaferAssessmentService();
