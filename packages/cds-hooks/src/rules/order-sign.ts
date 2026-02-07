/**
 * Order Sign Validation Handlers
 *
 * CDS Hook: order-sign
 * Service IDs: tribal-ehr-order-sign-validation, tribal-ehr-order-sign-drug-interactions
 *
 * Validates orders at the point of signing by checking for duplicate orders,
 * completeness of order fields, and high-risk orders requiring additional
 * authorization. Also delegates to drug interaction checking for medication
 * orders being signed.
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
  CDSSuggestion,
} from '../types';
import { DrugInteractionHandler } from './drug-interactions';

// ── High-risk order definitions ─────────────────────────────────────────────

interface HighRiskOrder {
  /** Keywords to match against order display text (lowercase). */
  keywords: string[];
  /** Human-readable label for the high-risk category. */
  label: string;
  /** Reason this order is flagged as high-risk. */
  reason: string;
  /** Recommendation for the prescriber. */
  recommendation: string;
}

const HIGH_RISK_ORDERS: HighRiskOrder[] = [
  {
    keywords: [
      'methotrexate', 'trexall', 'otrexup', 'rasuvo', 'xatmep',
    ],
    label: 'Methotrexate',
    reason:
      'Methotrexate has a narrow therapeutic index with risk of severe myelosuppression, hepatotoxicity, ' +
      'and nephrotoxicity. Dosing errors (e.g. daily instead of weekly) have caused fatalities.',
    recommendation:
      'Confirm the dosing frequency is weekly (not daily) for non-oncologic indications. Verify baseline ' +
      'CBC, hepatic function, and renal function. Ensure patient counseling has been documented.',
  },
  {
    keywords: [
      'warfarin', 'coumadin', 'jantoven',
    ],
    label: 'Warfarin',
    reason:
      'Warfarin has a narrow therapeutic index with significant bleeding risk. Requires INR monitoring ' +
      'and has numerous drug and food interactions.',
    recommendation:
      'Confirm target INR range is documented. Verify baseline INR and that follow-up INR monitoring ' +
      'is scheduled. Review concurrent medications for interactions.',
  },
  {
    keywords: [
      'insulin', 'humulin', 'novolin', 'lantus', 'levemir', 'tresiba',
      'humalog', 'novolog', 'apidra', 'fiasp', 'admelog',
    ],
    label: 'Insulin',
    reason:
      'Insulin is a high-alert medication. Dosing errors can cause severe hypoglycemia or ' +
      'diabetic ketoacidosis.',
    recommendation:
      'Verify the insulin type (basal vs bolus vs mixed), dose, and frequency. Confirm the patient\'s ' +
      'current blood glucose levels and renal function. Ensure glucose monitoring plan is in place.',
  },
  {
    keywords: [
      'opioid', 'morphine', 'oxycodone', 'hydrocodone', 'fentanyl', 'codeine',
      'hydromorphone', 'methadone', 'oxycontin', 'vicodin', 'norco',
      'percocet', 'dilaudid', 'duragesic', 'tramadol', 'ultram',
    ],
    label: 'Opioid Analgesic',
    reason:
      'Opioids carry significant risks of respiratory depression, dependence, and overdose. ' +
      'The CDC recommends careful evaluation before prescribing.',
    recommendation:
      'Check the prescription drug monitoring program (PDMP). Verify the morphine milligram ' +
      'equivalent (MME) daily dose. Consider co-prescribing naloxone if MME >= 50. Document ' +
      'pain management plan and follow-up schedule.',
  },
  {
    keywords: [
      'chemotherapy', 'cisplatin', 'carboplatin', 'doxorubicin', 'cyclophosphamide',
      'paclitaxel', 'docetaxel', 'vincristine', 'bleomycin', 'etoposide',
      'fluorouracil', '5-fu', 'irinotecan', 'oxaliplatin', 'gemcitabine',
    ],
    label: 'Chemotherapy Agent',
    reason:
      'Chemotherapy agents have narrow therapeutic indices with potentially life-threatening ' +
      'toxicity. Dosing is highly individualized based on body surface area, renal/hepatic ' +
      'function, and protocol-specific parameters.',
    recommendation:
      'Verify order against the approved protocol. Confirm body surface area calculation, ' +
      'cycle number, and cumulative dose limits. Review baseline labs (CBC, CMP). Ensure ' +
      'pre-medications and supportive care are ordered.',
  },
  {
    keywords: [
      'heparin', 'enoxaparin', 'lovenox',
    ],
    label: 'Heparin / LMWH',
    reason:
      'Heparin products are high-alert medications with risk of heparin-induced thrombocytopenia (HIT) ' +
      'and serious bleeding complications. Dosing varies by indication.',
    recommendation:
      'Confirm the indication and verify the dose is appropriate (prophylactic vs therapeutic). ' +
      'Verify baseline platelet count and schedule monitoring. Check for prior HIT history.',
  },
  {
    keywords: [
      'digoxin', 'digitek', 'lanoxin',
    ],
    label: 'Digoxin',
    reason:
      'Digoxin has a narrow therapeutic index. Toxicity can cause fatal cardiac arrhythmias, ' +
      'especially in patients with renal impairment or electrolyte disturbances.',
    recommendation:
      'Verify renal function and electrolytes (especially potassium and magnesium). Confirm ' +
      'appropriate loading and maintenance dose. Schedule digoxin level monitoring.',
  },
];

