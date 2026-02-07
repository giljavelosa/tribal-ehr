/**
 * Overdue Immunization Alerts
 *
 * CDS Hook: patient-view
 * Service ID: tribal-ehr-immunization-alerts
 *
 * Checks the patient's immunization history against the recommended
 * adult immunization schedule and generates alerts for overdue or
 * missing immunizations.
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

// ── CVX codes for vaccine types ────────────────────────────────────────────

/**
 * CVX (Vaccine Administered) codes from the CDC.
 * https://www2a.cdc.gov/vaccines/iis/iisstandards/vaccines.asp?rpt=cvx
 */
const CVX = {
  // Influenza
  INFLUENZA_IIV: '141',        // Influenza, seasonal, injectable, preservative free
  INFLUENZA_IIV_PF: '150',     // Influenza, injectable, quadrivalent, preservative free
  INFLUENZA_IIV4: '158',       // Influenza, injectable, quadrivalent
  INFLUENZA_LAIV: '149',       // Influenza, live, intranasal, quadrivalent
  INFLUENZA_HD: '153',         // Influenza, high-dose seasonal
  INFLUENZA_RECOMBINANT: '155', // Influenza recombinant
  INFLUENZA_GENERIC: '88',     // Influenza, unspecified formulation

  // Tdap / Td
  TDAP: '115',                 // Tdap (adult)
  TD: '138',                   // Td (adult)
  TD_ADSORBED: '09',           // Td (adult, adsorbed)

  // Pneumococcal
  PCV13: '133',                // PCV13 (Prevnar 13)
  PCV15: '216',                // PCV15 (Vaxneuvance)
  PCV20: '217',                // PCV20 (Prevnar 20)
  PPSV23: '33',                // PPSV23 (Pneumovax 23)

  // Shingles / Zoster
  ZOSTER_LIVE: '121',          // Zoster vaccine, live (Zostavax)
  ZOSTER_RECOMBINANT: '187',   // Zoster vaccine, recombinant (Shingrix)

  // COVID-19
  COVID_PFIZER: '208',         // Pfizer-BioNTech COVID-19 Vaccine
  COVID_MODERNA: '207',        // Moderna COVID-19 Vaccine
  COVID_JANSSEN: '212',        // Janssen (J&J) COVID-19 Vaccine
  COVID_NOVAVAX: '211',        // Novavax COVID-19 Vaccine
  COVID_BIVALENT_PFIZER: '300', // COVID-19 bivalent
  COVID_BIVALENT_MODERNA: '301',
  COVID_2024_PFIZER: '308',    // COVID-19 updated (2024-2025)
  COVID_2024_MODERNA: '309',
  COVID_2024_NOVAVAX: '310',

  // Hepatitis B
  HEP_B_ADULT: '43',          // Hep B, adult dosage
  HEP_B_DIALYSIS: '44',       // Hep B, dialysis patient
  HEP_B_UNSPECIFIED: '45',    // Hep B, unspecified
  HEP_B_RECOMBINANT: '08',    // Hep B, recombinant
  HEP_B_HEPLISAV: '189',      // Hep B (Heplisav-B)

  // MMR
  MMR: '03',                   // MMR
  MEASLES: '05',               // Measles
  MUMPS: '07',                 // Mumps
  RUBELLA: '06',               // Rubella

  // Varicella
  VARICELLA: '21',             // Varicella (chickenpox)
  MMRV: '94',                  // MMRV (ProQuad)
};

// ── Immunization schedule definitions ──────────────────────────────────────

interface ImmunizationRule {
  id: string;
  name: string;
  description: string;
  /** CVX codes that satisfy this immunization requirement. */
  cvxCodes: string[];
  /** Minimum patient age (years) for this recommendation. */
  minAge: number;
  /** Maximum patient age (years). Undefined = no upper limit. */
  maxAge?: number;
  /** Minimum number of doses required for the series. */
  requiredDoses: number;
  /** How often this vaccine should be readministered (years). 0 = one-time series. */
  intervalYears: number;
  /** Additional eligibility check. */
  isEligible?: (ctx: PatientContext) => boolean;
  /** Detailed recommendation text. */
  recommendation: string;
}

