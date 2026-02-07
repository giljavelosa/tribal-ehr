/**
 * ACK (Acknowledgment) Message Builder
 *
 * Builds HL7v2 ACK messages in response to received messages.
 * Supports AA (Application Accept), AE (Application Error),
 * and AR (Application Reject) acknowledgment codes.
 */

import { HL7Builder } from '../builder/hl7-builder';
import { HL7Message } from '../parser/types';

/** Acknowledgment code type */
export type AckCode = 'AA' | 'AE' | 'AR';

/**
 * Build an ACK (Acknowledgment) message in response to a received message.
 *
 * The ACK message echoes back the original message's control ID and
 * includes the acknowledgment code and optional error text.
 *
 * ACK codes:
 * - AA: Application Accept - message was processed successfully
 * - AE: Application Error - message was received but had errors
 * - AR: Application Reject - message was rejected and should not be resent as-is
 *
 * @param originalMessage - The original parsed HL7Message being acknowledged
 * @param ackCode - Acknowledgment code (AA, AE, or AR)
 * @param errorMessage - Optional error message text (for AE and AR)
 * @returns Complete HL7v2 ACK message string
 */
export function buildACK(
  originalMessage: HL7Message,
  ackCode: AckCode,
  errorMessage?: string
): string {
  const builder = new HL7Builder();

  // Build ACK message type
  builder.createMessage('ACK', originalMessage.header.messageType.split('^')[1] || '');

  // Add MSH segment - swap sending/receiving from original
  builder.addMSH({
    sendingApplication: originalMessage.header.receivingApplication || 'TRIBAL-EHR',
    sendingFacility: originalMessage.header.receivingFacility || '',
    receivingApplication: originalMessage.header.sendingApplication || '',
    receivingFacility: originalMessage.header.sendingFacility || '',
    processingId: originalMessage.header.processingId || 'P',
    versionId: originalMessage.header.versionId || '2.5.1',
  });

  // Add MSA (Message Acknowledgment) segment
  builder.addSegment('MSA');
  const built = builder.build();
  const msaIndex = built.split('\r').filter((s) => s.length > 0).length - 1;

  // MSA-1: Acknowledgment Code
  builder.setField(msaIndex, 1, ackCode);
  // MSA-2: Message Control ID (echoes original)
  builder.setField(msaIndex, 2, originalMessage.header.messageControlId);
  // MSA-3: Text Message
  if (errorMessage) {
    builder.setField(msaIndex, 3, errorMessage);
  }

  // Add ERR (Error) segment if there's an error
  if ((ackCode === 'AE' || ackCode === 'AR') && errorMessage) {
    builder.addSegment('ERR');
    const errBuilt = builder.build();
    const errIndex = errBuilt.split('\r').filter((s) => s.length > 0).length - 1;

    // ERR-1: Error Code and Location (deprecated but still used)
    builder.setField(errIndex, 1, '');
    // ERR-2: Error Location
    builder.setField(errIndex, 2, '');
    // ERR-3: HL7 Error Code
    const errorCode = ackCode === 'AE' ? '207' : '200';
    const errorCodeText = ackCode === 'AE' ? 'Application internal error' : 'Unsupported message type';
    builder.setField(errIndex, 3, `${errorCode}^${errorCodeText}`);
    // ERR-4: Severity (E=Error, W=Warning, I=Information)
    builder.setField(errIndex, 4, ackCode === 'AE' ? 'E' : 'E');
    // ERR-7: Diagnostic Information
    builder.setField(errIndex, 7, errorMessage);
    // ERR-8: User Message
    builder.setField(errIndex, 8, errorMessage);
  }

  return builder.build();
}
