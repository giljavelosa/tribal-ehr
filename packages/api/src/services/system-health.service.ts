// =============================================================================
// System Health Service - Real health checks for SAFER Guide 7 compliance
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService } from './base.service';
import { checkDatabaseConnection } from '../config/database';
import { checkRedisConnection } from '../config/redis';
import { checkRabbitMQConnection } from '../config/rabbitmq';
import { config } from '../config';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ServiceHealth {
  name: string;
  status: 'connected' | 'disconnected';
  latencyMs: number;
}

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  services: {
    db: string;
    redis: string;
    rabbitmq: string;
    fhir: string;
  };
  serviceDetails: ServiceHealth[];
  activeUsers: number;
  todaysEncounters: number;
  totalLatencyMs: number;
}

interface HealthCheckRow {
  id: string;
  overall_status: string;
  services: Record<string, unknown>;
  active_users: number;
  todays_encounters: number;
  total_latency_ms: number;
  checked_at: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

class SystemHealthService extends BaseService {
  constructor() {
    super('SystemHealthService');
  }

  async checkAll(): Promise<HealthCheckResult> {
    const serviceDetails: ServiceHealth[] = [];
    let totalLatency = 0;

    // Check database
    const dbStart = Date.now();
    const dbHealthy = await checkDatabaseConnection();
    const dbLatency = Date.now() - dbStart;
    serviceDetails.push({ name: 'Database (PostgreSQL)', status: dbHealthy ? 'connected' : 'disconnected', latencyMs: dbLatency });
    totalLatency += dbLatency;

    // Check Redis
    const redisStart = Date.now();
    const redisHealthy = await checkRedisConnection();
    const redisLatency = Date.now() - redisStart;
    serviceDetails.push({ name: 'Redis Cache', status: redisHealthy ? 'connected' : 'disconnected', latencyMs: redisLatency });
    totalLatency += redisLatency;

    // Check RabbitMQ
    const rmqStart = Date.now();
    const rmqHealthy = await checkRabbitMQConnection();
    const rmqLatency = Date.now() - rmqStart;
    serviceDetails.push({ name: 'RabbitMQ', status: rmqHealthy ? 'connected' : 'disconnected', latencyMs: rmqLatency });
    totalLatency += rmqLatency;

    // Check FHIR server
    const fhirResult = await this.checkFHIRServer();
    serviceDetails.push(fhirResult);
    totalLatency += fhirResult.latencyMs;

    const allHealthy = dbHealthy && redisHealthy && rmqHealthy && fhirResult.status === 'connected';
    const anyDown = !dbHealthy || !redisHealthy;
    const overallStatus = anyDown ? 'down' : allHealthy ? 'ok' : 'degraded';

    // Get operational metrics
    const activeUsers = await this.getActiveUserCount();
    const todaysEncounters = await this.getTodaysEncounterCount();

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        db: dbHealthy ? 'connected' : 'disconnected',
        redis: redisHealthy ? 'connected' : 'disconnected',
        rabbitmq: rmqHealthy ? 'connected' : 'disconnected',
        fhir: fhirResult.status,
      },
      serviceDetails,
      activeUsers,
      todaysEncounters,
      totalLatencyMs: totalLatency,
    };
  }

  async checkFHIRServer(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const axios = await import('axios');
      const response = await axios.default.get(`${config.fhir.serverUrl}/metadata`, {
        timeout: 5000,
      });
      const latency = Date.now() - start;
      return {
        name: 'FHIR Server',
        status: response.status === 200 ? 'connected' : 'disconnected',
        latencyMs: latency,
      };
    } catch {
      return {
        name: 'FHIR Server',
        status: 'disconnected',
        latencyMs: Date.now() - start,
      };
    }
  }

  async getActiveUserCount(): Promise<number> {
    try {
      const result = await this.db('audit_logs')
        .countDistinct('user_id as count')
        .where('timestamp', '>=', this.db.raw("NOW() - INTERVAL '15 minutes'"))
        .first();
      return Number(result?.count || 0);
    } catch {
      return 0;
    }
  }

  async getTodaysEncounterCount(): Promise<number> {
    try {
      const result = await this.db('encounters')
        .count('id as count')
        .whereRaw("DATE(created_at) = CURRENT_DATE")
        .first();
      return Number(result?.count || 0);
    } catch {
      return 0;
    }
  }

  async recordHealthCheck(result: HealthCheckResult): Promise<void> {
    try {
      await this.db('system_health_checks').insert({
        id: uuidv4(),
        overall_status: result.status,
        services: JSON.stringify(result.serviceDetails),
        active_users: result.activeUsers,
        todays_encounters: result.todaysEncounters,
        total_latency_ms: result.totalLatencyMs,
        checked_at: result.timestamp,
      });
    } catch (error) {
      this.logger.error('Failed to record health check', { error });
    }
  }

  async getHealthHistory(hours: number = 24): Promise<HealthCheckRow[]> {
    return this.db('system_health_checks')
      .where('checked_at', '>=', this.db.raw(`NOW() - INTERVAL '${Math.min(hours, 720)} hours'`))
      .orderBy('checked_at', 'desc')
      .limit(500);
  }
}

export const systemHealthService = new SystemHealthService();