interface PatientContext {
  ageYears: number;
  birthYear: number;
  sex: string;
}

interface FHIRImmunization {
  resourceType?: string;
  vaccineCode?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  occurrenceDateTime?: string;
  occurrenceString?: string;
  status?: string;
}

// All CVX codes for influenza
const ALL_INFLUENZA_CVX = [
  CVX.INFLUENZA_IIV, CVX.INFLUENZA_IIV_PF, CVX.INFLUENZA_IIV4,
  CVX.INFLUENZA_LAIV, CVX.INFLUENZA_HD, CVX.INFLUENZA_RECOMBINANT,
  CVX.INFLUENZA_GENERIC,
];

// All CVX codes for Tdap/Td
const ALL_TDAP_TD_CVX = [CVX.TDAP, CVX.TD, CVX.TD_ADSORBED];

// All CVX codes for pneumococcal
const ALL_PNEUMOCOCCAL_CVX = [CVX.PCV13, CVX.PCV15, CVX.PCV20, CVX.PPSV23];

// All CVX codes for zoster
const ALL_ZOSTER_CVX = [CVX.ZOSTER_LIVE, CVX.ZOSTER_RECOMBINANT];

// All CVX codes for COVID-19
const ALL_COVID_CVX = [
  CVX.COVID_PFIZER, CVX.COVID_MODERNA, CVX.COVID_JANSSEN, CVX.COVID_NOVAVAX,
  CVX.COVID_BIVALENT_PFIZER, CVX.COVID_BIVALENT_MODERNA,
  CVX.COVID_2024_PFIZER, CVX.COVID_2024_MODERNA, CVX.COVID_2024_NOVAVAX,
];

// All CVX codes for Hepatitis B
const ALL_HEP_B_CVX = [
  CVX.HEP_B_ADULT, CVX.HEP_B_DIALYSIS, CVX.HEP_B_UNSPECIFIED,
  CVX.HEP_B_RECOMBINANT, CVX.HEP_B_HEPLISAV,
];

// All CVX codes for MMR
const ALL_MMR_CVX = [CVX.MMR, CVX.MEASLES, CVX.MUMPS, CVX.RUBELLA, CVX.MMRV];

// All CVX codes for varicella
const ALL_VARICELLA_CVX = [CVX.VARICELLA, CVX.MMRV];

