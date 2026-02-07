/**
 * Unit Tests: FHIR Resource Mapper Utilities
 *
 * Tests for /packages/shared/src/utils/fhir-mapper.ts
 * Covers bidirectional mapping between internal types and FHIR R4 resources.
 */

import {
  toFHIRHumanName,
  fromFHIRHumanName,
  toFHIRAddress,
  fromFHIRAddress,
  toFHIRContactPoint,
  fromFHIRContactPoint,
  toFHIRCodeableConcept,
  fromFHIRCodeableConcept,
  toFHIRReference,
  fromFHIRReference,
  toFHIRIdentifier,
  fromFHIRIdentifier,
  InternalName,
  InternalCode,
  InternalReference,
  InternalIdentifier,
} from '../../../packages/shared/src/utils/fhir-mapper';

import { PhoneUse, PhoneSystem, AddressUse, AddressType } from '../../../packages/shared/src/types/patient';

// =============================================================================
// HumanName: toFHIRHumanName / fromFHIRHumanName
// =============================================================================

describe('toFHIRHumanName', () => {
  it('should map firstName and lastName to given and family', () => {
    const name: InternalName = { firstName: 'John', lastName: 'Doe' };
    const fhirName = toFHIRHumanName(name);

    expect(fhirName.family).toBe('Doe');
    expect(fhirName.given).toEqual(['John']);
    expect(fhirName.use).toBe('official');
  });

  it('should include middleName in given array', () => {
    const name: InternalName = { firstName: 'John', middleName: 'Michael', lastName: 'Doe' };
    const fhirName = toFHIRHumanName(name);

    expect(fhirName.given).toEqual(['John', 'Michael']);
  });

  it('should include prefix and suffix', () => {
    const name: InternalName = {
      firstName: 'John',
      lastName: 'Doe',
      prefix: 'Dr.',
      suffix: 'Jr.',
    };
    const fhirName = toFHIRHumanName(name);

    expect(fhirName.prefix).toEqual(['Dr.']);
    expect(fhirName.suffix).toEqual(['Jr.']);
  });

  it('should generate a text representation', () => {
    const name: InternalName = {
      firstName: 'John',
      middleName: 'M',
      lastName: 'Doe',
      prefix: 'Dr.',
      suffix: 'III',
    };
    const fhirName = toFHIRHumanName(name);

    expect(fhirName.text).toBe('Dr. John M Doe III');
  });

  it('should use provided use value', () => {
    const name: InternalName = { firstName: 'Jane', lastName: 'Doe', use: 'nickname' };
    const fhirName = toFHIRHumanName(name);

    expect(fhirName.use).toBe('nickname');
  });

  it('should not include prefix/suffix arrays when not provided', () => {
    const name: InternalName = { firstName: 'John', lastName: 'Doe' };
    const fhirName = toFHIRHumanName(name);

    expect(fhirName.prefix).toBeUndefined();
    expect(fhirName.suffix).toBeUndefined();
  });
});

describe('fromFHIRHumanName', () => {
  it('should map given[0] to firstName and family to lastName', () => {
    const fhirName = { given: ['John'], family: 'Doe', use: 'official' as const };
    const name = fromFHIRHumanName(fhirName);

    expect(name.firstName).toBe('John');
    expect(name.lastName).toBe('Doe');
    expect(name.use).toBe('official');
  });

  it('should map additional given names to middleName', () => {
    const fhirName = { given: ['John', 'Michael', 'Robert'], family: 'Doe' };
    const name = fromFHIRHumanName(fhirName);

    expect(name.middleName).toBe('Michael Robert');
  });

  it('should map prefix and suffix arrays to strings', () => {
    const fhirName = {
      given: ['John'],
      family: 'Doe',
      prefix: ['Dr.'],
      suffix: ['Jr.', 'MD'],
    };
    const name = fromFHIRHumanName(fhirName);

    expect(name.prefix).toBe('Dr.');
    expect(name.suffix).toBe('Jr. MD');
  });

  it('should handle missing given and family', () => {
    const fhirName = {};
    const name = fromFHIRHumanName(fhirName);

    expect(name.firstName).toBe('');
    expect(name.lastName).toBe('');
  });

  it('should round-trip: toFHIR then fromFHIR preserves core data', () => {
    const original: InternalName = {
      firstName: 'Jane',
      middleName: 'Anne',
      lastName: 'Smith',
      prefix: 'Mrs.',
      suffix: 'PhD',
      use: 'official',
    };

    const fhirName = toFHIRHumanName(original);
    const roundTripped = fromFHIRHumanName(fhirName);

    expect(roundTripped.firstName).toBe(original.firstName);
    expect(roundTripped.middleName).toBe(original.middleName);
    expect(roundTripped.lastName).toBe(original.lastName);
    expect(roundTripped.prefix).toBe(original.prefix);
    expect(roundTripped.suffix).toBe(original.suffix);
    expect(roundTripped.use).toBe(original.use);
  });
});

