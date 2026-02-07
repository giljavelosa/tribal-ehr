/**
 * Unit Tests: CDS Drug Interaction Rules
 *
 * Tests for /packages/cds-hooks/src/rules/drug-interactions.ts
 * Covers: critical and warning interactions, no-interaction cases,
 *         card indicator levels, and suggestions.
 */

import { DrugInteractionHandler } from '../../../packages/cds-hooks/src/rules/drug-interactions';
import { CDSRequest } from '../../../packages/cds-hooks/src/types';

describe('DrugInteractionHandler', () => {
  let handler: DrugInteractionHandler;

  beforeEach(() => {
    handler = new DrugInteractionHandler();
  });

  function makeRequest(
    proposedMeds: Array<{ name: string; rxnormCode?: string }>,
    activeMeds: Array<{ name: string; rxnormCode?: string }> = [],
  ): CDSRequest {
    const proposedResources = proposedMeds.map((med) => ({
      resourceType: 'MedicationRequest',
      medicationCodeableConcept: {
        text: med.name,
        coding: med.rxnormCode
          ? [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: med.rxnormCode, display: med.name }]
          : [{ display: med.name }],
      },
    }));

    const activeResources = activeMeds.map((med) => ({
      resourceType: 'MedicationRequest',
      medicationCodeableConcept: {
        text: med.name,
        coding: med.rxnormCode
          ? [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: med.rxnormCode, display: med.name }]
          : [{ display: med.name }],
      },
    }));

    return {
      hookInstance: 'test-hook-instance',
      hook: 'order-select',
      fhirServer: 'http://localhost:8080/fhir',
      context: {
        patientId: 'test-patient-1',
        draftOrders: {
          resourceType: 'Bundle',
          entry: proposedResources.map((r) => ({ resource: r })),
        },
      },
      prefetch: {
        activeMedications: {
          resourceType: 'Bundle',
          entry: activeResources.map((r) => ({ resource: r })),
        },
      },
    };
  }

  // ===========================================================================
  // Critical interactions
  // ===========================================================================

  describe('critical interactions', () => {
    it('should flag Warfarin + NSAID as critical interaction', async () => {
      const request = makeRequest(
        [{ name: 'Ibuprofen (Advil) 400mg' }],
        [{ name: 'Warfarin 5mg' }],
      );

      const response = await handler.handle(request);

      expect(response.cards.length).toBeGreaterThanOrEqual(1);
      const card = response.cards.find((c) => c.indicator === 'critical' && c.summary.includes('Warfarin'));
      expect(card).toBeDefined();
      expect(card!.summary).toContain('bleeding');
    });

    it('should flag Opioid + Benzodiazepine as critical interaction', async () => {
      const request = makeRequest(
        [{ name: 'Alprazolam (Xanax) 0.5mg' }],
        [{ name: 'Oxycodone 5mg' }],
      );

      const response = await handler.handle(request);

      expect(response.cards.length).toBeGreaterThanOrEqual(1);
      const card = response.cards.find((c) => c.indicator === 'critical');
      expect(card).toBeDefined();
      expect(card!.summary.toLowerCase()).toContain('respiratory');
    });

    it('should flag SSRI + MAOI as critical interaction', async () => {
      const request = makeRequest(
        [{ name: 'Fluoxetine (Prozac) 20mg' }],
        [{ name: 'Phenelzine (Nardil) 15mg' }],
      );

      const response = await handler.handle(request);

      expect(response.cards.length).toBeGreaterThanOrEqual(1);
      const card = response.cards.find((c) => c.indicator === 'critical');
      expect(card).toBeDefined();
      expect(card!.summary.toLowerCase()).toContain('serotonin');
    });
  });

  // ===========================================================================
  // Warning interactions
  // ===========================================================================

  describe('warning interactions', () => {
    it('should flag ACE Inhibitor + Potassium-sparing diuretic as warning', async () => {
      const request = makeRequest(
        [{ name: 'Spironolactone (Aldactone) 25mg' }],
        [{ name: 'Lisinopril 10mg' }],
      );

      const response = await handler.handle(request);

      expect(response.cards.length).toBeGreaterThanOrEqual(1);
      const card = response.cards.find((c) => c.indicator === 'warning');
      expect(card).toBeDefined();
      expect(card!.summary.toLowerCase()).toContain('hyperkalemia');
    });

    it('should flag Statin + Fibrate as warning', async () => {
      const request = makeRequest(
        [{ name: 'Gemfibrozil (Lopid) 600mg' }],
        [{ name: 'Atorvastatin (Lipitor) 40mg' }],
      );

      const response = await handler.handle(request);

      expect(response.cards.length).toBeGreaterThanOrEqual(1);
      const card = response.cards.find((c) => c.indicator === 'warning');
      expect(card).toBeDefined();
      expect(card!.summary.toLowerCase()).toContain('rhabdomyolysis');
    });
  });

  // ===========================================================================
  // No interaction
  // ===========================================================================

  describe('no interaction', () => {
    it('should return no cards for two unrelated medications', async () => {
      const request = makeRequest(
        [{ name: 'Acetaminophen 500mg' }],
        [{ name: 'Vitamin D 1000IU' }],
      );

      const response = await handler.handle(request);

      expect(response.cards).toHaveLength(0);
    });

    it('should return no cards when there are no proposed medications', async () => {
      const request = makeRequest([], [{ name: 'Lisinopril 10mg' }]);

      const response = await handler.handle(request);

      expect(response.cards).toHaveLength(0);
    });

    it('should return no cards when there are no active medications', async () => {
      const request = makeRequest([{ name: 'Acetaminophen 500mg' }], []);

      const response = await handler.handle(request);

      expect(response.cards).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Card properties
  // ===========================================================================

  describe('card properties', () => {
    it('should use "critical" indicator for dangerous interactions', async () => {
      const request = makeRequest(
        [{ name: 'Morphine 10mg' }],
        [{ name: 'Lorazepam (Ativan) 1mg' }],
      );

      const response = await handler.handle(request);
      const criticalCards = response.cards.filter((c) => c.indicator === 'critical');

      expect(criticalCards.length).toBeGreaterThanOrEqual(1);
    });

    it('should use "warning" indicator for moderate interactions', async () => {
      const request = makeRequest(
        [{ name: 'Fenofibrate (Tricor) 160mg' }],
        [{ name: 'Simvastatin (Zocor) 20mg' }],
      );

      const response = await handler.handle(request);
      const warningCards = response.cards.filter((c) => c.indicator === 'warning');

      expect(warningCards.length).toBeGreaterThanOrEqual(1);
    });

    it('should include a suggestion to cancel the order', async () => {
      const request = makeRequest(
        [{ name: 'Naproxen (Aleve) 500mg' }],
        [{ name: 'Warfarin (Coumadin) 5mg' }],
      );

      const response = await handler.handle(request);

      expect(response.cards.length).toBeGreaterThanOrEqual(1);
      const card = response.cards[0];
      expect(card.suggestions).toBeDefined();
      expect(card.suggestions!.length).toBeGreaterThanOrEqual(1);

      const cancelSuggestion = card.suggestions!.find((s) =>
        s.label.toLowerCase().includes('cancel')
      );
      expect(cancelSuggestion).toBeDefined();
    });

    it('should include override reasons', async () => {
      const request = makeRequest(
        [{ name: 'Ibuprofen 400mg' }],
        [{ name: 'Warfarin 5mg' }],
      );

      const response = await handler.handle(request);
      const card = response.cards[0];

      expect(card.overrideReasons).toBeDefined();
      expect(card.overrideReasons!.length).toBeGreaterThanOrEqual(1);
    });

    it('should include source information', async () => {
      const request = makeRequest(
        [{ name: 'Ibuprofen 400mg' }],
        [{ name: 'Warfarin 5mg' }],
      );

      const response = await handler.handle(request);
      const card = response.cards[0];

      expect(card.source).toBeDefined();
      expect(card.source.label).toContain('Drug Interaction');
    });
  });

  // ===========================================================================
  // Service definition
  // ===========================================================================

  describe('service definition', () => {
    it('should have a valid service definition', () => {
      expect(handler.service.id).toBe('tribal-ehr-drug-interactions');
      expect(handler.service.hook).toBe('order-select');
      expect(handler.service.title).toBeTruthy();
      expect(handler.service.description).toBeTruthy();
      expect(handler.service.prefetch).toBeDefined();
    });
  });
});