// ── Required-field definitions per resource type ────────────────────────────

interface RequiredFieldRule {
  resourceType: string;
  fields: Array<{
    path: string;
    label: string;
  }>;
}

const REQUIRED_FIELD_RULES: RequiredFieldRule[] = [
  {
    resourceType: 'MedicationRequest',
    fields: [
      { path: 'dosageInstruction', label: 'Dosage instructions' },
      { path: 'dosageInstruction[0].doseAndRate', label: 'Dose amount' },
      { path: 'dosageInstruction[0].timing', label: 'Frequency/timing' },
      { path: 'dosageInstruction[0].route', label: 'Route of administration' },
    ],
  },
  {
    resourceType: 'ServiceRequest',
    fields: [
      { path: 'code', label: 'Order code/procedure' },
      { path: 'requester', label: 'Ordering provider' },
    ],
  },
  {
    resourceType: 'MedicationOrder',
    fields: [
      { path: 'dosageInstruction', label: 'Dosage instructions' },
      { path: 'dosageInstruction[0].doseQuantity', label: 'Dose amount' },
      { path: 'dosageInstruction[0].timing', label: 'Frequency/timing' },
    ],
  },
];

// ── Helper functions ────────────────────────────────────────────────────────

/**
 * Resolve a simple dotted/bracket path on an object.
 * Supports paths like "dosageInstruction[0].timing".
 */
function resolvePath(obj: any, path: string): any {
  if (!obj || !path) return undefined;

  const segments = path.replace(/\[(\d+)]/g, '.$1').split('.');
  let current = obj;
  for (const segment of segments) {
    if (current == null) return undefined;
    current = current[segment];
  }
  return current;
}

/**
 * Extract a human-readable name for an order resource.
 */
function getOrderDisplayName(resource: any): string {
  if (!resource) return 'Unknown order';

  // MedicationRequest / MedicationOrder
  if (resource.medicationCodeableConcept) {
    return (
      resource.medicationCodeableConcept.text ??
      resource.medicationCodeableConcept.coding?.[0]?.display ??
      'Unknown medication'
    );
  }

  // ServiceRequest / ProcedureRequest
  if (resource.code) {
    return (
      resource.code.text ??
      resource.code.coding?.[0]?.display ??
      'Unknown order'
    );
  }

  return resource.resourceType ?? 'Unknown order';
}

/**
 * Extract a comparable identity key for an order to detect duplicates.
 * Uses the first coding code if available; otherwise falls back to display text.
 */
