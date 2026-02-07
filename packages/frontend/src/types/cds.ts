/**
 * CDS Hooks frontend types — mirrors packages/cds-hooks/src/types.ts
 * Used for rendering CDS cards and handling overrides in the UI.
 */

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
  resource?: unknown;
  resourceId?: string;
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

export interface CDSResponse {
  cards: CDSCard[];
}

export interface CDSOverridePayload {
  cardId: string;
  patientId: string;
  hookInstance: string;
  reasonCode: string;
  reasonText?: string;
  cardSummary: string;
}

export interface CDSFeedbackPayload {
  cardId: string;
  outcome: string;
  outcomeTimestamp?: string;
}

export interface CDSOverrideRecord {
  id: string;
  cardId: string;
  userId: string;
  patientId: string;
  hookInstance: string;
  reasonCode: string;
  reasonText?: string;
  cardSummary: string;
  createdAt: string;
}
