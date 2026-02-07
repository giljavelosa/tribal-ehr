/**
 * HL7v2 Message Validator
 *
 * Validates parsed HL7v2 messages against structural rules and
 * message-type-specific requirements. Supports validation of required
 * segments, field formats, and content rules.
 */

import { HL7Message, HL7Segment } from '../parser/types';
import { HL7Parser } from '../parser/hl7-parser';

/** Severity level for validation errors */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/** A single validation error or warning */
export interface ValidationError {
  /** Segment name where the error occurred (e.g., 'MSH', 'PID') */
  segment: string;
  /** Field index (1-based) where the error occurred, or 0 for segment-level */
  field: number;
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Severity of the validation issue */
  severity: ValidationSeverity;
}

/** Result of message validation */
export interface ValidationResult {
  /** Whether the message passed validation (no errors, warnings allowed) */
  valid: boolean;
  /** List of all validation errors, warnings, and info messages */
  errors: ValidationError[];
}

/** Rule definition for validating a segment */
export interface SegmentRule {
  /** Segment name (e.g., 'PID') */
  segmentName: string;
  /** Field index (1-based) */
  fieldIndex: number;
  /** Whether this field is required */
  required: boolean;
  /** Field name for error messages */
  fieldName: string;
  /** Expected format (regex pattern) */
  format?: RegExp;
  /** Format description for error messages */
  formatDescription?: string;
  /** Maximum length */
  maxLength?: number;
}

/** Required segments definition for a message type */
interface MessageTypeDefinition {
  /** Required segment names */
  requiredSegments: string[];
  /** Optional field-level rules */
  fieldRules?: SegmentRule[];
}

/** Registry of message type definitions */
const MESSAGE_TYPE_DEFINITIONS: Record<string, MessageTypeDefinition> = {
  'ADT^A01': {
    requiredSegments: ['MSH', 'EVN', 'PID', 'PV1'],
    fieldRules: [],
  },
  'ADT^A02': {
    requiredSegments: ['MSH', 'EVN', 'PID', 'PV1'],
  },
  'ADT^A03': {
    requiredSegments: ['MSH', 'EVN', 'PID', 'PV1'],
  },
  'ADT^A04': {
    requiredSegments: ['MSH', 'EVN', 'PID', 'PV1'],
  },
  'ADT^A08': {
    requiredSegments: ['MSH', 'EVN', 'PID', 'PV1'],
  },
  'ORM^O01': {
    requiredSegments: ['MSH', 'PID', 'ORC', 'OBR'],
  },
  'ORU^R01': {
    requiredSegments: ['MSH', 'PID', 'OBR', 'OBX'],
  },
  'SIU^S12': {
    requiredSegments: ['MSH', 'SCH', 'PID'],
  },
  'VXU^V04': {
    requiredSegments: ['MSH', 'PID', 'RXA'],
  },
  'RDE^O11': {
    requiredSegments: ['MSH', 'PID', 'ORC', 'RXE'],
  },
  'MDM^T02': {
    requiredSegments: ['MSH', 'EVN', 'PID', 'TXA'],
  },
};

/** Common field validation rules */
const COMMON_FIELD_RULES: SegmentRule[] = [
  // MSH required fields
  {
    segmentName: 'MSH',
    fieldIndex: 9,
    required: true,
    fieldName: 'Message Type',
  },
  {
    segmentName: 'MSH',
    fieldIndex: 10,
    required: true,
    fieldName: 'Message Control ID',
  },
  {
    segmentName: 'MSH',
    fieldIndex: 11,
    required: true,
    fieldName: 'Processing ID',
  },
  {
    segmentName: 'MSH',
    fieldIndex: 12,
    required: true,
    fieldName: 'Version ID',
  },
  // PID required fields
  {
    segmentName: 'PID',
    fieldIndex: 3,
    required: true,
    fieldName: 'Patient Identifier List',
  },
  {
    segmentName: 'PID',
    fieldIndex: 5,
    required: true,
    fieldName: 'Patient Name',
  },
];

/** Date format: YYYYMMDD or YYYYMMDDHHMMSS or variations */
const HL7_DATE_PATTERN = /^\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(\d{2}(\d{2}(\d{2}(\.\d{1,4})?)?)?)?([+-]\d{4})?$/;

/** HL7 Processing ID pattern */
const PROCESSING_ID_PATTERN = /^[PDT]$/;

/** Patient class pattern */
const PATIENT_CLASS_PATTERN = /^[IOEPBRNU]$/;

export class MessageValidator {
  private customRules: Map<string, SegmentRule[]> = new Map();

