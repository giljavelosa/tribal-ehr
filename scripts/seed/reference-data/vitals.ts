// Vital signs reference data with LOINC codes

export interface VitalSign {
  loincCode: string;
  display: string;
  unit: string;
  normalRange: { low: number; high: number };
  criticalRange: { low: number; high: number };
}

export const VITAL_SIGNS: VitalSign[] = [
  {
    loincCode: '8480-6',
    display: 'Systolic Blood Pressure',
    unit: 'mmHg',
    normalRange: { low: 90, high: 140 },
    criticalRange: { low: 80, high: 180 },
  },
  {
    loincCode: '8462-4',
    display: 'Diastolic Blood Pressure',
    unit: 'mmHg',
    normalRange: { low: 60, high: 90 },
    criticalRange: { low: 50, high: 110 },
  },
  {
    loincCode: '8867-4',
    display: 'Heart Rate',
    unit: 'bpm',
    normalRange: { low: 60, high: 100 },
    criticalRange: { low: 40, high: 150 },
  },
  {
    loincCode: '9279-1',
    display: 'Respiratory Rate',
    unit: '/min',
    normalRange: { low: 12, high: 20 },
    criticalRange: { low: 8, high: 40 },
  },
  {
    loincCode: '8310-5',
    display: 'Body Temperature',
    unit: 'degF',
    normalRange: { low: 97.0, high: 99.5 },
    criticalRange: { low: 95.0, high: 104.0 },
  },
  {
    loincCode: '2708-6',
    display: 'Oxygen Saturation (SpO2)',
    unit: '%',
    normalRange: { low: 95, high: 100 },
    criticalRange: { low: 90, high: 100 },
  },
  {
    loincCode: '8302-2',
    display: 'Body Height',
    unit: 'cm',
    normalRange: { low: 50, high: 200 },   // variable by age/sex
    criticalRange: { low: 30, high: 220 },
  },
  {
    loincCode: '29463-7',
    display: 'Body Weight',
    unit: 'kg',
    normalRange: { low: 3, high: 150 },    // variable
    criticalRange: { low: 1, high: 300 },
  },
  {
    loincCode: '39156-5',
    display: 'Body Mass Index (BMI)',
    unit: 'kg/m2',
    normalRange: { low: 18.5, high: 24.9 },
    criticalRange: { low: 12.0, high: 60.0 },
  },
];