const IMMUNIZATION_RULES: ImmunizationRule[] = [
  {
    id: 'influenza',
    name: 'Influenza (Flu) Vaccine',
    description: 'Annual influenza vaccination for all persons aged 6 months and older.',
    cvxCodes: ALL_INFLUENZA_CVX,
    minAge: 1, // Using 1 since we deal in whole years; covers 6 months+
    requiredDoses: 1,
    intervalYears: 1,
    recommendation:
      'Annual influenza vaccination is recommended for all persons aged 6 months and older ' +
      '(ACIP recommendation). Any age-appropriate influenza vaccine formulation may be used. ' +
      'For adults aged 65+, a high-dose or adjuvanted formulation is preferred.',
  },
  {
    id: 'tdap-td',
    name: 'Tdap/Td (Tetanus, Diphtheria, Pertussis)',
    description: 'Tdap once, then Td or Tdap booster every 10 years for adults aged 11+.',
    cvxCodes: ALL_TDAP_TD_CVX,
    minAge: 11,
    requiredDoses: 1,
    intervalYears: 10,
    recommendation:
      'Adults who have not received Tdap should receive one dose, followed by Td or Tdap boosters ' +
      'every 10 years. Tdap is especially important for those in close contact with infants. ' +
      'Pregnant individuals should receive Tdap during each pregnancy (27-36 weeks gestation).',
  },
  {
    id: 'pneumococcal',
    name: 'Pneumococcal Vaccine',
    description: 'PCV20 or PCV15+PPSV23 for adults aged 65 and older.',
    cvxCodes: ALL_PNEUMOCOCCAL_CVX,
    minAge: 65,
    requiredDoses: 1,
    intervalYears: 0, // One-time series
    recommendation:
      'Adults aged 65 and older who have not previously received a pneumococcal conjugate vaccine ' +
      'should receive PCV20 alone OR PCV15 followed by PPSV23 (at least 1 year later). ' +
      'Also recommended for adults 19-64 with certain medical conditions ' +
      '(immunocompromising conditions, CSF leak, cochlear implant, chronic conditions).',
  },
  {
    id: 'zoster',
    name: 'Shingles (Zoster) Vaccine',
    description: 'Recombinant zoster vaccine (Shingrix) 2-dose series for adults aged 50+.',
    cvxCodes: ALL_ZOSTER_CVX,
    minAge: 50,
    requiredDoses: 2,
    intervalYears: 0, // One-time series (2 doses)
    recommendation:
      'The recombinant zoster vaccine (Shingrix) is recommended as a 2-dose series for adults ' +
      'aged 50 and older, regardless of prior episode of herpes zoster or receipt of the older ' +
      'live zoster vaccine (Zostavax). The second dose should be given 2-6 months after the first. ' +
      'Also recommended for adults aged 19+ who are immunodeficient or immunosuppressed.',
  },
  {
    id: 'covid-19',
    name: 'COVID-19 Vaccine',
    description: 'Updated COVID-19 vaccine per current ACIP recommendations.',
    cvxCodes: ALL_COVID_CVX,
    minAge: 6, // 6 months+, using 1 year for whole-year calculation
    requiredDoses: 1,
    intervalYears: 1,
    recommendation:
      'An updated COVID-19 vaccine is recommended annually for all persons aged 6 months and older. ' +
      'Patients who are immunocompromised may need additional doses. Check current ACIP recommendations ' +
      'for the most up-to-date guidance on timing and formulations.',
  },
  {
    id: 'hepatitis-b',
    name: 'Hepatitis B Vaccine',
    description: '3-dose (or 2-dose Heplisav-B) series if not previously completed.',
    cvxCodes: ALL_HEP_B_CVX,
    minAge: 18,
    maxAge: 59, // Universal recommendation for 19-59; risk-based for 60+
    requiredDoses: 3,
    intervalYears: 0, // One-time series
    recommendation:
      'Hepatitis B vaccination is universally recommended for all adults aged 19-59 who have not ' +
      'previously completed the series. For adults aged 60 and older, vaccination is recommended ' +
      'based on risk factors. Options: 3-dose series of Engerix-B or Recombivax HB (0, 1, 6 months), ' +
      'or 2-dose series of Heplisav-B (0, 1 month).',
  },
  {
    id: 'mmr',
    name: 'MMR (Measles, Mumps, Rubella)',
    description: '2-dose series for adults born after 1957 without evidence of immunity.',
    cvxCodes: ALL_MMR_CVX,
    minAge: 18,
    requiredDoses: 2,
    intervalYears: 0, // One-time series
    isEligible: (ctx) => ctx.birthYear > 1957,
    recommendation:
      'Adults born in 1957 or later should have documentation of 2 doses of MMR vaccine or other ' +
      'evidence of immunity (laboratory evidence, or healthcare provider diagnosis of disease). ' +
      'Adults born before 1957 are generally considered immune. Healthcare personnel born before 1957 ' +
      'without evidence of immunity should receive 2 doses.',
  },
  {
    id: 'varicella',
    name: 'Varicella (Chickenpox) Vaccine',
    description: '2-dose series for adults without evidence of immunity.',
    cvxCodes: ALL_VARICELLA_CVX,
    minAge: 18,
    requiredDoses: 2,
    intervalYears: 0, // One-time series
    recommendation:
      'Adults without evidence of immunity to varicella should receive 2 doses of varicella vaccine, ' +
      '4-8 weeks apart. Evidence of immunity includes: documentation of 2 doses, history of varicella ' +
      'or herpes zoster diagnosed by a healthcare provider, laboratory evidence of immunity, or ' +
      'birth in the United States before 1980 (except for healthcare personnel and pregnant women).',
  },
];

