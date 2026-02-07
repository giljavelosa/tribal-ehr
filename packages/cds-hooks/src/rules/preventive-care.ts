/**
 * Preventive Care Screening Reminders
 *
 * CDS Hook: patient-view
 * Service ID: tribal-ehr-preventive-care
 *
 * Evaluates patient demographics and clinical history to generate
 * evidence-based preventive screening recommendations aligned with
 * USPSTF guidelines.
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

// ── LOINC codes for screening observations / procedures ────────────────────

const LOINC = {
  COLONOSCOPY: '73761-9',
  FIT_TEST: '57905-2',
  MAMMOGRAPHY: '24606-6',
  PAP_SMEAR: '10524-7',
  LIPID_PANEL: '57698-3',
  TOTAL_CHOLESTEROL: '2093-3',
  HBA1C: '4548-4',
  FASTING_GLUCOSE: '1558-6',
  BLOOD_PRESSURE_SYSTOLIC: '8480-6',
  BLOOD_PRESSURE_DIASTOLIC: '8462-4',
  PHQ9: '44249-1',
  BMI: '39156-5',
};

// ── CPT / procedure codes used for checking completed screenings ───────────

const CPT = {
  COLONOSCOPY: ['44388', '44389', '45378', '45380', '45384', '45385'],
  MAMMOGRAPHY: ['77065', '77066', '77067'],
  PAP_SMEAR: ['88141', '88142', '88143', '88164', '88165', '88166', '88167', '88174', '88175'],
};

// ── Screening rule definitions ─────────────────────────────────────────────

interface ScreeningRule {
  id: string;
  name: string;
  description: string;
  /** Evaluate whether the patient is eligible and screening is due. */
  evaluate(ctx: PatientContext): ScreeningRecommendation | null;
}

interface PatientContext {
  ageYears: number;
  sex: string; // 'male' | 'female' | 'other' | 'unknown'
  conditions: FHIRCondition[];
  procedures: FHIRProcedure[];
  observations: FHIRObservation[];
}

interface FHIRCondition {
  code?: { coding?: Array<{ system?: string; code?: string; display?: string }> };
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  onsetDateTime?: string;
}

interface FHIRProcedure {
  code?: { coding?: Array<{ system?: string; code?: string; display?: string }> };
  performedDateTime?: string;
  performedPeriod?: { start?: string; end?: string };
  status?: string;
}

interface FHIRObservation {
  code?: { coding?: Array<{ system?: string; code?: string; display?: string }> };
  effectiveDateTime?: string;
  valueQuantity?: { value?: number; unit?: string };
  status?: string;
}

interface ScreeningRecommendation {
  summary: string;
  detail: string;
  indicator: 'info' | 'warning' | 'critical';
}

// ── Helper utilities ───────────────────────────────────────────────────────

function yearsSince(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  return diffMs / (365.25 * 24 * 60 * 60 * 1000);
}

function hasRecentObservation(
  observations: FHIRObservation[],
  loincCodes: string[],
  withinYears: number,
): boolean {
  return observations.some((obs) => {
    const codings = obs.code?.coding ?? [];
    const matchesCode = codings.some(
      (c) => c.system === 'http://loinc.org' && loincCodes.includes(c.code ?? ''),
    );
    if (!matchesCode) return false;
    const years = yearsSince(obs.effectiveDateTime);
    return years !== null && years <= withinYears;
  });
}

function hasRecentProcedure(
  procedures: FHIRProcedure[],
  cptCodes: string[],
  withinYears: number,
): boolean {
  return procedures.some((proc) => {
    if (proc.status === 'entered-in-error') return false;
    const codings = proc.code?.coding ?? [];
    const matchesCode = codings.some(
      (c) =>
        (c.system === 'http://www.ama-assn.org/go/cpt' ||
          c.system === 'urn:oid:2.16.840.1.113883.6.12') &&
        cptCodes.includes(c.code ?? ''),
    );
    if (!matchesCode) return false;
    const dateStr = proc.performedDateTime ?? proc.performedPeriod?.end ?? proc.performedPeriod?.start;
    const years = yearsSince(dateStr);
    return years !== null && years <= withinYears;
  });
}

