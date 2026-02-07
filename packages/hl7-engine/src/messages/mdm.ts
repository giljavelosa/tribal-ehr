/**
 * MDM (Medical Document Management) Message Factories
 *
 * Builds MDM messages for document notifications and content transmission.
 */

import { HL7Builder } from '../builder/hl7-builder';
import {
  MSHConfig,
  PatientData,
  DocumentData,
  EventData,
} from '../builder/data-types';

/**
 * Build an MDM^T02 message (Original Document Notification and Content).
 * Used to notify about a new document and transmit its content.
 * The document content is placed in OBX segments with value type TX.
 *
 * @param patient - Patient demographic data
 * @param document - Document data including content
 * @param mshConfig - Optional MSH configuration
 * @returns Complete HL7v2 MDM^T02 message string
 */
export function buildMDM_T02(
  patient: PatientData,
  document: DocumentData,
  mshConfig: MSHConfig = {}
): string {
  const builder = new HL7Builder();
  builder
    .createMessage('MDM', 'T02')
    .addMSH(mshConfig)
    .addEVN({
      eventTypeCode: 'T02',
      recordedDateTime: HL7Builder.generateTimestamp(),
    } as EventData)
    .addPID(patient);

  // Add TXA (Transcription Document Header) segment
  builder.addSegment('TXA');
  let built = builder.build();
  const txaIndex = built.split('\r').filter((s) => s.length > 0).length - 1;

  // TXA-1: Set ID
  builder.setField(txaIndex, 1, document.setId || '1');
  // TXA-2: Document Type
  builder.setField(txaIndex, 2, document.documentType);
  // TXA-3: Document Content Presentation
  builder.setField(txaIndex, 3, document.contentPresentation || 'TX');
  // TXA-4: Activity Date/Time
  builder.setField(txaIndex, 4, document.activityDateTime || HL7Builder.generateTimestamp());
  // TXA-5: Primary Activity Provider
  if (document.primaryProviderId) {
    const providerParts = [
      document.primaryProviderId,
      document.primaryProviderLastName || '',
      document.primaryProviderFirstName || '',
    ].join('^');
    builder.setField(txaIndex, 5, providerParts);
  }
  // TXA-6 through TXA-11 (empty)
  for (let i = 6; i <= 11; i++) {
    builder.setField(txaIndex, i, '');
  }
  // TXA-12: Unique Document Number
  builder.setField(txaIndex, 12, document.uniqueDocumentNumber || HL7Builder.generateControlId());
  // TXA-13 through TXA-16 (empty)
  for (let i = 13; i <= 16; i++) {
    builder.setField(txaIndex, i, '');
  }
  // TXA-17: Document Completion Status
  builder.setField(txaIndex, 17, document.completionStatus || 'AU');
  // TXA-18: Document Confidentiality Status
  builder.setField(txaIndex, 18, '');
  // TXA-19: Document Availability Status
  builder.setField(txaIndex, 19, document.availabilityStatus || 'AV');

  // Add document content as OBX segments
  if (document.content) {
    // Split content into lines for separate OBX segments
    const lines = document.content.split('\n');
    lines.forEach((line, idx) => {
      builder.addOBX({
        setId: (idx + 1).toString(),
        valueType: 'TX',
        observationCode: 'DOCUMENT',
        observationText: 'Document Content',
        value: line,
        resultStatus: 'F',
      });
    });
  }

  return builder.build();
}
