/**
 * Unit Tests: HL7v2 Message Parser
 *
 * Tests for /packages/hl7-engine/src/parser/hl7-parser.ts
 * Covers: parsing ADT^A01, encoding characters, component/repetition/subcomponent
 *         separators, escape sequences, empty fields, malformed messages, OBX parsing.
 */

import { HL7Parser } from '../../../packages/hl7-engine/src/parser/hl7-parser';

describe('HL7Parser', () => {
  let parser: HL7Parser;

  beforeEach(() => {
    parser = new HL7Parser();
  });

  // ===========================================================================
  // Parse a valid ADT^A01 message
  // ===========================================================================

  describe('parse valid ADT^A01 message', () => {
    const adtMessage =
      'MSH|^~\\&|TRIBAL|FACILITY|DEST|FAC|20240115120000||ADT^A01|MSG00001|P|2.5.1\r' +
      'EVN|A01|20240115120000\r' +
      'PID|1||MRN001^^^TRIBAL^MR||DOE^JOHN^M||19800515|M|||123 MAIN ST^^ANYTOWN^CA^90210||555-123-4567\r' +
      'PV1|1|I|ICU^101^A';

    it('should parse 4 segments from the message', () => {
      const message = parser.parse(adtMessage);

      expect(message.segments).toHaveLength(4);
      expect(message.segments.map((s) => s.name)).toEqual(['MSH', 'EVN', 'PID', 'PV1']);
    });

    it('should correctly extract MSH header fields', () => {
      const message = parser.parse(adtMessage);

      expect(message.header.sendingApplication).toBe('TRIBAL');
      expect(message.header.sendingFacility).toBe('FACILITY');
      expect(message.header.receivingApplication).toBe('DEST');
      expect(message.header.receivingFacility).toBe('FAC');
      expect(message.header.dateTime).toBe('20240115120000');
      expect(message.header.messageType).toBe('ADT^A01');
      expect(message.header.messageControlId).toBe('MSG00001');
      expect(message.header.processingId).toBe('P');
      expect(message.header.versionId).toBe('2.5.1');
    });

    it('should parse the PID patient name correctly', () => {
      const message = parser.parse(adtMessage);
      const pidSegment = HL7Parser.findSegment(message, 'PID')!;

      // PID-5 (Patient Name) is field index 5
      const nameField = HL7Parser.getFieldValue(pidSegment, 5);
      expect(nameField).toContain('DOE');
      expect(nameField).toContain('JOHN');

      // Component 1 = family name (DOE), component 2 = given name (JOHN)
      const familyName = HL7Parser.getComponentValue(pidSegment, 5, 1);
      const givenName = HL7Parser.getComponentValue(pidSegment, 5, 2);
      expect(familyName).toBe('DOE');
      expect(givenName).toBe('JOHN');
    });

    it('should parse the PV1 location correctly', () => {
      const message = parser.parse(adtMessage);
      const pv1 = HL7Parser.findSegment(message, 'PV1')!;

      // PV1-2: Patient class
      expect(HL7Parser.getFieldValue(pv1, 2)).toBe('I');

      // PV1-3: Location (ICU^101^A)
      expect(HL7Parser.getComponentValue(pv1, 3, 1)).toBe('ICU');
      expect(HL7Parser.getComponentValue(pv1, 3, 2)).toBe('101');
      expect(HL7Parser.getComponentValue(pv1, 3, 3)).toBe('A');
    });

    it('should preserve the raw message', () => {
      const message = parser.parse(adtMessage);

      expect(message.raw).toBe(adtMessage);
    });
  });

  // ===========================================================================
  // Encoding characters
  // ===========================================================================

  describe('encoding characters', () => {
    it('should extract default encoding characters from MSH', () => {
      const msg = 'MSH|^~\\&|APP|FAC|||20240101000000||ADT^A01|1|P|2.5.1';
      const message = parser.parse(msg);

      expect(message.encodingCharacters.fieldSeparator).toBe('|');
      expect(message.encodingCharacters.componentSeparator).toBe('^');
      expect(message.encodingCharacters.repetitionSeparator).toBe('~');
      expect(message.encodingCharacters.escapeCharacter).toBe('\\');
      expect(message.encodingCharacters.subComponentSeparator).toBe('&');
    });

    it('should handle component separators (^) within fields', () => {
      const msg = 'MSH|^~\\&|APP|FAC|||20240101||ADT^A01|1|P|2.5.1\rPID|1||ID^^^AUTH^MR||DOE^JOHN';
      const message = parser.parse(msg);
      const pid = HL7Parser.findSegment(message, 'PID')!;

      // PID-3 components
      expect(HL7Parser.getComponentValue(pid, 3, 1)).toBe('ID');
      expect(HL7Parser.getComponentValue(pid, 3, 4)).toBe('AUTH');
      expect(HL7Parser.getComponentValue(pid, 3, 5)).toBe('MR');
    });

    it('should handle repetition separators (~)', () => {
      const msg =
        'MSH|^~\\&|APP|FAC|||20240101||ADT^A01|1|P|2.5.1\r' +
        'PID|1||ID1^^^AUTH~ID2^^^AUTH2||DOE^JOHN';
      const message = parser.parse(msg);
      const pid = HL7Parser.findSegment(message, 'PID')!;

      // PID-3 has repetitions
      const field = pid.fields[2]; // PID-3 (0-indexed)
      expect(field.repetitions.length).toBeGreaterThan(0);
    });

    it('should handle subcomponent separators (&)', () => {
      const msg =
        'MSH|^~\\&|APP|FAC|||20240101||ADT^A01|1|P|2.5.1\r' +
        'PID|1||ID^^^AUTH&SUB1&SUB2^MR||DOE^JOHN';
      const message = parser.parse(msg);
      const pid = HL7Parser.findSegment(message, 'PID')!;

      // PID-3, component 4 should have subcomponents
      const field = pid.fields[2]; // PID-3
      const component = field.components[3]; // 4th component (AUTH&SUB1&SUB2)
      expect(component.subComponents).toContain('AUTH');
      expect(component.subComponents).toContain('SUB1');
      expect(component.subComponents).toContain('SUB2');
    });
  });

  // ===========================================================================
  // Escape sequences
  // ===========================================================================

  describe('escape sequences', () => {
    it('should resolve \\F\\ to field separator', () => {
      const result = parser.resolveEscapeSequences(
        'before\\F\\after',
        {
          fieldSeparator: '|',
          componentSeparator: '^',
          repetitionSeparator: '~',
          escapeCharacter: '\\',
          subComponentSeparator: '&',
        }
      );
      expect(result).toBe('before|after');
    });

    it('should resolve \\S\\ to component separator', () => {
      const result = parser.resolveEscapeSequences(
        'before\\S\\after',
        {
          fieldSeparator: '|',
          componentSeparator: '^',
          repetitionSeparator: '~',
          escapeCharacter: '\\',
          subComponentSeparator: '&',
        }
      );
      expect(result).toBe('before^after');
    });

    it('should resolve \\R\\ to repetition separator', () => {
      const result = parser.resolveEscapeSequences(
        'test\\R\\value',
        {
          fieldSeparator: '|',
          componentSeparator: '^',
          repetitionSeparator: '~',
          escapeCharacter: '\\',
          subComponentSeparator: '&',
        }
      );
      expect(result).toBe('test~value');
    });

    it('should return string unchanged when no escape sequences', () => {
      const result = parser.resolveEscapeSequences(
        'no escapes here',
        {
          fieldSeparator: '|',
          componentSeparator: '^',
          repetitionSeparator: '~',
          escapeCharacter: '\\',
          subComponentSeparator: '&',
        }
      );
      expect(result).toBe('no escapes here');
    });
  });

  // ===========================================================================
  // Empty fields and edge cases
  // ===========================================================================

  describe('empty fields and edge cases', () => {
    it('should handle empty fields correctly', () => {
      const msg = 'MSH|^~\\&|APP|FAC|||20240101||ADT^A01|1|P|2.5.1\rPID|1||||DOE^JOHN';
      const message = parser.parse(msg);
      const pid = HL7Parser.findSegment(message, 'PID')!;

      // PID-2, PID-3, PID-4 should be empty
      expect(HL7Parser.getFieldValue(pid, 2)).toBe('');
      expect(HL7Parser.getFieldValue(pid, 3)).toBe('');
      expect(HL7Parser.getFieldValue(pid, 4)).toBe('');

      // PID-5 should have data
      expect(HL7Parser.getComponentValue(pid, 5, 1)).toBe('DOE');
    });

    it('should parse a message with only an MSH segment', () => {
      const msg = 'MSH|^~\\&|APP|FAC|||20240101||ADT^A01|1|P|2.5.1';
      const message = parser.parse(msg);

      expect(message.segments).toHaveLength(1);
      expect(message.segments[0].name).toBe('MSH');
    });

    it('should normalize \\n line endings to \\r', () => {
      const msg =
        'MSH|^~\\&|APP|FAC|||20240101||ADT^A01|1|P|2.5.1\n' +
        'PID|1||MRN001||DOE^JOHN';
      const message = parser.parse(msg);

      expect(message.segments).toHaveLength(2);
    });

    it('should normalize \\r\\n line endings to \\r', () => {
      const msg =
        'MSH|^~\\&|APP|FAC|||20240101||ADT^A01|1|P|2.5.1\r\n' +
        'PID|1||MRN001||DOE^JOHN';
      const message = parser.parse(msg);

      expect(message.segments).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Error handling
  // ===========================================================================

  describe('error handling', () => {
    it('should throw on empty message', () => {
      expect(() => parser.parse('')).toThrow('Empty or null message');
    });

    it('should throw on null message', () => {
      expect(() => parser.parse(null as any)).toThrow();
    });

    it('should throw when message does not start with MSH', () => {
      expect(() => parser.parse('PID|1||MRN001||DOE^JOHN')).toThrow('must start with MSH');
    });

    it('should throw on MSH segment too short for encoding characters', () => {
      expect(() => parser.parse('MSH|^')).toThrow();
    });
  });

  // ===========================================================================
  // Complex OBX observation
  // ===========================================================================

  describe('OBX observation parsing', () => {
    it('should parse a numeric OBX result correctly', () => {
      const msg =
        'MSH|^~\\&|LAB|FAC|||20240115||ORU^R01|1|P|2.5.1\r' +
        'PID|1||MRN001||DOE^JOHN\r' +
        'OBR|1|||CBC^Complete Blood Count^LOINC\r' +
        'OBX|1|NM|718-7^Hemoglobin^LOINC||14.2|g/dL^grams per deciliter|12.0-17.5|N|||F';

      const message = parser.parse(msg);
      const obx = HL7Parser.findSegment(message, 'OBX')!;

      // OBX-2: Value type
      expect(HL7Parser.getFieldValue(obx, 2)).toBe('NM');
      // OBX-3: Observation identifier
      expect(HL7Parser.getComponentValue(obx, 3, 1)).toBe('718-7');
      expect(HL7Parser.getComponentValue(obx, 3, 2)).toBe('Hemoglobin');
      // OBX-5: Value
      expect(HL7Parser.getFieldValue(obx, 5)).toBe('14.2');
      // OBX-7: Reference range
      expect(HL7Parser.getFieldValue(obx, 7)).toBe('12.0-17.5');
      // OBX-8: Abnormal flags
      expect(HL7Parser.getFieldValue(obx, 8)).toBe('N');
      // OBX-11: Result status
      expect(HL7Parser.getFieldValue(obx, 11)).toBe('F');
    });
  });

  // ===========================================================================
  // Static utility methods
  // ===========================================================================

  describe('static utility methods', () => {
    it('findSegments should return all segments matching a name', () => {
      const msg =
        'MSH|^~\\&|APP|FAC|||20240101||ORU^R01|1|P|2.5.1\r' +
        'PID|1||MRN001||DOE^JOHN\r' +
        'OBR|1|||CBC^CBC\r' +
        'OBX|1|NM|WBC||7.5\r' +
        'OBX|2|NM|RBC||5.2';

      const message = parser.parse(msg);
      const obxSegments = HL7Parser.findSegments(message, 'OBX');

      expect(obxSegments).toHaveLength(2);
    });

    it('findSegment should return the first matching segment', () => {
      const msg =
        'MSH|^~\\&|APP|FAC|||20240101||ADT^A01|1|P|2.5.1\r' +
        'PID|1||MRN001||DOE^JOHN';
      const message = parser.parse(msg);

      expect(HL7Parser.findSegment(message, 'PID')).toBeDefined();
      expect(HL7Parser.findSegment(message, 'ZZZ')).toBeUndefined();
    });

    it('getFieldValue should return empty string for non-existent field', () => {
      const msg = 'MSH|^~\\&|APP|FAC|||20240101||ADT^A01|1|P|2.5.1\rPID|1||MRN001';
      const message = parser.parse(msg);
      const pid = HL7Parser.findSegment(message, 'PID')!;

      expect(HL7Parser.getFieldValue(pid, 99)).toBe('');
    });
  });
});