function getLatestObservationValue(
  observations: FHIRObservation[],
  loincCodes: string[],
): number | null {
  let latest: FHIRObservation | null = null;
  let latestDate = 0;

  for (const obs of observations) {
    const codings = obs.code?.coding ?? [];
    const matches = codings.some(
      (c) => c.system === 'http://loinc.org' && loincCodes.includes(c.code ?? ''),
    );
    if (!matches) continue;
    const dt = obs.effectiveDateTime ? new Date(obs.effectiveDateTime).getTime() : 0;
    if (dt >= latestDate) {
      latestDate = dt;
      latest = obs;
    }
  }

  return latest?.valueQuantity?.value ?? null;
}

// ── Screening rules ────────────────────────────────────────────────────────

const colorectalCancerScreening: ScreeningRule = {
  id: 'colorectal-cancer',
  name: 'Colorectal Cancer Screening',
  description: 'USPSTF recommends screening for colorectal cancer in adults aged 45 to 75.',
  evaluate(ctx) {
    if (ctx.ageYears < 45 || ctx.ageYears > 75) return null;

    // Check for colonoscopy within 10 years
    const hasColonoscopy = hasRecentProcedure(ctx.procedures, CPT.COLONOSCOPY, 10);
    if (hasColonoscopy) return null;

    // Check for FIT/FOBT within 1 year
    const hasFIT = hasRecentObservation(ctx.observations, [LOINC.FIT_TEST], 1);
    if (hasFIT) return null;

    // Check for colonoscopy observation within 10 years
    const hasColonoscopyObs = hasRecentObservation(ctx.observations, [LOINC.COLONOSCOPY], 10);
    if (hasColonoscopyObs) return null;

    return {
      summary: 'Colorectal cancer screening is due',
      detail:
        `Patient is ${ctx.ageYears} years old. USPSTF recommends colorectal cancer screening ` +
        'for adults aged 45-75. Options include colonoscopy every 10 years, annual FIT/FOBT, ' +
        'FIT-DNA every 1-3 years, or CT colonography every 5 years.',
      indicator: 'info',
    };
  },
};

const breastCancerScreening: ScreeningRule = {
  id: 'breast-cancer',
  name: 'Breast Cancer Screening (Mammography)',
  description: 'USPSTF recommends biennial mammography for women aged 40 and older.',
  evaluate(ctx) {
    if (ctx.sex !== 'female' || ctx.ageYears < 40) return null;

    const hasMammography =
      hasRecentProcedure(ctx.procedures, CPT.MAMMOGRAPHY, 2) ||
      hasRecentObservation(ctx.observations, [LOINC.MAMMOGRAPHY], 2);
    if (hasMammography) return null;

    return {
      summary: 'Breast cancer screening (mammography) is due',
      detail:
        `Patient is a ${ctx.ageYears}-year-old female. USPSTF recommends biennial screening ` +
        'mammography for women aged 40 and older. The decision to begin screening before age 50 ' +
        'should be an individual one.',
      indicator: 'info',
    };
  },
};

const cervicalCancerScreening: ScreeningRule = {
  id: 'cervical-cancer',
  name: 'Cervical Cancer Screening (Pap Smear)',
  description: 'USPSTF recommends cervical cancer screening for women aged 21-65.',
  evaluate(ctx) {
    if (ctx.sex !== 'female' || ctx.ageYears < 21 || ctx.ageYears > 65) return null;

    // Pap smear every 3 years
    const hasPap =
      hasRecentProcedure(ctx.procedures, CPT.PAP_SMEAR, 3) ||
      hasRecentObservation(ctx.observations, [LOINC.PAP_SMEAR], 3);
    if (hasPap) return null;

    return {
      summary: 'Cervical cancer screening (Pap smear) is due',
      detail:
        `Patient is a ${ctx.ageYears}-year-old female. USPSTF recommends cervical cancer ` +
        'screening with cytology (Pap smear) every 3 years for women aged 21-29, or every 3 years ' +
        'with cytology alone, every 5 years with hrHPV testing alone, or every 5 years with ' +
        'co-testing for women aged 30-65.',
      indicator: 'info',
    };
  },
};

