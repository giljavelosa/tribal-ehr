/**
 * Drug-Allergy Contraindication Checker
 *
 * CDS Hook: order-select / medication-prescribe
 * Service ID: tribal-ehr-drug-allergy
 *
 * Checks proposed medication orders against the patient's documented allergies.
 * Cross-references drug classes for known cross-reactivity patterns
 * (e.g., penicillin allergy flagging amoxicillin).
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

// ── Drug class definitions for allergy cross-reactivity ────────────────────

interface AllergyDrugClass {
  id: string;
  name: string;
  /** Member drug names (lowercased) belonging to this class. */
  members: string[];
  /** Classes that have known cross-reactivity with this class. */
  crossReactiveWith: Array<{
    classId: string;
    riskDescription: string;
    crossReactivityRate: string;
  }>;
}

const ALLERGY_DRUG_CLASSES: AllergyDrugClass[] = [
  {
    id: 'penicillins',
    name: 'Penicillins',
    members: [
      'penicillin', 'amoxicillin', 'ampicillin', 'piperacillin',
      'nafcillin', 'oxacillin', 'dicloxacillin', 'ticarcillin',
      'amoxicillin-clavulanate', 'ampicillin-sulbactam',
      'piperacillin-tazobactam', 'augmentin', 'unasyn', 'zosyn',
    ],
    crossReactiveWith: [
      {
        classId: 'cephalosporins',
        riskDescription:
          'Cephalosporins share a beta-lactam ring with penicillins. First-generation cephalosporins ' +
          'have the highest cross-reactivity risk.',
        crossReactivityRate: '~1-2%',
      },
      {
        classId: 'carbapenems',
        riskDescription:
          'Carbapenems share a beta-lactam ring structure. Cross-reactivity is uncommon but possible.',
        crossReactivityRate: '<1%',
      },
    ],
  },
  {
    id: 'cephalosporins',
    name: 'Cephalosporins',
    members: [
      'cephalexin', 'cefazolin', 'cefadroxil',        // 1st gen
      'cefaclor', 'cefuroxime', 'cefprozil', 'loracarbef', // 2nd gen
      'ceftriaxone', 'cefotaxime', 'cefpodoxime', 'cefdinir', 'ceftazidime', 'cefixime', // 3rd gen
      'cefepime',                                       // 4th gen
      'ceftaroline', 'ceftolozane',                     // 5th gen
      'keflex', 'ancef', 'rocephin', 'suprax', 'omnicef', 'cedax',
    ],
    crossReactiveWith: [
      {
        classId: 'penicillins',
        riskDescription:
          'Patients with cephalosporin allergy may cross-react with penicillins due to shared beta-lactam ring.',
        crossReactivityRate: '~1-2%',
      },
    ],
  },
  {
    id: 'carbapenems',
    name: 'Carbapenems',
    members: [
      'meropenem', 'imipenem', 'ertapenem', 'doripenem',
      'imipenem-cilastatin', 'merrem', 'invanz', 'primaxin',
    ],
    crossReactiveWith: [
      {
        classId: 'penicillins',
        riskDescription:
          'Carbapenems share a beta-lactam ring with penicillins, though cross-reactivity is rare.',
        crossReactivityRate: '<1%',
      },
    ],
  },
  {
    id: 'sulfonamides',
    name: 'Sulfonamide Antibiotics',
    members: [
      'sulfamethoxazole', 'sulfasalazine', 'sulfadiazine', 'sulfisoxazole',
      'trimethoprim-sulfamethoxazole', 'bactrim', 'septra',
      'sulfacetamide', 'dapsone',
    ],
    crossReactiveWith: [],
  },
  {
    id: 'nsaids',
    name: 'NSAIDs',
    members: [
      'ibuprofen', 'naproxen', 'ketorolac', 'diclofenac', 'indomethacin',
      'meloxicam', 'piroxicam', 'celecoxib', 'etodolac', 'sulindac',
      'flurbiprofen', 'ketoprofen', 'mefenamic acid', 'nabumetone',
      'oxaprozin', 'fenoprofen', 'tolmetin',
      'advil', 'motrin', 'aleve', 'toradol', 'voltaren', 'mobic',
      'celebrex', 'indocin', 'feldene',
    ],
    crossReactiveWith: [],
  },
  {
    id: 'opioids',
    name: 'Opioids',
    members: [
      'morphine', 'codeine', 'hydrocodone', 'oxycodone', 'fentanyl',
      'tramadol', 'hydromorphone', 'methadone', 'meperidine', 'tapentadol',
      'buprenorphine', 'oxymorphone', 'levorphanol',
      'oxycontin', 'vicodin', 'norco', 'percocet', 'dilaudid', 'duragesic',
      'ultram', 'suboxone', 'demerol',
    ],
    crossReactiveWith: [],
  },
  {
    id: 'fluoroquinolones',
    name: 'Fluoroquinolones',
    members: [
      'ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'ofloxacin',
      'gemifloxacin', 'norfloxacin', 'gatifloxacin',
      'cipro', 'levaquin', 'avelox',
    ],
    crossReactiveWith: [],
  },
  {
    id: 'ace-inhibitors',
    name: 'ACE Inhibitors',
    members: [
      'lisinopril', 'enalapril', 'ramipril', 'benazepril', 'captopril',
      'fosinopril', 'quinapril', 'trandolapril', 'perindopril', 'moexipril',
      'zestril', 'prinivil', 'vasotec', 'altace', 'lotensin', 'capoten',
    ],
    crossReactiveWith: [],
  },
  {
    id: 'statins',
    name: 'Statins (HMG-CoA Reductase Inhibitors)',
    members: [
      'atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin',
      'lovastatin', 'fluvastatin', 'pitavastatin',
      'lipitor', 'zocor', 'crestor', 'pravachol', 'mevacor', 'lescol', 'livalo',
    ],
    crossReactiveWith: [],
  },
  {
    id: 'macrolides',
    name: 'Macrolide Antibiotics',
    members: [
      'azithromycin', 'erythromycin', 'clarithromycin', 'fidaxomicin',
      'zithromax', 'z-pack', 'biaxin', 'ery-tab',
    ],
    crossReactiveWith: [],
  },
  {
    id: 'tetracyclines',
    name: 'Tetracyclines',
    members: [
      'tetracycline', 'doxycycline', 'minocycline', 'demeclocycline',
      'tigecycline', 'vibramycin', 'doryx', 'minocin',
    ],
    crossReactiveWith: [],
  },
  {
    id: 'local-anesthetics-amide',
    name: 'Amide Local Anesthetics',
    members: [
      'lidocaine', 'bupivacaine', 'ropivacaine', 'mepivacaine', 'prilocaine',
      'etidocaine', 'articaine', 'xylocaine', 'marcaine', 'sensorcaine',
    ],
    crossReactiveWith: [],
  },
  {
    id: 'local-anesthetics-ester',
    name: 'Ester Local Anesthetics',
    members: [
      'procaine', 'benzocaine', 'tetracaine', 'chloroprocaine',
      'novocain', 'cetacaine',
    ],
    crossReactiveWith: [],
  },
];