// ── Helper utilities ───────────────────────────────────────────────────────

/**
 * Extract patient age in years from a FHIR Patient resource.
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
 * Extract birth year from a FHIR Patient resource.
 */
function getPatientBirthYear(patient: any): number | null {
  const birthDate = patient?.birthDate;
  if (!birthDate) return null;
  const bd = new Date(birthDate);
  if (isNaN(bd.getTime())) return null;
  return bd.getFullYear();
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

/**
 * Count completed doses of a vaccine identified by CVX codes.
 * Only counts immunizations with status 'completed'.
 */
function countCompletedDoses(
  immunizations: FHIRImmunization[],
  cvxCodes: string[],
): number {
  let count = 0;
  for (const imm of immunizations) {
    if (imm.status !== 'completed') continue;
    const codings = imm.vaccineCode?.coding ?? [];
    const matches = codings.some(
      (c) =>
        (c.system === 'http://hl7.org/fhir/sid/cvx' || c.system === 'urn:oid:2.16.840.1.113883.12.292') &&
        cvxCodes.includes(c.code ?? ''),
    );
    if (matches) {
      count++;
    }
  }
  return count;
}

/**
 * Get the most recent administration date for a vaccine.
 */
function getMostRecentDate(
  immunizations: FHIRImmunization[],
  cvxCodes: string[],
): Date | null {
  let latest: Date | null = null;

  for (const imm of immunizations) {
    if (imm.status !== 'completed') continue;
    const codings = imm.vaccineCode?.coding ?? [];
    const matches = codings.some(
      (c) =>
        (c.system === 'http://hl7.org/fhir/sid/cvx' || c.system === 'urn:oid:2.16.840.1.113883.12.292') &&
        cvxCodes.includes(c.code ?? ''),
    );
    if (!matches) continue;

    const dateStr = imm.occurrenceDateTime ?? imm.occurrenceString;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) continue;

    if (!latest || d > latest) {
      latest = d;
    }
  }

  return latest;
}

/**
 * Calculate years since a given date.
 */
