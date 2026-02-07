// =============================================================================
// Safety Incident Service - SAFER Guide 5, Practice 1.5
// Near-miss reporting, adverse event tracking, investigation workflow
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import { ValidationError, NotFoundError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SafetyIncident {
  id: string;
  incidentNumber: string;
  type: string;
  severity: string;
  status: string;
  description: string;
  reporterId: string;
  patientId?: string;
  incidentDate: string;
  assignedTo?: string;
  investigationNotes?: string;
  rootCause?: string;
  correctiveAction?: string;
  resolution?: string;
  ehrRelated: boolean;
  ehrModule?: string;
  contributingFactors: string[];
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

class SafetyIncidentService extends BaseService {
  constructor() {
    super('SafetyIncidentService');
  }

  private toModel(row: Record<string, unknown>): SafetyIncident {
    return {
      id: row.id as string,
      incidentNumber: row.incident_number as string,
      type: row.type as string,
      severity: row.severity as string,
      status: row.status as string,
      description: row.description as string,
      reporterId: row.reporter_id as string,
      patientId: row.patient_id as string | undefined,
      incidentDate: row.incident_date as string,
      assignedTo: row.assigned_to as string | undefined,
      investigationNotes: row.investigation_notes as string | undefined,
      rootCause: row.root_cause as string | undefined,
      correctiveAction: row.corrective_action as string | undefined,
      resolution: row.resolution as string | undefined,
      ehrRelated: row.ehr_related as boolean,
      ehrModule: row.ehr_module as string | undefined,
      contributingFactors: (row.contributing_factors || []) as string[],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  private async generateIncidentNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `INC-${dateStr}-`;

    const lastIncident = await this.db('safety_incidents')
      .where('incident_number', 'like', `${prefix}%`)
      .orderBy('incident_number', 'desc')
      .first();

    let seq = 1;
    if (lastIncident) {
      const lastSeq = parseInt(lastIncident.incident_number.split('-').pop() || '0', 10);
      seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  async create(data: {
    type: string;
    severity: string;
    description: string;
    reporterId: string;
    patientId?: string;
    incidentDate: string;
    ehrRelated?: boolean;
    ehrModule?: string;
    contributingFactors?: string[];
  }): Promise<SafetyIncident> {
    if (!data.type || !data.severity || !data.description || !data.reporterId || !data.incidentDate) {
      throw new ValidationError('type, severity, description, reporterId, and incidentDate are required');
    }

    const id = uuidv4();
    const incidentNumber = await this.generateIncidentNumber();

    await this.db('safety_incidents').insert({
      id,
      incident_number: incidentNumber,
      type: data.type,
      severity: data.severity,
      status: 'reported',
      description: data.description,
      reporter_id: data.reporterId,
      patient_id: data.patientId || null,
      incident_date: data.incidentDate,
      ehr_related: data.ehrRelated || false,
      ehr_module: data.ehrModule || null,
      contributing_factors: JSON.stringify(data.contributingFactors || []),
    });

    const row = await this.db('safety_incidents').where({ id }).first();
    return this.toModel(row);
  }

  async update(id: string, data: Partial<{
    type: string;
    severity: string;
    description: string;
    investigationNotes: string;
    rootCause: string;
    correctiveAction: string;
    ehrRelated: boolean;
    ehrModule: string;
    contributingFactors: string[];
  }>): Promise<SafetyIncident> {
    await this.requireExists('safety_incidents', id, 'SafetyIncident');

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.type !== undefined) update.type = data.type;
    if (data.severity !== undefined) update.severity = data.severity;
    if (data.description !== undefined) update.description = data.description;
    if (data.investigationNotes !== undefined) update.investigation_notes = data.investigationNotes;
    if (data.rootCause !== undefined) update.root_cause = data.rootCause;
    if (data.correctiveAction !== undefined) update.corrective_action = data.correctiveAction;
    if (data.ehrRelated !== undefined) update.ehr_related = data.ehrRelated;
    if (data.ehrModule !== undefined) update.ehr_module = data.ehrModule;
    if (data.contributingFactors !== undefined) update.contributing_factors = JSON.stringify(data.contributingFactors);

    await this.db('safety_incidents').where({ id }).update(update);
    const row = await this.db('safety_incidents').where({ id }).first();
    return this.toModel(row);
  }

  async search(filters: {
    status?: string;
    severity?: string;
    type?: string;
    ehrRelated?: boolean;
  } & PaginationParams): Promise<PaginatedResult<SafetyIncident>> {
    let query = this.db('safety_incidents').orderBy('incident_date', 'desc');

    if (filters.status) query = query.where({ status: filters.status });
    if (filters.severity) query = query.where({ severity: filters.severity });
    if (filters.type) query = query.where({ type: filters.type });
    if (filters.ehrRelated !== undefined) query = query.where({ ehr_related: filters.ehrRelated });

    const result = await this.paginate<Record<string, unknown>>(query, filters);
    return {
      ...result,
      data: result.data.map((r) => this.toModel(r)),
    };
  }

  async assignInvestigator(id: string, assignedTo: string): Promise<SafetyIncident> {
    await this.requireExists('safety_incidents', id, 'SafetyIncident');

    await this.db('safety_incidents').where({ id }).update({
      assigned_to: assignedTo,
      status: 'investigating',
      updated_at: new Date().toISOString(),
    });

    const row = await this.db('safety_incidents').where({ id }).first();
    return this.toModel(row);
  }

  async resolve(id: string, data: {
    resolution: string;
    rootCause?: string;
    correctiveAction?: string;
  }): Promise<SafetyIncident> {
    await this.requireExists('safety_incidents', id, 'SafetyIncident');

    if (!data.resolution) {
      throw new ValidationError('resolution is required');
    }

    await this.db('safety_incidents').where({ id }).update({
      status: 'resolved',
      resolution: data.resolution,
      root_cause: data.rootCause || null,
      corrective_action: data.correctiveAction || null,
      updated_at: new Date().toISOString(),
    });

    const row = await this.db('safety_incidents').where({ id }).first();
    return this.toModel(row);
  }

  async getAnalytics(): Promise<{
    total: number;
    byStatus: { status: string; count: number }[];
    bySeverity: { severity: string; count: number }[];
    byType: { type: string; count: number }[];
    ehrRelatedCount: number;
    avgResolutionDays: number;
  }> {
    const total = await this.db('safety_incidents').count('id as count').first();
    const byStatus = await this.db('safety_incidents')
      .select('status')
      .count('id as count')
      .groupBy('status');
    const bySeverity = await this.db('safety_incidents')
      .select('severity')
      .count('id as count')
      .groupBy('severity');
    const byType = await this.db('safety_incidents')
      .select('type')
      .count('id as count')
      .groupBy('type');
    const ehrRelated = await this.db('safety_incidents')
      .where({ ehr_related: true })
      .count('id as count')
      .first();
    const avgResolution = await this.db('safety_incidents')
      .where({ status: 'resolved' })
      .whereNotNull('created_at')
      .select(this.db.raw("AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) as avg"))
      .first() as { avg: number | null } | undefined;

    return {
      total: Number(total?.count || 0),
      byStatus: byStatus.map((r: Record<string, unknown>) => ({ status: r.status as string, count: Number(r.count) })),
      bySeverity: bySeverity.map((r: Record<string, unknown>) => ({ severity: r.severity as string, count: Number(r.count) })),
      byType: byType.map((r: Record<string, unknown>) => ({ type: r.type as string, count: Number(r.count) })),
      ehrRelatedCount: Number(ehrRelated?.count || 0),
      avgResolutionDays: Math.round(Number(avgResolution?.avg || 0) * 10) / 10,
    };
  }
}

export const safetyIncidentService = new SafetyIncidentService();
