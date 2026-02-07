/**
 * HL7v2 Message Parser
 *
 * Parses raw HL7v2 message strings into structured HL7Message objects.
 * Handles standard encoding characters, escape sequences, and segment parsing.
 */

import {
  HL7Message,
  HL7Segment,
  HL7Field,
  HL7Component,
  EncodingCharacters,
  MessageHeader,
  DEFAULT_ENCODING_CHARS,
} from './types';

export class HL7Parser {
  /**
   * Parse a raw HL7v2 message string into a structured HL7Message object.
   *
   * @param rawMessage - The raw HL7v2 message string
   * @returns Parsed HL7Message
   * @throws Error if the message is malformed or missing required MSH segment
   */
  parse(rawMessage: string): HL7Message {
    if (!rawMessage || rawMessage.trim().length === 0) {
      throw new Error('HL7 Parser Error: Empty or null message');
    }

    // Normalize line endings: replace \r\n and \n with \r
    const normalized = rawMessage.replace(/\r\n/g, '\r').replace(/\n/g, '\r');

    // Split into segments by \r, filter empty
    const segmentStrings = normalized.split('\r').filter((s) => s.length > 0);

    if (segmentStrings.length === 0) {
      throw new Error('HL7 Parser Error: No segments found in message');
    }

    // First segment must be MSH
    const firstSegment = segmentStrings[0];
    if (!firstSegment.startsWith('MSH')) {
      throw new Error(
        `HL7 Parser Error: Message must start with MSH segment, found: "${firstSegment.substring(0, 3)}"`
      );
    }

    // Extract encoding characters from MSH segment
    const encodingChars = this.extractEncodingCharacters(firstSegment);

    // Parse all segments
    const segments: HL7Segment[] = segmentStrings.map((segStr) =>
      this.parseSegment(segStr, encodingChars)
    );

    // Extract message header from the MSH segment
    const header = this.extractMessageHeader(segments[0], encodingChars);

    return {
      raw: rawMessage,
      segments,
      header,
      encodingCharacters: encodingChars,
    };
  }

  /**
   * Extract encoding characters from the MSH segment.
   * MSH-1 is the field separator (character at position 3).
   * MSH-2 contains the remaining encoding characters (positions 4-7).
   */
  private extractEncodingCharacters(mshSegment: string): EncodingCharacters {
    if (mshSegment.length < 8) {
      throw new Error(
        'HL7 Parser Error: MSH segment too short to contain encoding characters'
      );
    }

    const fieldSeparator = mshSegment[3]; // Character after 'MSH'
    const encodingField = mshSegment.substring(4, 8);

    return {
      fieldSeparator,
      componentSeparator: encodingField[0] || DEFAULT_ENCODING_CHARS.componentSeparator,
      repetitionSeparator: encodingField[1] || DEFAULT_ENCODING_CHARS.repetitionSeparator,
      escapeCharacter: encodingField[2] || DEFAULT_ENCODING_CHARS.escapeCharacter,
      subComponentSeparator: encodingField[3] || DEFAULT_ENCODING_CHARS.subComponentSeparator,
    };
  }

