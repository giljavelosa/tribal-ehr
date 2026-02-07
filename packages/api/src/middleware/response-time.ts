// =============================================================================
// Response Time Middleware - SAFER Guide 7, Practice 3.1
// Collects per-request timing metrics with periodic DB flush
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { logger } from '../utils/logger';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RequestTiming {
  endpoint: string;
  method: string;
  durationMs: number;
  statusCode: number;
  timestamp: number;
}

// -----------------------------------------------------------------------------
// Circular Buffer Collector
// -----------------------------------------------------------------------------

class ResponseTimeCollector {
  private buffer: RequestTiming[] = [];
  private readonly maxSize = 10000;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private lastFlush: number = Date.now();

  start(): void {
    // Flush to DB every 60 seconds
    this.flushInterval = setInterval(() => {
      this.flush().catch((err) => {
        logger.error('Response time flush failed', { error: String(err) });
      });
    }, 60_000);
  }

  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  record(timing: RequestTiming): void {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(timing);
  }

  getLiveMetrics(): {
    totalRequests: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    maxMs: number;
    errorRate: number;
  } {
    if (this.buffer.length === 0) {
      return { totalRequests: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0, errorRate: 0 };
    }

    const durations = this.buffer.map((t) => t.durationMs).sort((a, b) => a - b);
    const errors = this.buffer.filter((t) => t.statusCode >= 500).length;
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      totalRequests: durations.length,
      avgMs: Math.round((sum / durations.length) * 100) / 100,
      p50Ms: durations[Math.floor(durations.length * 0.5)] || 0,
      p95Ms: durations[Math.floor(durations.length * 0.95)] || 0,
      p99Ms: durations[Math.floor(durations.length * 0.99)] || 0,
      maxMs: durations[durations.length - 1] || 0,
      errorRate: Math.round((errors / durations.length) * 10000) / 100,
    };
  }

  getSlowEndpoints(thresholdMs: number = 1000): { endpoint: string; method: string; avgMs: number; count: number }[] {
    const byEndpoint = new Map<string, { durations: number[]; method: string }>();

    for (const t of this.buffer) {
      const key = `${t.method}:${t.endpoint}`;
      if (!byEndpoint.has(key)) {
        byEndpoint.set(key, { durations: [], method: t.method });
      }
      byEndpoint.get(key)!.durations.push(t.durationMs);
    }

    const slow: { endpoint: string; method: string; avgMs: number; count: number }[] = [];
    for (const [key, data] of byEndpoint) {
      const avg = data.durations.reduce((a, b) => a + b, 0) / data.durations.length;
      if (avg >= thresholdMs) {
        slow.push({
          endpoint: key.split(':').slice(1).join(':'),
          method: data.method,
          avgMs: Math.round(avg * 100) / 100,
          count: data.durations.length,
        });
      }
    }

    return slow.sort((a, b) => b.avgMs - a.avgMs);
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const now = Date.now();
    const periodStart = new Date(this.lastFlush).toISOString();
    const periodEnd = new Date(now).toISOString();

    // Group by endpoint + method
    const groups = new Map<string, RequestTiming[]>();
    for (const t of this.buffer) {
      const key = `${t.method}:${t.endpoint}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(t);
    }

    const rows = Array.from(groups.entries()).map(([key, timings]) => {
      const durations = timings.map((t) => t.durationMs).sort((a, b) => a - b);
      const sum = durations.reduce((a, b) => a + b, 0);
      const errors = timings.filter((t) => t.statusCode >= 500).length;
      const parts = key.split(':');

      return {
        id: uuidv4(),
        endpoint: parts.slice(1).join(':'),
        method: parts[0],
        request_count: durations.length,
        avg_duration_ms: Math.round((sum / durations.length) * 100) / 100,
        p50_ms: durations[Math.floor(durations.length * 0.5)] || 0,
        p95_ms: durations[Math.floor(durations.length * 0.95)] || 0,
        p99_ms: durations[Math.floor(durations.length * 0.99)] || 0,
        max_ms: durations[durations.length - 1] || 0,
        error_count: errors,
        period_start: periodStart,
        period_end: periodEnd,
      };
    });

    try {
      if (rows.length > 0) {
        await db('response_time_metrics').insert(rows);
      }
    } catch (error) {
      logger.error('Failed to flush response time metrics', { error: String(error) });
    }

    this.buffer = [];
    this.lastFlush = now;
  }
}

export const responseTimeCollector = new ResponseTimeCollector();

// Normalize dynamic URL params to avoid cardinality explosion
function normalizeEndpoint(url: string): string {
  return url
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .split('?')[0];
}

export function responseTimeMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationMs = durationNs / 1_000_000;

    responseTimeCollector.record({
      endpoint: normalizeEndpoint(req.originalUrl || req.url),
      method: req.method,
      durationMs: Math.round(durationMs * 100) / 100,
      statusCode: res.statusCode,
      timestamp: Date.now(),
    });
  });

  next();
}
