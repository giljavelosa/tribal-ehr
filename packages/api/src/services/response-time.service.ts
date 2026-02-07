// =============================================================================
// Response Time Service - Query historical response time metrics
// =============================================================================

import { BaseService } from './base.service';

interface MetricRow {
  id: string;
  endpoint: string;
  method: string;
  request_count: number;
  avg_duration_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  max_ms: number;
  error_count: number;
  period_start: string;
  period_end: string;
}

class ResponseTimeService extends BaseService {
  constructor() {
    super('ResponseTimeService');
  }

  async getMetrics(hours: number = 24): Promise<MetricRow[]> {
    return this.db('response_time_metrics')
      .where('period_start', '>=', this.db.raw(`NOW() - INTERVAL '${Math.min(hours, 720)} hours'`))
      .orderBy('period_start', 'desc')
      .limit(1000);
  }

  async getSlowEndpoints(thresholdMs: number = 500, hours: number = 24): Promise<{
    endpoint: string;
    method: string;
    avgMs: number;
    totalRequests: number;
    maxMs: number;
  }[]> {
    const rows = await this.db('response_time_metrics')
      .select('endpoint', 'method')
      .avg('avg_duration_ms as avgMs')
      .sum('request_count as totalRequests')
      .max('max_ms as maxMs')
      .where('period_start', '>=', this.db.raw(`NOW() - INTERVAL '${Math.min(hours, 720)} hours'`))
      .groupBy('endpoint', 'method')
      .havingRaw('AVG(avg_duration_ms) >= ?', [thresholdMs])
      .orderByRaw('AVG(avg_duration_ms) DESC')
      .limit(50);

    return rows.map((r: Record<string, unknown>) => ({
      endpoint: r.endpoint as string,
      method: r.method as string,
      avgMs: Math.round(Number(r.avgMs || 0) * 100) / 100,
      totalRequests: Number(r.totalRequests || 0),
      maxMs: Number(r.maxMs || 0),
    }));
  }
}

export const responseTimeService = new ResponseTimeService();