// =============================================================================
// Address: toFHIRAddress / fromFHIRAddress
// =============================================================================

describe('toFHIRAddress', () => {
  it('should map line1 to line array', () => {
    const address = { line1: '123 Main St', city: 'Anytown', state: 'CA', postalCode: '90210' };
    const fhir = toFHIRAddress(address);

    expect(fhir.line).toEqual(['123 Main St']);
    expect(fhir.city).toBe('Anytown');
    expect(fhir.state).toBe('CA');
    expect(fhir.postalCode).toBe('90210');
  });

  it('should include line2 in line array', () => {
    const address = { line1: '123 Main St', line2: 'Apt 4B', city: 'Anytown', state: 'CA', postalCode: '90210' };
    const fhir = toFHIRAddress(address);

    expect(fhir.line).toEqual(['123 Main St', 'Apt 4B']);
  });

  it('should map use and type', () => {
    const address = {
      line1: '123 Main St', city: 'Anytown', state: 'CA', postalCode: '90210',
      use: AddressUse.HOME, type: AddressType.PHYSICAL,
    };
    const fhir = toFHIRAddress(address);

    expect(fhir.use).toBe('home');
    expect(fhir.type).toBe('physical');
  });

  it('should include country when provided', () => {
    const address = {
      line1: '123 Main St', city: 'Anytown', state: 'CA', postalCode: '90210',
      country: 'US',
    };
    const fhir = toFHIRAddress(address);

    expect(fhir.country).toBe('US');
  });

  it('should generate text representation', () => {
    const address = { line1: '123 Main St', city: 'Anytown', state: 'CA', postalCode: '90210' };
    const fhir = toFHIRAddress(address);

    expect(fhir.text).toBe('123 Main St, Anytown, CA 90210');
  });
});

describe('fromFHIRAddress', () => {
  it('should map line[0] to line1', () => {
    const fhir = { line: ['123 Main St'], city: 'Anytown', state: 'CA', postalCode: '90210' };
    const address = fromFHIRAddress(fhir);

    expect(address.line1).toBe('123 Main St');
    expect(address.city).toBe('Anytown');
    expect(address.state).toBe('CA');
    expect(address.postalCode).toBe('90210');
  });

  it('should map additional lines to line2', () => {
    const fhir = { line: ['123 Main St', 'Apt 4B', 'Floor 2'], city: 'Anytown', state: 'CA', postalCode: '90210' };
    const address = fromFHIRAddress(fhir);

    expect(address.line2).toBe('Apt 4B, Floor 2');
  });

  it('should handle missing fields with defaults', () => {
    const fhir = {};
    const address = fromFHIRAddress(fhir);

    expect(address.line1).toBe('');
    expect(address.city).toBe('');
    expect(address.state).toBe('');
    expect(address.postalCode).toBe('');
  });

  it('should round-trip address data', () => {
    const original = {
      line1: '456 Oak Ave',
      line2: 'Suite 100',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62704',
      country: 'US',
      use: AddressUse.WORK,
      type: AddressType.BOTH,
    };

    const fhir = toFHIRAddress(original);
    const roundTripped = fromFHIRAddress(fhir);

    expect(roundTripped.line1).toBe(original.line1);
    expect(roundTripped.line2).toBe(original.line2);
    expect(roundTripped.city).toBe(original.city);
    expect(roundTripped.state).toBe(original.state);
    expect(roundTripped.postalCode).toBe(original.postalCode);
    expect(roundTripped.country).toBe(original.country);
  });
});

// =============================================================================
// ContactPoint: toFHIRContactPoint / fromFHIRContactPoint
// =============================================================================

describe('toFHIRContactPoint', () => {
  it('should map phone value with default system', () => {
    const phone = { value: '555-123-4567' };
    const fhir = toFHIRContactPoint(phone);

    expect(fhir.value).toBe('555-123-4567');
    expect(fhir.system).toBe('phone');
  });

  it('should map explicit system and use', () => {
    const phone = { value: '555-123-4567', system: PhoneSystem.FAX, use: PhoneUse.WORK };
    const fhir = toFHIRContactPoint(phone);

    expect(fhir.system).toBe('fax');
    expect(fhir.use).toBe('work');
  });

  it('should handle mobile use', () => {
    const phone = { value: '555-123-4567', use: PhoneUse.MOBILE };
    const fhir = toFHIRContactPoint(phone);

    expect(fhir.use).toBe('mobile');
  });

  it('should not set use when not provided', () => {
    const phone = { value: '555-123-4567' };
    const fhir = toFHIRContactPoint(phone);

    expect(fhir.use).toBeUndefined();
  });
});

