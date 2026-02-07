// =============================================================================
// Medication Safety Service
// Tall Man lettering, high-risk medication identification, dose range checking,
// weight-based dosing, and renal dose adjustments
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Data Constants
// -----------------------------------------------------------------------------

// ISMP-approved Tall Man Lettering pairs
const TALL_MAN_LETTERING_MAP: Record<string, string> = {
  'hydralazine': 'hydrALAZINE',
  'hydroxyzine': 'hydrOXYzine',
  'prednisone': 'predniSONE',
  'prednisolone': 'prednisoLONE',
  'vinblastine': 'vinBLAStine',
  'vincristine': 'vinCRIStine',
  'chlorpromazine': 'chlorproMAZINE',
  'chlorpropamide': 'chlorproPAMIDE',
  'clomiphene': 'clomiPHENE',
  'clomipramine': 'clomiPRAMINE',
  'cyclosporine': 'cycloSPORINE',
  'cycloserine': 'cycloSERINE',
  'daunorubicin': 'DAUNOrubicin',
  'doxorubicin': 'DOXOrubicin',
  'glipizide': 'glipiZIDE',
  'glyburide': 'glyBURIDE',
  'methylprednisolone': 'methylPREDNISolone',
  'medroxyprogesterone': 'medroxyPROGESTERone',
  'sulfadiazine': 'sulfADIAZINE',
  'sulfisoxazole': 'sulfiSOXAZOLE',
  'tolazamide': 'TOLAZamide',
  'tolbutamide': 'TOLBUTamide',
  'acetazolamide': 'acetaZOLAMIDE',
  'acetohydroxamic acid': 'acetoHYDROXAMIC acid',
  'bupropion': 'buPROPion',
  'buspirone': 'busPIRone',
  'cefazolin': 'ceFAZolin',
  'ceftriaxone': 'cefTRIAXone',
  'diazepam': 'diazePAM',
  'diltiazem': 'dilTIAZem',
  'dopamine': 'DOPamine',
  'dobutamine': 'DOBUTamine',
  'ephedrine': 'ePHEDrine',
  'epinephrine': 'EPINEPHrine',
  'fentanyl': 'fentaNYL',
  'sufentanil': 'SUFentanil',
};

// ISMP High-Alert Medications (by RxNorm code)
const ISMP_HIGH_ALERT_MEDICATIONS: Record<string, string> = {
  '11289': 'Warfarin',
  '4337': 'Heparin',
  '67108': 'Enoxaparin',
  '5521': 'Insulin',
  '7804': 'Morphine',
  '7646': 'Oxycodone',
  '3640': 'Fentanyl',
  '3423': 'Hydrocodone',
  '10582': 'Tramadol',
  '6813': 'Methotrexate',
  '3995': 'Digoxin',
  '2002': 'Phenelzine',
  '1886': 'Citalopram',
  '596': 'Alprazolam',
  '2551': 'Diazepam',
};

// Maximum daily doses by RxNorm code
const MAX_DAILY_DOSES: Record<string, { maxDaily: number; unit: string; name: string; frequency?: number }> = {
  '161': { maxDaily: 4000, unit: 'mg', name: 'Acetaminophen' },
  '5487': { maxDaily: 3200, unit: 'mg', name: 'Ibuprofen' },
  '6918': { maxDaily: 2550, unit: 'mg', name: 'Metformin' },
  '35296': { maxDaily: 80, unit: 'mg', name: 'Lisinopril' },
  '36567': { maxDaily: 80, unit: 'mg', name: 'Simvastatin' },
  '83367': { maxDaily: 80, unit: 'mg', name: 'Atorvastatin' },
  '7804': { maxDaily: 200, unit: 'mg', name: 'Morphine (oral)' },
  '7646': { maxDaily: 160, unit: 'mg', name: 'Oxycodone' },
  '3995': { maxDaily: 0.5, unit: 'mg', name: 'Digoxin' },
  '11289': { maxDaily: 10, unit: 'mg', name: 'Warfarin' },
};

// Drugs requiring renal dose adjustment
const RENAL_DOSE_ADJUSTMENTS: Record<string, { gfrThreshold: number; adjustment: string; name: string }> = {
  '6918': { gfrThreshold: 30, adjustment: 'Contraindicated if GFR < 30', name: 'Metformin' },
  '3995': { gfrThreshold: 50, adjustment: 'Reduce dose by 50% if GFR < 50', name: 'Digoxin' },
  '6813': { gfrThreshold: 30, adjustment: 'Reduce dose if GFR < 30, contraindicated if GFR < 15', name: 'Methotrexate' },
  '67108': { gfrThreshold: 30, adjustment: 'Reduce dose if GFR < 30', name: 'Enoxaparin' },
  '161': { gfrThreshold: 10, adjustment: 'Avoid or reduce frequency if GFR < 10', name: 'Acetaminophen' },
};

