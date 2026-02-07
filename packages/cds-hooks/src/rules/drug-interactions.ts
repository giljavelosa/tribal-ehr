/**
 * Drug-Drug Interaction Checker
 *
 * CDS Hook: order-select / medication-prescribe
 * Service ID: tribal-ehr-drug-interactions
 *
 * Checks proposed medications against the patient's active medication list
 * for clinically significant drug-drug interactions. Uses a built-in
 * interaction knowledge base of common critical interactions.
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

// ── Drug class definitions (RxNorm-aligned therapeutic classes) ─────────────

interface DrugClass {
  id: string;
  name: string;
  /** RxNorm ingredient concept codes belonging to this class. */
  rxnormCodes: string[];
  /** Lowercase display-name keywords for fuzzy matching when codes are absent. */
  keywords: string[];
}

const DRUG_CLASSES: DrugClass[] = [
  {
    id: 'warfarin',
    name: 'Warfarin',
    rxnormCodes: ['11289'],
    keywords: ['warfarin', 'coumadin', 'jantoven'],
  },
  {
    id: 'nsaids',
    name: 'NSAIDs',
    rxnormCodes: ['5640', '7052', '38547', '41493', '36278', '20610'],
    keywords: [
      'ibuprofen', 'naproxen', 'ketorolac', 'diclofenac', 'indomethacin',
      'meloxicam', 'piroxicam', 'celecoxib', 'advil', 'motrin', 'aleve',
      'toradol', 'voltaren', 'mobic',
    ],
  },
  {
    id: 'ace-inhibitors',
    name: 'ACE Inhibitors',
    rxnormCodes: ['29046', '1998', '3827', '50166', '35208', '30131'],
    keywords: [
      'lisinopril', 'enalapril', 'ramipril', 'benazepril', 'captopril',
      'fosinopril', 'quinapril', 'trandolapril', 'perindopril', 'moexipril',
      'zestril', 'prinivil', 'vasotec', 'altace', 'lotensin',
    ],
  },
  {
    id: 'potassium-sparing-diuretics',
    name: 'Potassium-Sparing Diuretics',
    rxnormCodes: ['9997', '37418', '6916'],
    keywords: [
      'spironolactone', 'amiloride', 'triamterene', 'eplerenone',
      'aldactone', 'inspra', 'dyrenium', 'midamor',
    ],
  },
  {
    id: 'ssris',
    name: 'SSRIs',
    rxnormCodes: ['36437', '4493', '39786', '32937', '31565'],
    keywords: [
      'fluoxetine', 'sertraline', 'paroxetine', 'citalopram', 'escitalopram',
      'fluvoxamine', 'prozac', 'zoloft', 'paxil', 'celexa', 'lexapro', 'luvox',
    ],
  },
  {
    id: 'maois',
    name: 'MAOIs',
    rxnormCodes: ['6011', '8123', '58834', '30121'],
    keywords: [
      'phenelzine', 'tranylcypromine', 'isocarboxazid', 'selegiline',
      'nardil', 'parnate', 'marplan', 'emsam',
    ],
  },
  {
    id: 'metformin',
    name: 'Metformin',
    rxnormCodes: ['6809'],
    keywords: ['metformin', 'glucophage', 'fortamet', 'glumetza', 'riomet'],
  },
  {
    id: 'contrast-dye',
    name: 'Iodinated Contrast Dye',
    rxnormCodes: [],
    keywords: [
      'iohexol', 'iodixanol', 'iopamidol', 'ioversol', 'iopromide',
      'contrast dye', 'iodinated contrast', 'omnipaque', 'visipaque',
    ],
  },
  {
    id: 'statins',
    name: 'Statins',
    rxnormCodes: ['36567', '42463', '83367', '41127', '301542'],
    keywords: [
      'atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin',
      'lovastatin', 'fluvastatin', 'pitavastatin', 'lipitor', 'zocor',
      'crestor', 'pravachol', 'mevacor', 'lescol', 'livalo',
    ],
  },
  {
    id: 'fibrates',
    name: 'Fibrates',
    rxnormCodes: ['4719', '33738'],
    keywords: [
      'gemfibrozil', 'fenofibrate', 'fenofibric acid', 'lopid', 'tricor',
      'trilipix', 'antara', 'lipofen',
    ],
  },
  {
    id: 'antibiotics-warfarin',
    name: 'Antibiotics (CYP-interacting)',
    rxnormCodes: ['2551', '18631', '10109', '21212'],
    keywords: [
      'ciprofloxacin', 'metronidazole', 'fluconazole', 'trimethoprim',
      'sulfamethoxazole', 'erythromycin', 'clarithromycin', 'isoniazid',
      'cipro', 'flagyl', 'diflucan', 'bactrim',
    ],
  },
  {
    id: 'opioids',
    name: 'Opioids',
    rxnormCodes: ['7052', '2670', '3423', '5489', '7804'],
    keywords: [
      'morphine', 'codeine', 'hydrocodone', 'oxycodone', 'fentanyl',
      'tramadol', 'hydromorphone', 'methadone', 'meperidine', 'tapentadol',
      'oxycontin', 'vicodin', 'norco', 'percocet', 'dilaudid', 'duragesic',
      'ultram',
    ],
  },
  {
    id: 'benzodiazepines',
    name: 'Benzodiazepines',
    rxnormCodes: ['596', '2598', '6470', '36196', '39993'],
    keywords: [
      'alprazolam', 'diazepam', 'lorazepam', 'clonazepam', 'midazolam',
      'temazepam', 'triazolam', 'chlordiazepoxide', 'oxazepam',
      'xanax', 'valium', 'ativan', 'klonopin', 'versed', 'restoril', 'halcion',
    ],
  },
  {
    id: 'digoxin',
    name: 'Digoxin',
    rxnormCodes: ['3407'],
    keywords: ['digoxin', 'digitek', 'lanoxin'],
  },
  {
    id: 'amiodarone',
    name: 'Amiodarone',
    rxnormCodes: ['703'],
    keywords: ['amiodarone', 'cordarone', 'pacerone', 'nexterone'],
  },
  {
    id: 'lithium',
    name: 'Lithium',
    rxnormCodes: ['6448'],
    keywords: ['lithium', 'lithobid', 'eskalith'],
  },
  {
    id: 'theophylline',
    name: 'Theophylline',
    rxnormCodes: ['10438'],
    keywords: ['theophylline', 'aminophylline', 'theo-dur', 'theolair', 'elixophyllin'],
  },
  {
    id: 'fluoroquinolones',
    name: 'Fluoroquinolones',
    rxnormCodes: ['2551', '82122', '18631'],
    keywords: [
      'ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'ofloxacin',
      'gemifloxacin', 'cipro', 'levaquin', 'avelox',
    ],
  },
  {
    id: 'arbs',
    name: 'ARBs (Angiotensin II Receptor Blockers)',
    rxnormCodes: ['52175', '83515', '73494', '83818', '321064'],
    keywords: [
      'losartan', 'valsartan', 'irbesartan', 'candesartan', 'olmesartan',
      'telmisartan', 'azilsartan', 'cozaar', 'diovan', 'avapro', 'atacand',
      'benicar', 'micardis',
    ],
  },
  {
    id: 'potassium-supplements',
    name: 'Potassium Supplements',
    rxnormCodes: ['8591'],
    keywords: [
      'potassium chloride', 'potassium bicarbonate', 'potassium citrate',
      'klor-con', 'k-dur', 'micro-k', 'k-tab', 'potassium supplement',
    ],
  },
];

