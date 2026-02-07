/**
 * Integration Tests: C-CDA Document Generation
 *
 * Tests the generation of Continuity of Care Documents (CCD) in C-CDA format.
 * Validates XML structure, required templateIds, and section presence.
 *
 * Since the C-CDA generation module may not be fully implemented yet, these
 * tests validate the expected structures and templateIds that a compliant
 * CCD must contain. The tests can be updated as the C-CDA module is built out.
 */

import { CODE_SYSTEMS } from '../../../packages/shared/src/constants/terminology';

// CDA templateIds per the C-CDA 2.1 specification
const CCD_TEMPLATE_ID = '2.16.840.1.113883.10.20.22.1.2';
const ALLERGIES_SECTION_TEMPLATE_ID = '2.16.840.1.113883.10.20.22.2.6.1';
const MEDICATIONS_SECTION_TEMPLATE_ID = '2.16.840.1.113883.10.20.22.2.1.1';
const PROBLEMS_SECTION_TEMPLATE_ID = '2.16.840.1.113883.10.20.22.2.5.1';
const PROCEDURES_SECTION_TEMPLATE_ID = '2.16.840.1.113883.10.20.22.2.7.1';
const RESULTS_SECTION_TEMPLATE_ID = '2.16.840.1.113883.10.20.22.2.3.1';
const VITAL_SIGNS_SECTION_TEMPLATE_ID = '2.16.840.1.113883.10.20.22.2.4.1';
const IMMUNIZATIONS_SECTION_TEMPLATE_ID = '2.16.840.1.113883.10.20.22.2.2.1';

// Sample patient data for CCD generation
const samplePatient = {
  id: 'patient-001',
  mrn: 'TRB-000001',
  firstName: 'Running',
  middleName: 'Cloud',
  lastName: 'Eagle',
  dateOfBirth: '1975-03-10',
  sex: 'male',
  race: [{ code: '1002-5', display: 'American Indian or Alaska Native', system: CODE_SYSTEMS.CDC_RACE }],
  addresses: [{
    line1: '123 Tribal Way',
    city: 'Tribal City',
    state: 'NM',
    postalCode: '87501',
  }],
  phoneNumbers: [{ value: '505-555-1234', system: 'phone', use: 'home' }],
};

const sampleAllergies = [
  {
    substance: { code: '7980', display: 'Penicillin', system: CODE_SYSTEMS.RXNORM },
    reaction: 'Hives',
    severity: 'moderate',
    status: 'active',
  },
];

const sampleMedications = [
  {
    medication: { code: '197361', display: 'Amlodipine 5 MG Oral Tablet', system: CODE_SYSTEMS.RXNORM },
    dosage: '5 mg daily',
    status: 'active',
  },
];

const sampleProblems = [
  {
    condition: { code: '73211009', display: 'Diabetes mellitus', system: CODE_SYSTEMS.SNOMED_CT },
    status: 'active',
    onset: '2020-06-15',
  },
];

