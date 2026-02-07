/**
 * CDS Hooks Specification Types
 * Implements the HL7 CDS Hooks specification for clinical decision support.
 * Required for ONC certification §170.315(a)(9).
 */

export interface CDSService {
  id: string;
  hook: string; // 'patient-view' | 'order-select' | 'order-sign' | 'medication-prescribe'
  title: string;
  description: string;
  prefetch?: Record<string, string>; // FHIR query templates
  usageRequirements?: string;
}

export interface CDSServiceDiscovery {
  services: CDSService[];
}

export interface CDSRequest {
  hookInstance: string; // UUID
  hook: string;
  fhirServer: string;
  fhirAuthorization?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    subject: string;
  };
  context: Record<string, any>;
  prefetch?: Record<string, any>;
}

export interface CDSResponse {
  cards: CDSCard[];
  systemActions?: SystemAction[];
}

export interface CDSCard {
  uuid?: string;
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  source: CDSSource;
  suggestions?: CDSSuggestion[];
  selectionBehavior?: 'at-most-one' | 'any';
  overrideReasons?: OverrideReason[];
  links?: CDSLink[];
}

export interface CDSSource {
  label: string;
  url?: string;
  icon?: string;
  topic?: Coding;
}

export interface CDSSuggestion {
  label: string;
  uuid?: string;
  isRecommended?: boolean;
  actions?: SuggestionAction[];
}

export interface SuggestionAction {
  type: 'create' | 'update' | 'delete';
  description: string;
  resource?: any; // FHIR Resource
  resourceId?: string;
}

export interface SystemAction {
  type: 'create' | 'update' | 'delete';
  description: string;
  resource: any;
}

export interface OverrideReason {
  code: string;
  system: string;
  display: string;
}

export interface CDSLink {
  label: string;
  url: string;
  type: 'absolute' | 'smart';
  appContext?: string;
}

export interface Coding {
  system: string;
  code: string;
  display?: string;
}

export interface CDSHookHandler {
  service: CDSService;
  handle(request: CDSRequest): Promise<CDSResponse>;
}

export interface OverrideRecord {
  cardId: string;
  userId: string;
  reason: string;
  reasonCode?: string;
  timestamp: Date;
  patientId: string;
  hookInstance: string;
}