// ── Interaction knowledge base ─────────────────────────────────────────────

interface DrugInteraction {
  drug1ClassId: string;
  drug2ClassId: string;
  severity: 'warning' | 'critical';
  description: string;
  mechanism: string;
  recommendation: string;
}

const INTERACTION_DATABASE: DrugInteraction[] = [
  {
    drug1ClassId: 'warfarin',
    drug2ClassId: 'nsaids',
    severity: 'critical',
    description: 'Increased risk of gastrointestinal and other bleeding',
    mechanism:
      'NSAIDs inhibit platelet function and may cause GI erosion, compounding the anticoagulant effect of warfarin.',
    recommendation:
      'Avoid concurrent use if possible. If necessary, use the lowest NSAID dose for the shortest duration ' +
      'and monitor INR closely. Consider acetaminophen as an alternative analgesic.',
  },
  {
    drug1ClassId: 'ace-inhibitors',
    drug2ClassId: 'potassium-sparing-diuretics',
    severity: 'warning',
    description: 'Risk of hyperkalemia (elevated serum potassium)',
    mechanism:
      'Both ACE inhibitors and potassium-sparing diuretics reduce potassium excretion, increasing the risk of dangerous hyperkalemia.',
    recommendation:
      'Monitor serum potassium levels closely, especially during initiation or dose changes. ' +
      'Consider alternative diuretic if possible.',
  },
  {
    drug1ClassId: 'ssris',
    drug2ClassId: 'maois',
    severity: 'critical',
    description: 'Risk of serotonin syndrome (potentially fatal)',
    mechanism:
      'Combined serotonergic activity from SSRIs and MAOIs can cause serotonin syndrome: agitation, hyperthermia, ' +
      'tachycardia, muscular rigidity, and in severe cases death.',
    recommendation:
      'This combination is CONTRAINDICATED. Allow a washout period of at least 14 days when switching between ' +
      'MAOIs and SSRIs (5 weeks for fluoxetine due to long half-life).',
  },
  {
    drug1ClassId: 'metformin',
    drug2ClassId: 'contrast-dye',
    severity: 'warning',
    description: 'Risk of lactic acidosis',
    mechanism:
      'Iodinated contrast media can cause acute kidney injury, impairing metformin clearance and leading to ' +
      'metformin accumulation and lactic acidosis.',
    recommendation:
      'Hold metformin at the time of or prior to contrast administration. Do not restart until renal function ' +
      'has been re-evaluated and found to be stable (typically 48 hours post-procedure).',
  },
  {
    drug1ClassId: 'statins',
    drug2ClassId: 'fibrates',
    severity: 'warning',
    description: 'Increased risk of rhabdomyolysis (muscle breakdown)',
    mechanism:
      'Both drug classes can cause myopathy independently. The combination significantly increases the risk ' +
      'of rhabdomyolysis, especially with gemfibrozil.',
    recommendation:
      'If combination therapy is necessary, prefer fenofibrate over gemfibrozil. Monitor for muscle pain, ' +
      'tenderness, or weakness. Check CK levels if symptoms occur.',
  },
  {
    drug1ClassId: 'warfarin',
    drug2ClassId: 'antibiotics-warfarin',
    severity: 'warning',
    description: 'Increased anticoagulant effect and elevated INR',
    mechanism:
      'Many antibiotics inhibit CYP enzymes involved in warfarin metabolism (primarily CYP2C9 and CYP3A4), ' +
      'or reduce vitamin K production by gut flora, potentiating warfarin effect.',
    recommendation:
      'Monitor INR more frequently during and after antibiotic therapy. Consider empiric warfarin dose reduction. ' +
      'Patient should watch for signs of bleeding.',
  },
  {
    drug1ClassId: 'opioids',
    drug2ClassId: 'benzodiazepines',
    severity: 'critical',
    description: 'Risk of respiratory depression, coma, and death',
    mechanism:
      'Opioids and benzodiazepines both depress the central nervous system. Their combined respiratory depressant ' +
      'effects are synergistic and can be fatal.',
    recommendation:
      'Avoid concurrent prescribing when possible (FDA Black Box Warning). If co-prescribing is necessary, ' +
      'use the lowest effective doses and shortest duration. Counsel patients on risks. Consider prescribing naloxone.',
  },
  {
    drug1ClassId: 'digoxin',
    drug2ClassId: 'amiodarone',
    severity: 'critical',
    description: 'Risk of digoxin toxicity (potentially fatal arrhythmia)',
    mechanism:
      'Amiodarone inhibits P-glycoprotein and CYP3A4, significantly reducing digoxin clearance and increasing ' +
      'serum digoxin concentrations by 70-100%.',
    recommendation:
      'Reduce digoxin dose by 50% when initiating amiodarone. Monitor digoxin levels and watch for signs of ' +
      'toxicity (nausea, visual changes, arrhythmia). Adjust dose based on levels.',
  },
  {
    drug1ClassId: 'lithium',
    drug2ClassId: 'nsaids',
    severity: 'warning',
    description: 'Risk of lithium toxicity',
    mechanism:
      'NSAIDs reduce renal prostaglandin synthesis, decreasing renal blood flow and lithium clearance. ' +
      'This can increase serum lithium levels by 15-30%.',
    recommendation:
      'Avoid NSAIDs if possible in patients on lithium. If necessary, monitor lithium levels closely ' +
      'and watch for signs of toxicity (tremor, ataxia, confusion, GI symptoms). Consider sulindac as a ' +
      'potentially safer NSAID alternative.',
  },
  {
    drug1ClassId: 'theophylline',
    drug2ClassId: 'fluoroquinolones',
    severity: 'warning',
    description: 'Risk of theophylline toxicity (seizures, arrhythmia)',
    mechanism:
      'Fluoroquinolones (especially ciprofloxacin) inhibit CYP1A2, the primary enzyme for theophylline metabolism, ' +
      'leading to elevated theophylline levels.',
    recommendation:
      'Monitor theophylline levels when initiating or discontinuing fluoroquinolones. Consider reducing ' +
      'theophylline dose by 25-50%. Levofloxacin has less CYP1A2 interaction than ciprofloxacin.',
  },
  {
    drug1ClassId: 'ace-inhibitors',
    drug2ClassId: 'arbs',
    severity: 'warning',
    description: 'Risk of hypotension, hyperkalemia, and renal impairment',
    mechanism:
      'Dual blockade of the renin-angiotensin system provides no additional benefit in most patients but ' +
      'significantly increases the risk of adverse effects including acute kidney injury.',
    recommendation:
      'Avoid dual RAAS blockade. Use only one agent (ACE inhibitor OR ARB). The combination is generally ' +
      'not recommended by current guidelines (ONTARGET trial).',
  },
  {
    drug1ClassId: 'potassium-supplements',
    drug2ClassId: 'ace-inhibitors',
    severity: 'warning',
    description: 'Risk of hyperkalemia',
    mechanism:
      'ACE inhibitors reduce aldosterone secretion, leading to potassium retention. Concurrent potassium ' +
      'supplementation further increases the risk of dangerous hyperkalemia.',
    recommendation:
      'Monitor serum potassium closely. Potassium supplements should generally be discontinued or reduced ' +
      'when starting ACE inhibitors unless hypokalemia is documented. Reassess need for supplementation regularly.',
  },
];