function yearsSinceDate(date: Date): number {
  const now = new Date();
  return (now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

// ── CDSHookHandler implementation ──────────────────────────────────────────

const SOURCE = {
  label: 'Tribal EHR Immunization Module',
  url: 'https://www.cdc.gov/vaccines/schedules/hcp/imz/adult.html',
  topic: {
    system: 'http://hl7.org/fhir/definition-topic',
    code: 'treatment',
    display: 'Treatment',
  },
};

export class ImmunizationAlertHandler implements CDSHookHandler {
  public readonly service: CDSService = {
    id: 'tribal-ehr-immunization-alerts',
    hook: 'patient-view',
    title: 'Overdue Immunization Alerts',
    description:
      'Checks the patient\'s immunization history against the recommended immunization schedule ' +
      'and generates alerts for overdue or missing immunizations.',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
      immunizations: 'Immunization?patient={{context.patientId}}',
    },
    usageRequirements:
      'Requires patient demographics and immunization history in prefetch.',
  };

  async handle(request: CDSRequest): Promise<CDSResponse> {
    const prefetch = request.prefetch ?? {};

    const patient = prefetch.patient;
    if (!patient) {
      return { cards: [] };
    }

    const age = getPatientAge(patient);
    if (age === null) {
      return { cards: [] };
    }

    const birthYear = getPatientBirthYear(patient) ?? 0;
    const sex = (patient.gender ?? 'unknown').toLowerCase();

    const patientCtx: PatientContext = {
      ageYears: age,
      birthYear,
      sex,
    };

    const immunizations: FHIRImmunization[] = extractResources(prefetch.immunizations);
    const overdueItems: Array<{ rule: ImmunizationRule; detail: string }> = [];

    for (const rule of IMMUNIZATION_RULES) {
      // Check age eligibility
      if (age < rule.minAge) continue;
      if (rule.maxAge !== undefined && age > rule.maxAge) continue;

      // Check custom eligibility
      if (rule.isEligible && !rule.isEligible(patientCtx)) continue;

      const completedDoses = countCompletedDoses(immunizations, rule.cvxCodes);

      if (rule.intervalYears > 0) {
        // Recurring vaccine (e.g., influenza, Tdap booster, COVID-19)
        const mostRecent = getMostRecentDate(immunizations, rule.cvxCodes);
        if (!mostRecent || yearsSinceDate(mostRecent) >= rule.intervalYears) {
          const lastDoseInfo = mostRecent
            ? `Last dose: ${mostRecent.toLocaleDateString()} (${yearsSinceDate(mostRecent).toFixed(1)} years ago).`
            : 'No prior doses documented.';
          overdueItems.push({
            rule,
            detail: `${lastDoseInfo} ${rule.recommendation}`,
          });
        }
      } else {
        // One-time series (e.g., Hepatitis B, MMR, Varicella, Pneumococcal, Zoster)
        if (completedDoses < rule.requiredDoses) {
          const doseInfo =
            completedDoses === 0
              ? 'No doses documented.'
              : `${completedDoses} of ${rule.requiredDoses} required dose(s) documented.`;
          overdueItems.push({
            rule,
            detail: `${doseInfo} ${rule.recommendation}`,
          });
        }
      }
    }

    if (overdueItems.length === 0) {
      return { cards: [] };
    }

    // Generate one summary card if there are multiple overdue immunizations,
    // plus individual detail cards for each.
    const cards: CDSCard[] = [];

    if (overdueItems.length > 1) {
      const summaryList = overdueItems
        .map((item) => `- ${item.rule.name}`)
        .join('\n');

      cards.push({
        uuid: uuidv4(),
        summary: `${overdueItems.length} immunization(s) may be due for this patient`,
        detail:
          `The following immunizations appear overdue or incomplete for this ` +
          `${age}-year-old patient:\n\n${summaryList}\n\n` +
          `Review each recommendation below for details.`,
        indicator: 'info',
        source: SOURCE,
        links: [
          {
            label: 'CDC Adult Immunization Schedule',
            url: 'https://www.cdc.gov/vaccines/schedules/hcp/imz/adult.html',
            type: 'absolute',
          },
        ],
      });
    }

    for (const item of overdueItems) {
      const cvxDisplay = item.rule.cvxCodes.slice(0, 3).join(', ') +
        (item.rule.cvxCodes.length > 3 ? '...' : '');

      cards.push({
        uuid: uuidv4(),
        summary: `${item.rule.name} is due`,
        detail:
          `**${item.rule.name}** (CVX: ${cvxDisplay})\n\n` +
          `${item.detail}`,
        indicator: 'info',
        source: SOURCE,
        suggestions: [
          {
            label: `Order ${item.rule.name}`,
            uuid: uuidv4(),
            isRecommended: true,
          },
        ],
        overrideReasons: [
          {
            code: 'patient-declined',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Patient declined vaccination',
          },
          {
            code: 'medical-contraindication',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Medical contraindication exists',
          },
          {
            code: 'received-elsewhere',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Vaccine received at another facility',
          },
          {
            code: 'immunity-documented',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Evidence of immunity documented',
          },
        ],
      });
    }

    return { cards };
  }
}
