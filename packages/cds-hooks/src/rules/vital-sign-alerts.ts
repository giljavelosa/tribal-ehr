/**
 * Abnormal Vital Sign Alerting
 *
 * CDS Hook: patient-view
 * Service ID: tribal-ehr-vital-alerts
 *
 * Checks the patient's most recent vital sign observations against
 * clinically accepted reference ranges and generates alerts with
 * appropriate severity indicators.
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

// ── LOINC codes for vital sign types ───────────────────────────────────────

const VITAL_LOINC = {
  SYSTOLIC_BP: '8480-6',
  DIASTOLIC_BP: '8462-4',
  HEART_RATE: '8867-4',
  RESPIRATORY_RATE: '9279-1',
  TEMPERATURE_F: '8310-5',  // Body temperature
  TEMPERATURE_C: '8310-5',
  SPO2: '2708-6',           // Oxygen saturation
  BMI: '39156-5',
  WEIGHT: '29463-7',
  HEIGHT: '8302-2',
};

// ── Vital sign reference ranges ────────────────────────────────────────────

interface VitalRange {
  id: string;
  name: string;
  unit: string;
  loincCodes: string[];
  /** Critical low threshold (below this = critical card). */
  criticalLow?: number;
  /** Warning low threshold (below this = warning card). */
  warningLow?: number;
  /** Warning high threshold (above this = warning card). */
  warningHigh?: number;
  /** Critical high threshold (above this = critical card). */
  criticalHigh?: number;
  /** Info-level note (for BMI-like values without acute danger). */
  infoLow?: number;
  infoHigh?: number;
  /** Clinical recommendation when value is low. */
  lowRecommendation: string;
  /** Clinical recommendation when value is high. */
  highRecommendation: string;
  /** Whether to convert from Celsius to Fahrenheit for threshold comparison. */
  convertCelsiusToFahrenheit?: boolean;
}

