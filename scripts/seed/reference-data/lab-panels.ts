// Lab panel reference data with LOINC codes

export interface LabTest {
  loincCode: string;
  display: string;
  unit: string;
  referenceRange: { low: number; high: number };
  criticalRange?: { low: number; high: number };
  normalValue: number;     // typical normal center point
  abnormalRange: { low: number; high: number }; // full possible value generation range
}

export interface LabPanel {
  name: string;
  loincCode: string; // panel LOINC code
  tests: LabTest[];
}

export const LAB_PANELS: Record<string, LabPanel> = {
  CBC: {
    name: 'Complete Blood Count',
    loincCode: '58410-2',
    tests: [
      {
        loincCode: '6690-2',
        display: 'WBC',
        unit: '10*3/uL',
        referenceRange: { low: 4.5, high: 11.0 },
        criticalRange: { low: 2.0, high: 30.0 },
        normalValue: 7.5,
        abnormalRange: { low: 2.0, high: 20.0 },
      },
      {
        loincCode: '789-8',
        display: 'RBC',
        unit: '10*6/uL',
        referenceRange: { low: 4.2, high: 5.9 },
        criticalRange: { low: 2.5, high: 8.0 },
        normalValue: 4.8,
        abnormalRange: { low: 3.0, high: 6.5 },
      },
      {
        loincCode: '718-7',
        display: 'Hemoglobin',
        unit: 'g/dL',
        referenceRange: { low: 12.0, high: 17.5 },
        criticalRange: { low: 7.0, high: 20.0 },
        normalValue: 14.5,
        abnormalRange: { low: 8.0, high: 19.0 },
      },
      {
        loincCode: '4544-3',
        display: 'Hematocrit',
        unit: '%',
        referenceRange: { low: 36, high: 50 },
        criticalRange: { low: 20, high: 60 },
        normalValue: 42,
        abnormalRange: { low: 25, high: 55 },
      },
      {
        loincCode: '777-3',
        display: 'Platelet Count',
        unit: '10*3/uL',
        referenceRange: { low: 150, high: 400 },
        criticalRange: { low: 50, high: 1000 },
        normalValue: 250,
        abnormalRange: { low: 100, high: 500 },
      },
      {
        loincCode: '787-2',
        display: 'MCV',
        unit: 'fL',
        referenceRange: { low: 80, high: 100 },
        normalValue: 90,
        abnormalRange: { low: 70, high: 110 },
      },
    ],
  },

  CMP: {
    name: 'Comprehensive Metabolic Panel',
    loincCode: '24323-8',
    tests: [
      {
        loincCode: '2345-7',
        display: 'Glucose',
        unit: 'mg/dL',
        referenceRange: { low: 70, high: 100 },
        criticalRange: { low: 40, high: 500 },
        normalValue: 90,
        abnormalRange: { low: 50, high: 350 },
      },
      {
        loincCode: '3094-0',
        display: 'BUN',
        unit: 'mg/dL',
        referenceRange: { low: 7, high: 20 },
        criticalRange: { low: 2, high: 100 },
        normalValue: 14,
        abnormalRange: { low: 5, high: 50 },
      },
      {
        loincCode: '2160-0',
        display: 'Creatinine',
        unit: 'mg/dL',
        referenceRange: { low: 0.7, high: 1.3 },
        criticalRange: { low: 0.2, high: 10.0 },
        normalValue: 1.0,
        abnormalRange: { low: 0.4, high: 4.0 },
      },
      {
        loincCode: '2951-2',
        display: 'Sodium',
        unit: 'mEq/L',
        referenceRange: { low: 136, high: 145 },
        criticalRange: { low: 120, high: 160 },
        normalValue: 140,
        abnormalRange: { low: 128, high: 155 },
      },
      {
        loincCode: '2823-3',
        display: 'Potassium',
        unit: 'mEq/L',
        referenceRange: { low: 3.5, high: 5.0 },
        criticalRange: { low: 2.5, high: 6.5 },
        normalValue: 4.2,
        abnormalRange: { low: 3.0, high: 6.0 },
      },
      {
        loincCode: '2075-0',
        display: 'Chloride',
        unit: 'mEq/L',
        referenceRange: { low: 98, high: 106 },
        normalValue: 102,
        abnormalRange: { low: 90, high: 115 },
      },
      {
        loincCode: '2028-9',
        display: 'CO2',
        unit: 'mEq/L',
        referenceRange: { low: 22, high: 29 },
        normalValue: 25,
        abnormalRange: { low: 15, high: 35 },
      },
      {
        loincCode: '17861-6',
        display: 'Calcium',
        unit: 'mg/dL',
        referenceRange: { low: 8.5, high: 10.5 },
        criticalRange: { low: 6.0, high: 13.0 },
        normalValue: 9.5,
        abnormalRange: { low: 7.0, high: 12.0 },
      },
      {
        loincCode: '2885-2',
        display: 'Total Protein',
        unit: 'g/dL',
        referenceRange: { low: 6.0, high: 8.3 },
        normalValue: 7.0,
        abnormalRange: { low: 4.5, high: 9.5 },
      },
      {
        loincCode: '1751-7',
        display: 'Albumin',
        unit: 'g/dL',
        referenceRange: { low: 3.5, high: 5.0 },
        normalValue: 4.2,
        abnormalRange: { low: 2.0, high: 5.5 },
      },
      {
        loincCode: '1920-8',
        display: 'AST',
        unit: 'U/L',
        referenceRange: { low: 10, high: 40 },
        criticalRange: { low: 5, high: 1000 },
        normalValue: 25,
        abnormalRange: { low: 8, high: 120 },
      },
      {
        loincCode: '1742-6',
        display: 'ALT',
        unit: 'U/L',
        referenceRange: { low: 7, high: 56 },
        criticalRange: { low: 3, high: 1000 },
        normalValue: 30,
        abnormalRange: { low: 5, high: 120 },
      },
      {
        loincCode: '6768-6',
        display: 'Alkaline Phosphatase',
        unit: 'U/L',
        referenceRange: { low: 44, high: 147 },
        normalValue: 80,
        abnormalRange: { low: 25, high: 200 },
      },
      {
        loincCode: '1975-2',
        display: 'Total Bilirubin',
        unit: 'mg/dL',
        referenceRange: { low: 0.1, high: 1.2 },
        criticalRange: { low: 0.0, high: 15.0 },
        normalValue: 0.6,
        abnormalRange: { low: 0.1, high: 3.0 },
      },
    ],
  },

  BMP: {
    name: 'Basic Metabolic Panel',
    loincCode: '24320-4',
    tests: [
      {
        loincCode: '2345-7',
        display: 'Glucose',
        unit: 'mg/dL',
        referenceRange: { low: 70, high: 100 },
        criticalRange: { low: 40, high: 500 },
        normalValue: 90,
        abnormalRange: { low: 50, high: 350 },
      },
      {
        loincCode: '3094-0',
        display: 'BUN',
        unit: 'mg/dL',
        referenceRange: { low: 7, high: 20 },
        normalValue: 14,
        abnormalRange: { low: 5, high: 50 },
      },
      {
        loincCode: '2160-0',
        display: 'Creatinine',
        unit: 'mg/dL',
        referenceRange: { low: 0.7, high: 1.3 },
        criticalRange: { low: 0.2, high: 10.0 },
        normalValue: 1.0,
        abnormalRange: { low: 0.4, high: 4.0 },
      },
      {
        loincCode: '2951-2',
        display: 'Sodium',
        unit: 'mEq/L',
        referenceRange: { low: 136, high: 145 },
        criticalRange: { low: 120, high: 160 },
        normalValue: 140,
        abnormalRange: { low: 128, high: 155 },
      },
      {
        loincCode: '2823-3',
        display: 'Potassium',
        unit: 'mEq/L',
        referenceRange: { low: 3.5, high: 5.0 },
        criticalRange: { low: 2.5, high: 6.5 },
        normalValue: 4.2,
        abnormalRange: { low: 3.0, high: 6.0 },
      },
      {
        loincCode: '2075-0',
        display: 'Chloride',
        unit: 'mEq/L',
        referenceRange: { low: 98, high: 106 },
        normalValue: 102,
        abnormalRange: { low: 90, high: 115 },
      },
      {
        loincCode: '2028-9',
        display: 'CO2',
        unit: 'mEq/L',
        referenceRange: { low: 22, high: 29 },
        normalValue: 25,
        abnormalRange: { low: 15, high: 35 },
      },
      {
        loincCode: '17861-6',
        display: 'Calcium',
        unit: 'mg/dL',
        referenceRange: { low: 8.5, high: 10.5 },
        criticalRange: { low: 6.0, high: 13.0 },
        normalValue: 9.5,
        abnormalRange: { low: 7.0, high: 12.0 },
      },
    ],
  },

  LIPID: {
    name: 'Lipid Panel',
    loincCode: '57698-3',
    tests: [
      {
        loincCode: '2093-3',
        display: 'Total Cholesterol',
        unit: 'mg/dL',
        referenceRange: { low: 0, high: 200 },
        normalValue: 180,
        abnormalRange: { low: 120, high: 320 },
      },
      {
        loincCode: '2571-8',
        display: 'Triglycerides',
        unit: 'mg/dL',
        referenceRange: { low: 0, high: 150 },
        normalValue: 120,
        abnormalRange: { low: 40, high: 500 },
      },
      {
        loincCode: '2085-9',
        display: 'HDL Cholesterol',
        unit: 'mg/dL',
        referenceRange: { low: 40, high: 999 },
        normalValue: 55,
        abnormalRange: { low: 25, high: 95 },
      },
      {
        loincCode: '13457-7',
        display: 'LDL Cholesterol (calculated)',
        unit: 'mg/dL',
        referenceRange: { low: 0, high: 100 },
        normalValue: 90,
        abnormalRange: { low: 40, high: 250 },
      },
    ],
  },

  A1C: {
    name: 'Hemoglobin A1c',
    loincCode: '4548-4',
    tests: [
      {
        loincCode: '4548-4',
        display: 'Hemoglobin A1c',
        unit: '%',
        referenceRange: { low: 4.0, high: 5.6 },   // normal <5.7, pre-diabetic 5.7-6.4, diabetic >=6.5
        criticalRange: { low: 3.0, high: 15.0 },
        normalValue: 5.2,                            // diabetic target <7.0
        abnormalRange: { low: 4.0, high: 14.0 },
      },
    ],
  },

  TSH: {
    name: 'Thyroid Stimulating Hormone',
    loincCode: '3016-3',
    tests: [
      {
        loincCode: '3016-3',
        display: 'TSH',
        unit: 'mIU/L',
        referenceRange: { low: 0.4, high: 4.0 },
        criticalRange: { low: 0.01, high: 100.0 },
        normalValue: 2.0,
        abnormalRange: { low: 0.1, high: 12.0 },
      },
    ],
  },

  URINALYSIS: {
    name: 'Urinalysis',
    loincCode: '24356-8',
    tests: [
      {
        loincCode: '2756-5',
        display: 'pH',
        unit: '',
        referenceRange: { low: 5.0, high: 8.0 },
        normalValue: 6.0,
        abnormalRange: { low: 4.5, high: 9.0 },
      },
      {
        loincCode: '5811-5',
        display: 'Specific Gravity',
        unit: '',
        referenceRange: { low: 1.005, high: 1.030 },
        normalValue: 1.015,
        abnormalRange: { low: 1.001, high: 1.040 },
      },
      {
        loincCode: '2888-6',
        display: 'Protein',
        unit: 'mg/dL',
        referenceRange: { low: 0, high: 14 },
        normalValue: 0,
        abnormalRange: { low: 0, high: 300 },
      },
      {
        loincCode: '2350-7',
        display: 'Glucose',
        unit: 'mg/dL',
        referenceRange: { low: 0, high: 15 },
        normalValue: 0,
        abnormalRange: { low: 0, high: 1000 },
      },
      {
        loincCode: '5794-3',
        display: 'Blood',
        unit: '',
        referenceRange: { low: 0, high: 0 },
        normalValue: 0,
        abnormalRange: { low: 0, high: 3 },
      },
    ],
  },
};