const lipidPanelScreening: ScreeningRule = {
  id: 'lipid-panel',
  name: 'Lipid Panel Screening',
  description: 'Recommends lipid screening for adults aged 40 and older every 5 years.',
  evaluate(ctx) {
    if (ctx.ageYears < 40) return null;

    const hasLipid = hasRecentObservation(
      ctx.observations,
      [LOINC.LIPID_PANEL, LOINC.TOTAL_CHOLESTEROL],
      5,
    );
    if (hasLipid) return null;

    return {
      summary: 'Lipid panel screening is due',
      detail:
        `Patient is ${ctx.ageYears} years old. Lipid screening is recommended for adults aged ` +
        '40 and older at least every 5 years to assess cardiovascular risk. Earlier or more frequent ' +
        'screening may be warranted based on risk factors.',
      indicator: 'info',
    };
  },
};

const diabetesScreening: ScreeningRule = {
  id: 'diabetes',
  name: 'Diabetes Screening (A1C)',
  description:
    'USPSTF recommends screening for prediabetes and type 2 diabetes in adults aged 35-70 who are overweight or obese.',
  evaluate(ctx) {
    // Check if patient qualifies: age 45+ OR BMI > 25 at any age (18+)
    const bmi = getLatestObservationValue(ctx.observations, [LOINC.BMI]);
    const eligibleByAge = ctx.ageYears >= 45;
    const eligibleByBMI = ctx.ageYears >= 18 && bmi !== null && bmi > 25;

    if (!eligibleByAge && !eligibleByBMI) return null;

    const hasA1C = hasRecentObservation(
      ctx.observations,
      [LOINC.HBA1C, LOINC.FASTING_GLUCOSE],
      3,
    );
    if (hasA1C) return null;

    const reason = eligibleByBMI && !eligibleByAge
      ? `BMI of ${bmi?.toFixed(1)} (>25)`
      : `age ${ctx.ageYears}`;

    return {
      summary: 'Diabetes screening (HbA1c) is due',
      detail:
        `Patient qualifies for diabetes screening based on ${reason}. USPSTF recommends ` +
        'screening for prediabetes and type 2 diabetes with HbA1c or fasting plasma glucose ' +
        'every 3 years. Earlier rescreening may be appropriate for patients with prediabetes.',
      indicator: 'info',
    };
  },
};

const bloodPressureScreening: ScreeningRule = {
  id: 'blood-pressure',
  name: 'Blood Pressure Screening',
  description: 'USPSTF recommends screening for high blood pressure in adults aged 18 and older.',
  evaluate(ctx) {
    if (ctx.ageYears < 18) return null;

    const hasBP = hasRecentObservation(
      ctx.observations,
      [LOINC.BLOOD_PRESSURE_SYSTOLIC],
      1,
    );
    if (hasBP) return null;

    return {
      summary: 'Annual blood pressure screening is due',
      detail:
        `Patient is ${ctx.ageYears} years old. USPSTF recommends screening for high blood ` +
        'pressure in adults aged 18 years or older. Annual screening is recommended; those with ' +
        'elevated readings should have confirmatory measurements.',
      indicator: 'info',
    };
  },
};

const depressionScreening: ScreeningRule = {
  id: 'depression-phq9',
  name: 'Depression Screening (PHQ-9)',
  description: 'USPSTF recommends screening for depression in the general adult population.',
  evaluate(ctx) {
    if (ctx.ageYears < 12) return null;

    const hasPHQ9 = hasRecentObservation(ctx.observations, [LOINC.PHQ9], 1);
    if (hasPHQ9) return null;

    return {
      summary: 'Annual depression screening (PHQ-9) is due',
      detail:
        `Patient is ${ctx.ageYears} years old. USPSTF recommends screening for major depressive ` +
        'disorder (MDD) in adolescents aged 12 and older and all adults. PHQ-9 is the recommended ' +
        'instrument. Screening should be implemented with adequate systems in place for diagnosis, ' +
        'treatment, and follow-up.',
      indicator: 'info',
    };
  },
};

