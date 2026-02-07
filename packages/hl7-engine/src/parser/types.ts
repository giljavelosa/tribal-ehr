/**
 * HL7v2 Message Type Definitions
 *
 * Core type system for representing parsed HL7v2 messages,
 * segments, fields, components, and encoding characters.
 */

/** Encoding characters used in HL7v2 message delimiters */
export interface EncodingCharacters {
  /** Field separator - default '|' */
  fieldSeparator: string;
  /** Component separator - default '^' */
  componentSeparator: string;
  /** Repetition separator - default '~' */
  repetitionSeparator: string;
  /** Escape character - default '\\' */
  escapeCharacter: string;
  /** Sub-component separator - default '&' */
  subComponentSeparator: string;
}

/** Default HL7v2 encoding characters */
export const DEFAULT_ENCODING_CHARS: EncodingCharacters = {
  fieldSeparator: '|',
  componentSeparator: '^',
  repetitionSeparator: '~',
  escapeCharacter: '\\',
  subComponentSeparator: '&',
};

/** A sub-component within a component */
export interface HL7Component {
  /** The full value of this component */
  value: string;
  /** Sub-components split by the sub-component separator */
  subComponents: string[];
}

/** A single field within a segment, which may contain components and repetitions */
export interface HL7Field {
  /** The raw string value of the field */
  value: string;
  /** Components within this field (split by component separator) */
  components: HL7Component[];
  /** Repetitions of this field (split by repetition separator) */
  repetitions: HL7Field[];
}

/** A single segment within an HL7 message (e.g., MSH, PID, PV1) */
export interface HL7Segment {
  /** Segment name/identifier (e.g., 'MSH', 'PID', 'OBR') */
  name: string;
  /** Array of fields within this segment */
  fields: HL7Field[];
}

/** Parsed MSH (Message Header) segment information */
export interface MessageHeader {
  /** MSH-3: Sending application */
  sendingApplication: string;
  /** MSH-4: Sending facility */
  sendingFacility: string;
  /** MSH-5: Receiving application */
  receivingApplication: string;
  /** MSH-6: Receiving facility */
  receivingFacility: string;
  /** MSH-7: Date/time of message (HL7 timestamp format) */
  dateTime: string;
  /** MSH-8: Security */
  security: string;
  /** MSH-9: Message type (e.g., 'ADT^A01') */
  messageType: string;
  /** MSH-10: Message control ID (unique identifier) */
  messageControlId: string;
  /** MSH-11: Processing ID (P=Production, D=Debugging, T=Training) */
  processingId: string;
  /** MSH-12: Version ID (e.g., '2.5.1') */
  versionId: string;
}

/** A fully parsed HL7v2 message */
export interface HL7Message {
  /** The raw, unparsed message string */
  raw: string;
  /** Array of parsed segments */
  segments: HL7Segment[];
  /** Parsed MSH header information */
  header: MessageHeader;
  /** Encoding characters used in this message */
  encodingCharacters: EncodingCharacters;
}