  /**
   * Validate a parsed HL7 message.
   *
   * Checks:
   * 1. MSH segment presence and required fields
   * 2. Message-type-specific required segments
   * 3. Field-level validation rules (required, format, length)
   * 4. Common field format validations
   *
   * @param message - The parsed HL7Message to validate
   * @returns ValidationResult with valid flag and any errors
   */
  validate(message: HL7Message): ValidationResult {
    const errors: ValidationError[] = [];

    // 1. Validate MSH segment exists
    const mshSegment = HL7Parser.findSegment(message, 'MSH');
    if (!mshSegment) {
      errors.push({
        segment: 'MSH',
        field: 0,
        code: 'MISSING_MSH',
        message: 'Message must contain an MSH segment',
        severity: 'error',
      });
      return { valid: false, errors };
    }

    // 2. Validate common MSH fields
    errors.push(...this.validateCommonFields(message));

    // 3. Determine message type and validate required segments
    const messageType = message.header.messageType;
    const messageTypeParts = messageType.split('^');
    const typeKey = `${messageTypeParts[0]}^${messageTypeParts[1] || ''}`;

    const definition = MESSAGE_TYPE_DEFINITIONS[typeKey];
    if (definition) {
      errors.push(...this.validateRequiredSegments(message, definition.requiredSegments));

      // Validate message-type-specific field rules
      if (definition.fieldRules) {
        for (const rule of definition.fieldRules) {
          const segment = HL7Parser.findSegment(message, rule.segmentName);
          if (segment) {
            errors.push(...this.validateSegment(segment, [rule]));
          }
        }
      }
    } else {
      errors.push({
        segment: 'MSH',
        field: 9,
        code: 'UNKNOWN_MESSAGE_TYPE',
        message: `Unknown message type: ${typeKey}. Cannot validate required segments.`,
        severity: 'warning',
      });
    }

    // 4. Validate field formats for present segments
    errors.push(...this.validateFieldFormats(message));

    // 5. Apply custom rules
    for (const [segmentName, rules] of this.customRules) {
      const segments = HL7Parser.findSegments(message, segmentName);
      for (const segment of segments) {
        errors.push(...this.validateSegment(segment, rules));
      }
    }

    const hasErrors = errors.some((e) => e.severity === 'error');
    return { valid: !hasErrors, errors };
  }

