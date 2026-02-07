// =============================================================================
// Clinical Quality Measures (CQM) Service
// ONC Certification: 170.315(c)(1) - Clinical Quality Measures - Record and Export
//                    170.315(c)(2) - Clinical Quality Measures - Import and Calculate
//                    170.315(c)(3) - Clinical Quality Measures - Report
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface MeasureResult {
  measureId: string;
  measureName: string;
  description: string;
  numerator: number;
  denominator: number;
  exclusions: number;
  exceptions: number;
  rate: number;
  period: { start: string; end: string };
  patients: {
    inNumerator: string[];
    inDenominator: string[];
    excluded: string[];
  };
}

export interface QRDADocument {
  format: 'QRDA-I' | 'QRDA-III';
  content: string;
  generatedAt: string;
}

interface MeasureDefinition {
  id: string;
  name: string;
  description: string;
  calculator: (period: { start: string; end: string }) => Promise<MeasureResult>;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class QualityMeasuresService extends BaseService {
  private measureDefinitions: Map<string, MeasureDefinition>;

  constructor() {
    super('QualityMeasuresService');
    this.measureDefinitions = new Map();
    this.initializeMeasures();
  }

  // ---------------------------------------------------------------------------
  // Initialize measure calculators
  // ---------------------------------------------------------------------------

  private initializeMeasures(): void {
    const measures: MeasureDefinition[] = [
      {
        id: 'CMS165v12',
        name: 'Controlling High Blood Pressure',
        description:
          'Percentage of patients 18-85 years of age who had a diagnosis of essential hypertension starting before and continuing into, or starting during the first six months of the measurement period, and whose most recent blood pressure was adequately controlled during the measurement period (systolic < 140 mmHg and diastolic < 90 mmHg).',
        calculator: (period) => this.calculateCMS165(period),
      },
      {
        id: 'CMS122v12',
        name: 'Diabetes: Hemoglobin A1c (HbA1c) Poor Control (> 9%)',
        description:
          'Percentage of patients 18-75 years of age with diabetes who had hemoglobin A1c > 9.0% during the measurement period. Note: This is an inverse measure where a lower rate indicates better performance.',
        calculator: (period) => this.calculateCMS122(period),
      },
      {
        id: 'CMS69v12',
        name: 'Preventive Care and Screening: Body Mass Index (BMI) Screening and Follow-Up Plan',
        description:
          'Percentage of patients aged 18 years and older with a BMI documented during the current encounter or during the previous twelve months AND with a BMI outside of normal parameters, a follow-up plan is documented during the encounter or during the previous twelve months of the current encounter.',
        calculator: (period) => this.calculateCMS69(period),
      },
      {
        id: 'CMS2v13',
        name: 'Preventive Care and Screening: Screening for Depression and Follow-Up Plan',
        description:
          'Percentage of patients aged 12 years and older screened for depression on the date of the encounter or up to 14 days prior to the date of the encounter using an age-appropriate standardized depression screening tool AND if positive, a follow-up plan is documented.',
        calculator: (period) => this.calculateCMS2(period),
      },
      {
        id: 'CMS117v12',
        name: 'Childhood Immunization Status',
        description:
          'Percentage of children 2 years of age who had four diphtheria, tetanus and acellular pertussis (DTaP); three inactivated polio virus (IPV); one measles, mumps and rubella (MMR); three or four H influenza type B (HiB); three hepatitis B (Hep B); one chicken pox (VZV); four pneumococcal conjugate (PCV); one hepatitis A (Hep A); two or three rotavirus (RV); and two influenza (Flu) vaccines by their second birthday.',
        calculator: (period) => this.calculateCMS117(period),
      },
      {
        id: 'CMS347v7',
        name: 'Statin Therapy for the Prevention and Treatment of Cardiovascular Disease',
        description:
          'Percentage of the following patients - all considered at high risk of cardiovascular events - who were prescribed or were already on statin therapy during the measurement period: adults aged >= 21 years who were previously diagnosed with or currently have an active diagnosis of clinical atherosclerotic cardiovascular disease (ASCVD); OR adults aged >= 21 years with a fasting or direct LDL-C level >= 190 mg/dL; OR adults aged 40-75 years with a diagnosis of diabetes.',
        calculator: (period) => this.calculateCMS347(period),
      },
    ];

    for (const measure of measures) {
      this.measureDefinitions.set(measure.id, measure);
    }
  }

  // ---------------------------------------------------------------------------
  // Calculate a specific measure
  // ---------------------------------------------------------------------------

  async calculateMeasure(
    measureId: string,
    period: { start: string; end: string }
  ): Promise<MeasureResult> {
    try {
      const definition = this.measureDefinitions.get(measureId);
      if (!definition) {
        throw new NotFoundError('Quality Measure', measureId);
      }

      this.logger.info('Calculating quality measure', { measureId, period });
      const result = await definition.calculator(period);

      this.logger.info('Quality measure calculated', {
        measureId,
        numerator: result.numerator,
        denominator: result.denominator,
        rate: result.rate,
      });

      return result;
    } catch (error) {
      this.handleError(`Failed to calculate measure ${measureId}`, error);
    }
  }

  // ---------------------------------------------------------------------------
  // Calculate all measures
  // ---------------------------------------------------------------------------

  async calculateAllMeasures(
    period: { start: string; end: string }
  ): Promise<MeasureResult[]> {
    try {
      const results: MeasureResult[] = [];

      for (const [measureId, definition] of this.measureDefinitions) {
        try {
          const result = await definition.calculator(period);
          results.push(result);
        } catch (err) {
          this.logger.warn('Failed to calculate measure, skipping', {
            measureId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      this.logger.info('All quality measures calculated', {
        measuresCalculated: results.length,
        period,
      });

      return results;
    } catch (error) {
      this.handleError('Failed to calculate all measures', error);
    }
  }

  // ---------------------------------------------------------------------------
  // CMS165v12 - Controlling High Blood Pressure
  // Denominator: Patients 18-85 with essential hypertension (ICD-10: I10)
  // Numerator: Most recent BP < 140/90
  // Exclusions: ESRD, pregnancy, palliative care
  // ---------------------------------------------------------------------------

  private async calculateCMS165(
    period: { start: string; end: string }
  ): Promise<MeasureResult> {
    // Find denominator: patients 18-85 with essential hypertension diagnosed
    // before or during the first 6 months of the measurement period
    const sixMonthsIn = this.addMonths(period.start, 6);

    const denominatorPatients = await this.db('patients')
      .join('conditions', 'patients.id', 'conditions.patient_id')
      .where('conditions.code_code', 'I10')
      .where('conditions.code_system', 'http://hl7.org/fhir/sid/icd-10-cm')
      .whereIn('conditions.clinical_status', ['active', 'recurrence', 'relapse'])
      .where('conditions.onset_datetime', '<=', sixMonthsIn)
      .whereRaw(
        `DATE_PART('year', AGE(CAST(? AS DATE), CAST(patients.date_of_birth AS DATE))) >= 18`,
        [period.start]
      )
      .whereRaw(
        `DATE_PART('year', AGE(CAST(? AS DATE), CAST(patients.date_of_birth AS DATE))) <= 85`,
        [period.start]
      )
      .where('patients.active', true)
      .distinct('patients.id')
      .pluck('patients.id');

    // Find exclusions: ESRD (N18.6), pregnancy (O00-O9A), palliative care (Z51.5)
    const excludedPatients = await this.db('conditions')
      .whereIn('patient_id', denominatorPatients)
      .where(function (this: Knex.QueryBuilder) {
        this.where('code_code', 'N18.6') // ESRD
          .orWhere('code_code', 'Z51.5') // Palliative care
          .orWhereRaw("code_code LIKE 'O%'"); // Pregnancy codes
      })
      .whereIn('clinical_status', ['active', 'recurrence', 'relapse'])
      .distinct('patient_id')
      .pluck('patient_id');

    const excludedSet = new Set(excludedPatients);
    const eligiblePatients = denominatorPatients.filter(
      (id: string) => !excludedSet.has(id)
    );

    // Find numerator: patients whose most recent BP is adequately controlled
    // Systolic < 140 AND Diastolic < 90
    const numeratorPatients: string[] = [];

    for (const patientId of eligiblePatients) {
      // Get the most recent blood pressure observation (panel code 85354-9)
      const latestBP = await this.db('observations')
        .where({ patient_id: patientId, code_code: '85354-9' })
        .where('effective_date_time', '>=', period.start)
        .where('effective_date_time', '<=', period.end)
        .orderBy('effective_date_time', 'desc')
        .first();

      if (latestBP && latestBP.component) {
        try {
          const components = JSON.parse(latestBP.component);
          let systolic: number | undefined;
          let diastolic: number | undefined;

          for (const comp of components) {
            const code = comp?.code?.coding?.[0]?.code;
            const value = comp?.valueQuantity?.value;
            if (code === '8480-6') systolic = value; // Systolic
            if (code === '8462-4') diastolic = value; // Diastolic
          }

          if (
            systolic !== undefined &&
            diastolic !== undefined &&
            systolic < 140 &&
            diastolic < 90
          ) {
            numeratorPatients.push(patientId);
          }
        } catch {
          // Component parsing failed
        }
      }
    }

    const denominator = eligiblePatients.length;
    const numerator = numeratorPatients.length;
    const rate = denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;

    return {
      measureId: 'CMS165v12',
      measureName: 'Controlling High Blood Pressure',
      description:
        'Percentage of patients 18-85 with hypertension whose BP is adequately controlled (<140/90)',
      numerator,
      denominator,
      exclusions: excludedPatients.length,
      exceptions: 0,
      rate,
      period,
      patients: {
        inNumerator: numeratorPatients,
        inDenominator: eligiblePatients,
        excluded: excludedPatients,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // CMS122v12 - Diabetes: Hemoglobin A1c Poor Control (>9%)
  // INVERSE MEASURE - lower is better
  // Denominator: Patients 18-75 with diabetes
  // Numerator: Patients with most recent A1C > 9%
  // Exclusions: Palliative care, hospice
  // ---------------------------------------------------------------------------

  private async calculateCMS122(
    period: { start: string; end: string }
  ): Promise<MeasureResult> {
    // Diabetes ICD-10 codes: E10.* (Type 1), E11.* (Type 2), E13.* (Other specified)
    const denominatorPatients = await this.db('patients')
      .join('conditions', 'patients.id', 'conditions.patient_id')
      .where(function (this: Knex.QueryBuilder) {
        this.whereRaw("conditions.code_code LIKE 'E10%'")
          .orWhereRaw("conditions.code_code LIKE 'E11%'")
          .orWhereRaw("conditions.code_code LIKE 'E13%'");
      })
      .where('conditions.code_system', 'http://hl7.org/fhir/sid/icd-10-cm')
      .whereIn('conditions.clinical_status', ['active', 'recurrence', 'relapse'])
      .whereRaw(
        `DATE_PART('year', AGE(CAST(? AS DATE), CAST(patients.date_of_birth AS DATE))) >= 18`,
        [period.start]
      )
      .whereRaw(
        `DATE_PART('year', AGE(CAST(? AS DATE), CAST(patients.date_of_birth AS DATE))) <= 75`,
        [period.start]
      )
      .where('patients.active', true)
      .distinct('patients.id')
      .pluck('patients.id');

    // Find exclusions: palliative care (Z51.5), hospice (Z51.81)
    const excludedPatients = await this.db('conditions')
      .whereIn('patient_id', denominatorPatients)
      .whereIn('code_code', ['Z51.5', 'Z51.81'])
      .whereIn('clinical_status', ['active'])
      .distinct('patient_id')
      .pluck('patient_id');

    const excludedSet = new Set(excludedPatients);
    const eligiblePatients = denominatorPatients.filter(
      (id: string) => !excludedSet.has(id)
    );

    // Numerator: most recent HbA1c > 9% (LOINC 4548-4 = Hemoglobin A1c)
    // Also count patients with NO A1c test during the period (poor control by default)
    const numeratorPatients: string[] = [];

    for (const patientId of eligiblePatients) {
      const latestA1c = await this.db('observations')
        .where({ patient_id: patientId, code_code: '4548-4' })
        .where('effective_date_time', '>=', period.start)
        .where('effective_date_time', '<=', period.end)
        .orderBy('effective_date_time', 'desc')
        .first();

      if (!latestA1c) {
        // No A1c recorded during the period = poor control
        numeratorPatients.push(patientId);
      } else if (
        latestA1c.value_quantity_value !== undefined &&
        latestA1c.value_quantity_value > 9.0
      ) {
        numeratorPatients.push(patientId);
      }
    }

    const denominator = eligiblePatients.length;
    const numerator = numeratorPatients.length;
    const rate = denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;

    return {
      measureId: 'CMS122v12',
      measureName: 'Diabetes: Hemoglobin A1c (HbA1c) Poor Control (> 9%)',
      description:
        'Percentage of patients 18-75 with diabetes whose most recent A1c > 9%. INVERSE measure - lower is better.',
      numerator,
      denominator,
      exclusions: excludedPatients.length,
      exceptions: 0,
      rate,
      period,
      patients: {
        inNumerator: numeratorPatients,
        inDenominator: eligiblePatients,
        excluded: excludedPatients,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // CMS69v12 - BMI Screening and Follow-Up
  // Denominator: Patients 18+ with at least one eligible encounter during period
  // Numerator: BMI documented AND follow-up plan if outside normal (18.5-25)
  // ---------------------------------------------------------------------------

  private async calculateCMS69(
    period: { start: string; end: string }
  ): Promise<MeasureResult> {
    // Denominator: patients 18+ with an encounter during the measurement period
    const denominatorPatients = await this.db('patients')
      .join('encounters', 'patients.id', 'encounters.patient_id')
      .where('encounters.period_start', '>=', period.start)
      .where('encounters.period_start', '<=', period.end)
      .whereIn('encounters.status', ['finished', 'in-progress'])
      .whereRaw(
        `DATE_PART('year', AGE(CAST(? AS DATE), CAST(patients.date_of_birth AS DATE))) >= 18`,
        [period.start]
      )
      .where('patients.active', true)
      .distinct('patients.id')
      .pluck('patients.id');

    // Exclusions: patients with certain conditions where BMI assessment is not appropriate
    // e.g., pregnancy (weight gain expected), palliative/hospice
    const excludedPatients = await this.db('conditions')
      .whereIn('patient_id', denominatorPatients)
      .where(function (this: Knex.QueryBuilder) {
        this.whereRaw("code_code LIKE 'O%'") // Pregnancy
          .orWhereIn('code_code', ['Z51.5', 'Z51.81']); // Palliative/hospice
      })
      .whereIn('clinical_status', ['active'])
      .distinct('patient_id')
      .pluck('patient_id');

    const excludedSet = new Set(excludedPatients);
    const eligiblePatients = denominatorPatients.filter(
      (id: string) => !excludedSet.has(id)
    );

    // Numerator: BMI documented during the encounter or within prior 12 months
    // If BMI outside 18.5-25 kg/m2, a follow-up plan must also be documented
    const lookbackStart = this.addMonths(period.start, -12);
    const numeratorPatients: string[] = [];

    for (const patientId of eligiblePatients) {
      // Check for BMI observation (LOINC 39156-5)
      const bmiObs = await this.db('observations')
        .where({ patient_id: patientId, code_code: '39156-5' })
        .where('effective_date_time', '>=', lookbackStart)
        .where('effective_date_time', '<=', period.end)
        .orderBy('effective_date_time', 'desc')
        .first();

      if (bmiObs && bmiObs.value_quantity_value !== undefined) {
        const bmi = bmiObs.value_quantity_value;
        if (bmi >= 18.5 && bmi <= 25.0) {
          // BMI in normal range, no follow-up needed
          numeratorPatients.push(patientId);
        } else {
          // BMI outside normal - check for a follow-up plan in care_plans
          const followUpPlan = await this.db('care_plans')
            .where({ patient_id: patientId })
            .whereIn('status', ['active', 'completed'])
            .where(function (this: Knex.QueryBuilder) {
              this.whereRaw(
                "LOWER(title) LIKE '%bmi%' OR LOWER(title) LIKE '%weight%' OR LOWER(title) LIKE '%nutrition%' OR LOWER(title) LIKE '%diet%' OR LOWER(title) LIKE '%exercise%' OR LOWER(title) LIKE '%obesity%'"
              );
            })
            .where('created_at', '>=', lookbackStart)
            .where('created_at', '<=', period.end)
            .first();

          if (followUpPlan) {
            numeratorPatients.push(patientId);
          }
        }
      }
    }

    const denominator = eligiblePatients.length;
    const numerator = numeratorPatients.length;
    const rate = denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;

    return {
      measureId: 'CMS69v12',
      measureName: 'Preventive Care and Screening: BMI Screening and Follow-Up Plan',
      description:
        'Percentage of patients 18+ with BMI documented and follow-up plan if BMI outside normal parameters.',
      numerator,
      denominator,
      exclusions: excludedPatients.length,
      exceptions: 0,
      rate,
      period,
      patients: {
        inNumerator: numeratorPatients,
        inDenominator: eligiblePatients,
        excluded: excludedPatients,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // CMS2v13 - Screening for Depression and Follow-Up Plan
  // Denominator: Patients 12+ with encounter during period
  // Numerator: Screened using PHQ-2/PHQ-9 and follow-up if positive
  // ---------------------------------------------------------------------------

  private async calculateCMS2(
    period: { start: string; end: string }
  ): Promise<MeasureResult> {
    // Denominator: patients 12+ with an encounter during the measurement period
    const denominatorPatients = await this.db('patients')
      .join('encounters', 'patients.id', 'encounters.patient_id')
      .where('encounters.period_start', '>=', period.start)
      .where('encounters.period_start', '<=', period.end)
      .whereIn('encounters.status', ['finished', 'in-progress'])
      .whereRaw(
        `DATE_PART('year', AGE(CAST(? AS DATE), CAST(patients.date_of_birth AS DATE))) >= 12`,
        [period.start]
      )
      .where('patients.active', true)
      .distinct('patients.id')
      .pluck('patients.id');

    // Exclusions: patients already diagnosed with depression or bipolar disorder
    // and on treatment, or with documented medical reason for not screening
    const excludedPatients = await this.db('conditions')
      .whereIn('patient_id', denominatorPatients)
      .where(function (this: Knex.QueryBuilder) {
        // Active depression already being managed
        this.whereRaw("code_code LIKE 'F32%'") // Major depressive disorder, single episode
          .orWhereRaw("code_code LIKE 'F33%'") // Major depressive disorder, recurrent
          .orWhereRaw("code_code LIKE 'F31%'"); // Bipolar disorder
      })
      .whereIn('clinical_status', ['active'])
      .distinct('patient_id')
      .pluck('patient_id');

    const excludedSet = new Set(excludedPatients);
    const eligiblePatients = denominatorPatients.filter(
      (id: string) => !excludedSet.has(id)
    );

    // Numerator: screened for depression using PHQ-2 (LOINC 55758-7) or PHQ-9 (LOINC 44249-1)
    // If the screen is positive (PHQ-2 >= 3 or PHQ-9 >= 10), a follow-up plan is needed
    const numeratorPatients: string[] = [];
    const lookbackDays = 14; // can be done up to 14 days before encounter
    const lookbackDate = this.addDays(period.start, -lookbackDays);

    for (const patientId of eligiblePatients) {
      // Check for PHQ-2 or PHQ-9 screening
      const screening = await this.db('observations')
        .where({ patient_id: patientId })
        .whereIn('code_code', ['55758-7', '44249-1']) // PHQ-2 total, PHQ-9 total
        .where('effective_date_time', '>=', lookbackDate)
        .where('effective_date_time', '<=', period.end)
        .orderBy('effective_date_time', 'desc')
        .first();

      if (screening) {
        const score = screening.value_quantity_value;
        const isPHQ2 = screening.code_code === '55758-7';
        const isPositive = isPHQ2 ? (score !== undefined && score >= 3) : (score !== undefined && score >= 10);

        if (!isPositive) {
          // Negative screen - meets numerator
          numeratorPatients.push(patientId);
        } else {
          // Positive screen - need follow-up plan
          const followUp = await this.db('care_plans')
            .where({ patient_id: patientId })
            .whereIn('status', ['active', 'completed'])
            .where(function (this: Knex.QueryBuilder) {
              this.whereRaw(
                "LOWER(title) LIKE '%depression%' OR LOWER(title) LIKE '%mental health%' OR LOWER(title) LIKE '%behavioral health%' OR LOWER(title) LIKE '%psychiatr%' OR LOWER(title) LIKE '%counseling%' OR LOWER(title) LIKE '%antidepressant%'"
              );
            })
            .where('created_at', '>=', lookbackDate)
            .where('created_at', '<=', period.end)
            .first();

          // Also check for antidepressant medication as follow-up
          const antidepressant = await this.db('medication_requests')
            .where({ patient_id: patientId })
            .whereIn('status', ['active', 'completed'])
            .where(function (this: Knex.QueryBuilder) {
              this.whereRaw(
                "LOWER(medication_display) LIKE '%sertraline%' OR LOWER(medication_display) LIKE '%fluoxetine%' OR LOWER(medication_display) LIKE '%escitalopram%' OR LOWER(medication_display) LIKE '%citalopram%' OR LOWER(medication_display) LIKE '%paroxetine%' OR LOWER(medication_display) LIKE '%venlafaxine%' OR LOWER(medication_display) LIKE '%duloxetine%' OR LOWER(medication_display) LIKE '%bupropion%' OR LOWER(medication_display) LIKE '%mirtazapine%'"
              );
            })
            .where('authored_on', '>=', lookbackDate)
            .where('authored_on', '<=', period.end)
            .first();

          if (followUp || antidepressant) {
            numeratorPatients.push(patientId);
          }
        }
      }
    }

    const denominator = eligiblePatients.length;
    const numerator = numeratorPatients.length;
    const rate = denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;

    return {
      measureId: 'CMS2v13',
      measureName: 'Preventive Care and Screening: Screening for Depression and Follow-Up Plan',
      description:
        'Percentage of patients 12+ screened for depression with PHQ-2/PHQ-9 and follow-up plan if positive.',
      numerator,
      denominator,
      exclusions: excludedPatients.length,
      exceptions: 0,
      rate,
      period,
      patients: {
        inNumerator: numeratorPatients,
        inDenominator: eligiblePatients,
        excluded: excludedPatients,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // CMS117v12 - Childhood Immunization Status
  // Denominator: Children who turn 2 during measurement period
  // Numerator: Children with all required immunizations by 2nd birthday
  // ---------------------------------------------------------------------------

  private async calculateCMS117(
    period: { start: string; end: string }
  ): Promise<MeasureResult> {
    // Denominator: children who turn 2 during the measurement period
    // Birthday between (period.start - 2 years) and (period.end - 2 years)
    const twoYearsBefore = (dateStr: string): string => {
      const d = new Date(dateStr);
      d.setFullYear(d.getFullYear() - 2);
      return d.toISOString().split('T')[0];
    };

    const dobStart = twoYearsBefore(period.start);
    const dobEnd = twoYearsBefore(period.end);

    const denominatorPatients = await this.db('patients')
      .where('date_of_birth', '>=', dobStart)
      .where('date_of_birth', '<=', dobEnd)
      .where('active', true)
      .pluck('id');

    // Required immunization CVX codes and minimum doses by 2nd birthday
    const requiredVaccines: Array<{
      name: string;
      cvxCodes: string[];
      minDoses: number;
    }> = [
      { name: 'DTaP', cvxCodes: ['20', '106', '107', '110', '120'], minDoses: 4 },
      { name: 'IPV', cvxCodes: ['10', '89', '110', '120'], minDoses: 3 },
      { name: 'MMR', cvxCodes: ['03', '94'], minDoses: 1 },
      { name: 'HiB', cvxCodes: ['17', '46', '47', '48', '49', '51'], minDoses: 3 },
      { name: 'Hep B', cvxCodes: ['08', '44', '45', '51', '110'], minDoses: 3 },
      { name: 'VZV', cvxCodes: ['21', '94'], minDoses: 1 },
      { name: 'PCV', cvxCodes: ['133', '152'], minDoses: 4 },
      { name: 'Hep A', cvxCodes: ['83', '84', '85'], minDoses: 1 },
      { name: 'Rotavirus', cvxCodes: ['116', '119'], minDoses: 2 },
      { name: 'Influenza', cvxCodes: ['88', '140', '141', '150', '153', '155', '158', '161', '171', '185', '186', '197'], minDoses: 2 },
    ];

    // Check each child for complete immunizations
    const numeratorPatients: string[] = [];
    const excludedPatients: string[] = [];

    for (const patientId of denominatorPatients) {
      // Get patient DOB to calculate 2nd birthday cutoff
      const patientRow = await this.db('patients')
        .where({ id: patientId })
        .first<{ date_of_birth: string }>();

      if (!patientRow?.date_of_birth) {
        continue;
      }

      const secondBirthday = new Date(patientRow.date_of_birth);
      secondBirthday.setFullYear(secondBirthday.getFullYear() + 2);
      const cutoff = secondBirthday.toISOString();

      // Get all immunizations before 2nd birthday
      const immunizations = await this.db('immunizations')
        .where({ patient_id: patientId, status: 'completed' })
        .where('occurrence_date_time', '<=', cutoff)
        .select('vaccine_code');

      const vaccineCodes = immunizations.map(
        (imm: { vaccine_code: string }) => imm.vaccine_code
      );

      // Check each required vaccine
      let allComplete = true;
      for (const req of requiredVaccines) {
        const doseCount = vaccineCodes.filter((code: string) =>
          req.cvxCodes.includes(code)
        ).length;
        if (doseCount < req.minDoses) {
          allComplete = false;
          break;
        }
      }

      if (allComplete) {
        numeratorPatients.push(patientId);
      }
    }

    const denominator = denominatorPatients.length;
    const numerator = numeratorPatients.length;
    const rate = denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;

    return {
      measureId: 'CMS117v12',
      measureName: 'Childhood Immunization Status',
      description:
        'Percentage of children turning 2 during the measurement period with all required immunizations.',
      numerator,
      denominator,
      exclusions: excludedPatients.length,
      exceptions: 0,
      rate,
      period,
      patients: {
        inNumerator: numeratorPatients,
        inDenominator: denominatorPatients,
        excluded: excludedPatients,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // CMS347v7 - Statin Therapy for Cardiovascular Disease Prevention
  // Denominator: High-risk patients (ASCVD, LDL >= 190, diabetes age 40-75)
  // Numerator: Patients prescribed or on statin therapy
  // ---------------------------------------------------------------------------

  private async calculateCMS347(
    period: { start: string; end: string }
  ): Promise<MeasureResult> {
    // Group 1: Patients >= 21 with ASCVD
    // ASCVD ICD-10 codes: I20-I25 (ischemic heart disease), I63 (cerebral infarction),
    // I65-I66 (occlusion of cerebral/precerebral arteries), I73.9 (PVD)
    const ascvdPatients = await this.db('patients')
      .join('conditions', 'patients.id', 'conditions.patient_id')
      .where(function (this: Knex.QueryBuilder) {
        this.whereRaw("conditions.code_code LIKE 'I20%'")
          .orWhereRaw("conditions.code_code LIKE 'I21%'")
          .orWhereRaw("conditions.code_code LIKE 'I22%'")
          .orWhereRaw("conditions.code_code LIKE 'I23%'")
          .orWhereRaw("conditions.code_code LIKE 'I24%'")
          .orWhereRaw("conditions.code_code LIKE 'I25%'")
          .orWhereRaw("conditions.code_code LIKE 'I63%'")
          .orWhereRaw("conditions.code_code LIKE 'I65%'")
          .orWhereRaw("conditions.code_code LIKE 'I66%'")
          .orWhere('conditions.code_code', 'I73.9');
      })
      .whereIn('conditions.clinical_status', ['active', 'recurrence', 'relapse'])
      .whereRaw(
        `DATE_PART('year', AGE(CAST(? AS DATE), CAST(patients.date_of_birth AS DATE))) >= 21`,
        [period.start]
      )
      .where('patients.active', true)
      .distinct('patients.id')
      .pluck('patients.id');

    // Group 2: Patients >= 21 with LDL >= 190 mg/dL (LOINC 13457-7 or 18262-6)
    const highLDLPatients = await this.db('patients')
      .join('observations', 'patients.id', 'observations.patient_id')
      .whereIn('observations.code_code', ['13457-7', '18262-6'])
      .where('observations.value_quantity_value', '>=', 190)
      .where('observations.effective_date_time', '>=', period.start)
      .where('observations.effective_date_time', '<=', period.end)
      .whereRaw(
        `DATE_PART('year', AGE(CAST(? AS DATE), CAST(patients.date_of_birth AS DATE))) >= 21`,
        [period.start]
      )
      .where('patients.active', true)
      .distinct('patients.id')
      .pluck('patients.id');

    // Group 3: Patients 40-75 with diabetes
    const diabetesStatinPatients = await this.db('patients')
      .join('conditions', 'patients.id', 'conditions.patient_id')
      .where(function (this: Knex.QueryBuilder) {
        this.whereRaw("conditions.code_code LIKE 'E10%'")
          .orWhereRaw("conditions.code_code LIKE 'E11%'")
          .orWhereRaw("conditions.code_code LIKE 'E13%'");
      })
      .whereIn('conditions.clinical_status', ['active', 'recurrence', 'relapse'])
      .whereRaw(
        `DATE_PART('year', AGE(CAST(? AS DATE), CAST(patients.date_of_birth AS DATE))) BETWEEN 40 AND 75`,
        [period.start]
      )
      .where('patients.active', true)
      .distinct('patients.id')
      .pluck('patients.id');

    // Combine all three groups into unique denominator
    const allDenominator = new Set([
      ...ascvdPatients,
      ...highLDLPatients,
      ...diabetesStatinPatients,
    ]);
    const denominatorPatients = Array.from(allDenominator);

    // Exclusions: patients with statin allergy, active pregnancy, breastfeeding,
    // rhabdomyolysis (T79.6), or hepatic disease (K70-K77)
    const excludedPatients = await this.db('conditions')
      .whereIn('patient_id', denominatorPatients)
      .where(function (this: Knex.QueryBuilder) {
        this.whereRaw("code_code LIKE 'O%'") // Pregnancy
          .orWhereRaw("code_code LIKE 'K7%'") // Hepatic disease
          .orWhere('code_code', 'T79.6'); // Rhabdomyolysis
      })
      .whereIn('clinical_status', ['active'])
      .distinct('patient_id')
      .pluck('patient_id');

    // Also check for statin allergies
    const statinAllergyPatients = await this.db('allergy_intolerances')
      .whereIn('patient_id', denominatorPatients)
      .where(function (this: Knex.QueryBuilder) {
        this.whereRaw(
          "LOWER(code_display) LIKE '%statin%' OR LOWER(code_display) LIKE '%atorvastatin%' OR LOWER(code_display) LIKE '%simvastatin%' OR LOWER(code_display) LIKE '%rosuvastatin%' OR LOWER(code_display) LIKE '%pravastatin%' OR LOWER(code_display) LIKE '%lovastatin%' OR LOWER(code_display) LIKE '%fluvastatin%' OR LOWER(code_display) LIKE '%pitavastatin%'"
        );
      })
      .distinct('patient_id')
      .pluck('patient_id');

    const allExcluded = new Set([...excludedPatients, ...statinAllergyPatients]);
    const eligiblePatients = denominatorPatients.filter(
      (id) => !allExcluded.has(id)
    );

    // Numerator: patients prescribed statin therapy during the measurement period
    const statinNames = [
      'atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin',
      'lovastatin', 'fluvastatin', 'pitavastatin',
    ];
    const statinLikePattern = statinNames
      .map((s) => `LOWER(medication_display) LIKE '%${s}%'`)
      .join(' OR ');

    const numeratorPatients = await this.db('medication_requests')
      .whereIn('patient_id', eligiblePatients)
      .whereIn('status', ['active', 'completed'])
      .whereRaw(`(${statinLikePattern})`)
      .where(function (this: Knex.QueryBuilder) {
        this.where('authored_on', '>=', period.start)
          .orWhere('authored_on', '<=', period.end);
      })
      .distinct('patient_id')
      .pluck('patient_id');

    const denominator = eligiblePatients.length;
    const numerator = numeratorPatients.length;
    const rate = denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;

    return {
      measureId: 'CMS347v7',
      measureName: 'Statin Therapy for the Prevention and Treatment of Cardiovascular Disease',
      description:
        'Percentage of high-risk cardiovascular patients prescribed statin therapy.',
      numerator,
      denominator,
      exclusions: Array.from(allExcluded).length,
      exceptions: 0,
      rate,
      period,
      patients: {
        inNumerator: numeratorPatients,
        inDenominator: eligiblePatients,
        excluded: Array.from(allExcluded),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // QRDA Category I (individual patient) export
  // ---------------------------------------------------------------------------

  async exportQRDAI(
    patientId: string,
    measureId: string,
    period: { start: string; end: string }
  ): Promise<QRDADocument> {
    try {
      const definition = this.measureDefinitions.get(measureId);
      if (!definition) {
        throw new NotFoundError('Quality Measure', measureId);
      }

      // Get patient data
      const patient = await this.db('patients')
        .where({ id: patientId })
        .first();

      if (!patient) {
        throw new NotFoundError('Patient', patientId);
      }

      // Calculate the measure to determine if this patient is in the numerator
      const result = await definition.calculator(period);
      const inNumerator = result.patients.inNumerator.includes(patientId);
      const inDenominator = result.patients.inDenominator.includes(patientId);
      const isExcluded = result.patients.excluded.includes(patientId);

      const now = new Date().toISOString();
      const documentId = uuidv4();

      // Generate QRDA Category I XML
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<?xml-stylesheet type="text/xsl" href="qrda.xsl"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:voc="urn:hl7-org:v3/voc" xmlns:sdtc="urn:hl7-org:sdtc">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <!-- QRDA Category I Report -->
  <templateId root="2.16.840.1.113883.10.20.24.1.1" extension="2017-08-01"/>
  <!-- QDM-based QRDA -->
  <templateId root="2.16.840.1.113883.10.20.24.1.2" extension="2019-12-01"/>
  <!-- US Realm Header -->
  <templateId root="2.16.840.1.113883.10.20.22.1.1" extension="2015-08-01"/>
  <id root="${documentId}"/>
  <code code="55182-0" codeSystem="2.16.840.1.113883.6.1"
    displayName="Quality Measure Report"/>
  <title>QRDA Category I Report - ${definition.name}</title>
  <effectiveTime value="${this.formatCDATimestamp(now)}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="en"/>
  <!-- Patient (recordTarget) -->
  <recordTarget>
    <patientRole>
      <id extension="${patient.mrn || patient.id}" root="2.16.840.1.113883.19.5"/>
      <addr use="HP">
        <streetAddressLine>${this.escapeXml(patient.address_street || '')}</streetAddressLine>
        <city>${this.escapeXml(patient.address_city || '')}</city>
        <state>${this.escapeXml(patient.address_state || '')}</state>
        <postalCode>${this.escapeXml(patient.address_zip || '')}</postalCode>
        <country>US</country>
      </addr>
      <telecom use="HP" value="tel:${this.escapeXml(patient.phone_home || '')}"/>
      <patient>
        <name use="L">
          <given>${this.escapeXml(patient.first_name)}</given>
          <family>${this.escapeXml(patient.last_name)}</family>
        </name>
        <administrativeGenderCode code="${this.mapGenderToCDA(patient.gender)}"
          codeSystem="2.16.840.1.113883.5.1"/>
        <birthTime value="${this.formatCDADate(patient.date_of_birth || '')}"/>
        <raceCode code="${patient.race || '2106-3'}" codeSystem="2.16.840.1.113883.6.238"
          displayName="${patient.race || 'White'}"/>
        <ethnicGroupCode code="${patient.ethnicity || '2186-5'}"
          codeSystem="2.16.840.1.113883.6.238"
          displayName="${patient.ethnicity || 'Not Hispanic or Latino'}"/>
      </patient>
    </patientRole>
  </recordTarget>
  <!-- Custodian -->
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id root="2.16.840.1.113883.19.5"/>
        <name>Tribal Health Facility</name>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>
  <!-- Reporting Parameters -->
  <component>
    <structuredBody>
      <component>
        <section>
          <!-- Reporting Parameters Section -->
          <templateId root="2.16.840.1.113883.10.20.17.2.1"/>
          <code code="55187-9" codeSystem="2.16.840.1.113883.6.1"/>
          <title>Reporting Parameters</title>
          <text>
            <list>
              <item>Reporting Period: ${period.start} - ${period.end}</item>
            </list>
          </text>
          <entry typeCode="DRIV">
            <act classCode="ACT" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.17.3.8"/>
              <id root="${uuidv4()}"/>
              <code code="252116004" codeSystem="2.16.840.1.113883.6.96"
                displayName="Observation Parameters"/>
              <effectiveTime>
                <low value="${this.formatCDATimestamp(period.start)}"/>
                <high value="${this.formatCDATimestamp(period.end)}"/>
              </effectiveTime>
            </act>
          </entry>
        </section>
      </component>
      <component>
        <section>
          <!-- Measure Section -->
          <templateId root="2.16.840.1.113883.10.20.24.2.2"/>
          <code code="55186-1" codeSystem="2.16.840.1.113883.6.1"/>
          <title>Measure Section</title>
          <text>
            <table border="1" width="100%">
              <thead>
                <tr>
                  <th>eMeasure Identifier</th>
                  <th>Measure Name</th>
                  <th>In Denominator</th>
                  <th>In Numerator</th>
                  <th>Excluded</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${measureId}</td>
                  <td>${this.escapeXml(definition.name)}</td>
                  <td>${inDenominator ? 'Yes' : 'No'}</td>
                  <td>${inNumerator ? 'Yes' : 'No'}</td>
                  <td>${isExcluded ? 'Yes' : 'No'}</td>
                </tr>
              </tbody>
            </table>
          </text>
          <entry>
            <organizer classCode="CLUSTER" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.24.3.98"/>
              <id root="${uuidv4()}"/>
              <statusCode code="completed"/>
              <reference typeCode="REFR">
                <externalDocument classCode="DOC" moodCode="EVN">
                  <id root="${measureId}"/>
                  <text>${this.escapeXml(definition.name)}</text>
                </externalDocument>
              </reference>
              <!-- Population criteria -->
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <code code="DENOM" codeSystem="2.16.840.1.113883.5.4"
                    displayName="Denominator"/>
                  <value xsi:type="CD" code="${inDenominator ? '1' : '0'}"
                    codeSystem="2.16.840.1.113883.5.1063"/>
                </observation>
              </component>
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <code code="NUMER" codeSystem="2.16.840.1.113883.5.4"
                    displayName="Numerator"/>
                  <value xsi:type="CD" code="${inNumerator ? '1' : '0'}"
                    codeSystem="2.16.840.1.113883.5.1063"/>
                </observation>
              </component>
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <code code="DENEXCL" codeSystem="2.16.840.1.113883.5.4"
                    displayName="Denominator Exclusion"/>
                  <value xsi:type="CD" code="${isExcluded ? '1' : '0'}"
                    codeSystem="2.16.840.1.113883.5.1063"/>
                </observation>
              </component>
            </organizer>
          </entry>
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>`;

      this.logger.info('QRDA Category I exported', {
        patientId,
        measureId,
        inNumerator,
        inDenominator,
      });

      return {
        format: 'QRDA-I',
        content: xml,
        generatedAt: now,
      };
    } catch (error) {
      this.handleError('Failed to export QRDA Category I', error);
    }
  }

  // ---------------------------------------------------------------------------
  // QRDA Category III (aggregate) export
  // ---------------------------------------------------------------------------

  async exportQRDAIII(
    measureIds: string[],
    period: { start: string; end: string }
  ): Promise<QRDADocument> {
    try {
      const validMeasureIds = measureIds.length > 0
        ? measureIds
        : Array.from(this.measureDefinitions.keys());

      // Calculate all requested measures
      const measureResults: MeasureResult[] = [];
      for (const measureId of validMeasureIds) {
        const definition = this.measureDefinitions.get(measureId);
        if (definition) {
          const result = await definition.calculator(period);
          measureResults.push(result);
        }
      }

      const now = new Date().toISOString();
      const documentId = uuidv4();

      // Build measure entries XML
      const measureEntriesXml = measureResults
        .map(
          (result) => `
      <component>
        <section>
          <!-- Measure Section -->
          <templateId root="2.16.840.1.113883.10.20.27.2.1" extension="2017-06-01"/>
          <code code="55186-1" codeSystem="2.16.840.1.113883.6.1"/>
          <title>${this.escapeXml(result.measureName)}</title>
          <text>
            <table border="1" width="100%">
              <thead>
                <tr>
                  <th>Measure</th>
                  <th>Denominator</th>
                  <th>Numerator</th>
                  <th>Exclusions</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${result.measureId}</td>
                  <td>${result.denominator}</td>
                  <td>${result.numerator}</td>
                  <td>${result.exclusions}</td>
                  <td>${result.rate}%</td>
                </tr>
              </tbody>
            </table>
          </text>
          <entry>
            <organizer classCode="CLUSTER" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.27.3.1" extension="2017-06-01"/>
              <id root="${uuidv4()}"/>
              <statusCode code="completed"/>
              <reference typeCode="REFR">
                <externalDocument classCode="DOC" moodCode="EVN">
                  <id root="${result.measureId}"/>
                  <text>${this.escapeXml(result.measureName)}</text>
                </externalDocument>
              </reference>
              <!-- Initial Population -->
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.5" extension="2016-09-01"/>
                  <code code="MSRPOPL" codeSystem="2.16.840.1.113883.5.4"
                    displayName="Measure Population"/>
                  <statusCode code="completed"/>
                  <value xsi:type="INT" value="${result.denominator + result.exclusions}"/>
                </observation>
              </component>
              <!-- Denominator -->
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.3"/>
                  <code code="DENOM" codeSystem="2.16.840.1.113883.5.4"
                    displayName="Denominator"/>
                  <statusCode code="completed"/>
                  <value xsi:type="INT" value="${result.denominator}"/>
                </observation>
              </component>
              <!-- Numerator -->
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.3"/>
                  <code code="NUMER" codeSystem="2.16.840.1.113883.5.4"
                    displayName="Numerator"/>
                  <statusCode code="completed"/>
                  <value xsi:type="INT" value="${result.numerator}"/>
                </observation>
              </component>
              <!-- Denominator Exclusions -->
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.3"/>
                  <code code="DENEXCL" codeSystem="2.16.840.1.113883.5.4"
                    displayName="Denominator Exclusion"/>
                  <statusCode code="completed"/>
                  <value xsi:type="INT" value="${result.exclusions}"/>
                </observation>
              </component>
              <!-- Performance Rate -->
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.27.3.14" extension="2016-09-01"/>
                  <code code="72510-1" codeSystem="2.16.840.1.113883.6.1"
                    displayName="Performance Rate"/>
                  <statusCode code="completed"/>
                  <value xsi:type="REAL" value="${(result.rate / 100).toFixed(4)}"/>
                </observation>
              </component>
            </organizer>
          </entry>
        </section>
      </component>`
        )
        .join('\n');

      const xml = `<?xml version="1.0" encoding="utf-8"?>
<?xml-stylesheet type="text/xsl" href="qrda.xsl"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:voc="urn:hl7-org:v3/voc" xmlns:sdtc="urn:hl7-org:sdtc">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <!-- QRDA Category III Report -->
  <templateId root="2.16.840.1.113883.10.20.27.1.1" extension="2017-06-01"/>
  <!-- US Realm Header -->
  <templateId root="2.16.840.1.113883.10.20.22.1.1" extension="2015-08-01"/>
  <id root="${documentId}"/>
  <code code="55184-6" codeSystem="2.16.840.1.113883.6.1"
    displayName="Quality Reporting Document Architecture Calculated Summary Report"/>
  <title>QRDA Category III Report - Tribal EHR</title>
  <effectiveTime value="${this.formatCDATimestamp(now)}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="en"/>
  <!-- Custodian -->
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id root="2.16.840.1.113883.19.5"/>
        <name>Tribal Health Facility</name>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>
  <!-- Legal Authenticator -->
  <legalAuthenticator>
    <time value="${this.formatCDATimestamp(now)}"/>
    <signatureCode code="S"/>
    <assignedEntity>
      <id root="2.16.840.1.113883.19.5"/>
      <representedOrganization>
        <name>Tribal Health Facility</name>
      </representedOrganization>
    </assignedEntity>
  </legalAuthenticator>
  <component>
    <structuredBody>
      <!-- Reporting Parameters -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.17.2.1"/>
          <code code="55187-9" codeSystem="2.16.840.1.113883.6.1"/>
          <title>Reporting Parameters</title>
          <text>
            <list>
              <item>Reporting Period: ${period.start} - ${period.end}</item>
            </list>
          </text>
          <entry typeCode="DRIV">
            <act classCode="ACT" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.17.3.8"/>
              <id root="${uuidv4()}"/>
              <code code="252116004" codeSystem="2.16.840.1.113883.6.96"
                displayName="Observation Parameters"/>
              <effectiveTime>
                <low value="${this.formatCDATimestamp(period.start)}"/>
                <high value="${this.formatCDATimestamp(period.end)}"/>
              </effectiveTime>
            </act>
          </entry>
        </section>
      </component>
      <!-- Measure Sections -->
${measureEntriesXml}
    </structuredBody>
  </component>
</ClinicalDocument>`;

      this.logger.info('QRDA Category III exported', {
        measureCount: measureResults.length,
        period,
      });

      return {
        format: 'QRDA-III',
        content: xml,
        generatedAt: now,
      };
    } catch (error) {
      this.handleError('Failed to export QRDA Category III', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Dashboard - aggregated quality measure summary
  // ---------------------------------------------------------------------------

  async getDashboard(
    period: { start: string; end: string }
  ): Promise<{
    measures: MeasureResult[];
    summary: {
      totalMeasures: number;
      averageRate: number;
      measuresAboveThreshold: number;
      measuresBelowThreshold: number;
    };
  }> {
    try {
      const measures = await this.calculateAllMeasures(period);
      const threshold = 70; // 70% performance threshold

      const rates = measures
        .filter((m) => m.denominator > 0)
        .map((m) => m.rate);
      const averageRate =
        rates.length > 0
          ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100
          : 0;

      return {
        measures,
        summary: {
          totalMeasures: measures.length,
          averageRate,
          measuresAboveThreshold: measures.filter(
            (m) => m.denominator > 0 && m.rate >= threshold
          ).length,
          measuresBelowThreshold: measures.filter(
            (m) => m.denominator > 0 && m.rate < threshold
          ).length,
        },
      };
    } catch (error) {
      this.handleError('Failed to get quality measures dashboard', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private addMonths(dateStr: string, months: number): string {
    const date = new Date(dateStr);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split('T')[0];
  }

  private addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  private formatCDATimestamp(dateStr: string): string {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  private formatCDADate(dateStr: string): string {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private mapGenderToCDA(gender?: string): string {
    if (!gender) return 'UN';
    switch (gender.toLowerCase()) {
      case 'male':
        return 'M';
      case 'female':
        return 'F';
      default:
        return 'UN';
    }
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const qualityMeasuresService = new QualityMeasuresService();
