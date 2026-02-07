import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { config } from '../config';
import { logger } from './logger';
import { AppError, NotFoundError, ValidationError, InternalError } from './errors';

interface FHIROperationOutcome {
  resourceType: 'OperationOutcome';
  issue: Array<{
    severity: 'fatal' | 'error' | 'warning' | 'information';
    code: string;
    diagnostics?: string;
    details?: { text?: string };
  }>;
}

interface FHIRBundle {
  resourceType: 'Bundle';
  type: string;
  total?: number;
  entry?: Array<{
    resource?: Record<string, unknown>;
    fullUrl?: string;
    search?: { mode?: string; score?: number };
    request?: { method: string; url: string };
    response?: { status: string };
  }>;
  link?: Array<{ relation: string; url: string }>;
}

interface SearchParams {
  [key: string]: string | number | boolean | string[];
}

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

export class FHIRClient {
  private client: AxiosInstance;

  constructor(baseURL?: string) {
    this.client = axios.create({
      baseURL: baseURL || config.fhir.serverUrl,
      headers: {
        'Content-Type': 'application/fhir+json',
        Accept: 'application/fhir+json',
      },
      timeout: 30000,
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        throw this.convertError(error);
      }
    );
  }

  async create<T = Record<string, unknown>>(
    resourceType: string,
    resource: Record<string, unknown>
  ): Promise<T> {
    const response = await this.requestWithRetry<T>({
      method: 'POST',
      url: `/${resourceType}`,
      data: resource,
    });
    logger.info(`FHIR CREATE: ${resourceType}`, { resourceType });
    return response;
  }

  async read<T = Record<string, unknown>>(
    resourceType: string,
    id: string
  ): Promise<T> {
    const response = await this.requestWithRetry<T>({
      method: 'GET',
      url: `/${resourceType}/${id}`,
    });
    return response;
  }

  async update<T = Record<string, unknown>>(
    resourceType: string,
    id: string,
    resource: Record<string, unknown>
  ): Promise<T> {
    const response = await this.requestWithRetry<T>({
      method: 'PUT',
      url: `/${resourceType}/${id}`,
      data: resource,
    });
    logger.info(`FHIR UPDATE: ${resourceType}/${id}`, { resourceType, id });
    return response;
  }

  async delete(resourceType: string, id: string): Promise<void> {
    await this.requestWithRetry({
      method: 'DELETE',
      url: `/${resourceType}/${id}`,
    });
    logger.info(`FHIR DELETE: ${resourceType}/${id}`, { resourceType, id });
  }

  async search<T = FHIRBundle>(
    resourceType: string,
    params: SearchParams = {}
  ): Promise<T> {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParams.append(key, v));
      } else {
        searchParams.append(key, String(value));
      }
    }

    const response = await this.requestWithRetry<T>({
      method: 'GET',
      url: `/${resourceType}`,
      params: searchParams,
    });
    return response;
  }

  async transaction<T = FHIRBundle>(bundle: Record<string, unknown>): Promise<T> {
    const response = await this.requestWithRetry<T>({
      method: 'POST',
      url: '/',
      data: bundle,
    });
    logger.info('FHIR TRANSACTION completed');
    return response;
  }

  async operation<T = Record<string, unknown>>(
    resourceType: string,
    operationName: string,
    parameters?: Record<string, unknown>,
    id?: string
  ): Promise<T> {
    const url = id
      ? `/${resourceType}/${id}/$${operationName}`
      : `/${resourceType}/$${operationName}`;

    const response = await this.requestWithRetry<T>({
      method: 'POST',
      url,
      data: parameters,
    });
    logger.info(`FHIR OPERATION: $${operationName} on ${resourceType}`, {
      resourceType,
      operationName,
    });
    return response;
  }

  private async requestWithRetry<T>(
    requestConfig: AxiosRequestConfig,
    attempt = 0
  ): Promise<T> {
    try {
      const response = await this.client.request<T>(requestConfig);
      return response.data;
    } catch (error) {
      if (
        error instanceof AppError &&
        !error.isOperational &&
        attempt < MAX_RETRIES
      ) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        logger.warn(
          `FHIR request failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms`,
          { url: requestConfig.url, method: requestConfig.method }
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.requestWithRetry<T>(requestConfig, attempt + 1);
      }

      if (
        error instanceof AxiosError &&
        error.response &&
        RETRYABLE_STATUS_CODES.includes(error.response.status) &&
        attempt < MAX_RETRIES
      ) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        logger.warn(
          `FHIR request failed with ${error.response.status} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms`,
          { url: requestConfig.url, method: requestConfig.method }
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.requestWithRetry<T>(requestConfig, attempt + 1);
      }

      throw error;
    }
  }

  private convertError(error: AxiosError): AppError {
    if (!error.response) {
      return new InternalError(`FHIR server unreachable: ${error.message}`);
    }

    const { status, data } = error.response;
    const outcome = data as FHIROperationOutcome | undefined;

    const diagnosticMessage =
      outcome?.issue?.[0]?.diagnostics ||
      outcome?.issue?.[0]?.details?.text ||
      `FHIR server returned status ${status}`;

    switch (status) {
      case 400:
        return new ValidationError(diagnosticMessage, outcome?.issue);
      case 404:
        return new NotFoundError('FHIR Resource');
      case 409:
        return new AppError(diagnosticMessage, 409, 'FHIR_CONFLICT', true);
      case 422:
        return new ValidationError(diagnosticMessage, outcome?.issue);
      default:
        if (RETRYABLE_STATUS_CODES.includes(status)) {
          return new InternalError(diagnosticMessage);
        }
        return new AppError(
          diagnosticMessage,
          status,
          'FHIR_ERROR',
          status < 500
        );
    }
  }
}

export const fhirClient = new FHIRClient();
