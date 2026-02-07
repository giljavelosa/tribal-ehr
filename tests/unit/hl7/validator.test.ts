/**
 * Unit Tests: HL7v2 Message Validator
 *
 * Tests for /packages/hl7-engine/src/validator/message-validator.ts
 * Covers: required segment validation per message type, unknown message types,
 *         error messages, and field format validation.
 */

import { MessageValidator } from '../../../packages/hl7-engine/src/validator/message-validator';
import { HL7Parser } from '../../../packages/hl7-engine/src/parser/hl7-parser';

describe('MessageValidator', () => {
  let validator: MessageValidator;
  let parser: HL7Parser;

  beforeEach(() => {
    validator = new MessageValidator();
    parser = new HL7Parser();
  });

  // ===========================================================================
  // ADT^A01 validation
  // ===========================================================================

  describe('ADT^A01 validation', () => {
    it('should pass validation for a valid ADT^A01 message', () => {
      const msg =
        'MSH|^~\\&|TRIBAL|FAC|DEST|FAC|20240115120000||ADT^A01|MSG001|P|2.5.1\r' +
        'EVN|A01|20240115120000\r' +
        'PID|1||MRN001^^^TRIBAL^MR||DOE^JOHN||19800515|M\r' +
        'PV1|1|I|ICU^101^A';

      const parsed = parser.parse(msg);
      const result = validator.validate(parsed);

      expect(result.valid).toBe(true);
    });

    it('should fail when PID segment is missing from ADT^A01', () => {
      const msg =
        'MSH|^~\\&|TRIBAL|FAC|DEST|FAC|20240115120000||ADT^A01|MSG001|P|2.5.1\r' +
        'EVN|A01|20240115120000\r' +
        'PV1|1|I|ICU^101^A';

      const parsed = parser.parse(msg);
      const result = validator.validate(parsed);

      expect(result.valid).toBe(false);
      const pidError = result.errors.find(
        (e) => e.segment === 'PID' && e.code === 'MISSING_REQUIRED_SEGMENT'
      );
      expect(pidError).toBeDefined();
      expect(pidError!.message).toContain('PID');
    });

    it('should fail when PV1 segment is missing from ADT^A01', () => {
      const msg =
        'MSH|^~\\&|TRIBAL|FAC|DEST|FAC|20240115120000||ADT^A01|MSG001|P|2.5.1\r' +
        'EVN|A01|20240115120000\r' +
        'PID|1||MRN001^^^TRIBAL^MR||DOE^JOHN||19800515|M';

      const parsed = parser.parse(msg);
      const result = validator.validate(parsed);

      expect(result.valid).toBe(false);
      const pv1Error = result.errors.find(
        (e) => e.segment === 'PV1' && e.code === 'MISSING_REQUIRED_SEGMENT'
      );
      expect(pv1Error).toBeDefined();
    });

    it('should fail when EVN segment is missing from ADT^A01', () => {
      const msg =
        'MSH|^~\\&|TRIBAL|FAC|DEST|FAC|20240115120000||ADT^A01|MSG001|P|2.5.1\r' +
        'PID|1||MRN001^^^TRIBAL^MR||DOE^JOHN||19800515|M\r' +
        'PV1|1|I|ICU^101^A';

      const parsed = parser.parse(msg);
      const result = validator.validate(parsed);

      expect(result.valid).toBe(false);
      const evnError = result.errors.find(
        (e) => e.segment === 'EVN' && e.code === 'MISSING_REQUIRED_SEGMENT'
      );
      expect(evnError).toBeDefined();
    });
  });

  // ===========================================================================
  // ORU^R01 validation
  // ===========================================================================

  describe('ORU^R01 validation', () => {
    it('should pass validation for a valid ORU^R01 message', () => {
      const msg =
        'MSH|^~\\&|LAB|FAC|DEST|FAC|20240115120000||ORU^R01|MSG002|P|2.5.1\r' +
        'PID|1||MRN001^^^TRIBAL^MR||DOE^JOHN||19800515|M\r' +
        'OBR|1|||CBC^Complete Blood Count^LOINC\r' +
        'OBX|1|NM|718-7^Hemoglobin^LOINC||14.2|g/dL|12.0-17.5|N||F';

      const parsed = parser.parse(msg);
      const result = validator.validate(parsed);

      expect(result.valid).toBe(true);
    });

    it('should fail when OBX is missing from ORU^R01', () => {
      const msg =
        'MSH|^~\\&|LAB|FAC|DEST|FAC|20240115120000||ORU^R01|MSG002|P|2.5.1\r' +
        'PID|1||MRN001^^^TRIBAL^MR||DOE^JOHN||19800515|M\r' +
        'OBR|1|||CBC^Complete Blood Count^LOINC';

      const parsed = parser.parse(msg);
      const result = validator.validate(parsed);

      expect(result.valid).toBe(false);
      const obxError = result.errors.find(
        (e) => e.segment === 'OBX' && e.code === 'MISSING_REQUIRED_SEGMENT'
      );
      expect(obxError).toBeDefined();
    });

    it('should fail when OBR is missing from ORU^R01', () => {
      const msg =
        'MSH|^~\\&|LAB|FAC|DEST|FAC|20240115120000||ORU^R01|MSG002|P|2.5.1\r' +
        'PID|1||MRN001^^^TRIBAL^MR||DOE^JOHN||19800515|M\r' +
        'OBX|1|NM|718-7^Hemoglobin^LOINC||14.2|g/dL|12.0-17.5|N||F';

      const parsed = parser.parse(msg);
      const result = validator.validate(parsed);

      expect(result.valid).toBe(false);
      const obrError = result.errors.find(
        (e) => e.segment === 'OBR' && e.code === 'MISSING_REQUIRED_SEGMENT'
      );
      expect(obrError).toBeDefined();
    });
  });

  // ===========================================================================
  // VXU^V04 validation
  // ===========================================================================

  describe('VXU^V04 validation', () => {
    it('should pass validation for a valid VXU^V04 message', () => {
      const msg =
        'MSH|^~\\&|EHR|FAC|IIS|FAC|20240115120000||VXU^V04|MSG003|P|2.5.1\r' +
        'PID|1||MRN001^^^TRIBAL^MR||DOE^JOHN||19800515|M\r' +
        'RXA|0|1|20240115|20240115|141^Influenza^CVX|0.5|mL';

      const parsed = parser.parse(msg);
      const result = validator.validate(parsed);

      expect(result.valid).toBe(true);
    });

    it('should fail when RXA is missing from VXU^V04', () => {
      const msg =
        'MSH|^~\\&|EHR|FAC|IIS|FAC|20240115120000||VXU^V04|MSG003|P|2.5.1\r' +
        'PID|1||MRN001^^^TRIBAL^MR||DOE^JOHN||19800515|M';

      const parsed = parser.parse(msg);
      const result = validator.validate(parsed);

      expect(result.valid).toBe(false);
      const rxaError = result.errors.find(
        (e) => e.segment === 'RXA' && e.code === 'MISSING_REQUIRED_SEGMENT'
      );
      expect(rxaError).toBeDefined();
    });
  });

  // ===========================================================================
  // Unknown message type
  // ===========================================================================

  describe('unknown message type', () => {
    it('should return a warning for an unknown message type', () => {
      const msg =
        'MSH|^~\\&|APP|FAC|DEST|FAC|20240115120000||ZZZ^Z01|MSG004|P|2.5.1\r' +
        'PID|1||MRN001^^^TRIBAL^MR||DOE^JOHN||19800515|M';

      const parsed = parser.parse(msg);
      const result = validator.validate(parsed);

      // Unknown message types are warnings, not errors, so the message is still "valid"
      const unknownWarning = result.errors.find(
        (e) => e.code === 'UNKNOWN_MESSAGE_TYPE'
      );
      expect(unknownWarning).toBeDefined();
      expect(unknownWarning!.severity).toBe('warning');
      expect(unknownWarning!.message).toContain('ZZZ^Z01');
    });
  });

  // ===========================================================================
  // Required segment error messages
  // ===========================================================================

  describe('required segment error messages', () => {
    it('should include the segment name in the error message', () => {
      const msg =
        'MSH|^~\\&|TRIBAL|FAC|DEST|FAC|20240115120000||ADT^A01|MSG001|P|2.5.1\r' +
        'EVN|A01|20240115120000\r' +
        'PV1|1|I|ICU^101^A';

      const parsed = parser.parse(msg);
      const result = validator.validate(parsed);

      const pidError = result.errors.find(
        (e) => e.segment === 'PID' && e.code === 'MISSING_REQUIRED_SEGMENT'
      );
      expect(pidError).toBeDefined();
      expect(pidError!.message).toContain('PID');
      expect(pidError!.severity).toBe('error');
    });
  });

  // ===========================================================================
  // Field format validation
  // ===========================================================================

  describe('field format validation', () => {
    it('should warn on invalid PV1-2 patient class', () => {
      const msg =
        'MSH|^~\\&|TRIBAL|FAC|DEST|FAC|20240115120000||ADT^A01|MSG001|P|2.5.1\r' +
        'EVN|A01|20240115120000\r' +
        'PID|1||MRN001^^^TRIBAL^MR||DOE^JOHN||19800515|M\r' +
        'PV1|1|X|ICU^101^A';

      const parsed = parser.parse(msg);
      const result = validator.validate(parsed);

      const classWarning = result.errors.find(
        (e) => e.segment === 'PV1' && e.code === 'INVALID_PATIENT_CLASS'
      );
      expect(classWarning).toBeDefined();
      expect(classWarning!.severity).toBe('warning');
    });

    it('should warn on invalid PID-8 sex code', () => {
      const msg =
        'MSH|^~\\&|TRIBAL|FAC|DEST|FAC|20240115120000||ADT^A01|MSG001|P|2.5.1\r' +
        'EVN|A01|20240115120000\r' +
        'PID|1||MRN001^^^TRIBAL^MR||DOE^JOHN||19800515|Z\r' +
        'PV1|1|I|ICU^101^A';

      const parsed = parser.parse(msg);
      const result = validator.validate(parsed);

      const sexWarning = result.errors.find(
        (e) => e.segment === 'PID' && e.code === 'INVALID_SEX_CODE'
      );
      expect(sexWarning).toBeDefined();
    });
  });

  // ===========================================================================
  // Custom rules
  // ===========================================================================

  describe('custom rules', () => {
    it('should validate custom registered rules', () => {
      validator.registerRules('PID', [
        {
          segmentName: 'PID',
          fieldIndex: 7,
          required: true,
          fieldName: 'Date of Birth',
        },
      ]);

      const msg =
        'MSH|^~\\&|TRIBAL|FAC|DEST|FAC|20240115120000||ADT^A01|MSG001|P|2.5.1\r' +
        'EVN|A01|20240115120000\r' +
        'PID|1||MRN001^^^TRIBAL^MR||DOE^JOHN\r' +
        'PV1|1|I|ICU^101^A';

      const parsed = parser.parse(msg);
      const result = validator.validate(parsed);

      const dobError = result.errors.find(
        (e) => e.segment === 'PID' && e.field === 7 && e.code === 'REQUIRED_FIELD_MISSING'
      );
      expect(dobError).toBeDefined();
    });

    it('should clear custom rules', () => {
      validator.registerRules('PID', [
        {
          segmentName: 'PID',
          fieldIndex: 7,
          required: true,
          fieldName: 'Date of Birth',
        },
      ]);
      validator.clearCustomRules();

      const msg =
        'MSH|^~\\&|TRIBAL|FAC|DEST|FAC|20240115120000||ADT^A01|MSG001|P|2.5.1\r' +
        'EVN|A01|20240115120000\r' +
        'PID|1||MRN001^^^TRIBAL^MR||DOE^JOHN\r' +
        'PV1|1|I|ICU^101^A';

      const parsed = parser.parse(msg);
      const result = validator.validate(parsed);

      const dobError = result.errors.find(
        (e) => e.segment === 'PID' && e.field === 7 && e.code === 'REQUIRED_FIELD_MISSING'
      );
      expect(dobError).toBeUndefined();
    });
  });
});
