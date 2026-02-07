// =============================================================================
// Base Service - Common functionality for all service classes
// =============================================================================

import { Knex } from 'knex';
import { Logger } from 'winston';
import { db } from '../config/database';
import { FHIRClient, fhirClient } from '../utils/fhir-client';
import { logger as appLogger } from '../utils/logger';
import { AppError, InternalError, NotFoundError } from '../utils/errors';

// ---------------------------------------------------------------------------
// Common Types
// ---------------------------------------------------------------------------

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SortParams {
  sort?: string;
  order?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Base Service
// ---------------------------------------------------------------------------

export abstract class BaseService {
  protected db: Knex;
  protected fhirClient: FHIRClient;
  protected logger: Logger;

  constructor(serviceName: string) {
    this.db = db;
    this.fhirClient = fhirClient;
    this.logger = appLogger.child({ service: serviceName }) as Logger;
  }

  /**
   * Paginate a knex query builder and return a PaginatedResult.
   * The query should NOT have limit/offset already applied.
   */
  protected async paginate<T>(
    query: Knex.QueryBuilder,
    params: PaginationParams
  ): Promise<PaginatedResult<T>> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(200, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    // Clone the query for counting (before limit/offset)
    const countQuery = query.clone().clearSelect().clearOrder().count('* as total').first();
    const countResult = (await countQuery) as { total: string | number } | undefined;
    const total = countResult ? Number(countResult.total) : 0;

    const data = (await query.limit(limit).offset(offset)) as T[];

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Apply sorting to a knex query. Validates column names against an allow list
   * to prevent SQL injection through sort parameters.
   */
  protected buildSortClause(
    query: Knex.QueryBuilder,
    sort: string | undefined,
    order: 'asc' | 'desc' | undefined,
    allowedColumns: Record<string, string>
  ): Knex.QueryBuilder {
    if (!sort) {
      return query;
    }

    const column = allowedColumns[sort];
    if (!column) {
      return query;
    }

    return query.orderBy(column, order || 'asc');
  }

  /**
   * Wrap an operation in a database transaction. Rolls back on error.
   */
  protected async withTransaction<T>(
    callback: (trx: Knex.Transaction) => Promise<T>
  ): Promise<T> {
    const trx = await this.db.transaction();
    try {
      const result = await callback(trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Centralized error handling. Converts unknown errors to AppError instances,
   * logs them, and re-throws.
   */
  protected handleError(message: string, error: unknown): never {
    if (error instanceof AppError) {
      this.logger.error(message, {
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
      });
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logger.error(message, { error: errorMessage });
    throw new InternalError(`${message}: ${errorMessage}`);
  }

  /**
   * Look up a row by ID and throw NotFoundError if it doesn't exist.
   */
  protected async requireExists(
    table: string,
    id: string,
    resourceName: string
  ): Promise<Record<string, unknown>> {
    const row = await this.db(table).where({ id }).first();
    if (!row) {
      throw new NotFoundError(resourceName, id);
    }
    return row;
  }
}