// ── Allergy matching logic ─────────────────────────────────────────────────

interface AllergyInfo {
  substance: string;
  matchedClassIds: string[];
  reaction?: string;
  severity?: string; // 'mild' | 'moderate' | 'severe'
  type?: string; // 'allergy' | 'intolerance'
}

/**
 * Parse a FHIR AllergyIntolerance resource into our internal format.
 */
function parseAllergy(allergyResource: any): AllergyInfo | null {
  if (!allergyResource) return null;

  // Check that the allergy is active
  const clinicalStatus = allergyResource.clinicalStatus?.coding?.[0]?.code;
  if (clinicalStatus === 'inactive' || clinicalStatus === 'resolved') {
    return null;
  }

  // Determine verification status — skip entered-in-error
  const verificationStatus = allergyResource.verificationStatus?.coding?.[0]?.code;
  if (verificationStatus === 'entered-in-error') {
    return null;
  }

  // Extract the substance name
  const substanceName = extractAllergySubstanceName(allergyResource);
  if (!substanceName) return null;

  // Match to drug classes
  const matchedClassIds = matchSubstanceToClasses(substanceName);

  // Extract reaction information
  const reactions = allergyResource.reaction ?? [];
  const reactionDescriptions: string[] = [];
  let worstSeverity = 'mild';

  for (const reaction of reactions) {
    if (reaction.description) {
      reactionDescriptions.push(reaction.description);
    }
    for (const manifestation of reaction.manifestation ?? []) {
      const display = manifestation.coding?.[0]?.display ?? manifestation.text;
      if (display) reactionDescriptions.push(display);
    }
    if (reaction.severity === 'severe') {
      worstSeverity = 'severe';
    } else if (reaction.severity === 'moderate' && worstSeverity !== 'severe') {
      worstSeverity = 'moderate';
    }
  }

  return {
    substance: substanceName,
    matchedClassIds,
    reaction: reactionDescriptions.length > 0 ? reactionDescriptions.join(', ') : undefined,
    severity: worstSeverity,
    type: allergyResource.type ?? 'allergy',
  };
}