const VITAL_RANGES: VitalRange[] = [
  {
    id: 'systolic-bp',
    name: 'Systolic Blood Pressure',
    unit: 'mmHg',
    loincCodes: [VITAL_LOINC.SYSTOLIC_BP],
    criticalLow: 80,
    warningLow: 90,
    warningHigh: 160,
    criticalHigh: 200,
    lowRecommendation:
      'Evaluate for causes of hypotension (dehydration, sepsis, cardiac dysfunction, medication effects). ' +
      'Consider IV fluid resuscitation if symptomatic. Continuous monitoring recommended.',
    highRecommendation:
      'Evaluate for hypertensive urgency/emergency. Assess for end-organ damage (headache, visual changes, ' +
      'chest pain, dyspnea). Consider antihypertensive therapy and repeat measurement. If systolic >180 mmHg ' +
      'with evidence of end-organ damage, treat as hypertensive emergency.',
  },
  {
    id: 'diastolic-bp',
    name: 'Diastolic Blood Pressure',
    unit: 'mmHg',
    loincCodes: [VITAL_LOINC.DIASTOLIC_BP],
    criticalLow: 50,
    warningLow: 60,
    warningHigh: 100,
    criticalHigh: 120,
    lowRecommendation:
      'Low diastolic blood pressure may indicate reduced coronary perfusion pressure. ' +
      'Evaluate cardiac function and volume status. Review medications that may cause vasodilation.',
    highRecommendation:
      'Elevated diastolic blood pressure increases cardiovascular risk. Assess for secondary causes ' +
      'of hypertension. Consider medication adjustment. If diastolic >120 mmHg, evaluate for hypertensive emergency.',
  },
  {
    id: 'heart-rate',
    name: 'Heart Rate',
    unit: 'bpm',
    loincCodes: [VITAL_LOINC.HEART_RATE],
    criticalLow: 40,
    warningLow: 50,
    warningHigh: 120,
    criticalHigh: 150,
    lowRecommendation:
      'Bradycardia detected. Evaluate for symptomatic bradycardia (dizziness, syncope, fatigue). ' +
      'Review medications (beta-blockers, calcium channel blockers, digoxin). Consider 12-lead ECG. ' +
      'If hemodynamically unstable, follow ACLS bradycardia protocol.',
    highRecommendation:
      'Tachycardia detected. Evaluate for underlying cause (pain, fever, dehydration, anxiety, anemia, ' +
      'hyperthyroidism, cardiac arrhythmia). Obtain 12-lead ECG. If heart rate >150 bpm, assess for ' +
      'unstable tachycardia and follow ACLS protocol.',
  },
  {
    id: 'respiratory-rate',
    name: 'Respiratory Rate',
    unit: 'breaths/min',
    loincCodes: [VITAL_LOINC.RESPIRATORY_RATE],
    criticalLow: 8,
    warningLow: 10,
    warningHigh: 30,
    criticalHigh: 40,
    lowRecommendation:
      'Bradypnea detected. Evaluate for causes of respiratory depression (opioid use, CNS pathology, ' +
      'neuromuscular disease). Assess oxygen saturation and level of consciousness. If opioid-related, ' +
      'consider naloxone administration.',
    highRecommendation:
      'Tachypnea detected. Evaluate for respiratory distress (pneumonia, PE, asthma exacerbation, ' +
      'metabolic acidosis, anxiety). Assess oxygen saturation, obtain chest imaging if indicated. ' +
      'Consider arterial blood gas analysis.',
  },
  {
    id: 'temperature',
    name: 'Body Temperature',
    unit: '°F',
    loincCodes: [VITAL_LOINC.TEMPERATURE_F],
    criticalLow: 95.0,
    warningLow: 96.8,
    warningHigh: 100.4,
    criticalHigh: 104.0,
    convertCelsiusToFahrenheit: true,
    lowRecommendation:
      'Hypothermia detected. Evaluate for environmental exposure, sepsis (paradoxical hypothermia), ' +
      'hypothyroidism, or hypoglycemia. Initiate rewarming measures. If temp <95°F (35°C), ' +
      'monitor for cardiac arrhythmias.',
    highRecommendation:
      'Fever detected. Evaluate for infectious source. Obtain blood cultures if clinically indicated. ' +
      'Consider antipyretic therapy. If temp >104°F (40°C), evaluate for heat stroke or severe ' +
      'infection requiring aggressive intervention.',
  },
  {
    id: 'spo2',
    name: 'Oxygen Saturation (SpO2)',
    unit: '%',
    loincCodes: [VITAL_LOINC.SPO2],
    criticalLow: 88,
    warningLow: 92,
    lowRecommendation:
      'Hypoxemia detected. Assess respiratory function, apply supplemental oxygen. Evaluate for ' +
      'pneumonia, COPD exacerbation, pulmonary embolism, heart failure, or airway obstruction. ' +
      'If SpO2 <88%, consider urgent intervention and ABG analysis.',
    highRecommendation: '', // SpO2 does not have a clinically meaningful high threshold
  },
  {
    id: 'bmi',
    name: 'Body Mass Index (BMI)',
    unit: 'kg/m²',
    loincCodes: [VITAL_LOINC.BMI],
    infoLow: 18.5,
    infoHigh: 30.0,
    lowRecommendation:
      'Underweight BMI. Screen for eating disorders, malnutrition, chronic illness, or unintentional ' +
      'weight loss. Consider nutritional assessment and dietary counseling. Evaluate thyroid function.',
    highRecommendation:
      'Obesity (BMI ≥30). Counsel on lifestyle modifications including diet and physical activity. ' +
      'Screen for obesity-related comorbidities: type 2 diabetes (HbA1c), dyslipidemia, hypertension, ' +
      'and obstructive sleep apnea. Consider referral to weight management program.',
  },
];

// ── Helper utilities ───────────────────────────────────────────────────────