// Weight-based dosing drugs (pediatric/weight-sensitive)
const WEIGHT_BASED_DRUGS: Record<string, { mgPerKg: number; maxDose: number; unit: string; name: string }> = {
  '161': { mgPerKg: 15, maxDose: 1000, unit: 'mg', name: 'Acetaminophen' },
  '5487': { mgPerKg: 10, maxDose: 800, unit: 'mg', name: 'Ibuprofen' },
  '733': { mgPerKg: 50, maxDose: 3000, unit: 'mg', name: 'Amoxicillin' },
  '1721': { mgPerKg: 45, maxDose: 2000, unit: 'mg', name: 'Amoxicillin-Clavulanate' },
  '2180': { mgPerKg: 30, maxDose: 2000, unit: 'mg', name: 'Cephalexin' },
};

// -----------------------------------------------------------------------------
// Interfaces
// -----------------------------------------------------------------------------

export interface MedicationSafetyAlert {
  type: 'tall-man' | 'high-alert' | 'max-dose' | 'renal-dose' | 'weight-based';
  severity: 'info' | 'warning' | 'critical';
  summary: string;
  detail: string;
  drugName: string;
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class MedicationSafetyService extends BaseService {
  constructor() {
    super('MedicationSafetyService');
  }

  /**
   * Look up a drug name in the ISMP Tall Man Lettering map (case-insensitive).
   * Returns the Tall Man version if found, otherwise the original name.
   */
  formatTallMan(drugName: string): string {
    const key = drugName.toLowerCase();
    return TALL_MAN_LETTERING_MAP[key] || drugName;
  }

  /**
   * Check if an RxNorm code is in the ISMP High-Alert Medications list.
   */
  isHighAlert(rxnormCode: string): boolean {
    return rxnormCode in ISMP_HIGH_ALERT_MEDICATIONS;
  }

  /**
   * Return the high-alert drug name for an RxNorm code, or null if not high-alert.
   */
  getHighAlertName(rxnormCode: string): string | null {
    return ISMP_HIGH_ALERT_MEDICATIONS[rxnormCode] || null;
  }

  /**
   * Check if the calculated daily dose exceeds the maximum daily dose for a drug.
   * Daily dose = dosePerAdmin * frequencyPerDay.
   */
  checkMaxDailyDose(
    rxnormCode: string,
    dosePerAdmin: number,
    unit: string,
    frequencyPerDay: number
  ): MedicationSafetyAlert[] {
    const alerts: MedicationSafetyAlert[] = [];
    const doseInfo = MAX_DAILY_DOSES[rxnormCode];

    if (!doseInfo) {
      return alerts;
    }

    const dailyDose = dosePerAdmin * frequencyPerDay;

    if (dailyDose > doseInfo.maxDaily) {
      alerts.push({
        type: 'max-dose',
        severity: 'critical',
        summary: `Daily dose of ${doseInfo.name} exceeds maximum`,
        detail: `Calculated daily dose is ${dailyDose} ${unit} (${dosePerAdmin} ${unit} x ${frequencyPerDay}/day). ` +
          `Maximum recommended daily dose is ${doseInfo.maxDaily} ${doseInfo.unit}.`,
        drugName: doseInfo.name,
      });
    }

    return alerts;
  }

  /**
   * Check if a drug requires renal dose adjustment based on the patient's GFR.
   */
  checkRenalDosing(rxnormCode: string, gfr: number): MedicationSafetyAlert[] {
    const alerts: MedicationSafetyAlert[] = [];
    const renalInfo = RENAL_DOSE_ADJUSTMENTS[rxnormCode];

    if (!renalInfo) {
      return alerts;
    }

    if (gfr < renalInfo.gfrThreshold) {
      alerts.push({
        type: 'renal-dose',
        severity: 'warning',
        summary: `Renal dose adjustment needed for ${renalInfo.name}`,
        detail: `Patient GFR is ${gfr} mL/min. ${renalInfo.adjustment}.`,
        drugName: renalInfo.name,
      });
    }

    return alerts;
  }

  /**
   * Check weight-based dosing. Calculate recommended dose = mgPerKg * weight,
   * capped at maxDose. If ordered dose exceeds recommended by more than 10%, warn.
   */
  checkWeightBasedDosing(
    rxnormCode: string,
    doseOrdered: number,
    unit: string,
    patientWeightKg: number
  ): MedicationSafetyAlert[] {
    const alerts: MedicationSafetyAlert[] = [];
    const weightInfo = WEIGHT_BASED_DRUGS[rxnormCode];

    if (!weightInfo) {
      return alerts;
    }

    const recommendedDose = Math.min(weightInfo.mgPerKg * patientWeightKg, weightInfo.maxDose);
    const threshold = recommendedDose * 1.1;

    if (doseOrdered > threshold) {
      alerts.push({
        type: 'weight-based',
        severity: 'warning',
        summary: `Dose of ${weightInfo.name} exceeds weight-based recommendation`,
        detail: `Ordered dose is ${doseOrdered} ${unit}. ` +
          `Recommended dose for ${patientWeightKg} kg patient is ${recommendedDose.toFixed(1)} ${weightInfo.unit} ` +
          `(${weightInfo.mgPerKg} ${weightInfo.unit}/kg, max ${weightInfo.maxDose} ${weightInfo.unit}).`,
        drugName: weightInfo.name,
      });
    }

    return alerts;
  }

  /**
   * Run all applicable medication safety checks and return combined alerts.
   */
  runAllChecks(params: {
    rxnormCode: string;
    drugName: string;
    dosePerAdmin: number;
    unit: string;
    frequencyPerDay: number;
    patientWeightKg?: number;
    gfr?: number;
  }): MedicationSafetyAlert[] {
    const alerts: MedicationSafetyAlert[] = [];

    // Tall Man lettering check
    const tallManName = this.formatTallMan(params.drugName);
    if (tallManName !== params.drugName) {
      alerts.push({
        type: 'tall-man',
        severity: 'info',
        summary: `Tall Man lettering: ${tallManName}`,
        detail: `This drug has an ISMP-approved Tall Man lettering designation to help distinguish it from look-alike drug names.`,
        drugName: tallManName,
      });
    }

    // High-alert medication check
    if (this.isHighAlert(params.rxnormCode)) {
      const highAlertName = this.getHighAlertName(params.rxnormCode)!;
      alerts.push({
        type: 'high-alert',
        severity: 'critical',
        summary: `${highAlertName} is an ISMP High-Alert Medication`,
        detail: `This medication is on the ISMP list of High-Alert Medications. ` +
          `Independent double-check verification is recommended before administration.`,
        drugName: highAlertName,
      });
    }

    // Max daily dose check
    alerts.push(
      ...this.checkMaxDailyDose(params.rxnormCode, params.dosePerAdmin, params.unit, params.frequencyPerDay)
    );

    // Renal dose check (if GFR provided)
    if (params.gfr !== undefined) {
      alerts.push(...this.checkRenalDosing(params.rxnormCode, params.gfr));
    }

    // Weight-based dosing check (if weight provided)
    if (params.patientWeightKg !== undefined) {
      alerts.push(
        ...this.checkWeightBasedDosing(params.rxnormCode, params.dosePerAdmin, params.unit, params.patientWeightKg)
      );
    }

    return alerts;
  }

  /**
   * Record a high-risk medication verification in the database.
   */
  async recordVerification(
    orderId: string,
    verifiedBy: string,
    verificationType: string,
    notes?: string
  ): Promise<void> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      await this.db('high_risk_medication_verifications').insert({
        id,
        order_id: orderId,
        verified_by: verifiedBy,
        verification_type: verificationType,
        verified_at: now,
        notes: notes || null,
      });

      this.logger.info('High-risk medication verification recorded', {
        orderId,
        verifiedBy,
        verificationType,
      });
    } catch (error) {
      this.handleError('Failed to record medication verification', error);
    }
  }

  /**
   * Retrieve all verifications for a given order.
   */
  async getVerifications(
    orderId: string
  ): Promise<Array<{ id: string; verifiedBy: string; verificationType: string; verifiedAt: string; notes?: string }>> {
    try {
      const rows = await this.db('high_risk_medication_verifications')
        .where('order_id', orderId)
        .orderBy('verified_at', 'desc')
        .select('*');

      return rows.map((row: any) => ({
        id: row.id,
        verifiedBy: row.verified_by,
        verificationType: row.verification_type,
        verifiedAt: row.verified_at,
        notes: row.notes || undefined,
      }));
    } catch (error) {
      this.handleError('Failed to get medication verifications', error);
    }
  }
}

export const medicationSafetyService = new MedicationSafetyService();
