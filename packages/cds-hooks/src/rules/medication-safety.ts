/**
 * Medication Safety Handlers
 *
 * CDS Hook: order-select / order-sign
 * Service IDs: tribal-ehr-medication-safety, tribal-ehr-high-risk-medication-verification
 *
 * Implements two medication safety checks:
 * 1. Tall Man Lettering - Detects look-alike/sound-alike drug name pairs and
 *    displays the FDA-recommended Tall Man lettering to reduce confusion.
 * 2. High-Risk Medication Verification - Flags ISMP high-alert medications
 *    at the point of signing to require independent double-check verification.
 *
 * ONC Certification: §170.315(a)(9) Clinical Decision Support
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CDSHookHandler,
  CDSService,
  CDSRequest,
  CDSResponse,
  CDSCard,
} from '../types';

// ── Tall Man Lettering Pairs (FDA/ISMP recommended) ─────────────────────────

const TALL_MAN_PAIRS: Array<{ drug1: string; drug2: string; tallMan1: string; tallMan2: string }> = [
  { drug1: 'hydralazine', drug2: 'hydroxyzine', tallMan1: 'hydrALAZINE', tallMan2: 'hydrOXYzine' },
  { drug1: 'prednisone', drug2: 'prednisolone', tallMan1: 'predniSONE', tallMan2: 'prednisoLONE' },
  { drug1: 'vinblastine', drug2: 'vincristine', tallMan1: 'vinBLAStine', tallMan2: 'vinCRIStine' },
  { drug1: 'glipizide', drug2: 'glyburide', tallMan1: 'glipiZIDE', tallMan2: 'glyBURIDE' },
  { drug1: 'dopamine', drug2: 'dobutamine', tallMan1: 'DOPamine', tallMan2: 'DOBUTamine' },
  { drug1: 'ephedrine', drug2: 'epinephrine', tallMan1: 'ePHEDrine', tallMan2: 'EPINEPHrine' },
  { drug1: 'daunorubicin', drug2: 'doxorubicin', tallMan1: 'DAUNOrubicin', tallMan2: 'DOXOrubicin' },
  { drug1: 'chlorpromazine', drug2: 'chlorpropamide', tallMan1: 'chlorproMAZINE', tallMan2: 'chlorproPAMIDE' },
  { drug1: 'bupropion', drug2: 'buspirone', tallMan1: 'buPROPion', tallMan2: 'busPIRone' },
  { drug1: 'cefazolin', drug2: 'ceftriaxone', tallMan1: 'ceFAZolin', tallMan2: 'cefTRIAXone' },
];

// ── ISMP High-Alert Medication RxNorm Codes ─────────────────────────────────

const ISMP_HIGH_ALERT_RXNORM = new Set([
  '11289', '4337', '67108', '5521', '7804', '7646', '3640', '3423', '10582', '6813', '3995',
]);

// ── Source metadata ─────────────────────────────────────────────────────────

const MEDICATION_SAFETY_SOURCE = {
  label: 'Tribal EHR Medication Safety - Tall Man Lettering',
  url: 'https://www.ismp.org/recommendations/tall-man-letters-list',
  topic: {
    system: 'http://hl7.org/fhir/definition-topic',
    code: 'treatment',
    display: 'Treatment',
  },
};

const HIGH_RISK_SOURCE = {
  label: 'Tribal EHR Medication Safety - ISMP High-Alert Medications',
  url: 'https://www.ismp.org/recommendations/high-alert-medications-acute-list',
  topic: {
    system: 'http://hl7.org/fhir/definition-topic',
    code: 'treatment',
    display: 'Treatment',
  },
};

// ── Helper functions ────────────────────────────────────────────────────────

/**
 * Extract draft order resources from the hook context.
 * Supports context.draftOrders (FHIR Bundle).
 */
function extractDraftOrders(context: Record<string, any>): any[] {
  const orders: any[] = [];

  if (context.draftOrders) {
    const bundle = context.draftOrders;
    if (bundle.resourceType === 'Bundle' && Array.isArray(bundle.entry)) {
      for (const entry of bundle.entry) {
        if (entry.resource) {
          orders.push(entry.resource);
        }
      }
    }
  }

  return orders;
}

/**
 * Extract the display name from a medication order resource.
 */
function getMedicationDisplayName(resource: any): string | null {
  if (resource.medicationCodeableConcept) {
    return (
      resource.medicationCodeableConcept.text ??
      resource.medicationCodeableConcept.coding?.[0]?.display ??
      null
    );
  }
  if (resource.code) {
    return resource.code.text ?? resource.code.coding?.[0]?.display ?? null;
  }
  return null;
}

/**
 * Extract the RxNorm code from a medication order resource.
 */
function getMedicationCode(resource: any): string | null {
  const codings: Array<{ system?: string; code?: string }> = [];

  if (resource.medicationCodeableConcept?.coding) {
    codings.push(...resource.medicationCodeableConcept.coding);
  }
  if (resource.code?.coding) {
    codings.push(...resource.code.coding);
  }

  for (const coding of codings) {
    if (
      coding.system === 'http://www.nlm.nih.gov/research/umls/rxnorm' &&
      coding.code
    ) {
      return coding.code;
    }
  }

  return null;
}

// ── MedicationSafetyHandler (Tall Man Lettering) ────────────────────────────

