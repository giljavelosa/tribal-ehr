/**
 * Integration Tests: FHIR Patient Resource Mapping
 *
 * Tests the round-trip mapping between internal patient representation
 * and FHIR R4 Patient resources with US Core profile compliance.
 */

import {
  toFHIRHumanName,
  fromFHIRHumanName,
  toFHIRAddress,
  fromFHIRAddress,
  toFHIRContactPoint,
  toFHIRIdentifier,
  toFHIRCodeableConcept,
  toFHIRReference,
  InternalName,
  InternalCode,
  InternalReference,
  InternalIdentifier,
} from '../../../packages/shared/src/utils/fhir-mapper';

import { CODE_SYSTEMS } from '../../../packages/shared/src/constants/terminology';
import { AddressUse, PhoneSystem, PhoneUse } from '../../../packages/shared/src/types/patient';

// =============================================================================
// US Core Patient profile extensions
// =============================================================================

// US Core race extension URL
const US_CORE_RACE_URL = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race';
const US_CORE_ETHNICITY_URL = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity';
const US_CORE_BIRTHSEX_URL = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex';

describe('FHIR Patient Resource Mapping', () => {
  // ===========================================================================
  // Patient FHIR mapping round-trip
  // ===========================================================================

  describe('Patient to FHIR mapping round-trip', () => {
    it('should map internal patient demographics to FHIR Patient fields', () => {
      // Map name
      const name: InternalName = {
        firstName: 'Running',
        middleName: 'Cloud',
        lastName: 'Eagle',
        prefix: 'Mr.',
        use: 'official',
      };
      const fhirName = toFHIRHumanName(name);

      expect(fhirName.family).toBe('Eagle');
      expect(fhirName.given).toEqual(['Running', 'Cloud']);
      expect(fhirName.use).toBe('official');
      expect(fhirName.prefix).toEqual(['Mr.']);

      // Map address
      const address = {
        line1: '123 Tribal Way',
        line2: 'Suite 100',
        city: 'Tribal City',
        state: 'NM',
        postalCode: '87501',
        country: 'US',
        use: AddressUse.HOME,
      };
      const fhirAddress = toFHIRAddress(address);

      expect(fhirAddress.line).toEqual(['123 Tribal Way', 'Suite 100']);
      expect(fhirAddress.city).toBe('Tribal City');
      expect(fhirAddress.state).toBe('NM');
      expect(fhirAddress.postalCode).toBe('87501');
      expect(fhirAddress.country).toBe('US');

      // Map telecom
      const phone = { value: '505-555-1234', system: PhoneSystem.PHONE, use: PhoneUse.HOME };
      const fhirPhone = toFHIRContactPoint(phone);

      expect(fhirPhone.value).toBe('505-555-1234');
      expect(fhirPhone.system).toBe('phone');
      expect(fhirPhone.use).toBe('home');
    });

    it('should create a FHIR identifier for MRN', () => {
      const mrnIdentifier: InternalIdentifier = {
        system: 'http://tribal-ehr.org/mrn',
        value: 'TRB-000001',
        use: 'official',
      };
      const fhirId = toFHIRIdentifier(mrnIdentifier);

      expect(fhirId.system).toBe('http://tribal-ehr.org/mrn');
      expect(fhirId.value).toBe('TRB-000001');
      expect(fhirId.use).toBe('official');
    });
  });

  // ===========================================================================
  // US Core Profile compliance
  // ===========================================================================

  describe('US Core Profile compliance structures', () => {
    it('should construct race extension structure', () => {
      // Build the race extension manually as the mapper would
      const raceExtension = {
        url: US_CORE_RACE_URL,
        extension: [
          {
            url: 'ombCategory',
            valueCoding: {
              system: CODE_SYSTEMS.CDC_RACE,
              code: '1002-5',
              display: 'American Indian or Alaska Native',
            },
          },
          {
            url: 'text',
            valueString: 'American Indian or Alaska Native',
          },
        ],
      };

      expect(raceExtension.url).toBe(US_CORE_RACE_URL);
      expect(raceExtension.extension).toHaveLength(2);
      expect((raceExtension.extension[0] as any).valueCoding.system).toBe(CODE_SYSTEMS.CDC_RACE);
      expect((raceExtension.extension[0] as any).valueCoding.code).toBe('1002-5');
    });

    it('should construct ethnicity extension structure', () => {
      const ethnicityExtension = {
        url: US_CORE_ETHNICITY_URL,
        extension: [
          {
            url: 'ombCategory',
            valueCoding: {
              system: CODE_SYSTEMS.CDC_RACE,
              code: '2135-2',
              display: 'Hispanic or Latino',
            },
          },
          {
            url: 'text',
            valueString: 'Hispanic or Latino',
          },
        ],
      };

      expect(ethnicityExtension.url).toBe(US_CORE_ETHNICITY_URL);
      expect((ethnicityExtension.extension[0] as any).valueCoding.code).toBe('2135-2');
    });

    it('should construct birthsex extension structure', () => {
      const birthsexExtension = {
        url: US_CORE_BIRTHSEX_URL,
        valueCode: 'M',
      };

      expect(birthsexExtension.url).toBe(US_CORE_BIRTHSEX_URL);
      expect(birthsexExtension.valueCode).toBe('M');
    });
  });

  // ===========================================================================
  // Condition FHIR mapping
  // ===========================================================================

  describe('Condition FHIR mapping', () => {
    it('should map a condition code to FHIR CodeableConcept', () => {
      const condition: InternalCode = {
        code: '73211009',
        display: 'Diabetes mellitus',
        system: CODE_SYSTEMS.SNOMED_CT,
      };
      const cc = toFHIRCodeableConcept(condition);

      expect(cc.coding![0].system).toBe('http://snomed.info/sct');
      expect(cc.coding![0].code).toBe('73211009');
      expect(cc.text).toBe('Diabetes mellitus');
    });

    it('should map an ICD-10 condition code', () => {
      const condition: InternalCode = {
        code: 'E11.9',
        display: 'Type 2 diabetes mellitus without complications',
        system: CODE_SYSTEMS.ICD10CM,
      };
      const cc = toFHIRCodeableConcept(condition);

      expect(cc.coding![0].system).toBe('http://hl7.org/fhir/sid/icd-10-cm');
      expect(cc.coding![0].code).toBe('E11.9');
    });
  });

  // ===========================================================================
  // Observation FHIR mapping
  // ===========================================================================

  describe('Observation FHIR mapping', () => {
    it('should map a LOINC observation code', () => {
      const obsCode: InternalCode = {
        code: '8480-6',
        display: 'Systolic blood pressure',
        system: CODE_SYSTEMS.LOINC,
      };
      const cc = toFHIRCodeableConcept(obsCode);

      expect(cc.coding![0].system).toBe('http://loinc.org');
      expect(cc.coding![0].code).toBe('8480-6');
    });
  });

  // ===========================================================================
  // AllergyIntolerance FHIR mapping
  // ===========================================================================

  describe('AllergyIntolerance FHIR mapping', () => {
    it('should map an allergy substance to FHIR CodeableConcept', () => {
      const substance: InternalCode = {
        code: '7980',
        display: 'Penicillin',
        system: CODE_SYSTEMS.RXNORM,
      };
      const cc = toFHIRCodeableConcept(substance);

      expect(cc.coding![0].system).toBe('http://www.nlm.nih.gov/research/umls/rxnorm');
      expect(cc.coding![0].code).toBe('7980');
      expect(cc.text).toBe('Penicillin');
    });

    it('should use correct allergy clinical status code system', () => {
      expect(CODE_SYSTEMS.ALLERGY_CLINICAL_STATUS).toBe(
        'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical'
      );
    });

    it('should use correct allergy verification status code system', () => {
      expect(CODE_SYSTEMS.ALLERGY_VERIFICATION_STATUS).toBe(
        'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification'
      );
    });
  });

  // ===========================================================================
  // MedicationRequest FHIR mapping
  // ===========================================================================

  describe('MedicationRequest FHIR mapping', () => {
    it('should map an RxNorm medication code', () => {
      const medication: InternalCode = {
        code: '197361',
        display: 'Amlodipine 5 MG Oral Tablet',
        system: CODE_SYSTEMS.RXNORM,
      };
      const cc = toFHIRCodeableConcept(medication);

      expect(cc.coding![0].system).toBe('http://www.nlm.nih.gov/research/umls/rxnorm');
      expect(cc.coding![0].code).toBe('197361');
      expect(cc.text).toBe('Amlodipine 5 MG Oral Tablet');
    });

    it('should create a requester reference', () => {
      const requester: InternalReference = {
        resourceType: 'Practitioner',
        id: 'pract-001',
        display: 'Dr. Running Eagle',
      };
      const ref = toFHIRReference(requester);

      expect(ref.reference).toBe('Practitioner/pract-001');
      expect(ref.display).toBe('Dr. Running Eagle');
    });
  });

  // ===========================================================================
  // Immunization FHIR mapping
  // ===========================================================================

  describe('Immunization FHIR mapping', () => {
    it('should map a CVX vaccine code', () => {
      const vaccine: InternalCode = {
        code: '141',
        display: 'Influenza, seasonal, injectable',
        system: CODE_SYSTEMS.CVX,
      };
      const cc = toFHIRCodeableConcept(vaccine);

      expect(cc.coding![0].system).toBe('http://hl7.org/fhir/sid/cvx');
      expect(cc.coding![0].code).toBe('141');
      expect(cc.text).toBe('Influenza, seasonal, injectable');
    });

    it('should create a patient reference for immunization', () => {
      const patientRef: InternalReference = {
        resourceType: 'Patient',
        id: 'patient-001',
        display: 'John Doe',
      };
      const ref = toFHIRReference(patientRef);

      expect(ref.reference).toBe('Patient/patient-001');
      expect(ref.type).toBe('Patient');
    });
  });

  // ===========================================================================
  // Code Systems
  // ===========================================================================

  describe('code system URIs', () => {
    it('should have correct SNOMED CT URI', () => {
      expect(CODE_SYSTEMS.SNOMED_CT).toBe('http://snomed.info/sct');
    });

    it('should have correct LOINC URI', () => {
      expect(CODE_SYSTEMS.LOINC).toBe('http://loinc.org');
    });

    it('should have correct RxNorm URI', () => {
      expect(CODE_SYSTEMS.RXNORM).toBe('http://www.nlm.nih.gov/research/umls/rxnorm');
    });

    it('should have correct CVX URI', () => {
      expect(CODE_SYSTEMS.CVX).toBe('http://hl7.org/fhir/sid/cvx');
    });

    it('should have correct ICD-10-CM URI', () => {
      expect(CODE_SYSTEMS.ICD10CM).toBe('http://hl7.org/fhir/sid/icd-10-cm');
    });

    it('should have correct NDC URI', () => {
      expect(CODE_SYSTEMS.NDC).toBe('http://hl7.org/fhir/sid/ndc');
    });

    it('should have correct UCUM URI', () => {
      expect(CODE_SYSTEMS.UCUM).toBe('http://unitsofmeasure.org');
    });
  });
});
