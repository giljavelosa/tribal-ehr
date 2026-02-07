/**
 * ORM/OML (Order) Message Factories
 *
 * Builds order messages for general orders and laboratory orders.
 */

import { HL7Builder } from '../builder/hl7-builder';
import {
  MSHConfig,
  PatientData,
  OrderData,
  LabOrderData,
} from '../builder/data-types';

/**
 * Build an ORM^O01 message (General Order).
 * Used to place general clinical orders (lab, radiology, etc.).
 *
 * @param patient - Patient demographic data
 * @param order - Order data
 * @param mshConfig - Optional MSH configuration
 * @returns Complete HL7v2 ORM^O01 message string
 */
export function buildORM_O01(
  patient: PatientData,
  order: OrderData,
  mshConfig: MSHConfig = {}
): string {
  const builder = new HL7Builder();
  builder
    .createMessage('ORM', 'O01')
    .addMSH(mshConfig)
    .addPID(patient);

  // Add ORC (Common Order) segment
  builder.addSegment('ORC');
  const orcIndex = getSegmentCount(builder) - 1;

  // ORC-1: Order Control (NW = New order)
  builder.setField(orcIndex, 1, 'NW');
  // ORC-2: Placer Order Number
  if (order.placerOrderNumber) {
    builder.setField(orcIndex, 2, order.placerOrderNumber);
  }
  // ORC-3: Filler Order Number
  if (order.fillerOrderNumber) {
    builder.setField(orcIndex, 3, order.fillerOrderNumber);
  }
  // ORC-5: Order Status
  builder.setField(orcIndex, 5, 'SC');
  // ORC-9: Date/Time of Transaction
  builder.setField(orcIndex, 9, HL7Builder.generateTimestamp());
  // ORC-12: Ordering Provider
  if (order.orderingProviderId) {
    const providerStr = [
      order.orderingProviderId,
      order.orderingProviderLastName || '',
      order.orderingProviderFirstName || '',
    ].join('^');
    builder.setField(orcIndex, 12, providerStr);
  }

  // Add OBR segment
  builder.addOBR(order);

  return builder.build();
}

/**
 * Build an OML^O21 message (Laboratory Order).
 * Used specifically for laboratory test orders.
 *
 * @param patient - Patient demographic data
 * @param labOrder - Lab-specific order data
 * @param mshConfig - Optional MSH configuration
 * @returns Complete HL7v2 OML^O21 message string
 */
export function buildOML_O21(
  patient: PatientData,
  labOrder: LabOrderData,
  mshConfig: MSHConfig = {}
): string {
  const builder = new HL7Builder();
  builder
    .createMessage('OML', 'O21')
    .addMSH(mshConfig)
    .addPID(patient);

  // Add ORC (Common Order) segment
  builder.addSegment('ORC');
  const orcIndex = getSegmentCount(builder) - 1;

  // ORC-1: Order Control (NW = New order)
  builder.setField(orcIndex, 1, 'NW');
  // ORC-2: Placer Order Number
  if (labOrder.placerOrderNumber) {
    builder.setField(orcIndex, 2, labOrder.placerOrderNumber);
  }
  // ORC-3: Filler Order Number
  if (labOrder.fillerOrderNumber) {
    builder.setField(orcIndex, 3, labOrder.fillerOrderNumber);
  }
  // ORC-9: Date/Time of Transaction
  builder.setField(orcIndex, 9, HL7Builder.generateTimestamp());
  // ORC-12: Ordering Provider
  if (labOrder.orderingProviderId) {
    const providerStr = [
      labOrder.orderingProviderId,
      labOrder.orderingProviderLastName || '',
      labOrder.orderingProviderFirstName || '',
    ].join('^');
    builder.setField(orcIndex, 12, providerStr);
  }

  // Add OBR segment
  builder.addOBR(labOrder);

  // Add SPM (Specimen) segment if specimen data is provided
  if (labOrder.specimenType) {
    builder.addSegment('SPM');
    const spmIndex = getSegmentCount(builder) - 1;

    // SPM-1: Set ID
    builder.setField(spmIndex, 1, '1');
    // SPM-2: Specimen ID
    builder.setField(spmIndex, 2, '');
    // SPM-3: Specimen Parent IDs
    builder.setField(spmIndex, 3, '');
    // SPM-4: Specimen Type
    const specimenTypeParts = [
      labOrder.specimenType,
      labOrder.specimenTypeText || '',
    ].join('^');
    builder.setField(spmIndex, 4, specimenTypeParts);

    // SPM-8: Specimen Source Site
    if (labOrder.specimenSourceSite) {
      builder.setField(spmIndex, 8, labOrder.specimenSourceSite);
    }

    // SPM-17: Specimen Collection Date/Time
    if (labOrder.collectionDateTime) {
      builder.setField(spmIndex, 17, labOrder.collectionDateTime);
    }
  }

  return builder.build();
}

/**
 * Helper to get the current segment count from the builder.
 * Uses the build method structure to count segments.
 */
function getSegmentCount(builder: HL7Builder): number {
  // Access the segments array length via building and counting \r
  // This is a workaround since segments is private
  const built = builder.build();
  return built.split('\r').filter((s) => s.length > 0).length;
}