// ── Matching logic ─────────────────────────────────────────────────────────

function getClassById(id: string): DrugClass | undefined {
  return DRUG_CLASSES.find((dc) => dc.id === id);
}

/**
 * Determine which drug classes a medication belongs to based on
 * its RxNorm coding and display name.
 */
function classifyMedication(medication: any): Set<string> {
  const classes = new Set<string>();

  // Extract codings from various FHIR structures
  const codings: Array<{ system?: string; code?: string; display?: string }> = [];
  const displayTexts: string[] = [];

  // MedicationRequest.medicationCodeableConcept
  if (medication.medicationCodeableConcept) {
    const cc = medication.medicationCodeableConcept;
    if (cc.coding) codings.push(...cc.coding);
    if (cc.text) displayTexts.push(cc.text);
  }

  // Direct codings on a Medication resource
  if (medication.code?.coding) {
    codings.push(...medication.code.coding);
  }
  if (medication.code?.text) {
    displayTexts.push(medication.code.text);
  }

  // Collect display names from codings
  for (const coding of codings) {
    if (coding.display) displayTexts.push(coding.display);
  }

  // Match by RxNorm code
  for (const coding of codings) {
    if (
      coding.system === 'http://www.nlm.nih.gov/research/umls/rxnorm' &&
      coding.code
    ) {
      for (const drugClass of DRUG_CLASSES) {
        if (drugClass.rxnormCodes.includes(coding.code)) {
          classes.add(drugClass.id);
        }
      }
    }
  }

  // Match by keyword in display names
  const searchText = displayTexts.join(' ').toLowerCase();
  if (searchText) {
    for (const drugClass of DRUG_CLASSES) {
      for (const keyword of drugClass.keywords) {
        if (searchText.includes(keyword)) {
          classes.add(drugClass.id);
          break;
        }
      }
    }
  }

  return classes;
}

