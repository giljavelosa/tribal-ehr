// =============================================================================
// CPOE Order Management Service
// ONC Certification: 170.315(a)(1) CPOE - Medications
//                    170.315(a)(2) CPOE - Laboratory
//                    170.315(a)(3) CPOE - Diagnostic Imaging
//                    170.315(a)(4) Drug-Drug, Drug-Allergy Interaction Checks
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import { ValidationError, NotFoundError, AuthorizationError, ConflictError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type OrderType = 'medication' | 'laboratory' | 'imaging';
export type OrderStatus = 'draft' | 'active' | 'completed' | 'cancelled' | 'on-hold' | 'entered-in-error';
export type OrderPriority = 'routine' | 'urgent' | 'stat' | 'asap';

export interface CDSAlert {
  severity: 'info' | 'warning' | 'critical';
  summary: string;
  detail: string;
  source: string;
  overridable: boolean;
}

export interface Order {
  id: string;
  patientId: string;
  encounterId?: string;
  orderType: OrderType;
  status: OrderStatus;
  priority: OrderPriority;
  code?: string;
  codeSystem?: string;
  codeDisplay?: string;
  orderDetails: Record<string, unknown>;
  cdsAlerts: CDSAlert[];
  orderedBy: string;
  orderedAt: string;
  signedBy?: string;
  signedAt?: string;
  clinicalIndication?: string;
  notes?: string;
  fhirId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMedicationOrderDTO {
  patientId: string;
  encounterId?: string;
  priority?: OrderPriority;
  orderedBy: string;
  medication: {
    rxnormCode: string;
    displayName: string;
    dosage: string;
    route: string;
    frequency: string;
    duration?: string;
    quantity?: number;
    refills?: number;
    instructions?: string;
    prn?: boolean;
    prnReason?: string;
  };
}

export interface CreateLabOrderDTO {
  patientId: string;
  encounterId?: string;
  priority?: OrderPriority;
  orderedBy: string;
  lab: {
    loincCode: string;
    displayName: string;
    panelCode?: string;
    specimenType?: string;
    collectionInstructions?: string;
    clinicalNotes?: string;
    fastingRequired?: boolean;
  };
}

export interface CreateImagingOrderDTO {
  patientId: string;
  encounterId?: string;
  priority?: OrderPriority;
  orderedBy: string;
  imaging: {
    procedureCode: string;
    codeSystem?: string;
    displayName: string;
    clinicalIndication: string;
    bodyPart?: string;
    laterality?: string;
    contrast?: boolean;
    transportMode?: string;
    clinicalNotes?: string;
  };
}

export interface OrderSearchParams extends PaginationParams {
  patientId?: string;
  orderType?: OrderType;
  status?: OrderStatus;
  providerId?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Database Row
// -----------------------------------------------------------------------------

interface OrderRow {
  id: string;
  patient_id: string;
  encounter_id?: string;
  fhir_id?: string;
  order_type: string;
  status: string;
  priority: string;
  code_system?: string;
  code_code?: string;
  code_display?: string;
  clinical_indication?: string;
  ordered_by_id: string;
  ordered_at: string;
  signed_by_id?: string;
  signed_at?: string;
  details?: string;
  results?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Lab Panel Definitions (Real LOINC Codes)
// -----------------------------------------------------------------------------

const LAB_PANELS: Record<string, { name: string; tests: Array<{ code: string; display: string }> }> = {
  BMP: {
    name: 'Basic Metabolic Panel',
    tests: [
      { code: '2951-2', display: 'Sodium [Moles/volume] in Serum or Plasma' },
      { code: '2823-3', display: 'Potassium [Moles/volume] in Serum or Plasma' },
      { code: '2075-0', display: 'Chloride [Moles/volume] in Serum or Plasma' },
      { code: '1963-8', display: 'Bicarbonate [Moles/volume] in Serum or Plasma' },
      { code: '3094-0', display: 'Urea nitrogen [Mass/volume] in Serum or Plasma' },
      { code: '2160-0', display: 'Creatinine [Mass/volume] in Serum or Plasma' },
      { code: '2345-7', display: 'Glucose [Mass/volume] in Serum or Plasma' },
      { code: '17861-6', display: 'Calcium [Mass/volume] in Serum or Plasma' },
    ],
  },
  CMP: {
    name: 'Comprehensive Metabolic Panel',
    tests: [
      { code: '2951-2', display: 'Sodium [Moles/volume] in Serum or Plasma' },
      { code: '2823-3', display: 'Potassium [Moles/volume] in Serum or Plasma' },
      { code: '2075-0', display: 'Chloride [Moles/volume] in Serum or Plasma' },
      { code: '1963-8', display: 'Bicarbonate [Moles/volume] in Serum or Plasma' },
      { code: '3094-0', display: 'Urea nitrogen [Mass/volume] in Serum or Plasma' },
      { code: '2160-0', display: 'Creatinine [Mass/volume] in Serum or Plasma' },
      { code: '2345-7', display: 'Glucose [Mass/volume] in Serum or Plasma' },
      { code: '17861-6', display: 'Calcium [Mass/volume] in Serum or Plasma' },
      { code: '1751-7', display: 'Albumin [Mass/volume] in Serum or Plasma' },
      { code: '1975-2', display: 'Bilirubin.total [Mass/volume] in Serum or Plasma' },
      { code: '6768-6', display: 'Alkaline phosphatase [Enzymatic activity/volume] in Serum or Plasma' },
      { code: '1742-6', display: 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma' },
      { code: '1920-8', display: 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma' },
      { code: '2885-2', display: 'Protein [Mass/volume] in Serum or Plasma' },
    ],
  },
  CBC: {
    name: 'Complete Blood Count with Differential',
    tests: [
      { code: '6690-2', display: 'Leukocytes [#/volume] in Blood by Automated count' },
      { code: '789-8', display: 'Erythrocytes [#/volume] in Blood by Automated count' },
      { code: '718-7', display: 'Hemoglobin [Mass/volume] in Blood' },
      { code: '4544-3', display: 'Hematocrit [Volume Fraction] of Blood by Automated count' },
      { code: '787-2', display: 'MCV [Entitic volume] by Automated count' },
      { code: '785-6', display: 'MCH [Entitic mass] by Automated count' },
      { code: '786-4', display: 'MCHC [Mass/volume] by Automated count' },
      { code: '777-3', display: 'Platelets [#/volume] in Blood by Automated count' },
      { code: '770-8', display: 'Neutrophils/100 leukocytes in Blood by Automated count' },
      { code: '736-9', display: 'Lymphocytes/100 leukocytes in Blood by Automated count' },
      { code: '5905-5', display: 'Monocytes/100 leukocytes in Blood by Automated count' },
      { code: '713-8', display: 'Eosinophils/100 leukocytes in Blood by Automated count' },
      { code: '706-2', display: 'Basophils/100 leukocytes in Blood by Automated count' },
    ],
  },
  LIPID: {
    name: 'Lipid Panel',
    tests: [
      { code: '2093-3', display: 'Cholesterol [Mass/volume] in Serum or Plasma' },
      { code: '2571-8', display: 'Triglyceride [Mass/volume] in Serum or Plasma' },
      { code: '2085-9', display: 'Cholesterol in HDL [Mass/volume] in Serum or Plasma' },
      { code: '13457-7', display: 'Cholesterol in LDL [Mass/volume] in Serum or Plasma (calculated)' },
      { code: '13458-5', display: 'Cholesterol in VLDL [Mass/volume] in Serum or Plasma by calculation' },
    ],
  },
  HEPATIC: {
    name: 'Hepatic Function Panel',
    tests: [
      { code: '1751-7', display: 'Albumin [Mass/volume] in Serum or Plasma' },
      { code: '1975-2', display: 'Bilirubin.total [Mass/volume] in Serum or Plasma' },
      { code: '1968-7', display: 'Bilirubin.direct [Mass/volume] in Serum or Plasma' },
      { code: '6768-6', display: 'Alkaline phosphatase [Enzymatic activity/volume] in Serum or Plasma' },
      { code: '1742-6', display: 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma' },
      { code: '1920-8', display: 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma' },
      { code: '2885-2', display: 'Protein [Mass/volume] in Serum or Plasma' },
    ],
  },
  TSH: {
    name: 'Thyroid Stimulating Hormone',
    tests: [
      { code: '3016-3', display: 'Thyrotropin [Units/volume] in Serum or Plasma' },
    ],
  },
  UA: {
    name: 'Urinalysis',
    tests: [
      { code: '5811-5', display: 'Specific gravity of Urine by Test strip' },
      { code: '5803-2', display: 'pH of Urine by Test strip' },
      { code: '5804-0', display: 'Protein [Presence] in Urine by Test strip' },
      { code: '5792-7', display: 'Glucose [Presence] in Urine by Test strip' },
      { code: '5794-3', display: 'Hemoglobin [Presence] in Urine by Test strip' },
      { code: '5802-4', display: 'Nitrite [Presence] in Urine by Test strip' },
      { code: '5799-2', display: 'Leukocyte esterase [Presence] in Urine by Test strip' },
      { code: '20505-4', display: 'Bilirubin.total [Presence] in Urine by Test strip' },
      { code: '5797-6', display: 'Ketones [Presence] in Urine by Test strip' },
      { code: '5778-6', display: 'Color of Urine' },
      { code: '5767-9', display: 'Appearance of Urine' },
    ],
  },
  A1C: {
    name: 'Hemoglobin A1c',
    tests: [
      { code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total in Blood' },
    ],
  },
};

// -----------------------------------------------------------------------------
// Known Drug Interaction Pairs (RxNorm-based, common clinical interactions)
// This is a representative set for CDS checking; production would use NLM API
// -----------------------------------------------------------------------------

const KNOWN_DRUG_INTERACTIONS: Array<{
  drug1: string;
  drug2: string;
  severity: 'warning' | 'critical';
  description: string;
}> = [
  { drug1: '11289', drug2: '4337', severity: 'critical', description: 'Warfarin + Heparin: increased risk of major bleeding' },
  { drug1: '11289', drug2: '1191', severity: 'critical', description: 'Warfarin + Aspirin: significantly increased risk of bleeding' },
  { drug1: '11289', drug2: '36567', severity: 'warning', description: 'Warfarin + Simvastatin: increased INR and bleeding risk' },
  { drug1: '11289', drug2: '6387', severity: 'critical', description: 'Warfarin + Metronidazole: increased anticoagulant effect' },
  { drug1: '10582', drug2: '3827', severity: 'critical', description: 'Tramadol + Fluoxetine: risk of serotonin syndrome and seizures' },
  { drug1: '10582', drug2: '32937', severity: 'critical', description: 'Tramadol + Sertraline: risk of serotonin syndrome and seizures' },
  { drug1: '3827', drug2: '6646', severity: 'critical', description: 'Fluoxetine + MAOIs: risk of serotonin syndrome - contraindicated' },
  { drug1: '161', drug2: '5640', severity: 'warning', description: 'Acetaminophen + Isoniazid: increased hepatotoxicity risk' },
  { drug1: '1191', drug2: '5487', severity: 'critical', description: 'Aspirin + Ibuprofen: reduced cardioprotective effect of aspirin; increased GI bleeding' },
  { drug1: '6813', drug2: '1202', severity: 'critical', description: 'Methotrexate + Bactrim: fatal bone marrow suppression' },
  { drug1: '1886', drug2: '2002', severity: 'critical', description: 'Citalopram + MAOIs: risk of serotonin syndrome' },
  { drug1: '1886', drug2: '10582', severity: 'warning', description: 'Citalopram + Tramadol: risk of serotonin syndrome' },
  { drug1: '6918', drug2: '36567', severity: 'warning', description: 'Metformin + Contrast dye: risk of lactic acidosis' },
  { drug1: '35296', drug2: '1191', severity: 'warning', description: 'Lisinopril + Aspirin: reduced antihypertensive effect' },
  { drug1: '35296', drug2: '8183', severity: 'critical', description: 'ACE inhibitor + Potassium: risk of hyperkalemia' },
  { drug1: '7646', drug2: '2551', severity: 'critical', description: 'Oxycodone + Diazepam: risk of fatal respiratory depression' },
  { drug1: '7646', drug2: '596', severity: 'critical', description: 'Oxycodone + Alprazolam: risk of fatal respiratory depression' },
  { drug1: '4337', drug2: '1191', severity: 'warning', description: 'Heparin + Aspirin: increased risk of hemorrhage' },
  { code: '3640', drug1: '3640', drug2: '2002', severity: 'critical', description: 'Fentanyl + MAOIs: risk of serotonin syndrome' },
  { drug1: '5640', drug2: '10594', severity: 'warning', description: 'Isoniazid + Rifampin: increased hepatotoxicity risk' },
] as Array<{ drug1: string; drug2: string; severity: 'warning' | 'critical'; description: string }>;

// Known drug class groupings for duplicate therapy detection
const DRUG_CLASSES: Record<string, string[]> = {
  SSRI: ['3827', '32937', '1886', '42347', '30125'], // fluoxetine, sertraline, citalopram, escitalopram, paroxetine
  STATIN: ['36567', '83367', '301542', '73178', '42463'], // simvastatin, atorvastatin, rosuvastatin, pravastatin, lovastatin
  ACE_INHIBITOR: ['35296', '3827', '29046', '18867', '1998'], // lisinopril, enalapril, ramipril, benazepril, captopril
  PPI: ['7646', '5691', '283742', '40790', '114979'], // omeprazole, lansoprazole, pantoprazole, esomeprazole, rabeprazole
  NSAID: ['5487', '7258', '7781', '6730', '41126'], // ibuprofen, naproxen, piroxicam, meloxicam, celecoxib
  OPIOID: ['7804', '3423', '7646', '10582', '3640'], // morphine, hydrocodone, oxycodone, tramadol, fentanyl
  BENZODIAZEPINE: ['596', '2551', '6470', '2356', '7781'], // alprazolam, diazepam, lorazepam, clonazepam
  THIAZIDE: ['5487', '4603'], // hydrochlorothiazide, chlorthalidone
  BETA_BLOCKER: ['6918', '20352', '1202', '6185', '33408'], // metoprolol, atenolol, carvedilol, labetalol, bisoprolol
};

// Authorized roles for signing orders
const SIGNING_ROLES = ['physician', 'nurse_practitioner', 'physician_assistant', 'attending', 'resident'];

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class OrderService extends BaseService {
  constructor() {
    super('OrderService');
  }

  // ---------------------------------------------------------------------------
  // Create Medication Order (CPOE)
  // ---------------------------------------------------------------------------

  async createMedicationOrder(data: CreateMedicationOrderDTO): Promise<Order> {
    try {
      // Validate required fields
      if (!data.patientId) {
        throw new ValidationError('patientId is required');
      }
      if (!data.medication.rxnormCode) {
        throw new ValidationError('RxNorm code is required for medication orders');
      }
      if (!data.medication.displayName) {
        throw new ValidationError('Medication display name is required');
      }
      if (!data.medication.dosage) {
        throw new ValidationError('Dosage is required');
      }
      if (!data.medication.route) {
        throw new ValidationError('Route is required');
      }
      if (!data.medication.frequency) {
        throw new ValidationError('Frequency is required');
      }

      // Verify patient exists
      await this.requireExists('patients', data.patientId, 'Patient');

      // Run CDS checks
      const cdsAlerts: CDSAlert[] = [];

      const drugInteractions = await this.checkDrugInteractions(data.medication.rxnormCode, data.patientId);
      cdsAlerts.push(...drugInteractions);

      const allergyInteractions = await this.checkDrugAllergyInteractions(data.medication.rxnormCode, data.patientId);
      cdsAlerts.push(...allergyInteractions);

      const duplicateAlerts = await this.checkDuplicateTherapy(data.medication.rxnormCode, data.patientId);
      cdsAlerts.push(...duplicateAlerts);

      const dosageAlerts = this.checkDosageRange(data.medication);
      cdsAlerts.push(...dosageAlerts);

      // Create order record
      const id = uuidv4();
      const now = new Date().toISOString();

      const row: OrderRow = {
        id,
        patient_id: data.patientId,
        encounter_id: data.encounterId,
        order_type: 'medication',
        status: 'draft',
        priority: data.priority || 'routine',
        code_code: data.medication.rxnormCode,
        code_system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code_display: data.medication.displayName,
        details: JSON.stringify({ medication: data.medication, cdsAlerts }),
        ordered_by_id: data.orderedBy,
        ordered_at: now,
        created_at: now,
        updated_at: now,
      };

      await this.db('orders').insert(row);

      this.logger.info('Medication order created', {
        orderId: id,
        patientId: data.patientId,
        medication: data.medication.displayName,
        alertCount: cdsAlerts.length,
        criticalAlerts: cdsAlerts.filter(a => a.severity === 'critical').length,
      });

      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to create medication order', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Create Lab Order
  // ---------------------------------------------------------------------------

  async createLabOrder(data: CreateLabOrderDTO): Promise<Order> {
    try {
      if (!data.patientId) {
        throw new ValidationError('patientId is required');
      }
      if (!data.lab.loincCode) {
        throw new ValidationError('LOINC code is required for laboratory orders');
      }
      if (!data.lab.displayName) {
        throw new ValidationError('Lab test display name is required');
      }

      await this.requireExists('patients', data.patientId, 'Patient');

      // If this is a panel, expand to individual tests
      const orderDetails: Record<string, unknown> = { ...data.lab };
      if (data.lab.panelCode && LAB_PANELS[data.lab.panelCode]) {
        const panel = LAB_PANELS[data.lab.panelCode];
        orderDetails.panelName = panel.name;
        orderDetails.panelTests = panel.tests;
        orderDetails.displayName = panel.name;
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      const row: OrderRow = {
        id,
        patient_id: data.patientId,
        encounter_id: data.encounterId,
        order_type: 'laboratory',
        status: 'draft',
        priority: data.priority || 'routine',
        code_code: data.lab.loincCode,
        code_system: 'http://loinc.org',
        code_display: data.lab.displayName,
        details: JSON.stringify({ lab: orderDetails, cdsAlerts: [] }),
        ordered_by_id: data.orderedBy,
        ordered_at: now,
        created_at: now,
        updated_at: now,
      };

      await this.db('orders').insert(row);

      this.logger.info('Lab order created', {
        orderId: id,
        patientId: data.patientId,
        labTest: data.lab.displayName,
        panel: data.lab.panelCode || null,
      });

      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to create lab order', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Create Imaging Order
  // ---------------------------------------------------------------------------

  async createImagingOrder(data: CreateImagingOrderDTO): Promise<Order> {
    try {
      if (!data.patientId) {
        throw new ValidationError('patientId is required');
      }
      if (!data.imaging.procedureCode) {
        throw new ValidationError('Procedure code is required for imaging orders');
      }
      if (!data.imaging.displayName) {
        throw new ValidationError('Imaging procedure display name is required');
      }
      if (!data.imaging.clinicalIndication) {
        throw new ValidationError('Clinical indication is required for imaging orders');
      }

      await this.requireExists('patients', data.patientId, 'Patient');

      const id = uuidv4();
      const now = new Date().toISOString();

      const row: OrderRow = {
        id,
        patient_id: data.patientId,
        encounter_id: data.encounterId,
        order_type: 'imaging',
        status: 'draft',
        priority: data.priority || 'routine',
        code_code: data.imaging.procedureCode,
        code_system: data.imaging.codeSystem || 'http://www.ama-assn.org/go/cpt',
        code_display: data.imaging.displayName,
        details: JSON.stringify({ imaging: data.imaging, cdsAlerts: [] }),
        ordered_by_id: data.orderedBy,
        ordered_at: now,
        created_at: now,
        updated_at: now,
      };

      await this.db('orders').insert(row);

      this.logger.info('Imaging order created', {
        orderId: id,
        patientId: data.patientId,
        procedure: data.imaging.displayName,
        priority: data.priority || 'routine',
      });

      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to create imaging order', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Sign Order
  // ---------------------------------------------------------------------------

  async signOrder(orderId: string, signerId: string): Promise<Order> {
    try {
      const row = await this.db('orders').where({ id: orderId }).first<OrderRow>();
      if (!row) {
        throw new NotFoundError('Order', orderId);
      }

      if (row.status !== 'draft') {
        throw new ConflictError(`Cannot sign order with status '${row.status}'. Only draft orders can be signed.`);
      }

      // Validate signer is authorized
      const signer = await this.db('users').where({ id: signerId }).first<{ id: string; role: string; first_name?: string; last_name?: string }>();
      if (!signer) {
        throw new NotFoundError('User', signerId);
      }
      if (!SIGNING_ROLES.includes(signer.role)) {
        throw new AuthorizationError(
          `User role '${signer.role}' is not authorized to sign orders. Required: ${SIGNING_ROLES.join(', ')}`
        );
      }

      const now = new Date().toISOString();

      await this.withTransaction(async (trx: Knex.Transaction) => {
        await trx('orders').where({ id: orderId }).update({
          status: 'active',
          signed_by: signerId,
          signed_at: now,
          updated_at: now,
        });

        // Create FHIR resources based on order type
        if (row.order_type === 'medication') {
          const orderDetails = row.details ? JSON.parse(row.details) : {};
          const details = orderDetails.medication || {};
          const medicationRequest = {
            resourceType: 'MedicationRequest',
            status: 'active',
            intent: 'order',
            medicationCodeableConcept: {
              coding: [
                {
                  system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                  code: row.code_code,
                  display: row.code_display,
                },
              ],
              text: row.code_display,
            },
            subject: { reference: `Patient/${row.patient_id}` },
            authoredOn: now,
            requester: { reference: `Practitioner/${signerId}` },
            dosageInstruction: [
              {
                text: `${details.dosage} ${details.route} ${details.frequency}`,
                route: { text: details.route },
              },
            ],
            dispenseRequest: {
              numberOfRepeatsAllowed: details.refills || 0,
              quantity: details.quantity ? { value: details.quantity } : undefined,
            },
          };

          try {
            const fhirResult = await this.fhirClient.create<Record<string, unknown>>('MedicationRequest', medicationRequest);
            if (fhirResult.id) {
              await trx('orders').where({ id: orderId }).update({ fhir_id: fhirResult.id as string });
            }
          } catch (fhirError) {
            this.logger.warn('Failed to sync medication order to FHIR server', { orderId, error: fhirError });
          }
        } else if (row.order_type === 'laboratory') {
          const serviceRequest = {
            resourceType: 'ServiceRequest',
            status: 'active',
            intent: 'order',
            category: [
              {
                coding: [
                  {
                    system: 'http://snomed.info/sct',
                    code: '108252007',
                    display: 'Laboratory procedure',
                  },
                ],
              },
            ],
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: row.code_code,
                  display: row.code_display,
                },
              ],
              text: row.code_display,
            },
            subject: { reference: `Patient/${row.patient_id}` },
            authoredOn: now,
            requester: { reference: `Practitioner/${signerId}` },
            priority: row.priority,
          };

          try {
            const fhirResult = await this.fhirClient.create<Record<string, unknown>>('ServiceRequest', serviceRequest);
            if (fhirResult.id) {
              await trx('orders').where({ id: orderId }).update({ fhir_id: fhirResult.id as string });
            }
          } catch (fhirError) {
            this.logger.warn('Failed to sync lab order to FHIR server', { orderId, error: fhirError });
          }
        } else if (row.order_type === 'imaging') {
          const serviceRequest = {
            resourceType: 'ServiceRequest',
            status: 'active',
            intent: 'order',
            category: [
              {
                coding: [
                  {
                    system: 'http://snomed.info/sct',
                    code: '363679005',
                    display: 'Imaging',
                  },
                ],
              },
            ],
            code: {
              coding: [
                {
                  system: row.code_system,
                  code: row.code_code,
                  display: row.code_display,
                },
              ],
              text: row.code_display,
            },
            subject: { reference: `Patient/${row.patient_id}` },
            authoredOn: now,
            requester: { reference: `Practitioner/${signerId}` },
            priority: row.priority,
          };

          try {
            const fhirResult = await this.fhirClient.create<Record<string, unknown>>('ServiceRequest', serviceRequest);
            if (fhirResult.id) {
              await trx('orders').where({ id: orderId }).update({ fhir_id: fhirResult.id as string });
            }
          } catch (fhirError) {
            this.logger.warn('Failed to sync imaging order to FHIR server', { orderId, error: fhirError });
          }
        }

        // Publish HL7v2 ORM message to RabbitMQ for external system integration
        try {
          const ormMessage = this.buildORM(row, signerId, now);
          // This publishes to the RabbitMQ exchange if available
          await this.publishToQueue('hl7.orders', ormMessage);
        } catch (queueError) {
          this.logger.warn('Failed to publish ORM message to queue', { orderId, error: queueError });
        }
      });

      this.logger.info('Order signed', {
        orderId,
        signerId,
        orderType: row.order_type,
      });

      return this.getOrder(orderId);
    } catch (error) {
      this.handleError('Failed to sign order', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Cancel Order
  // ---------------------------------------------------------------------------

  async cancelOrder(orderId: string, reason: string, cancelledBy: string): Promise<Order> {
    try {
      const row = await this.db('orders').where({ id: orderId }).first<OrderRow>();
      if (!row) {
        throw new NotFoundError('Order', orderId);
      }

      if (row.status === 'cancelled' || row.status === 'entered-in-error') {
        throw new ConflictError(`Order is already ${row.status}`);
      }

      if (row.status === 'completed') {
        throw new ConflictError('Cannot cancel a completed order');
      }

      if (!reason) {
        throw new ValidationError('Cancellation reason is required');
      }

      const now = new Date().toISOString();

      await this.db('orders').where({ id: orderId }).update({
        status: 'cancelled',
        cancelled_by: cancelledBy,
        cancelled_at: now,
        cancel_reason: reason,
        updated_at: now,
      });

      this.logger.info('Order cancelled', { orderId, reason, cancelledBy });

      return this.getOrder(orderId);
    } catch (error) {
      this.handleError('Failed to cancel order', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Order
  // ---------------------------------------------------------------------------

  async getOrder(orderId: string): Promise<Order> {
    try {
      const row = await this.db('orders').where({ id: orderId }).first<OrderRow>();
      if (!row) {
        throw new NotFoundError('Order', orderId);
      }
      return this.fromRow(row);
    } catch (error) {
      this.handleError('Failed to get order', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Patient Orders
  // ---------------------------------------------------------------------------

  async getPatientOrders(params: OrderSearchParams): Promise<PaginatedResult<Order>> {
    try {
      const query = this.db('orders').select('*');

      if (params.patientId) {
        query.where('patient_id', params.patientId);
      }
      if (params.orderType) {
        query.where('order_type', params.orderType);
      }
      if (params.status) {
        query.where('status', params.status);
      }
      if (params.providerId) {
        query.where('ordered_by', params.providerId);
      }
      if (params.startDate) {
        query.where('ordered_at', '>=', params.startDate);
      }
      if (params.endDate) {
        query.where('ordered_at', '<=', params.endDate);
      }

      const allowedSortColumns: Record<string, string> = {
        orderedAt: 'ordered_at',
        status: 'status',
        orderType: 'order_type',
        priority: 'priority',
        code: 'code_display',
      };

      this.buildSortClause(query, params.sort, params.order, allowedSortColumns);

      if (!params.sort) {
        query.orderBy('ordered_at', 'desc');
      }

      const result = await this.paginate<OrderRow>(query, params);

      return {
        data: result.data.map((row) => this.fromRow(row)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.handleError('Failed to get patient orders', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Pending Orders for Provider
  // ---------------------------------------------------------------------------

  async getPendingOrders(providerId: string): Promise<Order[]> {
    try {
      const rows = await this.db('orders')
        .where({ ordered_by: providerId, status: 'draft' })
        .orderBy('priority', 'asc')
        .orderBy('ordered_at', 'asc') as OrderRow[];

      return rows.map((row) => this.fromRow(row));
    } catch (error) {
      this.handleError('Failed to get pending orders', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Lab Panels
  // ---------------------------------------------------------------------------

  getLabPanels(): Record<string, { name: string; tests: Array<{ code: string; display: string }> }> {
    return LAB_PANELS;
  }

  // ---------------------------------------------------------------------------
  // Acknowledge Result
  // ---------------------------------------------------------------------------

  async acknowledgeResult(orderId: string, userId: string): Promise<Order> {
    try {
      const row = await this.db('orders').where({ id: orderId }).first<OrderRow>();
      if (!row) {
        throw new NotFoundError('Order', orderId);
      }

      const now = new Date().toISOString();
      await this.db('orders').where({ id: orderId }).update({
        acknowledged_at: now,
        acknowledged_by: userId,
        updated_at: now,
      });

      this.logger.info('Result acknowledged', { orderId, userId });
      return this.getOrder(orderId);
    } catch (error) {
      this.handleError('Failed to acknowledge result', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Bulk Acknowledge Results
  // ---------------------------------------------------------------------------

  async bulkAcknowledgeResults(orderIds: string[], userId: string): Promise<{ acknowledged: number }> {
    try {
      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        throw new ValidationError('orderIds array is required');
      }

      const now = new Date().toISOString();
      const count = await this.db('orders')
        .whereIn('id', orderIds)
        .whereNull('acknowledged_at')
        .update({
          acknowledged_at: now,
          acknowledged_by: userId,
          updated_at: now,
        });

      this.logger.info('Bulk results acknowledged', { count, userId });
      return { acknowledged: count };
    } catch (error) {
      this.handleError('Failed to bulk acknowledge results', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Amend Result
  // ---------------------------------------------------------------------------

  async amendResult(
    orderId: string,
    userId: string,
    reason: string,
    updatedResults?: unknown
  ): Promise<Order> {
    try {
      const row = await this.db('orders').where({ id: orderId }).first<OrderRow>();
      if (!row) {
        throw new NotFoundError('Order', orderId);
      }

      if (!reason) {
        throw new ValidationError('Amendment reason is required');
      }

      const now = new Date().toISOString();
      await this.db('orders').where({ id: orderId }).update({
        amended_at: now,
        amendment_reason: reason,
        original_results: row.results ? JSON.stringify(JSON.parse(row.results)) : null,
        results: updatedResults ? JSON.stringify(updatedResults) : row.results,
        acknowledged_at: null,
        acknowledged_by: null,
        updated_at: now,
      });

      this.logger.info('Result amended', { orderId, userId, reason });
      return this.getOrder(orderId);
    } catch (error) {
      this.handleError('Failed to amend result', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Record Critical Result
  // ---------------------------------------------------------------------------

  async recordCriticalResult(
    orderId: string,
    notifiedBy: string,
    notifiedTo: string
  ): Promise<Order> {
    try {
      const row = await this.db('orders').where({ id: orderId }).first<OrderRow>();
      if (!row) {
        throw new NotFoundError('Order', orderId);
      }

      const now = new Date().toISOString();
      await this.db('orders').where({ id: orderId }).update({
        is_critical: true,
        critical_notified_at: now,
        critical_notified_to: notifiedTo,
        updated_at: now,
      });

      this.logger.info('Critical result recorded', { orderId, notifiedBy, notifiedTo });
      return this.getOrder(orderId);
    } catch (error) {
      this.handleError('Failed to record critical result', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Unacknowledged Results
  // ---------------------------------------------------------------------------

  async getUnacknowledgedResults(
    providerId: string,
    filters: { status?: string; orderType?: string; priority?: string; startDate?: string; endDate?: string } = {}
  ): Promise<Order[]> {
    try {
      const query = this.db('orders')
        .where('ordered_by_id', providerId)
        .whereIn('status', ['completed', 'active'])
        .whereNull('acknowledged_at');

      if (filters.orderType) {
        query.where('order_type', filters.orderType);
      }
      if (filters.priority) {
        query.where('priority', filters.priority);
      }
      if (filters.startDate) {
        query.where('ordered_at', '>=', filters.startDate);
      }
      if (filters.endDate) {
        query.where('ordered_at', '<=', filters.endDate);
      }

      query.orderBy('is_critical', 'desc').orderBy('priority', 'asc').orderBy('ordered_at', 'desc');

      const rows = await query as OrderRow[];
      return rows.map((row) => this.fromRow(row));
    } catch (error) {
      this.handleError('Failed to get unacknowledged results', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Critical Results
  // ---------------------------------------------------------------------------

  async getCriticalResults(providerId: string): Promise<Order[]> {
    try {
      const rows = await this.db('orders')
        .where({ ordered_by_id: providerId, is_critical: true })
        .whereNull('critical_acknowledged_at')
        .orderBy('critical_notified_at', 'desc') as OrderRow[];

      return rows.map((row) => this.fromRow(row));
    } catch (error) {
      this.handleError('Failed to get critical results', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update Order Lifecycle
  // ---------------------------------------------------------------------------

  async updateOrderLifecycle(
    orderId: string,
    stage: string,
    userId: string
  ): Promise<Order> {
    try {
      const row = await this.db('orders').where({ id: orderId }).first<OrderRow>();
      if (!row) {
        throw new NotFoundError('Order', orderId);
      }

      const now = new Date().toISOString();
      const updates: Record<string, unknown> = { updated_at: now };

      switch (stage) {
        case 'specimen_received':
          updates.specimen_received_at = now;
          break;
        case 'lab_processing':
          updates.lab_processing_at = now;
          break;
        case 'completed':
          updates.completed_at = now;
          updates.status = 'completed';
          break;
        case 'reported':
          updates.reported_at = now;
          break;
        default:
          throw new ValidationError(`Invalid lifecycle stage: ${stage}`);
      }

      await this.db('orders').where({ id: orderId }).update(updates);

      this.logger.info('Order lifecycle updated', { orderId, stage, userId });
      return this.getOrder(orderId);
    } catch (error) {
      this.handleError('Failed to update order lifecycle', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Forward Result
  // ---------------------------------------------------------------------------

  async forwardResult(
    orderId: string,
    forwardedBy: string,
    forwardTo: string,
    note?: string
  ): Promise<{ success: boolean }> {
    try {
      const row = await this.db('orders').where({ id: orderId }).first<OrderRow>();
      if (!row) {
        throw new NotFoundError('Order', orderId);
      }

      if (!forwardTo) {
        throw new ValidationError('forwardTo is required');
      }

      // Create an internal message with the result details
      const { messageService } = await import('./message.service');
      await messageService.send({
        senderId: forwardedBy,
        recipientId: forwardTo,
        patientId: row.patient_id,
        subject: `Forwarded Result: ${row.code_display || 'Order'} (${row.order_type})`,
        body: note
          ? `${note}\n\nOrder ID: ${orderId}\nType: ${row.order_type}\nStatus: ${row.status}\nCode: ${row.code_display}`
          : `Result forwarded for your review.\n\nOrder ID: ${orderId}\nType: ${row.order_type}\nStatus: ${row.status}\nCode: ${row.code_display}`,
        priority: (row as any).is_critical ? 'urgent' : 'normal',
      });

      this.logger.info('Result forwarded', { orderId, forwardedBy, forwardTo });
      return { success: true };
    } catch (error) {
      this.handleError('Failed to forward result', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Acknowledgment Analytics
  // ---------------------------------------------------------------------------

  async getAcknowledgmentAnalytics(providerId: string): Promise<Record<string, unknown>> {
    try {
      const total = await this.db('orders')
        .where('ordered_by_id', providerId)
        .whereIn('status', ['completed', 'active'])
        .count('* as count')
        .first() as { count: string | number } | undefined;

      const acknowledged = await this.db('orders')
        .where('ordered_by_id', providerId)
        .whereIn('status', ['completed', 'active'])
        .whereNotNull('acknowledged_at')
        .count('* as count')
        .first() as { count: string | number } | undefined;

      const unacknowledged = await this.db('orders')
        .where('ordered_by_id', providerId)
        .whereIn('status', ['completed', 'active'])
        .whereNull('acknowledged_at')
        .count('* as count')
        .first() as { count: string | number } | undefined;

      const critical = await this.db('orders')
        .where({ ordered_by_id: providerId, is_critical: true })
        .count('* as count')
        .first() as { count: string | number } | undefined;

      const overdue = await this.db('orders')
        .where('ordered_by_id', providerId)
        .whereNotNull('follow_up_date')
        .where('follow_up_date', '<', new Date().toISOString().split('T')[0])
        .where('follow_up_completed', false)
        .count('* as count')
        .first() as { count: string | number } | undefined;

      return {
        totalResults: Number(total?.count || 0),
        acknowledged: Number(acknowledged?.count || 0),
        unacknowledged: Number(unacknowledged?.count || 0),
        criticalResults: Number(critical?.count || 0),
        overdueFollowUps: Number(overdue?.count || 0),
        acknowledgmentRate: Number(total?.count || 0) > 0
          ? Math.round((Number(acknowledged?.count || 0) / Number(total?.count || 0)) * 100)
          : 0,
      };
    } catch (error) {
      this.handleError('Failed to get acknowledgment analytics', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Result Trending
  // ---------------------------------------------------------------------------

  async getResultTrending(
    patientId: string,
    loincCode?: string
  ): Promise<Array<{ date: string; value: number; unit: string; code: string; display: string }>> {
    try {
      const query = this.db('observations')
        .where({ patient_id: patientId })
        .whereNotNull('value_quantity_value')
        .select(
          'effective_date_time as date',
          'value_quantity_value as value',
          'value_quantity_unit as unit',
          'code_code as code',
          'code_display as display'
        )
        .orderBy('effective_date_time', 'asc')
        .limit(100);

      if (loincCode) {
        query.where('code_code', loincCode);
      }

      const rows = await query;
      return rows.map((r: any) => ({
        date: r.date,
        value: Number(r.value),
        unit: r.unit || '',
        code: r.code || '',
        display: r.display || '',
      }));
    } catch (error) {
      this.handleError('Failed to get result trending', error);
    }
  }

  // ===========================================================================
  // CDS Checking Methods (Private)
  // ===========================================================================

  private async checkDrugInteractions(rxnormCode: string, patientId: string): Promise<CDSAlert[]> {
    const alerts: CDSAlert[] = [];

    // Get all active medications for this patient
    const activeMeds = await this.db('medication_requests')
      .where({ patient_id: patientId, status: 'active' })
      .select('medication_code_code', 'medication_code_display') as Array<{ medication_code_code: string; medication_code_display: string }>;

    // Also check active medication orders
    const activeMedOrders = await this.db('orders')
      .where({ patient_id: patientId, order_type: 'medication', status: 'active' })
      .select('code_code', 'code_display') as Array<{ code_code: string; code_display: string }>;

    const allActiveCodes = [
      ...activeMeds.map((m) => ({ code: m.medication_code_code, display: m.medication_code_display })),
      ...activeMedOrders.map((o) => ({ code: o.code_code, display: o.code_display })),
    ];

    for (const activeMed of allActiveCodes) {
      if (!activeMed.code) continue;

      for (const interaction of KNOWN_DRUG_INTERACTIONS) {
        const isMatch =
          (interaction.drug1 === rxnormCode && interaction.drug2 === activeMed.code) ||
          (interaction.drug2 === rxnormCode && interaction.drug1 === activeMed.code);

        if (isMatch) {
          alerts.push({
            severity: interaction.severity,
            summary: `Drug-Drug Interaction: ${interaction.description.split(':')[0]}`,
            detail: interaction.description,
            source: 'Drug Interaction Database',
            overridable: interaction.severity !== 'critical',
          });
        }
      }
    }

    return alerts;
  }

  private async checkDrugAllergyInteractions(rxnormCode: string, patientId: string): Promise<CDSAlert[]> {
    const alerts: CDSAlert[] = [];

    // Get active allergies for this patient
    const allergies = await this.db('allergy_intolerances')
      .where({ patient_id: patientId, clinical_status: 'active' })
      .select('code_code', 'code_display', 'code_system') as Array<{ code_code: string; code_display: string; code_system: string }>;

    for (const allergy of allergies) {
      if (!allergy.code_code) continue;

      // Check for exact code match (drug allergy codes in RxNorm)
      if (allergy.code_code === rxnormCode) {
        alerts.push({
          severity: 'critical',
          summary: `Drug-Allergy Interaction: Patient is allergic to this medication`,
          detail: `Patient has a documented allergy to ${allergy.code_display || 'this substance'} (${allergy.code_code}). Ordering ${rxnormCode} may cause an allergic reaction.`,
          source: 'Allergy Checking',
          overridable: false,
        });
      }

      // Check for class-level allergy match
      // Common medication class allergy checks
      const nsaidCodes = ['5487', '7258', '7781', '6730', '41126', '1191'];
      const penicillinCodes = ['7984', '733', '1721', '392151'];
      const sulfonamideCodes = ['10180', '9524', '1202'];
      const cephalosporinCodes = ['2180', '20481', '25033', '2191'];

      const drugClasses = [
        { name: 'NSAID', codes: nsaidCodes },
        { name: 'Penicillin', codes: penicillinCodes },
        { name: 'Sulfonamide', codes: sulfonamideCodes },
        { name: 'Cephalosporin', codes: cephalosporinCodes },
      ];

      for (const drugClass of drugClasses) {
        const allergyIsInClass = drugClass.codes.includes(allergy.code_code);
        const newDrugIsInClass = drugClass.codes.includes(rxnormCode);

        if (allergyIsInClass && newDrugIsInClass && allergy.code_code !== rxnormCode) {
          alerts.push({
            severity: 'warning',
            summary: `Drug-Class Allergy: Patient allergic to ${drugClass.name} class`,
            detail: `Patient has documented allergy to ${allergy.code_display || allergy.code_code} (${drugClass.name} class). The ordered medication is in the same drug class.`,
            source: 'Drug Class Allergy Checking',
            overridable: true,
          });
        }
      }

      // Cross-reactivity: penicillin allergy -> cephalosporin warning
      const allergyIsPenicillin = penicillinCodes.includes(allergy.code_code);
      const newDrugIsCephalosporin = cephalosporinCodes.includes(rxnormCode);
      if (allergyIsPenicillin && newDrugIsCephalosporin) {
        alerts.push({
          severity: 'warning',
          summary: 'Cross-Reactivity Warning: Penicillin allergy with Cephalosporin',
          detail: `Patient has documented penicillin allergy (${allergy.code_display || allergy.code_code}). Approximately 1-2% cross-reactivity risk with cephalosporins.`,
          source: 'Cross-Reactivity Checking',
          overridable: true,
        });
      }
    }

    return alerts;
  }

  private async checkDuplicateTherapy(rxnormCode: string, patientId: string): Promise<CDSAlert[]> {
    const alerts: CDSAlert[] = [];

    // Get active medications
    const activeMeds = await this.db('medication_requests')
      .where({ patient_id: patientId, status: 'active' })
      .select('medication_code_code', 'medication_code_display') as Array<{ medication_code_code: string; medication_code_display: string }>;

    const activeOrders = await this.db('orders')
      .where({ patient_id: patientId, order_type: 'medication', status: 'active' })
      .select('code_code', 'code_display') as Array<{ code_code: string; code_display: string }>;

    const allActiveCodes = [
      ...activeMeds.map((m) => m.medication_code_code),
      ...activeOrders.map((o) => o.code_code),
    ].filter(Boolean);

    // Check exact duplicate
    if (allActiveCodes.includes(rxnormCode)) {
      const existingMed = activeMeds.find((m) => m.medication_code_code === rxnormCode) ||
        activeOrders.find((o) => o.code_code === rxnormCode);
      alerts.push({
        severity: 'warning',
        summary: 'Duplicate Medication',
        detail: `Patient already has an active order/prescription for ${existingMed ? ('medication_code_display' in existingMed ? existingMed.medication_code_display : existingMed.code_display) : rxnormCode}. Consider reviewing before placing a duplicate order.`,
        source: 'Duplicate Therapy Checking',
        overridable: true,
      });
    }

    // Check therapeutic class duplication
    for (const [className, classCodes] of Object.entries(DRUG_CLASSES)) {
      if (!classCodes.includes(rxnormCode)) continue;

      for (const activeCode of allActiveCodes) {
        if (classCodes.includes(activeCode) && activeCode !== rxnormCode) {
          const existingMed = activeMeds.find((m) => m.medication_code_code === activeCode) ||
            activeOrders.find((o) => o.code_code === activeCode);
          const existingName = existingMed
            ? ('medication_code_display' in existingMed ? existingMed.medication_code_display : existingMed.code_display)
            : activeCode;

          alerts.push({
            severity: 'info',
            summary: `Duplicate Therapeutic Class: ${className.replace(/_/g, ' ')}`,
            detail: `Patient is already taking ${existingName} which is in the same therapeutic class (${className.replace(/_/g, ' ')}). Evaluate for therapeutic duplication.`,
            source: 'Duplicate Therapy Checking',
            overridable: true,
          });
          break; // Only alert once per class
        }
      }
    }

    return alerts;
  }

  private checkDosageRange(medication: CreateMedicationOrderDTO['medication']): CDSAlert[] {
    const alerts: CDSAlert[] = [];

    // Basic dosage validation - extract numeric value from dosage string
    const dosageMatch = medication.dosage.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|iu)/i);
    if (!dosageMatch) {
      return alerts; // Cannot parse dosage for validation
    }

    const value = parseFloat(dosageMatch[1]);
    const unit = dosageMatch[2].toLowerCase();

    // Common medication max doses (simplified for demonstration)
    const maxDoses: Record<string, { maxSingle: number; unit: string; name: string }> = {
      '161': { maxSingle: 4000, unit: 'mg', name: 'Acetaminophen' },   // Acetaminophen
      '5487': { maxSingle: 800, unit: 'mg', name: 'Ibuprofen' },       // Ibuprofen
      '6918': { maxSingle: 2550, unit: 'mg', name: 'Metformin' },      // Metformin
      '35296': { maxSingle: 80, unit: 'mg', name: 'Lisinopril' },      // Lisinopril
      '36567': { maxSingle: 80, unit: 'mg', name: 'Simvastatin' },     // Simvastatin
      '83367': { maxSingle: 80, unit: 'mg', name: 'Atorvastatin' },    // Atorvastatin
      '7804': { maxSingle: 200, unit: 'mg', name: 'Morphine' },        // Morphine (single oral dose max)
      '7646': { maxSingle: 80, unit: 'mg', name: 'Oxycodone' },        // Oxycodone (oral dose)
      '1191': { maxSingle: 650, unit: 'mg', name: 'Aspirin' },         // Aspirin
    };

    const maxDose = maxDoses[medication.rxnormCode];
    if (maxDose && unit === maxDose.unit && value > maxDose.maxSingle) {
      alerts.push({
        severity: 'warning',
        summary: `High Dose Alert: ${maxDose.name}`,
        detail: `Ordered dose of ${value}${unit} exceeds the typical maximum single dose of ${maxDose.maxSingle}${maxDose.unit} for ${maxDose.name}. Please verify the dosage.`,
        source: 'Dosage Range Checking',
        overridable: true,
      });
    }

    return alerts;
  }

  // ===========================================================================
  // HL7v2 ORM Message Builder
  // ===========================================================================

  private buildORM(order: OrderRow, signerId: string, timestamp: string): string {
    const ts = timestamp.replace(/[-:T]/g, '').substring(0, 14);
    const msgId = uuidv4().replace(/-/g, '').substring(0, 20);

    const orderType = order.order_type === 'medication' ? 'RX'
      : order.order_type === 'laboratory' ? 'LAB'
      : 'RAD';

    return [
      `MSH|^~\\&|TRIBAL_EHR|TRIBAL_HEALTH|EXTERNAL|PARTNER|${ts}||ORM^O01^ORM_O01|${msgId}|P|2.5.1|||AL|AL`,
      `PID|1||${order.patient_id}^^^TRIBAL_EHR^MR`,
      `ORC|NW|${order.id}|||CM||||${ts}|||${signerId}`,
      `OBR|1|${order.id}||${order.code_code}^${order.code_display}^${orderType === 'LAB' ? 'LN' : orderType === 'RX' ? 'RXNORM' : 'CPT'}|||${ts}|||||||||${signerId}`,
    ].join('\r');
  }

  // ===========================================================================
  // Queue Publishing (Best Effort)
  // ===========================================================================

  private async publishToQueue(routingKey: string, message: string): Promise<void> {
    // In production, this would use amqplib to publish to RabbitMQ
    // For now, log the message for later integration
    this.logger.info('HL7 message ready for queue', {
      routingKey,
      messageLength: message.length,
      messageType: 'ORM^O01',
    });
  }

  // ===========================================================================
  // Row Mapping
  // ===========================================================================

  private fromRow(row: OrderRow): Order {
    const details = row.details ? JSON.parse(row.details) : {};
    return {
      id: row.id,
      patientId: row.patient_id,
      encounterId: row.encounter_id,
      orderType: row.order_type as OrderType,
      status: row.status as OrderStatus,
      priority: row.priority as OrderPriority,
      code: row.code_code,
      codeSystem: row.code_system,
      codeDisplay: row.code_display,
      orderDetails: details.medication || details.lab || details.imaging || {},
      cdsAlerts: details.cdsAlerts || [],
      orderedBy: row.ordered_by_id,
      orderedAt: row.ordered_at,
      signedBy: row.signed_by_id,
      signedAt: row.signed_at,
      clinicalIndication: row.clinical_indication,
      notes: row.notes,
      fhirId: row.fhir_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const orderService = new OrderService();
