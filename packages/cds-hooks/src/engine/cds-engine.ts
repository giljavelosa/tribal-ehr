/**
 * CDS Hooks Engine
 *
 * Core engine for managing and invoking CDS Hooks services.
 * Handles service registration, discovery, parallel invocation with
 * timeouts, error isolation, external service proxying, and override tracking.
 *
 * ONC Certification: §170.315(a)(9) Clinical Decision Support
 */

import { v4 as uuidv4 } from 'uuid';
import axios, { AxiosInstance } from 'axios';
import winston from 'winston';
import {
  CDSService,
  CDSServiceDiscovery,
  CDSRequest,
  CDSResponse,
  CDSCard,
  CDSHookHandler,
  OverrideRecord,
  SystemAction,
} from '../types';

const SERVICE_TIMEOUT_MS = 10_000; // 10 seconds per service invocation

/**
 * Wraps an external CDS service endpoint as a local CDSHookHandler
 * so that the engine can invoke it uniformly.
 */
class ExternalServiceHandler implements CDSHookHandler {
  public readonly service: CDSService;
  private readonly baseUrl: string;
  private readonly httpClient: AxiosInstance;

  constructor(service: CDSService, baseUrl: string, httpClient: AxiosInstance) {
    this.service = service;
    this.baseUrl = baseUrl;
    this.httpClient = httpClient;
  }

  async handle(request: CDSRequest): Promise<CDSResponse> {
    const url = `${this.baseUrl}/${this.service.id}`;
    const response = await this.httpClient.post<CDSResponse>(url, request, {
      timeout: SERVICE_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  }
}

export class CDSEngine {
  private handlers: Map<string, CDSHookHandler> = new Map();
  private overrides: OverrideRecord[] = [];
  private logger: winston.Logger;
  private httpClient: AxiosInstance;

  constructor(logger?: winston.Logger) {
    this.logger = logger ?? winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      defaultMeta: { service: 'cds-engine' },
      transports: [new winston.transports.Console()],
    });

    this.httpClient = axios.create({
      timeout: SERVICE_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Register a local CDS hook handler.
   */
  registerService(handler: CDSHookHandler): void {
    const { id } = handler.service;
    if (this.handlers.has(id)) {
      this.logger.warn(`Replacing existing CDS service registration: ${id}`);
    }
    this.handlers.set(id, handler);
    this.logger.info(`CDS service registered: ${id} (hook: ${handler.service.hook})`);
  }

  /**
   * Remove a registered service by its ID.
   */
  unregisterService(serviceId: string): void {
    if (this.handlers.delete(serviceId)) {
      this.logger.info(`CDS service unregistered: ${serviceId}`);
    } else {
      this.logger.warn(`Attempted to unregister unknown CDS service: ${serviceId}`);
    }
  }

  /**
   * Return the CDS Hooks discovery document listing all registered services.
   */
  getDiscovery(): CDSServiceDiscovery {
    const services: CDSService[] = [];
    for (const handler of this.handlers.values()) {
      services.push({ ...handler.service });
    }
    return { services };
  }

  /**
   * Invoke all registered services that match the given hook name.
   *
   * Services are invoked in parallel. Each service is given a maximum of
   * SERVICE_TIMEOUT_MS to respond. If a service errors or times out, its
   * failure is logged and the remaining services' results are still returned.
   */
  async invoke(hook: string, request: CDSRequest): Promise<CDSResponse> {
    const matchingHandlers: CDSHookHandler[] = [];

    for (const handler of this.handlers.values()) {
      if (handler.service.hook === hook) {
        matchingHandlers.push(handler);
      }
    }

    if (matchingHandlers.length === 0) {
      this.logger.debug(`No CDS services registered for hook: ${hook}`);
      return { cards: [], systemActions: [] };
    }

    this.logger.info(
      `Invoking ${matchingHandlers.length} CDS service(s) for hook: ${hook}`,
    );

    // Invoke all matching services in parallel with individual timeouts
    const results = await Promise.allSettled(
      matchingHandlers.map((handler) => this.invokeWithTimeout(handler, request)),
    );

    const allCards: CDSCard[] = [];
    const allSystemActions: SystemAction[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const serviceId = matchingHandlers[i].service.id;

      if (result.status === 'fulfilled') {
        const response = result.value;
        // Assign UUIDs to cards that lack them
        for (const card of response.cards) {
          if (!card.uuid) {
            card.uuid = uuidv4();
          }
          allCards.push(card);
        }
        if (response.systemActions) {
          allSystemActions.push(...response.systemActions);
        }
        this.logger.info(
          `CDS service ${serviceId} returned ${response.cards.length} card(s)`,
        );
      } else {
        this.logger.error(
          `CDS service ${serviceId} failed: ${result.reason?.message ?? result.reason}`,
        );
      }
    }

    return {
      cards: allCards,
      systemActions: allSystemActions.length > 0 ? allSystemActions : undefined,
    };
  }

  /**
   * Invoke a single handler with a timeout guard. If the handler exceeds
   * SERVICE_TIMEOUT_MS, the promise rejects.
   */
  private invokeWithTimeout(
    handler: CDSHookHandler,
    request: CDSRequest,
  ): Promise<CDSResponse> {
    return new Promise<CDSResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`CDS service ${handler.service.id} timed out after ${SERVICE_TIMEOUT_MS}ms`));
      }, SERVICE_TIMEOUT_MS);