/**
 * Extract medication resources from prefetch data.
 */
function extractMedications(prefetchValue: any): any[] {
  if (!prefetchValue) return [];
  if (prefetchValue.resourceType === 'Bundle') {
    return (prefetchValue.entry ?? []).map((e: any) => e.resource).filter(Boolean);
  }
  return [prefetchValue];
}

/**
 * Find drug-drug interactions between a set of proposed medication classes
 * and a set of active medication classes.
 */
function findInteractions(
  proposedClasses: Set<string>,
  activeClasses: Set<string>,
): DrugInteraction[] {
  const found: DrugInteraction[] = [];

  for (const interaction of INTERACTION_DATABASE) {
    const { drug1ClassId, drug2ClassId } = interaction;

    // Check both directions: proposed=drug1 & active=drug2, or proposed=drug2 & active=drug1
    const match1 =
      proposedClasses.has(drug1ClassId) && activeClasses.has(drug2ClassId);
    const match2 =
      proposedClasses.has(drug2ClassId) && activeClasses.has(drug1ClassId);
    // Also check if both are in proposed (e.g. ordering two interacting drugs simultaneously)
    const match3 =
      proposedClasses.has(drug1ClassId) && proposedClasses.has(drug2ClassId);

    if (match1 || match2 || match3) {
      // Avoid duplicates
      if (!found.includes(interaction)) {
        found.push(interaction);
      }
    }
  }

  return found;
}

