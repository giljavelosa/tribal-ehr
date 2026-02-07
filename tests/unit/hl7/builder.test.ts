/**
 * Unit Tests: HL7v2 Message Builder
 *
 * Tests for /packages/hl7-engine/src/builder/hl7-builder.ts
 * Covers: building ADT^A01, ORU^R01, VXU^V04 messages; MSH validation;
 *         field separators; segment terminators; control ID; timestamps; round-trip.
 */

import { HL7Builder } from '../../../packages/hl7-engine/src/builder/hl7-builder';
import { HL7Parser } from '../../../packages/hl7-engine/src/parser/hl7-parser';

describe('HL7Builder', () => {
  let builder: HL7Builder;

  beforeEach(() => {
    builder = new HL7Builder();
  });

  // ===========================================================================
  // Build ADT^A01 message
  // ===========================================================================

  describe('build ADT^A01 message', () => {
    it('should build a valid ADT^A01 message with MSH, EVN, PID, PV1 segments', () => {
      const msg = builder
        .createMessage('ADT', 'A01')
        .addMSH({ sendingApplication: 'TRIBAL-EHR', sendingFacility: 'MAIN-HOSPITAL' })
        .addEVN()
        .addPID({
          patientId: 'MRN001',
          lastName: 'DOE',
          firstName: 'JOHN',
          dateOfBirth: '19800515',
          gender: 'M',
        })
        .addPV1({ patientClass: 'I', assignedLocation: 'ICU', room: '101', bed: 'A' })
        .build();

      expect(msg).toContain('MSH|^~\\&|');
      expect(msg).toContain('EVN|');
      expect(msg).toContain('PID|');
      expect(msg).toContain('PV1|');
    });

    it('should have correct message type in MSH-9', () => {
      const msg = builder
        .createMessage('ADT', 'A01')
        .addMSH()
        .build();

      expect(msg).toContain('ADT^A01^ADT_A01');
    });
  });

  // ===========================================================================
  // Build ORU^R01 message
  // ===========================================================================

  describe('build ORU^R01 with observation results', () => {
    it('should build an ORU^R01 with PID, OBR, and OBX segments', () => {
      const msg = builder
        .createMessage('ORU', 'R01')
        .addMSH({ sendingApplication: 'LAB-SYSTEM' })
        .addPID({ patientId: 'MRN002', lastName: 'SMITH', firstName: 'JANE' })
        .addOBR({
          serviceCode: '58410-2',
          serviceText: 'CBC panel',
          codingSystem: 'LOINC',
          resultStatus: 'F',
        })
        .addOBX({
          setId: '1',
          valueType: 'NM',
          observationCode: '718-7',
          observationText: 'Hemoglobin',
          codingSystem: 'LOINC',
          value: '14.2',
          units: 'g/dL',
          referenceRange: '12.0-17.5',
          abnormalFlags: 'N',
          resultStatus: 'F',
        })
        .build();

      expect(msg).toContain('ORU^R01^ORU_R01');
      expect(msg).toContain('OBR|');
      expect(msg).toContain('OBX|');
      expect(msg).toContain('718-7^Hemoglobin^LOINC');
      expect(msg).toContain('14.2');
    });
  });

  // ===========================================================================
  // Build VXU^V04 immunization message
  // ===========================================================================

  describe('build VXU^V04 immunization message', () => {
    it('should build a VXU^V04 with MSH and PID segments', () => {
      const msg = builder
        .createMessage('VXU', 'V04')
        .addMSH({ sendingApplication: 'EHR-IMMUNIZATION' })
        .addPID({ patientId: 'MRN003', lastName: 'GARCIA', firstName: 'MARIA' })
        .build();

      expect(msg).toContain('VXU^V04^VXU_V04');
      expect(msg).toContain('PID|');
      expect(msg).toContain('GARCIA^MARIA');
    });
  });

  // ===========================================================================
  // MSH segment verification
  // ===========================================================================

  describe('MSH segment properties', () => {
    it('should have correct message type in MSH-9', () => {
      const msg = builder
        .createMessage('ORM', 'O01')
        .addMSH()
        .build();

      expect(msg).toContain('ORM^O01^ORM_O01');
    });

    it('should have proper field separators in output', () => {
      const msg = builder
        .createMessage('ADT', 'A01')
        .addMSH()
        .build();

      // MSH must start with MSH|^~\&|
      expect(msg.startsWith('MSH|^~\\&|')).toBe(true);
    });

    it('should generate a message control ID', () => {
      const controlId = HL7Builder.generateControlId();

      expect(controlId).toBeTruthy();
      expect(controlId.length).toBeLessThanOrEqual(20);
      expect(controlId).toMatch(/^[0-9A-F]+$/);
    });

    it('should generate a timestamp in YYYYMMDDHHMMSS format', () => {
      const timestamp = HL7Builder.generateTimestamp();

      expect(timestamp).toMatch(/^\d{14}$/);
    });
  });

  // ===========================================================================
  // Segment terminator
  // ===========================================================================

  describe('segment terminator', () => {
    it('should use \\r as segment terminator between segments', () => {
      const msg = builder
        .createMessage('ADT', 'A01')
        .addMSH()
        .addEVN()
        .build();

      const segments = msg.split('\r');
      expect(segments.length).toBe(2);
      expect(segments[0]).toContain('MSH');
      expect(segments[1]).toContain('EVN');
    });

    it('should not have trailing pipe separators (clean output)', () => {
      const msg = builder
        .createMessage('ADT', 'A01')
        .addMSH()
        .build();

      // Last character should not be a pipe
      const lines = msg.split('\r');
      for (const line of lines) {
        expect(line.endsWith('|')).toBe(false);
      }
    });
  });

  // ===========================================================================
  // Field and component manipulation
  // ===========================================================================

  describe('setField and setComponent', () => {
    it('should set a field value at a specific position', () => {
      builder.createMessage('ADT', 'A01').addSegment('ZZZ');
      builder.setField(0, 1, 'custom-value');
      const msg = builder.build();

      expect(msg).toContain('ZZZ|custom-value');
    });

    it('should set a component value within a field', () => {
      builder.createMessage('ADT', 'A01').addSegment('ZZZ');
      builder.setComponent(0, 1, 1, 'comp1');
      builder.setComponent(0, 1, 2, 'comp2');
      builder.setComponent(0, 1, 3, 'comp3');
      const msg = builder.build();

      expect(msg).toContain('ZZZ|comp1^comp2^comp3');
    });

    it('should throw when segment index is out of range', () => {
      builder.createMessage('ADT', 'A01');

      expect(() => builder.setField(99, 1, 'value')).toThrow('out of range');
    });
  });

  // ===========================================================================
  // Round-trip: Build then parse
  // ===========================================================================

  describe('round-trip: build then parse', () => {
    it('should build a message, parse it, and verify key data integrity', () => {
      const msg = builder
        .createMessage('ADT', 'A01')
        .addMSH({
          sendingApplication: 'TRIBAL-EHR',
          sendingFacility: 'MAIN-FAC',
          receivingApplication: 'DEST-SYS',
          receivingFacility: 'DEST-FAC',
          processingId: 'P',
          versionId: '2.5.1',
        })
        .addEVN()
        .addPID({
          patientId: 'MRN-RT-001',
          lastName: 'ROUNDTRIP',
          firstName: 'TEST',
          middleName: 'M',
          dateOfBirth: '19900101',
          gender: 'F',
          addressStreet: '789 Test Blvd',
          addressCity: 'Testville',
          addressState: 'TX',
          addressZip: '75001',
        })
        .addPV1({ patientClass: 'O', assignedLocation: 'CLINIC', room: '200' })
        .build();

      // Parse the built message
      const parser = new HL7Parser();
      const parsed = parser.parse(msg);

      // Verify header
      expect(parsed.header.sendingApplication).toBe('TRIBAL-EHR');
      expect(parsed.header.sendingFacility).toBe('MAIN-FAC');
      expect(parsed.header.receivingApplication).toBe('DEST-SYS');
      expect(parsed.header.processingId).toBe('P');
      expect(parsed.header.versionId).toBe('2.5.1');
      expect(parsed.header.messageType).toContain('ADT^A01');

      // Verify PID
      const pid = HL7Parser.findSegment(parsed, 'PID')!;
      expect(pid).toBeDefined();
      expect(HL7Parser.getFieldValue(pid, 3)).toContain('MRN-RT-001');

      // PID-5: Name
      expect(HL7Parser.getComponentValue(pid, 5, 1)).toBe('ROUNDTRIP');
      expect(HL7Parser.getComponentValue(pid, 5, 2)).toBe('TEST');

      // PV1-2: Patient class
      const pv1 = HL7Parser.findSegment(parsed, 'PV1')!;
      expect(HL7Parser.getFieldValue(pv1, 2)).toBe('O');
    });
  });

  // ===========================================================================
  // PID segment details
  // ===========================================================================

  describe('PID segment', () => {
    it('should include patient demographics in PID', () => {
      const msg = builder
        .createMessage('ADT', 'A01')
        .addMSH()
        .addPID({
          patientId: 'PAT-100',
          lastName: 'EAGLE',
          firstName: 'RUNNING',
          middleName: 'CLOUD',
          dateOfBirth: '19750310',
          gender: 'M',
          race: '1002-5',
          homePhone: '505-555-1234',
          ethnicGroup: '2135-2',
        })
        .build();

      expect(msg).toContain('EAGLE^RUNNING^CLOUD');
      expect(msg).toContain('19750310');
      expect(msg).toContain('505-555-1234');
    });
  });
});
