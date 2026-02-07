/**
 * Unit Tests: CDS Vital Sign Alert Rules
 *
 * Tests for /packages/cds-hooks/src/rules/vital-sign-alerts.ts
 * Covers: normal vitals (no alerts), critical high/low, warning alerts,
 *         info alerts (BMI), multiple abnormal vitals.
 */

import { VitalSignAlertHandler } from '../../../packages/cds-hooks/src/rules/vital-sign-alerts';
import { CDSRequest } from '../../../packages/cds-hooks/src/types';

describe('VitalSignAlertHandler', () => {
  let handler: VitalSignAlertHandler;

  beforeEach(() => {
    handler = new VitalSignAlertHandler();
  });

  function makeVitalObservation(
    loincCode: string,
    value: number,
    unit: string,
    effectiveDateTime: string = '2024-01-15T10:00:00Z',
  ): any {
    return {
      resourceType: 'Observation',
      status: 'final',
      code: {
        coding: [{ system: 'http://loinc.org', code: loincCode }],
      },
      effectiveDateTime,
      valueQuantity: { value, unit },
    };
  }

  function makeRequest(observations: any[]): CDSRequest {
    return {
      hookInstance: 'test-hook',
      hook: 'patient-view',
      fhirServer: 'http://localhost:8080/fhir',
      context: { patientId: 'test-patient-1' },
      prefetch: {
        vitals: {
          resourceType: 'Bundle',
          entry: observations.map((obs) => ({ resource: obs })),
        },
      },
    };
  }

  // LOINC codes for reference
  const SYSTOLIC_BP = '8480-6';
  const DIASTOLIC_BP = '8462-4';
  const HEART_RATE = '8867-4';
  const RESPIRATORY_RATE = '9279-1';
  const TEMPERATURE = '8310-5';
  const SPO2 = '2708-6';
  const BMI = '39156-5';

  // ===========================================================================
  // Normal vitals - no alerts
  // ===========================================================================

  describe('normal vitals', () => {
    it('should return no alerts for normal vital signs', async () => {
      const request = makeRequest([
        makeVitalObservation(SYSTOLIC_BP, 120, 'mmHg'),
        makeVitalObservation(DIASTOLIC_BP, 75, 'mmHg'),
        makeVitalObservation(HEART_RATE, 72, 'bpm'),
        makeVitalObservation(RESPIRATORY_RATE, 16, 'breaths/min'),
        makeVitalObservation(TEMPERATURE, 98.6, '[degF]'),
        makeVitalObservation(SPO2, 98, '%'),
        makeVitalObservation(BMI, 23.5, 'kg/m2'),
      ]);

      const response = await handler.handle(request);

      expect(response.cards).toHaveLength(0);
    });

    it('should return no cards when no vitals are present', async () => {
      const request = makeRequest([]);

      const response = await handler.handle(request);

      expect(response.cards).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Critical alerts
  // ===========================================================================

  describe('critical alerts', () => {
    it('should generate critical alert for systolic BP > 200 (critically high)', async () => {
      const request = makeRequest([
        makeVitalObservation(SYSTOLIC_BP, 210, 'mmHg'),
      ]);

      const response = await handler.handle(request);

      expect(response.cards.length).toBeGreaterThanOrEqual(1);
      const card = response.cards.find(
        (c) => c.indicator === 'critical' && c.summary.includes('Systolic')
      );
      expect(card).toBeDefined();
      expect(card!.summary).toContain('CRITICAL');
      expect(card!.summary).toContain('210');
    });

    it('should generate critical alert for SpO2 < 88 (critically low)', async () => {
      const request = makeRequest([
        makeVitalObservation(SPO2, 85, '%'),
      ]);

      const response = await handler.handle(request);

      expect(response.cards.length).toBeGreaterThanOrEqual(1);
      const card = response.cards.find(
        (c) => c.indicator === 'critical' && c.summary.includes('SpO2')
      );
      expect(card).toBeDefined();
      expect(card!.summary).toContain('CRITICAL');
      expect(card!.summary).toContain('85');
    });

    it('should generate critical alert for heart rate > 150', async () => {
      const request = makeRequest([
        makeVitalObservation(HEART_RATE, 160, 'bpm'),
      ]);

      const response = await handler.handle(request);

      const card = response.cards.find(
        (c) => c.indicator === 'critical' && c.summary.includes('Heart Rate')
      );
      expect(card).toBeDefined();
    });

    it('should generate critical alert for temperature > 104 F', async () => {
      const request = makeRequest([
        makeVitalObservation(TEMPERATURE, 105.0, '[degF]'),
      ]);

      const response = await handler.handle(request);

      const card = response.cards.find(
        (c) => c.indicator === 'critical' && c.summary.includes('Temperature')
      );
      expect(card).toBeDefined();
    });
  });

  // ===========================================================================
  // Warning alerts
  // ===========================================================================

  describe('warning alerts', () => {
    it('should generate warning alert for elevated heart rate (125 bpm)', async () => {
      const request = makeRequest([
        makeVitalObservation(HEART_RATE, 125, 'bpm'),
      ]);

      const response = await handler.handle(request);

      expect(response.cards.length).toBeGreaterThanOrEqual(1);
      const card = response.cards.find(
        (c) => c.indicator === 'warning' && c.summary.includes('Heart Rate')
      );
      expect(card).toBeDefined();
      expect(card!.summary.toLowerCase()).toContain('elevated');
    });

    it('should generate warning alert for low temperature (95.5 F)', async () => {
      const request = makeRequest([
        makeVitalObservation(TEMPERATURE, 95.5, '[degF]'),
      ]);

      const response = await handler.handle(request);

      const card = response.cards.find(
        (c) => c.indicator === 'warning' && c.summary.includes('Temperature')
      );
      expect(card).toBeDefined();
      expect(card!.summary.toLowerCase()).toContain('low');
    });

    it('should generate warning alert for low SpO2 (90%)', async () => {
      const request = makeRequest([
        makeVitalObservation(SPO2, 90, '%'),
      ]);

      const response = await handler.handle(request);

      const card = response.cards.find(
        (c) => c.indicator === 'warning' && c.summary.includes('SpO2')
      );
      expect(card).toBeDefined();
    });

    it('should generate warning alert for high systolic BP (170 mmHg)', async () => {
      const request = makeRequest([
        makeVitalObservation(SYSTOLIC_BP, 170, 'mmHg'),
      ]);

      const response = await handler.handle(request);

      const card = response.cards.find(
        (c) => c.indicator === 'warning' && c.summary.includes('Systolic')
      );
      expect(card).toBeDefined();
    });
  });

  // ===========================================================================
  // Info alerts (BMI)
  // ===========================================================================

  describe('info alerts', () => {
    it('should generate info alert for high BMI (32 kg/m2)', async () => {
      const request = makeRequest([
        makeVitalObservation(BMI, 32, 'kg/m2'),
      ]);

      const response = await handler.handle(request);

      expect(response.cards.length).toBeGreaterThanOrEqual(1);
      const card = response.cards.find(
        (c) => c.indicator === 'info' && c.summary.includes('BMI')
      );
      expect(card).toBeDefined();
      expect(card!.summary).toContain('above normal');
    });

    it('should generate info alert for low BMI (17 kg/m2)', async () => {
      const request = makeRequest([
        makeVitalObservation(BMI, 17, 'kg/m2'),
      ]);

      const response = await handler.handle(request);

      const card = response.cards.find(
        (c) => c.indicator === 'info' && c.summary.includes('BMI')
      );
      expect(card).toBeDefined();
      expect(card!.summary).toContain('below normal');
    });
  });

  // ===========================================================================
  // Multiple abnormal vitals
  // ===========================================================================

  describe('multiple abnormal vitals', () => {
    it('should return multiple cards for multiple abnormal vitals', async () => {
      const request = makeRequest([
        makeVitalObservation(SYSTOLIC_BP, 210, 'mmHg'),    // critical high
        makeVitalObservation(HEART_RATE, 130, 'bpm'),       // warning high
        makeVitalObservation(SPO2, 85, '%'),                 // critical low
        makeVitalObservation(BMI, 35, 'kg/m2'),              // info high
      ]);

      const response = await handler.handle(request);

      expect(response.cards.length).toBeGreaterThanOrEqual(3);

      // Should have critical, warning, and info cards
      const critical = response.cards.filter((c) => c.indicator === 'critical');
      const warning = response.cards.filter((c) => c.indicator === 'warning');
      const info = response.cards.filter((c) => c.indicator === 'info');

      expect(critical.length).toBeGreaterThanOrEqual(2);
      expect(warning.length).toBeGreaterThanOrEqual(1);
      expect(info.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // Temperature conversion
  // ===========================================================================

  describe('temperature conversion', () => {
    it('should convert Celsius temperature to Fahrenheit for threshold comparison', async () => {
      // 35.0 C = 95.0 F, which is at the critical low threshold
      const request = makeRequest([
        makeVitalObservation(TEMPERATURE, 34.5, 'Cel'),
      ]);

      const response = await handler.handle(request);

      const card = response.cards.find(
        (c) => c.summary.includes('Temperature')
      );
      expect(card).toBeDefined();
    });
  });

  // ===========================================================================
  // Service definition
  // ===========================================================================

  describe('service definition', () => {
    it('should have a valid service definition', () => {
      expect(handler.service.id).toBe('tribal-ehr-vital-alerts');
      expect(handler.service.hook).toBe('patient-view');
      expect(handler.service.title).toBeTruthy();
      expect(handler.service.prefetch).toBeDefined();
    });
  });

  // ===========================================================================
  // Skips cancelled/entered-in-error observations
  // ===========================================================================

  describe('observation status filtering', () => {
    it('should ignore observations with entered-in-error status', async () => {
      const request = makeRequest([
        {
          resourceType: 'Observation',
          status: 'entered-in-error',
          code: { coding: [{ system: 'http://loinc.org', code: SYSTOLIC_BP }] },
          effectiveDateTime: '2024-01-15T10:00:00Z',
          valueQuantity: { value: 250, unit: 'mmHg' },
        },
      ]);

      const response = await handler.handle(request);

      expect(response.cards).toHaveLength(0);
    });
  });
});