// ── CDSHookHandler implementation ──────────────────────────────────────────

const SOURCE = {
  label: 'Tribal EHR Drug Interaction Checker',
  url: 'https://www.ncbi.nlm.nih.gov/books/NBK547857/',
  topic: {
    system: 'http://hl7.org/fhir/definition-topic',
    code: 'treatment',
    display: 'Treatment',
  },
};

export class DrugInteractionHandler implements CDSHookHandler {
  public readonly service: CDSService = {
    id: 'tribal-ehr-drug-interactions',
    hook: 'order-select',
    title: 'Drug-Drug Interaction Checker',
    description:
      'Checks proposed medication orders against the patient\'s active medication list for ' +
      'clinically significant drug-drug interactions.',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
      activeMedications:
        'MedicationRequest?patient={{context.patientId}}&status=active',
    },
    usageRequirements:
      'Requires active medication list in prefetch and proposed medication(s) in context.medications or context.draftOrders.',
  };

  async handle(request: CDSRequest): Promise<CDSResponse> {
    const prefetch = request.prefetch ?? {};
    const context = request.context ?? {};

    // Gather active medications from prefetch
    const activeMeds = extractMedications(prefetch.activeMedications);
    const activeClasses = new Set<string>();
    for (const med of activeMeds) {
      for (const cls of classifyMedication(med)) {
        activeClasses.add(cls);
      }
    }

    // Gather proposed medications from context
    const proposedMeds = this.extractProposedMedications(context);
    const proposedClasses = new Set<string>();
    const proposedMedNames: Map<string, string[]> = new Map();

    for (const med of proposedMeds) {
      const medClasses = classifyMedication(med);
      for (const cls of medClasses) {
        proposedClasses.add(cls);
        // Track medication names per class for better card descriptions
        const name = this.getMedicationName(med);
        if (name) {
          const existing = proposedMedNames.get(cls) ?? [];
          existing.push(name);
          proposedMedNames.set(cls, existing);
        }
      }
    }

    if (proposedClasses.size === 0) {
      return { cards: [] };
    }

    // Find interactions
    const interactions = findInteractions(proposedClasses, activeClasses);

    // Build cards
    const cards: CDSCard[] = interactions.map((interaction) => {
      const class1 = getClassById(interaction.drug1ClassId);
      const class2 = getClassById(interaction.drug2ClassId);
      const class1Name = class1?.name ?? interaction.drug1ClassId;
      const class2Name = class2?.name ?? interaction.drug2ClassId;

      const suggestions: CDSSuggestion[] = [
        {
          label: 'Cancel the proposed order',
          uuid: uuidv4(),
          isRecommended: interaction.severity === 'critical',
        },
        {
          label: 'Modify the order with additional monitoring',
          uuid: uuidv4(),
          isRecommended: interaction.severity === 'warning',
        },
      ];

      return {
        uuid: uuidv4(),
        summary: `${interaction.severity === 'critical' ? 'CRITICAL: ' : ''}${class1Name} + ${class2Name}: ${interaction.description}`,
        detail:
          `**Mechanism:** ${interaction.mechanism}\n\n` +
          `**Recommendation:** ${interaction.recommendation}`,
        indicator: interaction.severity,
        source: SOURCE,
        suggestions,
        selectionBehavior: 'at-most-one' as const,
        overrideReasons: [
          {
            code: 'clinical-benefit-outweighs-risk',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Clinical benefit outweighs risk',
          },
          {
            code: 'patient-tolerating-combination',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Patient has been tolerating this combination',
          },
          {
            code: 'will-monitor-closely',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Will monitor patient closely',
          },
        ],
      };
    });

    return { cards };
  }

  /**
   * Extract proposed medication resources from the hook context.
   * Supports both `context.medications` and `context.draftOrders` patterns
   * used by different CDS Hooks implementations.
   */
  private extractProposedMedications(context: Record<string, any>): any[] {
    const meds: any[] = [];

    // context.medications (direct array)
    if (context.medications) {
      if (Array.isArray(context.medications)) {
        meds.push(...context.medications);
      } else {
        meds.push(context.medications);
      }
    }

    // context.draftOrders (FHIR Bundle)
    if (context.draftOrders) {
      const bundle = context.draftOrders;
      if (bundle.resourceType === 'Bundle' && Array.isArray(bundle.entry)) {
        for (const entry of bundle.entry) {
          const resource = entry.resource;
          if (
            resource &&
            (resource.resourceType === 'MedicationRequest' ||
              resource.resourceType === 'MedicationOrder')
          ) {
            meds.push(resource);
          }
        }
      }
    }

    return meds;
  }

  /**
   * Extract a human-readable medication name from a FHIR medication resource.
   */
  private getMedicationName(medication: any): string | null {
    if (medication.medicationCodeableConcept) {
      return (
        medication.medicationCodeableConcept.text ??
        medication.medicationCodeableConcept.coding?.[0]?.display ??
        null
      );
    }
    if (medication.code) {
      return medication.code.text ?? medication.code.coding?.[0]?.display ?? null;
    }
    return null;
  }
}

/**
 * Variant handler registered under the medication-prescribe hook.
 * Shares the same logic as the order-select handler but fires on
 * a different hook event.
 */
export class DrugInteractionMedicationPrescribeHandler implements CDSHookHandler {
  private delegate: DrugInteractionHandler;

  constructor() {
    this.delegate = new DrugInteractionHandler();
  }

  public readonly service: CDSService = {
    id: 'tribal-ehr-drug-interactions-prescribe',
    hook: 'medication-prescribe',
    title: 'Drug-Drug Interaction Checker (Prescribe)',
    description:
      'Checks medication being prescribed against the patient\'s active medication list for ' +
      'clinically significant drug-drug interactions.',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
      activeMedications:
        'MedicationRequest?patient={{context.patientId}}&status=active',
    },
    usageRequirements:
      'Requires active medication list in prefetch and proposed medication(s) in context.',
  };

  async handle(request: CDSRequest): Promise<CDSResponse> {
    return this.delegate.handle(request);
  }
}