function getOrderIdentityKey(resource: any): string | null {
  // MedicationRequest / MedicationOrder
  if (resource.medicationCodeableConcept) {
    const coding = resource.medicationCodeableConcept.coding?.[0];
    if (coding?.code) return `medication:${coding.system ?? ''}|${coding.code}`;
    if (resource.medicationCodeableConcept.text) {
      return `medication:text:${resource.medicationCodeableConcept.text.toLowerCase()}`;
    }
  }

  // ServiceRequest / ProcedureRequest
  if (resource.code) {
    const coding = resource.code.coding?.[0];
    if (coding?.code) return `service:${coding.system ?? ''}|${coding.code}`;
    if (resource.code.text) {
      return `service:text:${resource.code.text.toLowerCase()}`;
    }
  }

  return null;
}

/**
 * Extract all order resources from a prefetch Bundle or direct resource.
 */
function extractOrders(prefetchValue: any): any[] {
  if (!prefetchValue) return [];
  if (prefetchValue.resourceType === 'Bundle') {
    return (prefetchValue.entry ?? []).map((e: any) => e.resource).filter(Boolean);
  }
  return [prefetchValue];
}

/**
 * Extract draft order resources from the hook context.
 * Supports both context.draftOrders (FHIR Bundle) and context.orders (array).
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

  if (context.orders) {
    if (Array.isArray(context.orders)) {
      orders.push(...context.orders);
    } else {
      orders.push(context.orders);
    }
  }

  return orders;
}

/**
 * Check if an order's display text matches any high-risk order keywords.
 */
function matchHighRiskOrder(resource: any): HighRiskOrder | null {
  const displayName = getOrderDisplayName(resource).toLowerCase();
  if (!displayName) return null;

  for (const highRisk of HIGH_RISK_ORDERS) {
    for (const keyword of highRisk.keywords) {
      if (displayName.includes(keyword)) {
        return highRisk;
      }
    }
  }

  return null;
}

// ── Source metadata ─────────────────────────────────────────────────────────

const SOURCE = {
  label: 'Tribal EHR Order Sign Validation',
  url: 'https://www.healthit.gov/test-method/clinical-decision-support-cds',
  topic: {
    system: 'http://hl7.org/fhir/definition-topic',
    code: 'treatment',
    display: 'Treatment',
  },
};

// ── OrderSignHandler ────────────────────────────────────────────────────────