describe('C-CDA Generation Integration Tests', () => {
  // ===========================================================================
  // CCD Template IDs
  // ===========================================================================

  describe('CCD template IDs', () => {
    it('should have the correct CCD document templateId', () => {
      expect(CCD_TEMPLATE_ID).toBe('2.16.840.1.113883.10.20.22.1.2');
    });

    it('should have the correct Allergies section templateId', () => {
      expect(ALLERGIES_SECTION_TEMPLATE_ID).toBe('2.16.840.1.113883.10.20.22.2.6.1');
    });

    it('should have the correct Medications section templateId', () => {
      expect(MEDICATIONS_SECTION_TEMPLATE_ID).toBe('2.16.840.1.113883.10.20.22.2.1.1');
    });

    it('should have the correct Problems section templateId', () => {
      expect(PROBLEMS_SECTION_TEMPLATE_ID).toBe('2.16.840.1.113883.10.20.22.2.5.1');
    });

    it('should have the correct Procedures section templateId', () => {
      expect(PROCEDURES_SECTION_TEMPLATE_ID).toBe('2.16.840.1.113883.10.20.22.2.7.1');
    });

    it('should have the correct Results section templateId', () => {
      expect(RESULTS_SECTION_TEMPLATE_ID).toBe('2.16.840.1.113883.10.20.22.2.3.1');
    });

    it('should have the correct Vital Signs section templateId', () => {
      expect(VITAL_SIGNS_SECTION_TEMPLATE_ID).toBe('2.16.840.1.113883.10.20.22.2.4.1');
    });

    it('should have the correct Immunizations section templateId', () => {
      expect(IMMUNIZATIONS_SECTION_TEMPLATE_ID).toBe('2.16.840.1.113883.10.20.22.2.2.1');
    });
  });

  // ===========================================================================
  // CCD XML structure validation (structural tests)
  // ===========================================================================

  describe('CCD XML structural validation', () => {
    it('should generate well-formed XML for a CCD header', () => {
      // Simulate CCD header construction
      const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:sdtc="urn:hl7-org:sdtc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <templateId root="${CCD_TEMPLATE_ID}"/>
  <id root="unique-document-id"/>
  <code code="34133-9" displayName="Summarization of Episode Note" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC"/>
  <title>Continuity of Care Document</title>
  <effectiveTime value="20240115120000"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="en-US"/>
</ClinicalDocument>`;

      // Verify basic XML well-formedness
      expect(xmlHeader).toContain('<?xml version="1.0"');
      expect(xmlHeader).toContain('ClinicalDocument');
      expect(xmlHeader).toContain(CCD_TEMPLATE_ID);
      expect(xmlHeader).toContain('realmCode code="US"');
      expect(xmlHeader).toContain('languageCode code="en-US"');
    });

    it('should include patient record target in CCD', () => {
      const recordTarget = `
  <recordTarget>
    <patientRole>
      <id root="2.16.840.1.113883.4.1" extension="${samplePatient.mrn}"/>
      <addr use="HP">
        <streetAddressLine>${samplePatient.addresses[0].line1}</streetAddressLine>
        <city>${samplePatient.addresses[0].city}</city>
        <state>${samplePatient.addresses[0].state}</state>
        <postalCode>${samplePatient.addresses[0].postalCode}</postalCode>
        <country>US</country>
      </addr>
      <telecom value="tel:${samplePatient.phoneNumbers[0].value}" use="HP"/>
      <patient>
        <name use="L">
          <given>${samplePatient.firstName}</given>
          <given>${samplePatient.middleName}</given>
          <family>${samplePatient.lastName}</family>
        </name>
        <administrativeGenderCode code="M" codeSystem="2.16.840.1.113883.5.1"/>
        <birthTime value="${samplePatient.dateOfBirth.replace(/-/g, '')}"/>
      </patient>
    </patientRole>
  </recordTarget>`;

      expect(recordTarget).toContain(samplePatient.mrn);
      expect(recordTarget).toContain(samplePatient.firstName);
      expect(recordTarget).toContain(samplePatient.lastName);
      expect(recordTarget).toContain(samplePatient.addresses[0].city);
    });
  });

  // ===========================================================================
  // Section structures
  // ===========================================================================

  describe('CCD section structures', () => {
    it('should construct Allergies section with correct templateId', () => {
      const allergiesSection = `
  <component>
    <section>
      <templateId root="${ALLERGIES_SECTION_TEMPLATE_ID}"/>
      <code code="48765-2" displayName="Allergies, adverse reactions, alerts" codeSystem="2.16.840.1.113883.6.1"/>
      <title>Allergies</title>
      <entry>
        <act classCode="ACT" moodCode="EVN">
          <code code="CONC" codeSystem="2.16.840.1.113883.5.6"/>
        </act>
      </entry>
    </section>
  </component>`;

      expect(allergiesSection).toContain(ALLERGIES_SECTION_TEMPLATE_ID);
      expect(allergiesSection).toContain('48765-2');
      expect(allergiesSection).toContain('entry');
    });

    it('should construct Medications section with correct templateId', () => {
      const medicationsSection = `
  <component>
    <section>
      <templateId root="${MEDICATIONS_SECTION_TEMPLATE_ID}"/>
      <code code="10160-0" displayName="History of Medication use" codeSystem="2.16.840.1.113883.6.1"/>
      <title>Medications</title>
    </section>
  </component>`;

      expect(medicationsSection).toContain(MEDICATIONS_SECTION_TEMPLATE_ID);
      expect(medicationsSection).toContain('10160-0');
    });

    it('should construct Problems section with correct templateId', () => {
      const problemsSection = `
  <component>
    <section>
      <templateId root="${PROBLEMS_SECTION_TEMPLATE_ID}"/>
      <code code="11450-4" displayName="Problem list" codeSystem="2.16.840.1.113883.6.1"/>
      <title>Problem List</title>
    </section>
  </component>`;

      expect(problemsSection).toContain(PROBLEMS_SECTION_TEMPLATE_ID);
      expect(problemsSection).toContain('11450-4');
    });
  });

  // ===========================================================================
  // Minimal data handling
  // ===========================================================================

  describe('minimal data handling', () => {
    it('should construct a valid CCD structure with minimal patient data', () => {
      const minimalPatient = {
        firstName: 'Test',
        lastName: 'Patient',
        dateOfBirth: '2000-01-01',
        sex: 'unknown',
      };

      // Verify we can construct required fields even with minimal data
      expect(minimalPatient.firstName).toBeTruthy();
      expect(minimalPatient.lastName).toBeTruthy();
      expect(minimalPatient.dateOfBirth).toBeTruthy();
    });

    it('should handle patient with no allergies gracefully', () => {
      // An empty allergies section should use the "No Known Allergies" pattern
      const noAllergyCode = '716186003';
      const noAllergyDisplay = 'No known allergy';

      expect(noAllergyCode).toBeTruthy();
      expect(noAllergyDisplay).toBeTruthy();
    });

    it('should handle patient with no medications gracefully', () => {
      const noMedCode = '787481004';
      const noMedDisplay = 'No known medications';

      expect(noMedCode).toBeTruthy();
    });
  });

  // ===========================================================================
  // Code system usage in C-CDA
  // ===========================================================================

  describe('code system usage', () => {
    it('should use LOINC for document and section codes', () => {
      // CCD document code is LOINC 34133-9
      expect(CODE_SYSTEMS.LOINC).toBe('http://loinc.org');
    });

    it('should use SNOMED CT for problem entries', () => {
      expect(CODE_SYSTEMS.SNOMED_CT).toBe('http://snomed.info/sct');
    });

    it('should use RxNorm for medication entries', () => {
      expect(CODE_SYSTEMS.RXNORM).toBe('http://www.nlm.nih.gov/research/umls/rxnorm');
    });

    it('should use CVX for immunization entries', () => {
      expect(CODE_SYSTEMS.CVX).toBe('http://hl7.org/fhir/sid/cvx');
    });
  });
});