  /**
   * Parse a single segment string into a structured HL7Segment.
   *
   * @param segmentStr - Raw segment string (e.g., "PID|1||12345^^^MRN||DOE^JOHN")
   * @param encodingChars - Encoding characters to use for parsing
   * @returns Parsed HL7Segment
   */
  parseSegment(segmentStr: string, encodingChars: EncodingCharacters): HL7Segment {
    const { fieldSeparator } = encodingChars;

    // MSH segment is special: the field separator IS MSH-1
    const isMSH = segmentStr.startsWith('MSH');

    let fieldStrings: string[];
    let segmentName: string;

    if (isMSH) {
      // For MSH, segment name is 'MSH', field separator is MSH-1,
      // and the encoding characters field (MSH-2) starts right after
      segmentName = 'MSH';

      // Split on field separator, but MSH-1 is the separator itself
      const afterName = segmentStr.substring(3); // Remove 'MSH'
      const parts = afterName.split(fieldSeparator);

      // MSH fields: [0] = '' (before first |), [1] = encoding chars (MSH-2), [2] = MSH-3, ...
      // But MSH-1 is the field separator itself, so we insert it
      fieldStrings = [
        fieldSeparator, // MSH-1: field separator
        parts[1] || '', // MSH-2: encoding characters
        ...parts.slice(2), // MSH-3 onwards
      ];
    } else {
      const parts = segmentStr.split(fieldSeparator);
      segmentName = parts[0];
      fieldStrings = parts.slice(1);
    }

    const fields: HL7Field[] = fieldStrings.map((fieldStr) =>
      this.parseField(fieldStr, encodingChars)
    );

    return {
      name: segmentName,
      fields,
    };
  }

  /**
   * Parse a single field string into a structured HL7Field.
   * Handles repetitions, components, and sub-components.
   *
   * @param fieldStr - Raw field string
   * @param encodingChars - Encoding characters to use for parsing
   * @returns Parsed HL7Field
   */
  parseField(fieldStr: string, encodingChars: EncodingCharacters): HL7Field {
    const { repetitionSeparator, componentSeparator, subComponentSeparator } = encodingChars;

    // Handle repetitions
    const repetitionStrings = fieldStr.split(repetitionSeparator);

    // If there are repetitions, parse each one as a separate field
    const repetitions: HL7Field[] =
      repetitionStrings.length > 1
        ? repetitionStrings.map((repStr) => this.parseSingleField(repStr, encodingChars))
        : [];

    // Parse the primary value (first repetition or the whole string)
    const primaryValue = repetitionStrings[0];
    const components = this.parseComponents(primaryValue, componentSeparator, subComponentSeparator);

    return {
      value: this.resolveEscapeSequences(fieldStr, encodingChars),
      components,
      repetitions,
    };
  }

  /**
   * Parse a single field value (without repetitions) into components.
   */
  private parseSingleField(fieldStr: string, encodingChars: EncodingCharacters): HL7Field {
    const { componentSeparator, subComponentSeparator } = encodingChars;
    const components = this.parseComponents(fieldStr, componentSeparator, subComponentSeparator);

    return {
      value: this.resolveEscapeSequences(fieldStr, encodingChars),
      components,
      repetitions: [],
    };
  }

  /**
   * Parse component strings from a field value.
   */
  private parseComponents(
    fieldStr: string,
    componentSeparator: string,
    subComponentSeparator: string
  ): HL7Component[] {
    const componentStrings = fieldStr.split(componentSeparator);

    return componentStrings.map((compStr) => {
      const subComponents = compStr.split(subComponentSeparator);
      return {
        value: compStr,
        subComponents,
      };
    });
  }

  /**
   * Resolve HL7v2 escape sequences in a string.
   *
   * Standard escape sequences:
   *   \F\  -> field separator
   *   \S\  -> component separator
   *   \R\  -> repetition separator
   *   \E\  -> escape character
   *   \T\  -> sub-component separator
   *   \X..\ -> hex data
   *   \.br\ -> line break
   */
  resolveEscapeSequences(value: string, encodingChars: EncodingCharacters): string {
    const esc = encodingChars.escapeCharacter;

    if (!value.includes(esc)) {
      return value;
    }

    let result = value;

    // Replace standard escape sequences
    result = result.replace(
      new RegExp(`\\${esc}F\\${esc}`, 'g'),
      encodingChars.fieldSeparator
    );
    result = result.replace(
      new RegExp(`\\${esc}S\\${esc}`, 'g'),
      encodingChars.componentSeparator
    );
    result = result.replace(
      new RegExp(`\\${esc}R\\${esc}`, 'g'),
      encodingChars.repetitionSeparator
    );
    result = result.replace(
      new RegExp(`\\${esc}E\\${esc}`, 'g'),
      encodingChars.escapeCharacter
    );
    result = result.replace(
      new RegExp(`\\${esc}T\\${esc}`, 'g'),
      encodingChars.subComponentSeparator
    );

    // Replace line break escape
    result = result.replace(
      new RegExp(`\\${esc}\\.br\\${esc}`, 'g'),
      '\n'
    );

    // Replace hex escape sequences \Xhh...\
    result = result.replace(
      new RegExp(`\\${esc}X([0-9A-Fa-f]+)\\${esc}`, 'g'),
      (_match, hexStr: string) => {
        let decoded = '';
        for (let i = 0; i < hexStr.length; i += 2) {
          decoded += String.fromCharCode(parseInt(hexStr.substring(i, i + 2), 16));
        }
        return decoded;
      }
    );

    return result;
  }

