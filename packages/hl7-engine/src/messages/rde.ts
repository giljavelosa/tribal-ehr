/**
 * RDE (Pharmacy/Treatment Encoded Order) Message Factories
 *
 * Builds RDE messages for pharmacy and prescription orders.
 */

import { HL7Builder } from '../builder/hl7-builder';
import {
  MSHConfig,
  PatientData,
  PrescriptionData,
} from '../builder/data-types';

/** Options for RDE messages */
export interface RDEOptions {
  mshConfig?: MSHConfig;
  /** ORC order control code (default 'NW' for new order) */
  orderControl?: string;
  /** Placer order number */
  placerOrderNumber?: string;
  /** Filler order number */
  fillerOrderNumber?: string;
  /** Ordering provider ID */
  orderingProviderId?: string;
  /** Ordering provider last name */
  orderingProviderLastName?: string;
  /** Ordering provider first name */
  orderingProviderFirstName?: string;
  /** Pharmacy route (e.g., PO, IV, IM) */
  route?: string;
  /** Pharmacy route text */
  routeText?: string;
  /** Frequency (e.g., BID, TID, QD) */
  frequency?: string;
  /** Duration */
  duration?: string;
  /** Duration units */
  durationUnits?: string;
}

/**
 * Build an RDE^O11 message (Pharmacy/Treatment Encoded Order).
 * Used to transmit pharmacy orders / prescriptions.
 *
 * @param patient - Patient demographic data
 * @param prescription - Prescription data
 * @param options - Optional additional RDE data
 * @returns Complete HL7v2 RDE^O11 message string
 */
export function buildRDE_O11(
  patient: PatientData,
  prescription: PrescriptionData,
  options: RDEOptions = {}
): string {
  const builder = new HL7Builder();
  builder
    .createMessage('RDE', 'O11')
    .addMSH(options.mshConfig || {})
    .addPID(patient);

  // Add ORC (Common Order) segment
  builder.addSegment('ORC');
  let built = builder.build();
  const orcIndex = built.split('\r').filter((s) => s.length > 0).length - 1;

  // ORC-1: Order Control
  builder.setField(orcIndex, 1, options.orderControl || 'NW');
  // ORC-2: Placer Order Number
  if (options.placerOrderNumber) {
    builder.setField(orcIndex, 2, options.placerOrderNumber);
  }
  // ORC-3: Filler Order Number
  if (options.fillerOrderNumber) {
    builder.setField(orcIndex, 3, options.fillerOrderNumber);
  }
  // ORC-9: Date/Time of Transaction
  builder.setField(orcIndex, 9, HL7Builder.generateTimestamp());
  // ORC-12: Ordering Provider
  if (options.orderingProviderId) {
    const providerStr = [
      options.orderingProviderId,
      options.orderingProviderLastName || '',
      options.orderingProviderFirstName || '',
    ].join('^');
    builder.setField(orcIndex, 12, providerStr);
  }

  // Add RXE (Pharmacy/Treatment Encoded Order) segment
  builder.addRXE(prescription);

  // Add RXR (Pharmacy/Treatment Route) segment if route is provided
  if (options.route) {
    builder.addSegment('RXR');
    built = builder.build();
    const rxrIndex = built.split('\r').filter((s) => s.length > 0).length - 1;

    // RXR-1: Route
    const routeParts = [
      options.route,
      options.routeText || '',
    ].join('^');
    builder.setField(rxrIndex, 1, routeParts);
  }

  return builder.build();
}