export class OrderSignHandler implements CDSHookHandler {
  public readonly service: CDSService = {
    id: 'tribal-ehr-order-sign-validation',
    hook: 'order-sign',
    title: 'Order Sign Validation',
    description:
      'Validates orders at the point of signing by checking for duplicate orders, ' +
      'completeness of required fields, and high-risk orders requiring additional authorization.',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
      activeMedications:
        'MedicationRequest?patient={{context.patientId}}&status=active',
      recentOrders:
        'ServiceRequest?patient={{context.patientId}}&date=ge{{context.signDate}}&status=active',
    },
    usageRequirements:
      'Requires draft orders in context.draftOrders and active orders in prefetch.',
  };

  async handle(request: CDSRequest): Promise<CDSResponse> {
    const prefetch = request.prefetch ?? {};
    const context = request.context ?? {};

    const draftOrders = extractDraftOrders(context);

    if (draftOrders.length === 0) {
      return { cards: [] };
    }

    const cards: CDSCard[] = [];

    // ── Check 1: Duplicate orders ───────────────────────────────────────
    const duplicateCards = this.checkDuplicateOrders(draftOrders, prefetch);
    cards.push(...duplicateCards);

    // ── Check 2: Order completeness ─────────────────────────────────────
    const completenessCards = this.checkOrderCompleteness(draftOrders);
    cards.push(...completenessCards);

    // ── Check 3: High-risk orders ───────────────────────────────────────
    const highRiskCards = this.checkHighRiskOrders(draftOrders);
    cards.push(...highRiskCards);

    return { cards };
  }

  /**
   * Check for duplicate orders among the draft orders and the existing
   * active medications / recent orders from prefetch.
   */
  private checkDuplicateOrders(
    draftOrders: any[],
    prefetch: Record<string, any>,
  ): CDSCard[] {
    const cards: CDSCard[] = [];

    // Collect identity keys for existing active orders
    const existingKeys = new Set<string>();
    const activeMeds = extractOrders(prefetch.activeMedications);
    const recentOrders = extractOrders(prefetch.recentOrders);

    for (const resource of [...activeMeds, ...recentOrders]) {
      const key = getOrderIdentityKey(resource);
      if (key) existingKeys.add(key);
    }

    // Check draft orders against existing orders and against each other
    const draftKeysSeen = new Map<string, any>();

    for (const draft of draftOrders) {
      const key = getOrderIdentityKey(draft);
      if (!key) continue;

      const displayName = getOrderDisplayName(draft);

      // Duplicate with existing active order
      if (existingKeys.has(key)) {
        const suggestions: CDSSuggestion[] = [
          {
            label: `Remove duplicate order for ${displayName}`,
            uuid: uuidv4(),
            isRecommended: true,
            actions: [
              {
                type: 'delete',
                description: `Remove duplicate order: ${displayName}`,
                resourceId: draft.id,
              },
            ],
          },
          {
            label: 'Keep order (not a duplicate)',
            uuid: uuidv4(),
            isRecommended: false,
          },
        ];

        cards.push({
          uuid: uuidv4(),
          summary: `Duplicate order detected: ${displayName} is already active`,
          detail:
            `**${displayName}** appears to be a duplicate of an existing active order for this patient. ` +
            'Duplicate orders may lead to unintended double-dosing or redundant procedures.\n\n' +
            '**Recommendation:** Review and remove the duplicate order unless a dose change or ' +
            'new course of therapy is intended.',
          indicator: 'warning',
          source: SOURCE,
          suggestions,
          selectionBehavior: 'at-most-one',
          overrideReasons: [
            {
              code: 'intentional-duplicate',
              system: 'http://tribal-ehr.org/cds/override-reason',
              display: 'Intentional duplicate (new course of therapy)',
            },
            {
              code: 'dose-change',
              system: 'http://tribal-ehr.org/cds/override-reason',
              display: 'Dose change replacing prior order',
            },
          ],
        });
      }

      // Duplicate within the same batch of draft orders
      if (draftKeysSeen.has(key)) {
        const previousDraft = draftKeysSeen.get(key);
        const previousName = getOrderDisplayName(previousDraft);

        cards.push({
          uuid: uuidv4(),
          summary: `Duplicate orders in current batch: ${displayName}`,
          detail:
            `Multiple orders for **${displayName}** are present in the current signing batch. ` +
            'This may be unintentional and could result in duplicate therapy.\n\n' +
            '**Recommendation:** Review the orders and remove any unintended duplicates.',
          indicator: 'warning',
          source: SOURCE,
          suggestions: [
            {
              label: `Remove this duplicate order for ${displayName}`,
              uuid: uuidv4(),
              isRecommended: true,
              actions: [
                {
                  type: 'delete',
                  description: `Remove duplicate draft order: ${displayName}`,
                  resourceId: draft.id,
                },
              ],
            },
          ],
          selectionBehavior: 'at-most-one',
          overrideReasons: [
            {
              code: 'intentional-duplicate',
              system: 'http://tribal-ehr.org/cds/override-reason',
              display: 'Intentional duplicate (different indication)',
            },
          ],
        });
      }

      draftKeysSeen.set(key, draft);
    }

    return cards;
  }

  /**
   * Check that orders have all required fields populated based on
   * their resource type.
   */
  private checkOrderCompleteness(draftOrders: any[]): CDSCard[] {
    const cards: CDSCard[] = [];

    for (const draft of draftOrders) {
      const resourceType = draft.resourceType;
      if (!resourceType) continue;

      const rule = REQUIRED_FIELD_RULES.find(
        (r) => r.resourceType === resourceType,
      );
      if (!rule) continue;

      const missingFields: string[] = [];
      for (const field of rule.fields) {
        const value = resolvePath(draft, field.path);
        if (value == null || (Array.isArray(value) && value.length === 0)) {
          missingFields.push(field.label);
        }
      }

      if (missingFields.length === 0) continue;

      const displayName = getOrderDisplayName(draft);

      const suggestions: CDSSuggestion[] = [
        {
          label: `Complete missing fields for ${displayName}`,
          uuid: uuidv4(),
          isRecommended: true,
        },
        {
          label: 'Sign order as-is (acknowledge incomplete fields)',
          uuid: uuidv4(),
          isRecommended: false,
        },
      ];

      cards.push({
        uuid: uuidv4(),
        summary: `Incomplete order: ${displayName} is missing required fields`,
        detail:
          `The order for **${displayName}** is missing the following required fields:\n\n` +
          missingFields.map((f) => `- ${f}`).join('\n') +
          '\n\n**Recommendation:** Complete all required fields before signing to ensure ' +
          'the order can be correctly fulfilled and to reduce the risk of medication errors.',
        indicator: 'warning',
        source: SOURCE,
        suggestions,
        selectionBehavior: 'at-most-one',
        overrideReasons: [
          {
            code: 'will-complete-later',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Will complete missing fields after signing',
          },
          {
            code: 'fields-not-applicable',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Missing fields are not applicable for this order',
          },
        ],
      });
    }

    return cards;
  }

  /**
   * Check for high-risk orders that warrant additional authorization
   * or verification before signing.
   */
  private checkHighRiskOrders(draftOrders: any[]): CDSCard[] {
    const cards: CDSCard[] = [];

    for (const draft of draftOrders) {
      const highRisk = matchHighRiskOrder(draft);
      if (!highRisk) continue;

      const displayName = getOrderDisplayName(draft);

      const suggestions: CDSSuggestion[] = [
        {
          label: 'Acknowledge high-risk order and proceed',
          uuid: uuidv4(),
          isRecommended: false,
        },
        {
          label: `Cancel order for ${displayName}`,
          uuid: uuidv4(),
          isRecommended: false,
          actions: [
            {
              type: 'delete',
              description: `Cancel high-risk order: ${displayName}`,
              resourceId: draft.id,
            },
          ],
        },
      ];

      cards.push({
        uuid: uuidv4(),
        summary: `High-risk order: ${highRisk.label} requires additional verification`,
        detail:
          `**${displayName}** has been identified as a high-risk order.\n\n` +
          `**Risk:** ${highRisk.reason}\n\n` +
          `**Recommendation:** ${highRisk.recommendation}`,
        indicator: 'critical',
        source: SOURCE,
        suggestions,
        selectionBehavior: 'at-most-one',
        overrideReasons: [
          {
            code: 'verified-appropriate',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Order has been verified as appropriate',
          },
          {
            code: 'benefits-outweigh-risks',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Clinical benefits outweigh risks',
          },
          {
            code: 'specialist-approved',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Approved by specialist or pharmacist',
          },
        ],
      });
    }

    return cards;
  }
}

// ── OrderSignDrugInteractionHandler ─────────────────────────────────────────

/**
 * Variant handler that delegates to the DrugInteractionHandler but fires on
 * the order-sign hook. This ensures drug interaction checking is performed
 * at the point of order signing in addition to order selection.
 */
export class OrderSignDrugInteractionHandler implements CDSHookHandler {
  private delegate: DrugInteractionHandler;

  constructor() {
    this.delegate = new DrugInteractionHandler();
  }

  public readonly service: CDSService = {
    id: 'tribal-ehr-order-sign-drug-interactions',
    hook: 'order-sign',
    title: 'Drug-Drug Interaction Checker (Order Sign)',
    description:
      'Checks medications being signed against the patient\'s active medication list for ' +
      'clinically significant drug-drug interactions at the point of order signing.',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
      activeMedications:
        'MedicationRequest?patient={{context.patientId}}&status=active',
    },
    usageRequirements:
      'Requires active medication list in prefetch and proposed medication(s) in context.draftOrders.',
  };

  async handle(request: CDSRequest): Promise<CDSResponse> {
    return this.delegate.handle(request);
  }
}