  /**
   * Extract the MessageHeader from a parsed MSH segment.
   */
  private extractMessageHeader(
    mshSegment: HL7Segment,
    _encodingChars: EncodingCharacters
  ): MessageHeader {
    const getFieldValue = (index: number): string => {
      // MSH fields are 1-indexed in HL7 spec, but 0-indexed in our array
      // MSH-1 = fields[0] (field separator), MSH-2 = fields[1] (encoding chars), etc.
      const fieldIdx = index - 1;
      if (fieldIdx >= 0 && fieldIdx < mshSegment.fields.length) {
        return mshSegment.fields[fieldIdx].value;
      }
      return '';
    };

    return {
      sendingApplication: getFieldValue(3),
      sendingFacility: getFieldValue(4),
      receivingApplication: getFieldValue(5),
      receivingFacility: getFieldValue(6),
      dateTime: getFieldValue(7),
      security: getFieldValue(8),
      messageType: getFieldValue(9),
      messageControlId: getFieldValue(10),
      processingId: getFieldValue(11),
      versionId: getFieldValue(12),
    };
  }

  /**
   * Get a specific field value from a segment by field index (1-based HL7 indexing).
   *
   * @param segment - The parsed segment
   * @param fieldIndex - 1-based field index
   * @returns The field value string, or empty string if not found
   */
  static getFieldValue(segment: HL7Segment, fieldIndex: number): string {
    // For MSH segment, field index maps directly (MSH-1 = fields[0])
    const isMSH = segment.name === 'MSH';
    const arrayIndex = isMSH ? fieldIndex - 1 : fieldIndex - 1;

    if (arrayIndex >= 0 && arrayIndex < segment.fields.length) {
      return segment.fields[arrayIndex].value;
    }
    return '';
  }

  /**
   * Get a specific component value from a field.
   *
   * @param segment - The parsed segment
   * @param fieldIndex - 1-based field index
   * @param componentIndex - 1-based component index
   * @returns The component value string, or empty string if not found
   */
  static getComponentValue(
    segment: HL7Segment,
    fieldIndex: number,
    componentIndex: number
  ): string {
    const isMSH = segment.name === 'MSH';
    const fieldArrayIndex = isMSH ? fieldIndex - 1 : fieldIndex - 1;

    if (fieldArrayIndex >= 0 && fieldArrayIndex < segment.fields.length) {
      const field = segment.fields[fieldArrayIndex];
      const compArrayIndex = componentIndex - 1;
      if (compArrayIndex >= 0 && compArrayIndex < field.components.length) {
        return field.components[compArrayIndex].value;
      }
    }
    return '';
  }

  /**
   * Find all segments with a given name in a parsed message.
   */
  static findSegments(message: HL7Message, segmentName: string): HL7Segment[] {
    return message.segments.filter((s) => s.name === segmentName);
  }

  /**
   * Find the first segment with a given name in a parsed message.
   */
  static findSegment(message: HL7Message, segmentName: string): HL7Segment | undefined {
    return message.segments.find((s) => s.name === segmentName);
  }
}