interface FHIRObservation {
  resourceType?: string;
  code?: { coding?: Array<{ system?: string; code?: string; display?: string }> };
  effectiveDateTime?: string;
  valueQuantity?: { value?: number; unit?: string; system?: string; code?: string };
  component?: Array<{
    code?: { coding?: Array<{ system?: string; code?: string }> };
    valueQuantity?: { value?: number; unit?: string };
  }>;
  status?: string;
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
 * Find the most recent observation matching any of the given LOINC codes.
 * Also checks observation.component for blood pressure panels.
 */
function findLatestVital(
  observations: FHIRObservation[],
  loincCodes: string[],
): { value: number; unit: string; effectiveDateTime?: string } | null {
  let latest: { value: number; unit: string; effectiveDateTime?: string } | null = null;
  let latestDate = 0;

  for (const obs of observations) {
    if (obs.status === 'entered-in-error' || obs.status === 'cancelled') continue;

    const dt = obs.effectiveDateTime ? new Date(obs.effectiveDateTime).getTime() : 0;

    // Check top-level code
    const codings = obs.code?.coding ?? [];
    const matchesTopLevel = codings.some(
      (c) => c.system === 'http://loinc.org' && loincCodes.includes(c.code ?? ''),
    );

    if (matchesTopLevel && obs.valueQuantity?.value !== undefined && dt >= latestDate) {
      latestDate = dt;
      latest = {
        value: obs.valueQuantity.value,
        unit: obs.valueQuantity.unit ?? '',
        effectiveDateTime: obs.effectiveDateTime,
      };
    }

    // Check components (e.g., BP panel with systolic and diastolic components)
    if (obs.component) {
      for (const component of obs.component) {
        const componentCodings = component.code?.coding ?? [];
        const componentMatch = componentCodings.some(
          (c) => c.system === 'http://loinc.org' && loincCodes.includes(c.code ?? ''),
        );
        if (componentMatch && component.valueQuantity?.value !== undefined && dt >= latestDate) {
          latestDate = dt;
          latest = {
            value: component.valueQuantity.value,
            unit: component.valueQuantity.unit ?? '',
            effectiveDateTime: obs.effectiveDateTime,
          };
        }
      }
    }
  }

  return latest;
}

/**
 * Convert Celsius to Fahrenheit.
 */
function celsiusToFahrenheit(celsius: number): number {
  return celsius * 9 / 5 + 32;
}

/**
 * Determine if a temperature unit string indicates Celsius.
 */
function isCelsius(unit: string): boolean {
  const normalized = unit.toLowerCase().replace(/[^a-z]/g, '');
  return normalized === 'c' || normalized === 'cel' || normalized === 'celsius' || normalized === 'degc';
}

// ── CDSHookHandler implementation ──────────────────────────────────────────

const SOURCE = {
  label: 'Tribal EHR Vital Sign Monitor',
  topic: {
    system: 'http://hl7.org/fhir/definition-topic',
    code: 'assessment',
    display: 'Assessment',
  },
};

export class VitalSignAlertHandler implements CDSHookHandler {
  public readonly service: CDSService = {
    id: 'tribal-ehr-vital-alerts',
    hook: 'patient-view',
    title: 'Abnormal Vital Sign Alerts',
    description:
      'Checks the patient\'s most recent vital sign observations against clinically accepted ' +
      'reference ranges and generates alerts for abnormal values.',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
      vitals:
        'Observation?patient={{context.patientId}}&category=vital-signs&_sort=-date&_count=50',
    },
    usageRequirements:
      'Requires recent vital sign observations in prefetch.',
  };

  async handle(request: CDSRequest): Promise<CDSResponse> {
    const prefetch = request.prefetch ?? {};

    const vitalResources: FHIRObservation[] = extractResources(prefetch.vitals);

    if (vitalResources.length === 0) {
      return { cards: [] };
    }

    const cards: CDSCard[] = [];

    for (const range of VITAL_RANGES) {
      const vital = findLatestVital(vitalResources, range.loincCodes);
      if (!vital || vital.value === undefined) continue;

      let value = vital.value;

      // Handle temperature unit conversion
      if (range.convertCelsiusToFahrenheit && isCelsius(vital.unit)) {
        value = celsiusToFahrenheit(value);
      }

      const card = this.evaluateVital(range, value, vital.effectiveDateTime);
      if (card) {
        cards.push(card);
      }
    }

    return { cards };
  }