describe('fromFHIRContactPoint', () => {
  it('should map value from FHIR contact point', () => {
    const fhir = { value: '555-123-4567', system: 'phone' as const, use: 'home' as const };
    const phone = fromFHIRContactPoint(fhir);

    expect(phone.value).toBe('555-123-4567');
    expect(phone.system).toBe(PhoneSystem.PHONE);
    expect(phone.use).toBe(PhoneUse.HOME);
  });

  it('should handle missing value', () => {
    const fhir = { system: 'phone' as const };
    const phone = fromFHIRContactPoint(fhir);

    expect(phone.value).toBe('');
  });

  it('should round-trip phone data', () => {
    const original = { value: '555-999-0000', system: PhoneSystem.SMS, use: PhoneUse.MOBILE };
    const fhir = toFHIRContactPoint(original);
    const roundTripped = fromFHIRContactPoint(fhir);

    expect(roundTripped.value).toBe(original.value);
    expect(roundTripped.system).toBe(original.system);
    expect(roundTripped.use).toBe(original.use);
  });
});

// =============================================================================
// CodeableConcept: toFHIRCodeableConcept / fromFHIRCodeableConcept
// =============================================================================

describe('toFHIRCodeableConcept', () => {
  it('should map code, display, and system to coding array', () => {
    const internal: InternalCode = {
      code: '73211009',
      display: 'Diabetes mellitus',
      system: 'http://snomed.info/sct',
    };
    const cc = toFHIRCodeableConcept(internal);

    expect(cc.coding).toHaveLength(1);
    expect(cc.coding![0].code).toBe('73211009');
    expect(cc.coding![0].display).toBe('Diabetes mellitus');
    expect(cc.coding![0].system).toBe('http://snomed.info/sct');
  });

  it('should set text from display', () => {
    const internal: InternalCode = { code: '12345', display: 'Test condition' };
    const cc = toFHIRCodeableConcept(internal);

    expect(cc.text).toBe('Test condition');
  });

  it('should fall back to code for text when no display', () => {
    const internal: InternalCode = { code: '12345' };
    const cc = toFHIRCodeableConcept(internal);

    expect(cc.text).toBe('12345');
  });

  it('should omit system and display from coding when not provided', () => {
    const internal: InternalCode = { code: '12345' };
    const cc = toFHIRCodeableConcept(internal);

    expect(cc.coding![0].system).toBeUndefined();
    expect(cc.coding![0].display).toBeUndefined();
  });
});

describe('fromFHIRCodeableConcept', () => {
  it('should extract code, display, and system from first coding', () => {
    const cc = {
      coding: [{ code: '73211009', display: 'Diabetes mellitus', system: 'http://snomed.info/sct' }],
      text: 'Diabetes',
    };
    const internal = fromFHIRCodeableConcept(cc);

    expect(internal.code).toBe('73211009');
    expect(internal.display).toBe('Diabetes mellitus');
    expect(internal.system).toBe('http://snomed.info/sct');
  });

  it('should fall back to text for display when coding has no display', () => {
    const cc = { coding: [{ code: '12345' }], text: 'Fallback text' };
    const internal = fromFHIRCodeableConcept(cc);

    expect(internal.display).toBe('Fallback text');
  });

  it('should handle empty coding array', () => {
    const cc = { coding: [], text: 'Only text' };
    const internal = fromFHIRCodeableConcept(cc);

    expect(internal.code).toBe('');
    expect(internal.display).toBe('Only text');
  });

  it('should handle missing coding and text', () => {
    const cc = {};
    const internal = fromFHIRCodeableConcept(cc);

    expect(internal.code).toBe('');
    expect(internal.display).toBe('');
  });

  it('should round-trip CodeableConcept data', () => {
    const original: InternalCode = {
      code: 'E11.9',
      display: 'Type 2 DM without complications',
      system: 'http://hl7.org/fhir/sid/icd-10-cm',
    };
    const cc = toFHIRCodeableConcept(original);
    const roundTripped = fromFHIRCodeableConcept(cc);

    expect(roundTripped.code).toBe(original.code);
    expect(roundTripped.display).toBe(original.display);
    expect(roundTripped.system).toBe(original.system);
  });
});