export class MedicationSafetyHandler implements CDSHookHandler {
  public readonly service: CDSService = {
    id: 'tribal-ehr-medication-safety',
    hook: 'order-select',
    title: 'Medication Safety - Tall Man Lettering',
    description:
      'Checks draft medication orders for look-alike/sound-alike drug name pairs and ' +
      'displays FDA-recommended Tall Man lettering to reduce medication name confusion errors.',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
    },
    usageRequirements:
      'Requires draft medication orders in context.draftOrders.',
  };

  async handle(request: CDSRequest): Promise<CDSResponse> {
    const context = request.context ?? {};
    const draftOrders = extractDraftOrders(context);

    if (draftOrders.length === 0) {
      return { cards: [] };
    }

    const cards: CDSCard[] = [];

    for (const draft of draftOrders) {
      // Only process medication orders
      if (
        draft.resourceType !== 'MedicationRequest' &&
        draft.resourceType !== 'MedicationOrder'
      ) {
        continue;
      }

      const displayName = getMedicationDisplayName(draft);
      if (!displayName) continue;

      const lowerName = displayName.toLowerCase();

      for (const pair of TALL_MAN_PAIRS) {
        let matchedTallMan: string | null = null;
        let confusedWithTallMan: string | null = null;

        if (lowerName.includes(pair.drug1)) {
          matchedTallMan = pair.tallMan1;
          confusedWithTallMan = pair.tallMan2;
        } else if (lowerName.includes(pair.drug2)) {
          matchedTallMan = pair.tallMan2;
          confusedWithTallMan = pair.tallMan1;
        }

        if (matchedTallMan && confusedWithTallMan) {
          cards.push({
            uuid: uuidv4(),
            summary: `Tall Man Lettering Alert: ${matchedTallMan} (not ${confusedWithTallMan})`,
            detail:
              `**${matchedTallMan}** is a look-alike/sound-alike (LASA) medication that can be confused ` +
              `with **${confusedWithTallMan}**.\n\n` +
              'The FDA and ISMP recommend using Tall Man lettering to distinguish these medications ' +
              'and reduce the risk of dispensing or administration errors.\n\n' +
              `**Please verify** you intend to order **${matchedTallMan}** and not **${confusedWithTallMan}**.`,
            indicator: 'info',
            source: MEDICATION_SAFETY_SOURCE,
            suggestions: [
              {
                label: `Confirmed: ordering ${matchedTallMan}`,
                uuid: uuidv4(),
                isRecommended: true,
              },
              {
                label: `Change to ${confusedWithTallMan} instead`,
                uuid: uuidv4(),
                isRecommended: false,
              },
            ],
            selectionBehavior: 'at-most-one',
            overrideReasons: [
              {
                code: 'correct-medication-confirmed',
                system: 'http://tribal-ehr.org/cds/override-reason',
                display: 'Correct medication confirmed by prescriber',
              },
            ],
          });
          break; // Only match one pair per medication
        }
      }
    }

    return { cards };
  }
}

// ── HighRiskMedicationHandler (ISMP High-Alert Verification) ────────────────

export class HighRiskMedicationHandler implements CDSHookHandler {
  public readonly service: CDSService = {
    id: 'tribal-ehr-high-risk-medication-verification',
    hook: 'order-sign',
    title: 'High-Risk Medication Verification',
    description:
      'Checks if medications being signed are ISMP high-alert medications that require ' +
      'independent double-check verification before administration.',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
    },
    usageRequirements:
      'Requires draft medication orders in context.draftOrders with RxNorm coding.',
  };

  async handle(request: CDSRequest): Promise<CDSResponse> {
    const context = request.context ?? {};
    const draftOrders = extractDraftOrders(context);

    if (draftOrders.length === 0) {
      return { cards: [] };
    }

    const cards: CDSCard[] = [];

    for (const draft of draftOrders) {
      // Only process medication orders
      if (
        draft.resourceType !== 'MedicationRequest' &&
        draft.resourceType !== 'MedicationOrder'
      ) {
        continue;
      }

      const rxnormCode = getMedicationCode(draft);
      if (!rxnormCode) continue;

      if (ISMP_HIGH_ALERT_RXNORM.has(rxnormCode)) {
        const displayName = getMedicationDisplayName(draft) || 'Unknown medication';

        cards.push({
          uuid: uuidv4(),
          summary: `CRITICAL: ${displayName} is an ISMP High-Alert Medication - Independent Double-Check Required`,
          detail:
            `**${displayName}** (RxNorm: ${rxnormCode}) is classified as an ISMP High-Alert Medication.\n\n` +
            'High-alert medications bear a heightened risk of causing significant patient harm when used in error. ' +
            'The Institute for Safe Medication Practices (ISMP) requires that these medications undergo an ' +
            '**independent double-check verification** before dispensing and administration.\n\n' +
            '**Required Actions:**\n' +
            '- Verify the correct patient, medication, dose, route, and frequency\n' +
            '- Obtain independent verification from a second qualified clinician or pharmacist\n' +
            '- Document the double-check verification in the patient record',
          indicator: 'critical',
          source: HIGH_RISK_SOURCE,
          suggestions: [
            {
              label: 'Independent double-check completed and verified',
              uuid: uuidv4(),
              isRecommended: true,
            },
            {
              label: `Cancel order for ${displayName}`,
              uuid: uuidv4(),
              isRecommended: false,
              actions: [
                {
                  type: 'delete',
                  description: `Cancel high-alert medication order: ${displayName}`,
                  resourceId: draft.id,
                },
              ],
            },
          ],
          selectionBehavior: 'at-most-one',
          overrideReasons: [
            {
              code: 'double-check-completed',
              system: 'http://tribal-ehr.org/cds/override-reason',
              display: 'Independent double-check verification completed',
            },
            {
              code: 'pharmacist-verified',
              system: 'http://tribal-ehr.org/cds/override-reason',
              display: 'Pharmacist has verified the order',
            },
            {
              code: 'emergency-override',
              system: 'http://tribal-ehr.org/cds/override-reason',
              display: 'Emergency situation - verification will follow',
            },
          ],
        });
      }
    }

    return { cards };
  }
}
