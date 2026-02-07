/**
 * VXU (Immunization Update) Message Factories
 *
 * Builds VXU messages used to transmit immunization records.
 */

import { HL7Builder } from '../builder/hl7-builder';
import {
  MSHConfig,
  PatientData,
  ImmunizationData,
} from '../builder/data-types';

/**
 * Build a VXU^V04 message (Unsolicited Vaccination Record Update).
 * Used to send immunization administration records.
 *
 * @param patient - Patient demographic data
 * @param immunization - Immunization administration data
 * @param mshConfig - Optional MSH configuration
 * @returns Complete HL7v2 VXU^V04 message string
 */
export function buildVXU_V04(
  patient: PatientData,
  immunization: ImmunizationData,
  mshConfig: MSHConfig = {}
): string {
  const builder = new HL7Builder();
  builder
    .createMessage('VXU', 'V04')
    .addMSH(mshConfig)
    .addPID(patient);

  // Add ORC (Common Order) segment for the immunization order
  builder.addSegment('ORC');
  const built = builder.build();
  const orcIndex = built.split('\r').filter((s) => s.length > 0).length - 1;

  // ORC-1: Order Control (RE = Observations/Performed Service to follow)
  builder.setField(orcIndex, 1, 'RE');

  // Add RXA (Pharmacy/Treatment Administration) segment
  builder.addSegment('RXA');
  const rxaBuilt = builder.build();
  const rxaIndex = rxaBuilt.split('\r').filter((s) => s.length > 0).length - 1;

  // RXA-1: Give Sub-ID Counter
  builder.setField(rxaIndex, 1, immunization.subIdCounter || '0');
  // RXA-2: Administration Sub-ID Counter
  builder.setField(rxaIndex, 2, immunization.adminSubIdCounter || '1');
  // RXA-3: Date/Time Start of Administration
  builder.setField(rxaIndex, 3, immunization.adminStartDateTime);
  // RXA-4: Date/Time End of Administration
  builder.setField(rxaIndex, 4, immunization.adminEndDateTime || immunization.adminStartDateTime);
  // RXA-5: Administered Code
  const adminCodeParts = [
    immunization.administeredCode,
    immunization.administeredCodeText,
    immunization.codingSystem || 'CVX',
  ].join('^');
  builder.setField(rxaIndex, 5, adminCodeParts);
  // RXA-6: Administered Amount
  builder.setField(rxaIndex, 6, immunization.administeredAmount || '999');
  // RXA-7: Administered Units
  builder.setField(rxaIndex, 7, immunization.administeredUnits || '');
  // RXA-8: Administered Dosage Form
  builder.setField(rxaIndex, 8, '');
  // RXA-9: Administration Notes
  builder.setField(rxaIndex, 9, immunization.adminNotes || '');
  // RXA-10: Administering Provider
  if (immunization.adminProviderId) {
    const providerParts = [
      immunization.adminProviderId,
      immunization.adminProviderLastName || '',
      immunization.adminProviderFirstName || '',
    ].join('^');
    builder.setField(rxaIndex, 10, providerParts);
  } else {
    builder.setField(rxaIndex, 10, '');
  }
  // RXA-11: Administered-at Location
  builder.setField(rxaIndex, 11, immunization.adminLocation || '');
  // RXA-12 through RXA-14
  builder.setField(rxaIndex, 12, '');
  builder.setField(rxaIndex, 13, '');
  builder.setField(rxaIndex, 14, '');
  // RXA-15: Substance Lot Number
  builder.setField(rxaIndex, 15, immunization.lotNumber || '');
  // RXA-16: Substance Expiration Date
  builder.setField(rxaIndex, 16, immunization.expirationDate || '');
  // RXA-17: Substance Manufacturer Name
  builder.setField(rxaIndex, 17, immunization.manufacturerName || '');
  // RXA-18: Substance/Treatment Refusal Reason
  builder.setField(rxaIndex, 18, '');
  // RXA-19: Indication
  builder.setField(rxaIndex, 19, '');
  // RXA-20: Completion Status
  builder.setField(rxaIndex, 20, immunization.completionStatus || 'CP');
  // RXA-21: Action Code
  builder.setField(rxaIndex, 21, immunization.actionCode || 'A');

  return builder.build();
}