      handler
        .handle(request)
        .then((response) => {
          clearTimeout(timer);
          resolve(response);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Discover and register services from an external CDS Hooks endpoint.
   * Fetches the /cds-services discovery document from the given base URL
   * and registers each discovered service as a proxy handler.
   */
  async registerExternalService(url: string): Promise<void> {
    const discoveryUrl = url.endsWith('/')
      ? `${url}cds-services`
      : `${url}/cds-services`;

    this.logger.info(`Fetching CDS service discovery from: ${discoveryUrl}`);

    try {
      const response = await this.httpClient.get<CDSServiceDiscovery>(discoveryUrl);
      const discovery = response.data;

      if (!discovery.services || !Array.isArray(discovery.services)) {
        throw new Error('Invalid discovery document: missing services array');
      }

      const servicesBaseUrl = url.endsWith('/')
        ? `${url}cds-services`
        : `${url}/cds-services`;

      for (const service of discovery.services) {
        const handler = new ExternalServiceHandler(
          service,
          servicesBaseUrl,
          this.httpClient,
        );
        this.registerService(handler);
        this.logger.info(
          `Registered external CDS service: ${service.id} from ${url}`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to register external CDS services from ${url}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Invoke a specific external CDS service directly (without prior registration).
   */
  async invokeExternalService(
    service: CDSService,
    serviceBaseUrl: string,
    request: CDSRequest,
  ): Promise<CDSResponse> {
    const handler = new ExternalServiceHandler(service, serviceBaseUrl, this.httpClient);
    return this.invokeWithTimeout(handler, request);
  }

  /**
   * Record a clinician override of a CDS card. Override tracking is required
   * for ONC certification to demonstrate that alerts are being reviewed.
   */
  recordOverride(override: OverrideRecord): void {
    this.overrides.push({ ...override, timestamp: new Date(override.timestamp) });
    this.logger.info(
      `CDS override recorded: card=${override.cardId}, user=${override.userId}, ` +
      `reason=${override.reason}, patient=${override.patientId}`,
    );
  }

  /**
   * Retrieve all override records for a given patient.
   */
  getOverrides(patientId: string): OverrideRecord[] {
    return this.overrides.filter((o) => o.patientId === patientId);
  }

  /**
   * Return the count of registered services.
   */
  getServiceCount(): number {
    return this.handlers.size;
  }

  /**
   * Check whether a service with the given ID is registered.
   */
  hasService(serviceId: string): boolean {
    return this.handlers.has(serviceId);
  }
}
