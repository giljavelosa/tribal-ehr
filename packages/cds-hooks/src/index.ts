/**
 * @tribal-ehr/cds-hooks
 *
 * CDS Hooks clinical decision support engine for Tribal EHR.
 * Implements the HL7 CDS Hooks specification for clinical decision support,
 * required for ONC certification §170.315(a)(9).
 *
 * Provides:
 * - Core CDS engine with service registration, discovery, and invocation
 * - Preventive care screening reminders (USPSTF-aligned)
 * - Drug-drug interaction checking
 * - Drug-allergy contraindication checking
 * - Abnormal vital sign alerting
 * - Overdue immunization alerts
 */

// ── Types ──────────────────────────────────────────────────────────────────
export {
  CDSService,
  CDSServiceDiscovery,
  CDSRequest,
  CDSResponse,
  CDSCard,
  CDSSource,
  CDSSuggestion,
  SuggestionAction,
  SystemAction,
  OverrideReason,
  CDSLink,
  Coding,
  CDSHookHandler,
  OverrideRecord,
} from './types';

// ── Engine ─────────────────────────────────────────────────────────────────
export { CDSEngine } from './engine/cds-engine';

// ── Rules / Handlers ───────────────────────────────────────────────────────
export { PreventiveCareHandler } from './rules/preventive-care';
export {
  DrugInteractionHandler,
  DrugInteractionMedicationPrescribeHandler,
} from './rules/drug-interactions';
export {
  DrugAllergyHandler,
  DrugAllergyMedicationPrescribeHandler,
} from './rules/drug-allergy';
export { VitalSignAlertHandler } from './rules/vital-sign-alerts';
export { ImmunizationAlertHandler } from './rules/immunization-alerts';
export {
  OrderSignHandler,
  OrderSignDrugInteractionHandler,
} from './rules/order-sign';