// =============================================================================
// Reference: toFHIRReference / fromFHIRReference
// =============================================================================

describe('toFHIRReference', () => {
  it('should construct reference URL from type and id', () => {
    const internal: InternalReference = { resourceType: 'Patient', id: '12345' };
    const ref = toFHIRReference(internal);

    expect(ref.reference).toBe('Patient/12345');
    expect(ref.type).toBe('Patient');
  });

  it('should include display when provided', () => {
    const internal: InternalReference = { resourceType: 'Practitioner', id: '678', display: 'Dr. Smith' };
    const ref = toFHIRReference(internal);

    expect(ref.display).toBe('Dr. Smith');
  });

  it('should not include display when not provided', () => {
    const internal: InternalReference = { resourceType: 'Patient', id: '123' };
    const ref = toFHIRReference(internal);

    expect(ref.display).toBeUndefined();
  });
});

describe('fromFHIRReference', () => {
  it('should parse reference URL back to type and id', () => {
    const ref = { reference: 'Patient/12345', type: 'Patient' };
    const internal = fromFHIRReference(ref);

    expect(internal.resourceType).toBe('Patient');
    expect(internal.id).toBe('12345');
  });

  it('should handle absolute references', () => {
    const ref = { reference: 'http://example.com/fhir/Patient/12345' };
    const internal = fromFHIRReference(ref);

    expect(internal.resourceType).toBe('Patient');
    expect(internal.id).toBe('12345');
  });

  it('should include display', () => {
    const ref = { reference: 'Practitioner/678', display: 'Dr. Smith' };
    const internal = fromFHIRReference(ref);

    expect(internal.display).toBe('Dr. Smith');
  });

  it('should fall back to type when reference is missing', () => {
    const ref = { type: 'Observation' };
    const internal = fromFHIRReference(ref);

    expect(internal.resourceType).toBe('Observation');
    expect(internal.id).toBe('');
  });

  it('should round-trip reference data', () => {
    const original: InternalReference = { resourceType: 'Encounter', id: 'enc-789', display: 'Office Visit' };
    const ref = toFHIRReference(original);
    const roundTripped = fromFHIRReference(ref);

    expect(roundTripped.resourceType).toBe(original.resourceType);
    expect(roundTripped.id).toBe(original.id);
    expect(roundTripped.display).toBe(original.display);
  });
});

// =============================================================================
// Identifier: toFHIRIdentifier / fromFHIRIdentifier
// =============================================================================

describe('toFHIRIdentifier', () => {
  it('should map system and value', () => {
    const internal: InternalIdentifier = {
      system: 'http://hospital.example.com/mrn',
      value: 'MRN-001',
    };
    const fhir = toFHIRIdentifier(internal);

    expect(fhir.system).toBe('http://hospital.example.com/mrn');
    expect(fhir.value).toBe('MRN-001');
  });

  it('should include use when provided', () => {
    const internal: InternalIdentifier = {
      system: 'http://hospital.example.com/mrn',
      value: 'MRN-001',
      use: 'official',
    };
    const fhir = toFHIRIdentifier(internal);

    expect(fhir.use).toBe('official');
  });

  it('should not include use when not provided', () => {
    const internal: InternalIdentifier = { system: 'http://example.com', value: '123' };
    const fhir = toFHIRIdentifier(internal);

    expect(fhir.use).toBeUndefined();
  });
});

describe('fromFHIRIdentifier', () => {
  it('should map system and value from FHIR identifier', () => {
    const fhir = { system: 'http://example.com', value: 'ID-123', use: 'official' as const };
    const internal = fromFHIRIdentifier(fhir);

    expect(internal.system).toBe('http://example.com');
    expect(internal.value).toBe('ID-123');
    expect(internal.use).toBe('official');
  });

  it('should handle missing system and value', () => {
    const fhir = {};
    const internal = fromFHIRIdentifier(fhir);

    expect(internal.system).toBe('');
    expect(internal.value).toBe('');
  });

  it('should round-trip identifier data', () => {
    const original: InternalIdentifier = {
      system: 'http://example.com/ssn',
      value: '123-45-6789',
      use: 'secondary',
    };
    const fhir = toFHIRIdentifier(original);
    const roundTripped = fromFHIRIdentifier(fhir);

    expect(roundTripped.system).toBe(original.system);
    expect(roundTripped.value).toBe(original.value);
    expect(roundTripped.use).toBe(original.use);
  });
});