/**
 * Extract a substance name from a FHIR AllergyIntolerance resource.
 */
function extractAllergySubstanceName(allergy: any): string | null {
  // Try code.coding[].display first
  if (allergy.code?.coding) {
    for (const coding of allergy.code.coding) {
      if (coding.display) return coding.display;
    }
  }
  // Try code.text
  if (allergy.code?.text) return allergy.code.text;

  // Try reaction[].substance
  for (const reaction of allergy.reaction ?? []) {
    if (reaction.substance?.coding) {
      for (const coding of reaction.substance.coding) {
        if (coding.display) return coding.display;
      }
    }
    if (reaction.substance?.text) return reaction.substance.text;
  }

  return null;
}

/**
 * Match a substance name to drug class IDs.
 */
function matchSubstanceToClasses(substanceName: string): string[] {
  const searchText = substanceName.toLowerCase();
  const matchedIds: string[] = [];

  for (const drugClass of ALLERGY_DRUG_CLASSES) {
    // Direct match: substance name matches a member or the class name
    const directMatch =
      drugClass.members.some((m) => searchText.includes(m) || m.includes(searchText)) ||
      searchText.includes(drugClass.name.toLowerCase()) ||
      drugClass.name.toLowerCase().includes(searchText);

    if (directMatch) {
      matchedIds.push(drugClass.id);
    }
  }

  return matchedIds;
}

/**
 * Classify a proposed medication into drug class IDs.
 */
function classifyMedication(medication: any): { classIds: string[]; name: string | null } {
  const displayTexts: string[] = [];

  if (medication.medicationCodeableConcept) {
    const cc = medication.medicationCodeableConcept;
    if (cc.text) displayTexts.push(cc.text);
    for (const coding of cc.coding ?? []) {
      if (coding.display) displayTexts.push(coding.display);
    }
  }
  if (medication.code?.text) displayTexts.push(medication.code.text);
  for (const coding of medication.code?.coding ?? []) {
    if (coding.display) displayTexts.push(coding.display);
  }

  const searchText = displayTexts.join(' ').toLowerCase();
  const classIds: string[] = [];

  for (const drugClass of ALLERGY_DRUG_CLASSES) {
    for (const member of drugClass.members) {
      if (searchText.includes(member)) {
        if (!classIds.includes(drugClass.id)) {
          classIds.push(drugClass.id);
        }
        break;
      }
    }
  }

  const name = displayTexts[0] ?? null;
  return { classIds, name };
}

/**
 * Extract resources from a prefetch value (Bundle or single resource).
 */
function extractResources(prefetchValue: any): any[] {
  if (!prefetchValue) return [];
  if (prefetchValue.resourceType === 'Bundle') {
    return (prefetchValue.entry ?? []).map((e: any) => e.resource).filter(Boolean);
  }
  return [prefetchValue];
}

// ── Match result types ─────────────────────────────────────────────────────

interface AllergyMatch {
  type: 'direct' | 'cross-reactivity';
  allergySubstance: string;
  allergyReaction?: string;
  allergySeverity?: string;
  medicationName: string;
  drugClassName: string;
  /** Only for cross-reactivity matches */
  crossReactivityRate?: string;
  crossReactivityDescription?: string;
}

// ── CDSHookHandler implementation ──────────────────────────────────────────