  /**
   * Evaluate a single vital sign value against its reference range and
   * return a card if it is out of range, or null if it is normal.
   */
  private evaluateVital(
    range: VitalRange,
    value: number,
    effectiveDateTime?: string,
  ): CDSCard | null {
    const dateStr = effectiveDateTime
      ? ` (recorded ${new Date(effectiveDateTime).toLocaleDateString()})`
      : '';

    // Critical low
    if (range.criticalLow !== undefined && value < range.criticalLow) {
      return {
        uuid: uuidv4(),
        summary: `CRITICAL: ${range.name} is critically low at ${value} ${range.unit}`,
        detail:
          `**${range.name}:** ${value} ${range.unit}${dateStr}\n` +
          `**Critical threshold:** <${range.criticalLow} ${range.unit}\n\n` +
          `**Clinical recommendation:** ${range.lowRecommendation}`,
        indicator: 'critical',
        source: SOURCE,
        overrideReasons: [
          {
            code: 'patient-baseline',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'This is patient\'s known baseline',
          },
          {
            code: 'already-addressed',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Already being addressed',
          },
        ],
      };
    }

    // Critical high
    if (range.criticalHigh !== undefined && value > range.criticalHigh) {
      return {
        uuid: uuidv4(),
        summary: `CRITICAL: ${range.name} is critically high at ${value} ${range.unit}`,
        detail:
          `**${range.name}:** ${value} ${range.unit}${dateStr}\n` +
          `**Critical threshold:** >${range.criticalHigh} ${range.unit}\n\n` +
          `**Clinical recommendation:** ${range.highRecommendation}`,
        indicator: 'critical',
        source: SOURCE,
        overrideReasons: [
          {
            code: 'patient-baseline',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'This is patient\'s known baseline',
          },
          {
            code: 'already-addressed',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Already being addressed',
          },
        ],
      };
    }

    // Warning low
    if (range.warningLow !== undefined && value < range.warningLow) {
      return {
        uuid: uuidv4(),
        summary: `Warning: ${range.name} is low at ${value} ${range.unit}`,
        detail:
          `**${range.name}:** ${value} ${range.unit}${dateStr}\n` +
          `**Warning threshold:** <${range.warningLow} ${range.unit}\n\n` +
          `**Clinical recommendation:** ${range.lowRecommendation}`,
        indicator: 'warning',
        source: SOURCE,
        overrideReasons: [
          {
            code: 'patient-baseline',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'This is patient\'s known baseline',
          },
          {
            code: 'monitoring-in-place',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Monitoring already in place',
          },
        ],
      };
    }

    // Warning high
    if (range.warningHigh !== undefined && value > range.warningHigh) {
      return {
        uuid: uuidv4(),
        summary: `Warning: ${range.name} is elevated at ${value} ${range.unit}`,
        detail:
          `**${range.name}:** ${value} ${range.unit}${dateStr}\n` +
          `**Warning threshold:** >${range.warningHigh} ${range.unit}\n\n` +
          `**Clinical recommendation:** ${range.highRecommendation}`,
        indicator: 'warning',
        source: SOURCE,
        overrideReasons: [
          {
            code: 'patient-baseline',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'This is patient\'s known baseline',
          },
          {
            code: 'monitoring-in-place',
            system: 'http://tribal-ehr.org/cds/override-reason',
            display: 'Monitoring already in place',
          },
        ],
      };
    }

    // Info low (BMI underweight)
    if (range.infoLow !== undefined && value < range.infoLow) {
      return {
        uuid: uuidv4(),
        summary: `${range.name} is below normal at ${value} ${range.unit}`,
        detail:
          `**${range.name}:** ${value} ${range.unit}${dateStr}\n` +
          `**Normal range:** ${range.infoLow}-${range.infoHigh} ${range.unit}\n\n` +
          `**Clinical recommendation:** ${range.lowRecommendation}`,
        indicator: 'info',
        source: SOURCE,
      };
    }

    // Info high (BMI obese)
    if (range.infoHigh !== undefined && value > range.infoHigh) {
      return {
        uuid: uuidv4(),
        summary: `${range.name} is above normal at ${value} ${range.unit}`,
        detail:
          `**${range.name}:** ${value} ${range.unit}${dateStr}\n` +
          `**Normal range:** ${range.infoLow}-${range.infoHigh} ${range.unit}\n\n` +
          `**Clinical recommendation:** ${range.highRecommendation}`,
        indicator: 'info',
        source: SOURCE,
      };
    }

    // Value is within normal range
    return null;
  }
}