const ALL_SCREENING_RULES: ScreeningRule[] = [
  colorectalCancerScreening,
  breastCancerScreening,
  cervicalCancerScreening,
  lipidPanelScreening,
  diabetesScreening,
  bloodPressureScreening,
  depressionScreening,
];

// ── CDSHookHandler implementation ──────────────────────────────────────────

const SOURCE = {
  label: 'Tribal EHR Preventive Care Module',
  url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics',
  topic: {
    system: 'http://hl7.org/fhir/definition-topic',
    code: 'treatment',
    display: 'Treatment',
  },
};

/**
 * Extract age in years from a FHIR Patient resource.
 */
function getPatientAge(patient: any): number | null {
  const birthDate = patient?.birthDate;
  if (!birthDate) return null;
  const bd = new Date(birthDate);
  if (isNaN(bd.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  const monthDiff = now.getMonth() - bd.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < bd.getDate())) {
    age--;
  }
  return age;
}

/**
 * Normalize FHIR gender string to our internal representation.
 */
function normalizeGender(gender: string | undefined): string {
  switch (gender?.toLowerCase()) {
    case 'male':
      return 'male';
    case 'female':
      return 'female';
    default:
      return 'unknown';
  }
}

/**
 * Extract an array of FHIR resources from a prefetch value.
 * The prefetch value may be a Bundle or a single resource.
 */
function extractResources(prefetchValue: any): any[] {
  if (!prefetchValue) return [];
  if (prefetchValue.resourceType === 'Bundle') {
    return (prefetchValue.entry ?? []).map((e: any) => e.resource).filter(Boolean);
  }
  // Single resource
  return [prefetchValue];
}

export class PreventiveCareHandler implements CDSHookHandler {
  public readonly service: CDSService = {
    id: 'tribal-ehr-preventive-care',
    hook: 'patient-view',
    title: 'Preventive Care Screening Reminders',
    description:
      'Evaluates patient demographics and clinical history against USPSTF guidelines ' +
      'to generate evidence-based preventive care screening recommendations.',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
      conditions: 'Condition?patient={{context.patientId}}&clinical-status=active',
      procedures: 'Procedure?patient={{context.patientId}}',
      observations: 'Observation?patient={{context.patientId}}',
    },
    usageRequirements:
      'Requires patient demographics, active conditions, procedures, and observations in prefetch.',
  };

  async handle(request: CDSRequest): Promise<CDSResponse> {
    const prefetch = request.prefetch ?? {};

    // Extract patient
    const patient = prefetch.patient;
    if (!patient) {
      return { cards: [] };
    }

    const age = getPatientAge(patient);
    if (age === null) {
      return { cards: [] };
    }

    const sex = normalizeGender(patient.gender);

    const conditions: FHIRCondition[] = extractResources(prefetch.conditions);
    const procedures: FHIRProcedure[] = extractResources(prefetch.procedures);
    const observations: FHIRObservation[] = extractResources(prefetch.observations);

    const ctx: PatientContext = {
      ageYears: age,
      sex,
      conditions,
      procedures,
      observations,
    };

    const cards: CDSCard[] = [];

    for (const rule of ALL_SCREENING_RULES) {
      const recommendation = rule.evaluate(ctx);
      if (recommendation) {
        cards.push({
          uuid: uuidv4(),
          summary: recommendation.summary,
          detail: recommendation.detail,
          indicator: recommendation.indicator,
          source: SOURCE,
          suggestions: [
            {
              label: `Order ${rule.name}`,
              uuid: uuidv4(),
              isRecommended: true,
            },
          ],
          overrideReasons: [
            {
              code: 'patient-declined',
              system: 'http://tribal-ehr.org/cds/override-reason',
              display: 'Patient declined',
            },
            {
              code: 'already-performed-elsewhere',
              system: 'http://tribal-ehr.org/cds/override-reason',
              display: 'Already performed elsewhere',
            },
            {
              code: 'not-clinically-appropriate',
              system: 'http://tribal-ehr.org/cds/override-reason',
              display: 'Not clinically appropriate',
            },
          ],
          links: [
            {
              label: 'USPSTF Recommendations',
              url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics',
              type: 'absolute',
            },
          ],
        });
      }
    }

    return { cards };
  }
}