const SOURCE = {
  label: 'Tribal EHR Drug Allergy Checker',
  url: 'https://www.ncbi.nlm.nih.gov/books/NBK448071/',
  topic: {
    system: 'http://hl7.org/fhir/definition-topic',
    code: 'treatment',
    display: 'Treatment',
  },
};

export class DrugAllergyHandler implements CDSHookHandler {
  public readonly service: CDSService = {
    id: 'tribal-ehr-drug-allergy',
    hook: 'order-select',
    title: 'Drug-Allergy Contraindication Checker',
    description:
      'Checks proposed medication orders against the patient\'s documented allergies, ' +
      'including drug class cross-reactivity warnings.',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
      allergies:
        'AllergyIntolerance?patient={{context.patientId}}&clinical-status=active',
    },
    usageRequirements:
      'Requires patient allergies in prefetch and proposed medication(s) in context.',
  };

  async handle(request: CDSRequest): Promise<CDSResponse> {
    const prefetch = request.prefetch ?? {};
    const context = request.context ?? {};

    // Parse documented allergies
    const allergyResources = extractResources(prefetch.allergies);
    const allergies: AllergyInfo[] = [];
    for (const res of allergyResources) {
      const parsed = parseAllergy(res);
      if (parsed) allergies.push(parsed);
    }

    if (allergies.length === 0) {
      return { cards: [] };
    }

    // Extract proposed medications from context
    const proposedMeds = this.extractProposedMedications(context);
    if (proposedMeds.length === 0) {
      return { cards: [] };
    }

    // Check each proposed medication against each allergy
    const matches: AllergyMatch[] = [];

    for (const med of proposedMeds) {
      const { classIds, name: medName } = classifyMedication(med);
      const displayName = medName ?? 'Unknown medication';

      for (const allergy of allergies) {
        for (const medClassId of classIds) {
          // Direct match: medication class matches allergy class
          if (allergy.matchedClassIds.includes(medClassId)) {
            const drugClass = ALLERGY_DRUG_CLASSES.find((dc) => dc.id === medClassId);
            matches.push({
              type: 'direct',
              allergySubstance: allergy.substance,
              allergyReaction: allergy.reaction,
              allergySeverity: allergy.severity,
              medicationName: displayName,
              drugClassName: drugClass?.name ?? medClassId,
            });
          }

          // Cross-reactivity check: medication's class has cross-reactivity with allergy's class
          const medClass = ALLERGY_DRUG_CLASSES.find((dc) => dc.id === medClassId);
          if (medClass) {
            for (const allergyClassId of allergy.matchedClassIds) {
              for (const crossReactivity of medClass.crossReactiveWith) {
                if (crossReactivity.classId === allergyClassId) {
                  // Avoid duplicate if already matched as direct
                  const isDuplicate = matches.some(
                    (m) =>
                      m.medicationName === displayName &&
                      m.allergySubstance === allergy.substance &&
                      m.type === 'direct',
                  );
                  if (!isDuplicate) {
                    matches.push({
                      type: 'cross-reactivity',
                      allergySubstance: allergy.substance,
                      allergyReaction: allergy.reaction,
                      allergySeverity: allergy.severity,
                      medicationName: displayName,
                      drugClassName: medClass.name,
                      crossReactivityRate: crossReactivity.crossReactivityRate,
                      crossReactivityDescription: crossReactivity.riskDescription,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    // Build cards from matches
    const cards: CDSCard[] = matches.map((match) => this.buildCard(match));
    return { cards };
  }

  private buildCard(match: AllergyMatch): CDSCard {
    if (match.type === 'direct') {
      const reactionDetail = match.allergyReaction
        ? ` Documented reaction: ${match.allergyReaction}.`
        : '';
      const severityDetail = match.allergySeverity
        ? ` Allergy severity: ${match.allergySeverity}.`
        : '';

      const suggestions: CDSSuggestion[] = [
        {
          label: `Cancel order for ${match.medicationName}`,
          uuid: uuidv4(),
          isRecommended: true,
        },
        {
          label: 'Choose alternative medication',
          uuid: uuidv4(),
          isRecommended: false,
        },
      ];

      return {
        uuid: uuidv4(),
        summary: `ALLERGY ALERT: ${match.medicationName} - patient has documented ${match.allergySubstance} allergy`,
        detail:
          `**Direct allergy match.** The patient has a documented allergy to **${match.allergySubstance}**, ` +
          `and **${match.medicationName}** is a member of the **${match.drugClassName}** drug class.` +
          `${reactionDetail}${severityDetail}\n\n` +
          `**Action required:** Do not administer this medication unless the allergy has been verified ` +
          `as inaccurate or the clinical benefit clearly outweighs the risk after informed consent.`,
        indicator: 'critical',
        source: SOURCE,
        suggestions,
        selectionBehavior: 'at-most-one',
        overrideReasons: [
          {
            code: 'allergy-verified-inaccurate',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Allergy verified as inaccurate',
          },
          {
            code: 'patient-tolerated-previously',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Patient has tolerated this medication previously',
          },
          {
            code: 'desensitization-protocol',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Desensitization protocol will be used',
          },
          {
            code: 'benefit-outweighs-risk',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Clinical benefit outweighs risk (informed consent obtained)',
          },
        ],
      };
    } else {
      // Cross-reactivity
      const suggestions: CDSSuggestion[] = [
        {
          label: `Cancel order for ${match.medicationName}`,
          uuid: uuidv4(),
          isRecommended: false,
        },
        {
          label: 'Proceed with caution and monitoring',
          uuid: uuidv4(),
          isRecommended: true,
        },
        {
          label: 'Choose alternative from different drug class',
          uuid: uuidv4(),
          isRecommended: false,
        },
      ];

      return {
        uuid: uuidv4(),
        summary: `Cross-reactivity warning: ${match.medicationName} - patient has ${match.allergySubstance} allergy`,
        detail:
          `**Potential cross-reactivity.** The patient has a documented allergy to **${match.allergySubstance}**. ` +
          `**${match.medicationName}** (${match.drugClassName}) has known cross-reactivity.\n\n` +
          `**Cross-reactivity rate:** ${match.crossReactivityRate ?? 'Unknown'}\n\n` +
          `**Details:** ${match.crossReactivityDescription ?? 'These drug classes have structural similarities that may cause cross-allergic reactions.'}\n\n` +
          `**Recommendation:** Assess the nature and severity of the original allergy. A skin test or graded ` +
          `challenge may be appropriate before administering this medication.`,
        indicator: 'warning',
        source: SOURCE,
        suggestions,
        selectionBehavior: 'at-most-one',
        overrideReasons: [
          {
            code: 'low-cross-reactivity-risk',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Low cross-reactivity risk - proceeding with monitoring',
          },
          {
            code: 'allergy-testing-negative',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Allergy testing was negative for this drug',
          },
          {
            code: 'patient-tolerated-previously',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Patient has tolerated this drug class previously',
          },
          {
            code: 'no-suitable-alternative',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'No suitable alternative available',
          },
        ],
      };
    }
  }

  /**
   * Extract proposed medication resources from the hook context.
   */
  private extractProposedMedications(context: Record<string, any>): any[] {
    const meds: any[] = [];

    if (context.medications) {
      if (Array.isArray(context.medications)) {
        meds.push(...context.medications);
      } else {
        meds.push(context.medications);
      }
    }

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
}

/**
 * Variant handler registered under the medication-prescribe hook.
 */
export class DrugAllergyMedicationPrescribeHandler implements CDSHookHandler {
  private delegate: DrugAllergyHandler;

  constructor() {
    this.delegate = new DrugAllergyHandler();
  }

  public readonly service: CDSService = {
    id: 'tribal-ehr-drug-allergy-prescribe',
    hook: 'medication-prescribe',
    title: 'Drug-Allergy Contraindication Checker (Prescribe)',
    description:
      'Checks medication being prescribed against the patient\'s documented allergies, ' +
      'including drug class cross-reactivity warnings.',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
      allergies:
        'AllergyIntolerance?patient={{context.patientId}}&clinical-status=active',
    },
    usageRequirements:
      'Requires patient allergies in prefetch and proposed medication(s) in context.',
  };

  async handle(request: CDSRequest): Promise<CDSResponse> {
    return this.delegate.handle(request);
  }
}