  /**
   * Validate a single segment against a set of rules.
   *
   * @param segment - The segment to validate
   * @param rules - Array of rules to apply
   * @returns Array of validation errors
   */
  validateSegment(segment: HL7Segment, rules: SegmentRule[]): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const rule of rules) {
      if (rule.segmentName !== segment.name) continue;

      const fieldValue = HL7Parser.getFieldValue(segment, rule.fieldIndex);

      // Check required
      if (rule.required && (!fieldValue || fieldValue.trim() === '')) {
        errors.push({
          segment: segment.name,
          field: rule.fieldIndex,
          code: 'REQUIRED_FIELD_MISSING',
          message: `${segment.name}-${rule.fieldIndex} (${rule.fieldName}) is required but missing or empty`,
          severity: 'error',
        });
        continue;
      }

      // Skip format/length checks if field is empty and not required
      if (!fieldValue || fieldValue.trim() === '') continue;

      // Check format
      if (rule.format && !rule.format.test(fieldValue)) {
        errors.push({
          segment: segment.name,
          field: rule.fieldIndex,
          code: 'INVALID_FORMAT',
          message: `${segment.name}-${rule.fieldIndex} (${rule.fieldName}) has invalid format: "${fieldValue}". Expected: ${rule.formatDescription || rule.format.toString()}`,
          severity: 'error',
        });
      }

      // Check max length
      if (rule.maxLength && fieldValue.length > rule.maxLength) {
        errors.push({
          segment: segment.name,
          field: rule.fieldIndex,
          code: 'FIELD_TOO_LONG',
          message: `${segment.name}-${rule.fieldIndex} (${rule.fieldName}) exceeds maximum length of ${rule.maxLength} characters (actual: ${fieldValue.length})`,
          severity: 'warning',
        });
      }
    }

    return errors;
  }

  /**
   * Register custom validation rules for a segment type.
   *
   * @param segmentName - Segment name to apply rules to
   * @param rules - Array of field rules
   */
  registerRules(segmentName: string, rules: SegmentRule[]): void {
    const existing = this.customRules.get(segmentName) || [];
    this.customRules.set(segmentName, [...existing, ...rules]);
  }

  /**
   * Clear all custom validation rules.
   */
  clearCustomRules(): void {
    this.customRules.clear();
  }

  /**
   * Validate common required fields across all message types.
   */
  private validateCommonFields(message: HL7Message): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const rule of COMMON_FIELD_RULES) {
      const segment = HL7Parser.findSegment(message, rule.segmentName);
      if (segment) {
        errors.push(...this.validateSegment(segment, [rule]));
      }
    }

    return errors;
  }

  /**
   * Validate that all required segments are present.
   */
  private validateRequiredSegments(
    message: HL7Message,
    requiredSegments: string[]
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const presentSegments = new Set(message.segments.map((s) => s.name));

    for (const segName of requiredSegments) {
      if (!presentSegments.has(segName)) {
        errors.push({
          segment: segName,
          field: 0,
          code: 'MISSING_REQUIRED_SEGMENT',
          message: `Required segment ${segName} is missing from the message`,
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Validate field formats for known field types.
   */
  private validateFieldFormats(message: HL7Message): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate MSH-7 (Date/Time) format if present
    if (message.header.dateTime && message.header.dateTime.length > 0) {
      if (!HL7_DATE_PATTERN.test(message.header.dateTime)) {
        errors.push({
          segment: 'MSH',
          field: 7,
          code: 'INVALID_DATE_FORMAT',
          message: `MSH-7 (Date/Time of Message) has invalid format: "${message.header.dateTime}". Expected YYYYMMDD[HHMMSS[.SSSS]][+/-ZZZZ]`,
          severity: 'warning',
        });
      }
    }

    // Validate MSH-11 (Processing ID)
    if (message.header.processingId && message.header.processingId.length > 0) {
      // Processing ID may have components, check first component
      const procId = message.header.processingId.split('^')[0];
      if (!PROCESSING_ID_PATTERN.test(procId)) {
        errors.push({
          segment: 'MSH',
          field: 11,
          code: 'INVALID_PROCESSING_ID',
          message: `MSH-11 (Processing ID) has invalid value: "${procId}". Expected P, D, or T`,
          severity: 'warning',
        });
      }
    }

    // Validate PV1-2 (Patient Class) if PV1 present
    const pv1 = HL7Parser.findSegment(message, 'PV1');
    if (pv1) {
      const patientClass = HL7Parser.getFieldValue(pv1, 2);
      if (patientClass && patientClass.length > 0 && !PATIENT_CLASS_PATTERN.test(patientClass)) {
        errors.push({
          segment: 'PV1',
          field: 2,
          code: 'INVALID_PATIENT_CLASS',
          message: `PV1-2 (Patient Class) has invalid value: "${patientClass}". Expected I, O, E, P, B, R, N, or U`,
          severity: 'warning',
        });
      }
    }

    // Validate PID-7 (Date of Birth) format if present
    const pid = HL7Parser.findSegment(message, 'PID');
    if (pid) {
      const dob = HL7Parser.getFieldValue(pid, 7);
      if (dob && dob.length > 0 && !HL7_DATE_PATTERN.test(dob)) {
        errors.push({
          segment: 'PID',
          field: 7,
          code: 'INVALID_DATE_FORMAT',
          message: `PID-7 (Date of Birth) has invalid format: "${dob}". Expected YYYYMMDD[HHMMSS]`,
          severity: 'warning',
        });
      }

      // Validate PID-8 (Sex) if present
      const sex = HL7Parser.getFieldValue(pid, 8);
      if (sex && sex.length > 0 && !/^[MFOUANC]$/.test(sex)) {
        errors.push({
          segment: 'PID',
          field: 8,
          code: 'INVALID_SEX_CODE',
          message: `PID-8 (Administrative Sex) has invalid value: "${sex}". Expected M, F, O, U, A, N, or C`,
          severity: 'warning',
        });
      }
    }

    // Validate OBX-2 (Value Type) if OBX present
    const obxSegments = HL7Parser.findSegments(message, 'OBX');
    const validValueTypes = new Set([
      'AD', 'CE', 'CF', 'CK', 'CN', 'CP', 'CX', 'DT', 'ED', 'FT',
      'ID', 'MO', 'NM', 'PN', 'RP', 'SN', 'ST', 'TM', 'TN', 'TS',
      'TX', 'XAD', 'XCN', 'XON', 'XPN', 'XTN',
    ]);
    for (const obx of obxSegments) {
      const valueType = HL7Parser.getFieldValue(obx, 2);
      if (valueType && !validValueTypes.has(valueType)) {
        errors.push({
          segment: 'OBX',
          field: 2,
          code: 'INVALID_VALUE_TYPE',
          message: `OBX-2 (Value Type) has unrecognized value: "${valueType}"`,
          severity: 'warning',
        });
      }
    }

    return errors;
  }
}
