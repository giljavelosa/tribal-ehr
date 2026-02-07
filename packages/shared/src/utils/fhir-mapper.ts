// =============================================================================
// FHIR Resource Mapper Utilities
// Bidirectional mapping between internal types and FHIR R4 resources
// =============================================================================

import {
  HumanName,
  ContactPoint,
  CodeableConcept,
  Coding,
  Reference,
  Identifier,
  Period,
} from '../types/fhir';
import {
  Address,
  AddressUse,
  AddressType,
  PhoneNumber,
  PhoneUse,
  PhoneSystem,
} from '../types/patient';

// ---------------------------------------------------------------------------
// HumanName
// ---------------------------------------------------------------------------

export interface InternalName {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  prefix?: string;
  use?: string;
}

export function toFHIRHumanName(name: InternalName): HumanName {
  const given: string[] = [name.firstName];
  if (name.middleName) {
    given.push(name.middleName);
  }

  const result: HumanName = {
    use: (name.use as HumanName['use']) || 'official',
    family: name.lastName,
    given,
  };

  if (name.prefix) {
    result.prefix = [name.prefix];
  }
  if (name.suffix) {
    result.suffix = [name.suffix];
  }

  // Build text representation
  const parts: string[] = [];
  if (name.prefix) parts.push(name.prefix);
  parts.push(name.firstName);
  if (name.middleName) parts.push(name.middleName);
  parts.push(name.lastName);
  if (name.suffix) parts.push(name.suffix);
  result.text = parts.join(' ');

  return result;
}

export function fromFHIRHumanName(fhirName: HumanName): InternalName {
  const result: InternalName = {
    firstName: fhirName.given?.[0] || '',
    lastName: fhirName.family || '',
  };

  if (fhirName.given && fhirName.given.length > 1) {
    result.middleName = fhirName.given.slice(1).join(' ');
  }
  if (fhirName.suffix && fhirName.suffix.length > 0) {
    result.suffix = fhirName.suffix.join(' ');
  }
  if (fhirName.prefix && fhirName.prefix.length > 0) {
    result.prefix = fhirName.prefix.join(' ');
  }
  if (fhirName.use) {
    result.use = fhirName.use;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

interface FHIRAddress {
  use?: string;
  type?: string;
  text?: string;
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: Period;
}

export function toFHIRAddress(address: Address): FHIRAddress {
  const line: string[] = [address.line1];
  if (address.line2) {
    line.push(address.line2);
  }

  const result: FHIRAddress = {
    line,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
  };

  if (address.use) {
    result.use = address.use;
  }
  if (address.type) {
    result.type = address.type;
  }
  if (address.country) {
    result.country = address.country;
  }
  if (address.period) {
    result.period = address.period;
  }

  // Build text representation
  const textParts = [address.line1];
  if (address.line2) textParts.push(address.line2);
  textParts.push(`${address.city}, ${address.state} ${address.postalCode}`);
  if (address.country) textParts.push(address.country);
  result.text = textParts.join(', ');

  return result;
}

export function fromFHIRAddress(fhirAddress: FHIRAddress): Address {
  const result: Address = {
    line1: fhirAddress.line?.[0] || '',
    city: fhirAddress.city || '',
    state: fhirAddress.state || '',
    postalCode: fhirAddress.postalCode || '',
  };

  if (fhirAddress.line && fhirAddress.line.length > 1) {
    result.line2 = fhirAddress.line.slice(1).join(', ');
  }
  if (fhirAddress.use) {
    result.use = fhirAddress.use as AddressUse;
  }
  if (fhirAddress.type) {
    result.type = fhirAddress.type as AddressType;
  }
  if (fhirAddress.country) {
    result.country = fhirAddress.country;
  }
  if (fhirAddress.period) {
    result.period = fhirAddress.period;
  }

  return result;
}

// ---------------------------------------------------------------------------
// ContactPoint (Phone/Email)
// ---------------------------------------------------------------------------

export function toFHIRContactPoint(phone: PhoneNumber): ContactPoint {
  const result: ContactPoint = {
    value: phone.value,
  };

  if (phone.system) {
    result.system = phone.system as ContactPoint['system'];
  } else {
    result.system = 'phone';
  }

  if (phone.use) {
    result.use = phone.use as ContactPoint['use'];
  }

  return result;
}

export function fromFHIRContactPoint(fhirContact: ContactPoint): PhoneNumber {
  const result: PhoneNumber = {
    value: fhirContact.value || '',
  };

  if (fhirContact.system) {
    const systemMap: Record<string, PhoneSystem | undefined> = {
      phone: PhoneSystem.PHONE,
      fax: PhoneSystem.FAX,
      sms: PhoneSystem.SMS,
      pager: PhoneSystem.PAGER,
    };
    const mappedSystem = systemMap[fhirContact.system];
    if (mappedSystem) {
      result.system = mappedSystem;
    }
  }

  if (fhirContact.use) {
    const useMap: Record<string, PhoneUse | undefined> = {
      home: PhoneUse.HOME,
      work: PhoneUse.WORK,
      temp: PhoneUse.TEMP,
      old: PhoneUse.OLD,
      mobile: PhoneUse.MOBILE,
    };
    const mappedUse = useMap[fhirContact.use];
    if (mappedUse) {
      result.use = mappedUse;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// CodeableConcept
// ---------------------------------------------------------------------------

export interface InternalCode {
  code: string;
  display?: string;
  system?: string;
}

export function toFHIRCodeableConcept(internal: InternalCode): CodeableConcept {
  const coding: Coding = {
    code: internal.code,
  };

  if (internal.display) {
    coding.display = internal.display;
  }
  if (internal.system) {
    coding.system = internal.system;
  }

  return {
    coding: [coding],
    text: internal.display || internal.code,
  };
}

export function fromFHIRCodeableConcept(cc: CodeableConcept): InternalCode {
  const primaryCoding = cc.coding?.[0];

  return {
    code: primaryCoding?.code || '',
    display: primaryCoding?.display || cc.text || '',
    system: primaryCoding?.system,
  };
}

// ---------------------------------------------------------------------------
// Reference
// ---------------------------------------------------------------------------

export interface InternalReference {
  resourceType: string;
  id: string;
  display?: string;
}

export function toFHIRReference(internal: InternalReference): Reference {
  const result: Reference = {
    reference: `${internal.resourceType}/${internal.id}`,
    type: internal.resourceType,
  };

  if (internal.display) {
    result.display = internal.display;
  }

  return result;
}

export function fromFHIRReference(ref: Reference): InternalReference {
  const parts = ref.reference?.split('/') || [];
  const resourceType = parts.length >= 2 ? parts[parts.length - 2] : ref.type || '';
  const id = parts.length >= 2 ? parts[parts.length - 1] : '';

  return {
    resourceType,
    id,
    display: ref.display,
  };
}

// ---------------------------------------------------------------------------
// Identifier
// ---------------------------------------------------------------------------

export interface InternalIdentifier {
  system: string;
  value: string;
  use?: string;
}

export function toFHIRIdentifier(internal: InternalIdentifier): Identifier {
  const result: Identifier = {
    system: internal.system,
    value: internal.value,
  };

  if (internal.use) {
    result.use = internal.use as Identifier['use'];
  }

  return result;
}

export function fromFHIRIdentifier(fhirId: Identifier): InternalIdentifier {
  return {
    system: fhirId.system || '',
    value: fhirId.value || '',
    use: fhirId.use,
  };
}
