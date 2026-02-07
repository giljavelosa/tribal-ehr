// =============================================================================
// E-Prescribing Service
// ONC Certification: 170.315(b)(3) - Electronic Prescribing
// Supports NCPDP SCRIPT 2017071 standard for e-prescribing
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError, AppError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ScriptMessage {
  messageId: string;
  scriptXml: string;
  status: string;
}

interface MedicationOrderRow {
  id: string;
  patient_id: string;
  encounter_id?: string;
  status: string;
  intent: string;
  medication_code: string;
  medication_system: string;
  medication_display?: string;
  authored_on?: string;
  requester_reference?: string;
  requester_display?: string;
  dosage_instruction?: string;
  dispense_request?: string;
  substitution?: string;
  note?: string;
  fhir_id?: string;
}

interface PatientRow {
  id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  date_of_birth?: string;
  gender?: string;
  mrn?: string;
  ssn?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  phone_home?: string;
}

interface PrescriberRow {
  id: string;
  first_name: string;
  last_name: string;
  npi?: string;
  dea_number?: string;
  specialty?: string;
  phone?: string;
  fax?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
}

interface PharmacyRow {
  id: string;
  name: string;
  ncpdp_id?: string;
  npi?: string;
  phone?: string;
  fax?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
}

interface FormularyResult {
  covered: boolean;
  tier: number;
  priorAuthRequired: boolean;
  alternatives: Array<{ code: string; name: string; tier: number }>;
  copay?: number;
}

interface PriorAuthResult {
  authId: string;
  status: 'pending' | 'approved' | 'denied';
  responseMessage?: string;
}

interface EPCSResult {
  verified: boolean;
  deaSchedule: string;
  reason?: string;
}

interface DosageInstruction {
  text?: string;
  route?: { coding?: Array<{ code?: string; display?: string }> };
  doseAndRate?: Array<{
    doseQuantity?: { value?: number; unit?: string };
    rateQuantity?: { value?: number; unit?: string };
  }>;
  timing?: {
    repeat?: {
      frequency?: number;
      period?: number;
      periodUnit?: string;
      when?: string[];
    };
    code?: { coding?: Array<{ code?: string; display?: string }>; text?: string };
  };
  method?: { coding?: Array<{ code?: string; display?: string }> };
  maxDosePerPeriod?: {
    numerator?: { value?: number; unit?: string };
    denominator?: { value?: number; unit?: string };
  };
  additionalInstruction?: Array<{ text?: string }>;
  asNeededBoolean?: boolean;
  asNeededCodeableConcept?: { text?: string };
}

// -----------------------------------------------------------------------------
// DEA Schedule Lookup
// -----------------------------------------------------------------------------

const DEA_SCHEDULES: Record<string, string> = {
  // Schedule II
  '1049502': 'II',  // Oxycodone
  '197696': 'II',   // Hydrocodone/APAP
  '1053647': 'II',  // Methylphenidate
  '312961': 'II',   // Fentanyl
  '1049589': 'II',  // Amphetamine salts
  '1014599': 'II',  // Oxymorphone
  '1115573': 'II',  // Morphine sulfate
  '864706': 'II',   // Methadone
  '1860154': 'II',  // Lisdexamfetamine
  // Schedule III
  '1797861': 'III',  // Buprenorphine
  '262076': 'III',   // Testosterone
  '1012727': 'III',  // Ketamine
  // Schedule IV
  '199789': 'IV',   // Alprazolam
  '197591': 'IV',   // Diazepam
  '42844': 'IV',    // Zolpidem
  '197381': 'IV',   // Clonazepam
  '199283': 'IV',   // Lorazepam
  '485438': 'IV',   // Tramadol
  '1091396': 'IV',  // Carisoprodol
  '197464': 'IV',   // Phenobarbital
  // Schedule V
  '1190572': 'V',   // Pregabalin
  '1251052': 'V',   // Lacosamide
};

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class EPrescribingService extends BaseService {
  constructor() {
    super('EPrescribingService');
  }

  // ---------------------------------------------------------------------------
  // Generate NCPDP SCRIPT 2017071 NewRx message
  // ---------------------------------------------------------------------------

  async generateNewRx(medicationOrderId: string): Promise<ScriptMessage> {
    try {
      // Fetch medication order
      const order = await this.db('medication_requests')
        .where({ id: medicationOrderId })
        .first<MedicationOrderRow>();

      if (!order) {
        throw new NotFoundError('Medication Order', medicationOrderId);
      }

      if (order.status !== 'active' && order.status !== 'draft') {
        throw new ValidationError(
          `Medication order must be in active or draft status for e-prescribing, current status: ${order.status}`
        );
      }

      // Fetch patient
      const patient = await this.db('patients')
        .where({ id: order.patient_id })
        .first<PatientRow>();

      if (!patient) {
        throw new NotFoundError('Patient', order.patient_id);
      }

      // Fetch prescriber from requester reference
      const prescriberId = order.requester_reference?.replace('Practitioner/', '');
      let prescriber: PrescriberRow | undefined;
      if (prescriberId) {
        prescriber = await this.db('practitioners')
          .where({ id: prescriberId })
          .first<PrescriberRow>();
      }

      // Fetch the preferred pharmacy for the patient
      const pharmacy = await this.db('patient_pharmacies')
        .where({ patient_id: order.patient_id, is_preferred: true })
        .join('pharmacies', 'patient_pharmacies.pharmacy_id', 'pharmacies.id')
        .first<PharmacyRow>();

      // Parse dosage and dispense info
      let dosageInstructions: DosageInstruction[] = [];
      if (order.dosage_instruction) {
        try {
          dosageInstructions = JSON.parse(order.dosage_instruction);
        } catch {
          // Not parseable
        }
      }

      let dispenseRequest: Record<string, unknown> = {};
      if (order.dispense_request) {
        try {
          dispenseRequest = JSON.parse(order.dispense_request);
        } catch {
          // Not parseable
        }
      }

      let substitution: Record<string, unknown> = {};
      if (order.substitution) {
        try {
          substitution = JSON.parse(order.substitution);
        } catch {
          // Not parseable
        }
      }

      const messageId = uuidv4().replace(/-/g, '').substring(0, 20).toUpperCase();
      const timestamp = new Date().toISOString();
      const sig = this.generateStructuredSig(dosageInstructions[0] || {});

      // Build NCPDP SCRIPT 2017071 NewRx XML
      const scriptXml = `<?xml version="1.0" encoding="utf-8"?>
<Message xmlns="http://www.ncpdp.org/schema/SCRIPT" version="2017071"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  release="016">
  <Header>
    <To Qualifier="P">${pharmacy?.ncpdp_id || 'UNKNOWN'}</To>
    <From Qualifier="D">${prescriber?.npi || 'UNKNOWN'}</From>
    <MessageID>${messageId}</MessageID>
    <RelatesToMessageID/>
    <SentTime>${timestamp}</SentTime>
    <Security>
      <Sender>
        <TertiaryIdentification>${prescriber?.dea_number || ''}</TertiaryIdentification>
      </Sender>
    </Security>
    <SenderSoftware>
      <SenderSoftwareDeveloper>Tribal EHR</SenderSoftwareDeveloper>
      <SenderSoftwareProduct>Tribal EHR E-Prescribing</SenderSoftwareProduct>
      <SenderSoftwareVersionRelease>1.0</SenderSoftwareVersionRelease>
    </SenderSoftware>
  </Header>
  <Body>
    <NewRx>
      <Patient>
        <HumanPatient>
          <Name>
            <LastName>${this.escapeXml(patient.last_name)}</LastName>
            <FirstName>${this.escapeXml(patient.first_name)}</FirstName>
            <MiddleName>${this.escapeXml(patient.middle_name || '')}</MiddleName>
          </Name>
          <Gender>${this.mapGenderToNCPDP(patient.gender)}</Gender>
          <DateOfBirth>
            <Date>${this.formatNCPDPDate(patient.date_of_birth || '')}</Date>
          </DateOfBirth>
          <Address>
            <AddressLine1>${this.escapeXml(patient.address_street || '')}</AddressLine1>
            <City>${this.escapeXml(patient.address_city || '')}</City>
            <StateProvince>${this.escapeXml(patient.address_state || '')}</StateProvince>
            <PostalCode>${this.escapeXml(patient.address_zip || '')}</PostalCode>
          </Address>
          <CommunicationNumbers>
            <PrimaryTelephone>
              <Number>${this.escapeXml(patient.phone_home || '')}</Number>
            </PrimaryTelephone>
          </CommunicationNumbers>
          <Identification>
            <MedicalRecordIdentificationNumberEHR>${this.escapeXml(patient.mrn || patient.id)}</MedicalRecordIdentificationNumberEHR>
          </Identification>
        </HumanPatient>
      </Patient>
      <Pharmacy>
        <Identification>
          <NCPDPID>${this.escapeXml(pharmacy?.ncpdp_id || '')}</NCPDPID>
          <NPI>${this.escapeXml(pharmacy?.npi || '')}</NPI>
        </Identification>
        <StoreName>${this.escapeXml(pharmacy?.name || 'Unknown Pharmacy')}</StoreName>
        <Address>
          <AddressLine1>${this.escapeXml(pharmacy?.address_street || '')}</AddressLine1>
          <City>${this.escapeXml(pharmacy?.address_city || '')}</City>
          <StateProvince>${this.escapeXml(pharmacy?.address_state || '')}</StateProvince>
          <PostalCode>${this.escapeXml(pharmacy?.address_zip || '')}</PostalCode>
        </Address>
        <CommunicationNumbers>
          <PrimaryTelephone>
            <Number>${this.escapeXml(pharmacy?.phone || '')}</Number>
          </PrimaryTelephone>
          <Fax>
            <Number>${this.escapeXml(pharmacy?.fax || '')}</Number>
          </Fax>
        </CommunicationNumbers>
      </Pharmacy>
      <Prescriber>
        <NonVeterinarian>
          <Name>
            <LastName>${this.escapeXml(prescriber?.last_name || '')}</LastName>
            <FirstName>${this.escapeXml(prescriber?.first_name || '')}</FirstName>
          </Name>
          <Address>
            <AddressLine1>${this.escapeXml(prescriber?.address_street || '')}</AddressLine1>
            <City>${this.escapeXml(prescriber?.address_city || '')}</City>
            <StateProvince>${this.escapeXml(prescriber?.address_state || '')}</StateProvince>
            <PostalCode>${this.escapeXml(prescriber?.address_zip || '')}</PostalCode>
          </Address>
          <CommunicationNumbers>
            <PrimaryTelephone>
              <Number>${this.escapeXml(prescriber?.phone || '')}</Number>
            </PrimaryTelephone>
            <Fax>
              <Number>${this.escapeXml(prescriber?.fax || '')}</Number>
            </Fax>
          </CommunicationNumbers>
          <Identification>
            <NPI>${this.escapeXml(prescriber?.npi || '')}</NPI>
            <DEANumber>${this.escapeXml(prescriber?.dea_number || '')}</DEANumber>
          </Identification>
          <Specialty>${this.escapeXml(prescriber?.specialty || '')}</Specialty>
        </NonVeterinarian>
      </Prescriber>
      <MedicationPrescribed>
        <DrugDescription>${this.escapeXml(order.medication_display || '')}</DrugDescription>
        <DrugCoded>
          <ProductCode>
            <Code>${this.escapeXml(order.medication_code)}</Code>
            <Qualifier>${order.medication_system === 'http://hl7.org/fhir/sid/ndc' ? 'ND' : 'SBD'}</Qualifier>
          </ProductCode>
        </DrugCoded>
        <Quantity>
          <Value>${this.getDispenseQuantity(dispenseRequest)}</Value>
          <CodeListQualifier>EA</CodeListQualifier>
        </Quantity>
        <DaysSupply>${this.getDaysSupply(dispenseRequest)}</DaysSupply>
        <WrittenDate>
          <Date>${this.formatNCPDPDate(order.authored_on || new Date().toISOString())}</Date>
        </WrittenDate>
        <Substitutions>${this.getSubstitutionCode(substitution)}</Substitutions>
        <NumberOfRefills>${this.getRefills(dispenseRequest)}</NumberOfRefills>
        <Sig>
          <SigText>${this.escapeXml(sig)}</SigText>
        </Sig>
        <StructuredSig>
          ${this.buildStructuredSigXml(dosageInstructions[0] || {})}
        </StructuredSig>
      </MedicationPrescribed>
    </NewRx>
  </Body>
</Message>`;

      // Store the message for tracking
      const now = new Date().toISOString();
      await this.db('eprescribing_messages').insert({
        id: messageId,
        medication_order_id: medicationOrderId,
        patient_id: order.patient_id,
        message_type: 'NewRx',
        message_content: scriptXml,
        status: 'generated',
        created_at: now,
        updated_at: now,
      });

      this.logger.info('NewRx message generated', {
        messageId,
        medicationOrderId,
        medication: order.medication_display,
        patientId: order.patient_id,
      });

      return {
        messageId,
        scriptXml,
        status: 'generated',
      };
    } catch (error) {
      this.handleError('Failed to generate NewRx message', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Generate Refill Request
  // ---------------------------------------------------------------------------

  async generateRefillRequest(medicationOrderId: string): Promise<ScriptMessage> {
    try {
      const order = await this.db('medication_requests')
        .where({ id: medicationOrderId })
        .first<MedicationOrderRow>();

      if (!order) {
        throw new NotFoundError('Medication Order', medicationOrderId);
      }

      const patient = await this.db('patients')
        .where({ id: order.patient_id })
        .first<PatientRow>();

      if (!patient) {
        throw new NotFoundError('Patient', order.patient_id);
      }

      const prescriberId = order.requester_reference?.replace('Practitioner/', '');
      let prescriber: PrescriberRow | undefined;
      if (prescriberId) {
        prescriber = await this.db('practitioners')
          .where({ id: prescriberId })
          .first<PrescriberRow>();
      }

      const pharmacy = await this.db('patient_pharmacies')
        .where({ patient_id: order.patient_id, is_preferred: true })
        .join('pharmacies', 'patient_pharmacies.pharmacy_id', 'pharmacies.id')
        .first<PharmacyRow>();

      const messageId = uuidv4().replace(/-/g, '').substring(0, 20).toUpperCase();
      const timestamp = new Date().toISOString();

      const scriptXml = `<?xml version="1.0" encoding="utf-8"?>
<Message xmlns="http://www.ncpdp.org/schema/SCRIPT" version="2017071" release="016">
  <Header>
    <To Qualifier="D">${prescriber?.npi || 'UNKNOWN'}</To>
    <From Qualifier="P">${pharmacy?.ncpdp_id || 'UNKNOWN'}</From>
    <MessageID>${messageId}</MessageID>
    <SentTime>${timestamp}</SentTime>
    <SenderSoftware>
      <SenderSoftwareDeveloper>Tribal EHR</SenderSoftwareDeveloper>
      <SenderSoftwareProduct>Tribal EHR E-Prescribing</SenderSoftwareProduct>
      <SenderSoftwareVersionRelease>1.0</SenderSoftwareVersionRelease>
    </SenderSoftware>
  </Header>
  <Body>
    <RefillRequest>
      <Patient>
        <HumanPatient>
          <Name>
            <LastName>${this.escapeXml(patient.last_name)}</LastName>
            <FirstName>${this.escapeXml(patient.first_name)}</FirstName>
          </Name>
          <Gender>${this.mapGenderToNCPDP(patient.gender)}</Gender>
          <DateOfBirth>
            <Date>${this.formatNCPDPDate(patient.date_of_birth || '')}</Date>
          </DateOfBirth>
        </HumanPatient>
      </Patient>
      <MedicationPrescribed>
        <DrugDescription>${this.escapeXml(order.medication_display || '')}</DrugDescription>
        <DrugCoded>
          <ProductCode>
            <Code>${this.escapeXml(order.medication_code)}</Code>
            <Qualifier>${order.medication_system === 'http://hl7.org/fhir/sid/ndc' ? 'ND' : 'SBD'}</Qualifier>
          </ProductCode>
        </DrugCoded>
      </MedicationPrescribed>
    </RefillRequest>
  </Body>
</Message>`;

      const now = new Date().toISOString();
      await this.db('eprescribing_messages').insert({
        id: messageId,
        medication_order_id: medicationOrderId,
        patient_id: order.patient_id,
        message_type: 'RefillRequest',
        message_content: scriptXml,
        status: 'generated',
        created_at: now,
        updated_at: now,
      });

      this.logger.info('RefillRequest message generated', {
        messageId,
        medicationOrderId,
      });

      return { messageId, scriptXml, status: 'generated' };
    } catch (error) {
      this.handleError('Failed to generate refill request', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Generate Renewal Request
  // ---------------------------------------------------------------------------

  async generateRenewalRequest(medicationOrderId: string): Promise<ScriptMessage> {
    try {
      const order = await this.db('medication_requests')
        .where({ id: medicationOrderId })
        .first<MedicationOrderRow>();

      if (!order) {
        throw new NotFoundError('Medication Order', medicationOrderId);
      }

      const patient = await this.db('patients')
        .where({ id: order.patient_id })
        .first<PatientRow>();

      if (!patient) {
        throw new NotFoundError('Patient', order.patient_id);
      }

      const prescriberId = order.requester_reference?.replace('Practitioner/', '');
      let prescriber: PrescriberRow | undefined;
      if (prescriberId) {
        prescriber = await this.db('practitioners')
          .where({ id: prescriberId })
          .first<PrescriberRow>();
      }

      const pharmacy = await this.db('patient_pharmacies')
        .where({ patient_id: order.patient_id, is_preferred: true })
        .join('pharmacies', 'patient_pharmacies.pharmacy_id', 'pharmacies.id')
        .first<PharmacyRow>();

      const messageId = uuidv4().replace(/-/g, '').substring(0, 20).toUpperCase();
      const timestamp = new Date().toISOString();

      const scriptXml = `<?xml version="1.0" encoding="utf-8"?>
<Message xmlns="http://www.ncpdp.org/schema/SCRIPT" version="2017071" release="016">
  <Header>
    <To Qualifier="D">${prescriber?.npi || 'UNKNOWN'}</To>
    <From Qualifier="P">${pharmacy?.ncpdp_id || 'UNKNOWN'}</From>
    <MessageID>${messageId}</MessageID>
    <SentTime>${timestamp}</SentTime>
    <SenderSoftware>
      <SenderSoftwareDeveloper>Tribal EHR</SenderSoftwareDeveloper>
      <SenderSoftwareProduct>Tribal EHR E-Prescribing</SenderSoftwareProduct>
      <SenderSoftwareVersionRelease>1.0</SenderSoftwareVersionRelease>
    </SenderSoftware>
  </Header>
  <Body>
    <RxRenewalRequest>
      <Patient>
        <HumanPatient>
          <Name>
            <LastName>${this.escapeXml(patient.last_name)}</LastName>
            <FirstName>${this.escapeXml(patient.first_name)}</FirstName>
          </Name>
          <Gender>${this.mapGenderToNCPDP(patient.gender)}</Gender>
          <DateOfBirth>
            <Date>${this.formatNCPDPDate(patient.date_of_birth || '')}</Date>
          </DateOfBirth>
        </HumanPatient>
      </Patient>
      <MedicationPrescribed>
        <DrugDescription>${this.escapeXml(order.medication_display || '')}</DrugDescription>
        <DrugCoded>
          <ProductCode>
            <Code>${this.escapeXml(order.medication_code)}</Code>
            <Qualifier>${order.medication_system === 'http://hl7.org/fhir/sid/ndc' ? 'ND' : 'SBD'}</Qualifier>
          </ProductCode>
        </DrugCoded>
      </MedicationPrescribed>
    </RxRenewalRequest>
  </Body>
</Message>`;

      const now = new Date().toISOString();
      await this.db('eprescribing_messages').insert({
        id: messageId,
        medication_order_id: medicationOrderId,
        patient_id: order.patient_id,
        message_type: 'RxRenewalRequest',
        message_content: scriptXml,
        status: 'generated',
        created_at: now,
        updated_at: now,
      });

      this.logger.info('RxRenewalRequest message generated', {
        messageId,
        medicationOrderId,
      });

      return { messageId, scriptXml, status: 'generated' };
    } catch (error) {
      this.handleError('Failed to generate renewal request', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Generate CancelRx
  // ---------------------------------------------------------------------------

  async generateCancelRx(
    medicationOrderId: string,
    reason: string
  ): Promise<ScriptMessage> {
    try {
      if (!reason || reason.trim().length === 0) {
        throw new ValidationError('A reason is required for prescription cancellation');
      }

      const order = await this.db('medication_requests')
        .where({ id: medicationOrderId })
        .first<MedicationOrderRow>();

      if (!order) {
        throw new NotFoundError('Medication Order', medicationOrderId);
      }

      const patient = await this.db('patients')
        .where({ id: order.patient_id })
        .first<PatientRow>();

      if (!patient) {
        throw new NotFoundError('Patient', order.patient_id);
      }

      const prescriberId = order.requester_reference?.replace('Practitioner/', '');
      let prescriber: PrescriberRow | undefined;
      if (prescriberId) {
        prescriber = await this.db('practitioners')
          .where({ id: prescriberId })
          .first<PrescriberRow>();
      }

      const pharmacy = await this.db('patient_pharmacies')
        .where({ patient_id: order.patient_id, is_preferred: true })
        .join('pharmacies', 'patient_pharmacies.pharmacy_id', 'pharmacies.id')
        .first<PharmacyRow>();

      const messageId = uuidv4().replace(/-/g, '').substring(0, 20).toUpperCase();
      const timestamp = new Date().toISOString();

      const scriptXml = `<?xml version="1.0" encoding="utf-8"?>
<Message xmlns="http://www.ncpdp.org/schema/SCRIPT" version="2017071" release="016">
  <Header>
    <To Qualifier="P">${pharmacy?.ncpdp_id || 'UNKNOWN'}</To>
    <From Qualifier="D">${prescriber?.npi || 'UNKNOWN'}</From>
    <MessageID>${messageId}</MessageID>
    <SentTime>${timestamp}</SentTime>
    <SenderSoftware>
      <SenderSoftwareDeveloper>Tribal EHR</SenderSoftwareDeveloper>
      <SenderSoftwareProduct>Tribal EHR E-Prescribing</SenderSoftwareProduct>
      <SenderSoftwareVersionRelease>1.0</SenderSoftwareVersionRelease>
    </SenderSoftware>
  </Header>
  <Body>
    <CancelRx>
      <CancelRxReasonCode>AA</CancelRxReasonCode>
      <CancelRxReason>${this.escapeXml(reason)}</CancelRxReason>
      <Patient>
        <HumanPatient>
          <Name>
            <LastName>${this.escapeXml(patient.last_name)}</LastName>
            <FirstName>${this.escapeXml(patient.first_name)}</FirstName>
          </Name>
          <Gender>${this.mapGenderToNCPDP(patient.gender)}</Gender>
          <DateOfBirth>
            <Date>${this.formatNCPDPDate(patient.date_of_birth || '')}</Date>
          </DateOfBirth>
        </HumanPatient>
      </Patient>
      <Prescriber>
        <NonVeterinarian>
          <Name>
            <LastName>${this.escapeXml(prescriber?.last_name || '')}</LastName>
            <FirstName>${this.escapeXml(prescriber?.first_name || '')}</FirstName>
          </Name>
          <Identification>
            <NPI>${this.escapeXml(prescriber?.npi || '')}</NPI>
          </Identification>
        </NonVeterinarian>
      </Prescriber>
      <MedicationPrescribed>
        <DrugDescription>${this.escapeXml(order.medication_display || '')}</DrugDescription>
        <DrugCoded>
          <ProductCode>
            <Code>${this.escapeXml(order.medication_code)}</Code>
            <Qualifier>${order.medication_system === 'http://hl7.org/fhir/sid/ndc' ? 'ND' : 'SBD'}</Qualifier>
          </ProductCode>
        </DrugCoded>
      </MedicationPrescribed>
    </CancelRx>
  </Body>
</Message>`;

      const now = new Date().toISOString();
      await this.db('eprescribing_messages').insert({
        id: messageId,
        medication_order_id: medicationOrderId,
        patient_id: order.patient_id,
        message_type: 'CancelRx',
        message_content: scriptXml,
        status: 'generated',
        created_at: now,
        updated_at: now,
      });

      this.logger.info('CancelRx message generated', {
        messageId,
        medicationOrderId,
        reason,
      });

      return { messageId, scriptXml, status: 'generated' };
    } catch (error) {
      this.handleError('Failed to generate CancelRx message', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Generate RxChangeRequest
  // ---------------------------------------------------------------------------

  async generateRxChange(
    medicationOrderId: string,
    changeData: {
      newMedicationCode?: string;
      newMedicationDisplay?: string;
      newDosage?: string;
      reason: string;
    }
  ): Promise<ScriptMessage> {
    try {
      if (!changeData.reason) {
        throw new ValidationError('A reason is required for prescription change');
      }

      const order = await this.db('medication_requests')
        .where({ id: medicationOrderId })
        .first<MedicationOrderRow>();

      if (!order) {
        throw new NotFoundError('Medication Order', medicationOrderId);
      }

      const patient = await this.db('patients')
        .where({ id: order.patient_id })
        .first<PatientRow>();

      if (!patient) {
        throw new NotFoundError('Patient', order.patient_id);
      }

      const prescriberId = order.requester_reference?.replace('Practitioner/', '');
      let prescriber: PrescriberRow | undefined;
      if (prescriberId) {
        prescriber = await this.db('practitioners')
          .where({ id: prescriberId })
          .first<PrescriberRow>();
      }

      const pharmacy = await this.db('patient_pharmacies')
        .where({ patient_id: order.patient_id, is_preferred: true })
        .join('pharmacies', 'patient_pharmacies.pharmacy_id', 'pharmacies.id')
        .first<PharmacyRow>();

      const messageId = uuidv4().replace(/-/g, '').substring(0, 20).toUpperCase();
      const timestamp = new Date().toISOString();

      const newMedCode = changeData.newMedicationCode || order.medication_code;
      const newMedDisplay = changeData.newMedicationDisplay || order.medication_display || '';

      const scriptXml = `<?xml version="1.0" encoding="utf-8"?>
<Message xmlns="http://www.ncpdp.org/schema/SCRIPT" version="2017071" release="016">
  <Header>
    <To Qualifier="P">${pharmacy?.ncpdp_id || 'UNKNOWN'}</To>
    <From Qualifier="D">${prescriber?.npi || 'UNKNOWN'}</From>
    <MessageID>${messageId}</MessageID>
    <SentTime>${timestamp}</SentTime>
    <SenderSoftware>
      <SenderSoftwareDeveloper>Tribal EHR</SenderSoftwareDeveloper>
      <SenderSoftwareProduct>Tribal EHR E-Prescribing</SenderSoftwareProduct>
      <SenderSoftwareVersionRelease>1.0</SenderSoftwareVersionRelease>
    </SenderSoftware>
  </Header>
  <Body>
    <RxChangeRequest>
      <ChangeReasonCode>G</ChangeReasonCode>
      <ChangeReason>${this.escapeXml(changeData.reason)}</ChangeReason>
      <Patient>
        <HumanPatient>
          <Name>
            <LastName>${this.escapeXml(patient.last_name)}</LastName>
            <FirstName>${this.escapeXml(patient.first_name)}</FirstName>
          </Name>
          <Gender>${this.mapGenderToNCPDP(patient.gender)}</Gender>
          <DateOfBirth>
            <Date>${this.formatNCPDPDate(patient.date_of_birth || '')}</Date>
          </DateOfBirth>
        </HumanPatient>
      </Patient>
      <Prescriber>
        <NonVeterinarian>
          <Name>
            <LastName>${this.escapeXml(prescriber?.last_name || '')}</LastName>
            <FirstName>${this.escapeXml(prescriber?.first_name || '')}</FirstName>
          </Name>
          <Identification>
            <NPI>${this.escapeXml(prescriber?.npi || '')}</NPI>
          </Identification>
        </NonVeterinarian>
      </Prescriber>
      <MedicationPrescribed>
        <DrugDescription>${this.escapeXml(order.medication_display || '')}</DrugDescription>
        <DrugCoded>
          <ProductCode>
            <Code>${this.escapeXml(order.medication_code)}</Code>
            <Qualifier>SBD</Qualifier>
          </ProductCode>
        </DrugCoded>
      </MedicationPrescribed>
      <MedicationRequested>
        <DrugDescription>${this.escapeXml(newMedDisplay)}</DrugDescription>
        <DrugCoded>
          <ProductCode>
            <Code>${this.escapeXml(newMedCode)}</Code>
            <Qualifier>SBD</Qualifier>
          </ProductCode>
        </DrugCoded>${changeData.newDosage ? `
        <Sig>
          <SigText>${this.escapeXml(changeData.newDosage)}</SigText>
        </Sig>` : ''}
      </MedicationRequested>
    </RxChangeRequest>
  </Body>
</Message>`;

      const now = new Date().toISOString();
      await this.db('eprescribing_messages').insert({
        id: messageId,
        medication_order_id: medicationOrderId,
        patient_id: order.patient_id,
        message_type: 'RxChangeRequest',
        message_content: scriptXml,
        status: 'generated',
        created_at: now,
        updated_at: now,
      });

      this.logger.info('RxChangeRequest message generated', {
        messageId,
        medicationOrderId,
        reason: changeData.reason,
      });

      return { messageId, scriptXml, status: 'generated' };
    } catch (error) {
      this.handleError('Failed to generate RxChangeRequest message', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Query Medication History (RxHistoryRequest)
  // ---------------------------------------------------------------------------

  async queryMedicationHistory(patientId: string): Promise<{
    medications: Array<Record<string, unknown>>;
    messageId: string;
  }> {
    try {
      // Fetch from local database first
      const medications = await this.db('medication_requests')
        .where({ patient_id: patientId })
        .orderBy('authored_on', 'desc')
        .select(
          'id',
          'medication_code',
          'medication_display',
          'status',
          'intent',
          'authored_on',
          'dosage_instruction',
          'dispense_request',
          'requester_display'
        );

      const formattedMedications = medications.map((med: Record<string, unknown>) => {
        let dosage: DosageInstruction[] = [];
        if (med.dosage_instruction) {
          try {
            dosage = JSON.parse(med.dosage_instruction as string);
          } catch {
            // Not parseable
          }
        }

        return {
          id: med.id,
          medicationCode: med.medication_code,
          medicationName: med.medication_display,
          status: med.status,
          intent: med.intent,
          authoredOn: med.authored_on,
          sig: dosage[0]?.text || this.generateStructuredSig(dosage[0] || {}),
          prescriber: med.requester_display,
          isControlledSubstance: this.isControlledSubstance(med.medication_code as string),
          deaSchedule: this.getSchedule(med.medication_code as string),
        };
      });

      const messageId = uuidv4().replace(/-/g, '').substring(0, 20).toUpperCase();

      this.logger.info('Medication history queried', {
        patientId,
        medicationCount: formattedMedications.length,
      });

      return {
        medications: formattedMedications,
        messageId,
      };
    } catch (error) {
      this.handleError('Failed to query medication history', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Formulary and Benefit Check
  // ---------------------------------------------------------------------------

  async checkFormulary(
    medicationCode: string,
    insuranceId: string
  ): Promise<FormularyResult> {
    try {
      if (!medicationCode || !insuranceId) {
        throw new ValidationError('Medication code and insurance ID are required');
      }

      // Query formulary data
      const formularyEntry = await this.db('formulary_entries')
        .where({
          medication_code: medicationCode,
          insurance_plan_id: insuranceId,
        })
        .first();

      if (!formularyEntry) {
        // Not found in formulary - check for alternatives
        const alternatives = await this.db('formulary_entries')
          .where({ insurance_plan_id: insuranceId })
          .whereRaw(
            "therapeutic_class = (SELECT therapeutic_class FROM formulary_entries WHERE medication_code = ? LIMIT 1)",
            [medicationCode]
          )
          .where('tier', '<=', 2)
          .limit(5)
          .select('medication_code', 'medication_name', 'tier');

        return {
          covered: false,
          tier: 0,
          priorAuthRequired: false,
          alternatives: alternatives.map(
            (alt: { medication_code: string; medication_name: string; tier: number }) => ({
              code: alt.medication_code,
              name: alt.medication_name,
              tier: alt.tier,
            })
          ),
        };
      }

      // Get alternatives if tier is high (3+)
      let alternatives: Array<{ code: string; name: string; tier: number }> = [];
      if (formularyEntry.tier >= 3) {
        const altEntries = await this.db('formulary_entries')
          .where({ insurance_plan_id: insuranceId })
          .where('therapeutic_class', formularyEntry.therapeutic_class)
          .where('tier', '<', formularyEntry.tier)
          .limit(5)
          .select('medication_code', 'medication_name', 'tier');

        alternatives = altEntries.map(
          (alt: { medication_code: string; medication_name: string; tier: number }) => ({
            code: alt.medication_code,
            name: alt.medication_name,
            tier: alt.tier,
          })
        );
      }

      this.logger.info('Formulary check completed', {
        medicationCode,
        insuranceId,
        covered: true,
        tier: formularyEntry.tier,
      });

      return {
        covered: true,
        tier: formularyEntry.tier,
        priorAuthRequired: formularyEntry.prior_auth_required || false,
        alternatives,
        copay: formularyEntry.copay,
      };
    } catch (error) {
      this.handleError('Failed to check formulary', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Electronic Prior Authorization
  // ---------------------------------------------------------------------------

  async submitPriorAuth(
    medicationOrderId: string,
    clinicalInfo: {
      diagnosis?: string;
      previousTherapies?: string[];
      labResults?: string[];
      clinicalRationale?: string;
    }
  ): Promise<PriorAuthResult> {
    try {
      const order = await this.db('medication_requests')
        .where({ id: medicationOrderId })
        .first<MedicationOrderRow>();

      if (!order) {
        throw new NotFoundError('Medication Order', medicationOrderId);
      }

      const patient = await this.db('patients')
        .where({ id: order.patient_id })
        .first<PatientRow>();

      if (!patient) {
        throw new NotFoundError('Patient', order.patient_id);
      }

      // Get patient insurance
      const insurance = await this.db('patient_insurance')
        .where({ patient_id: order.patient_id })
        .where('status', 'active')
        .first();

      const authId = uuidv4();
      const now = new Date().toISOString();

      // Store the prior auth request
      await this.db('prior_authorizations').insert({
        id: authId,
        medication_order_id: medicationOrderId,
        patient_id: order.patient_id,
        medication_code: order.medication_code,
        medication_display: order.medication_display,
        insurance_id: insurance?.id || null,
        insurance_plan: insurance?.plan_name || null,
        diagnosis: clinicalInfo.diagnosis || null,
        previous_therapies: clinicalInfo.previousTherapies
          ? JSON.stringify(clinicalInfo.previousTherapies)
          : null,
        lab_results: clinicalInfo.labResults
          ? JSON.stringify(clinicalInfo.labResults)
          : null,
        clinical_rationale: clinicalInfo.clinicalRationale || null,
        status: 'pending',
        submitted_at: now,
        created_at: now,
        updated_at: now,
      });

      this.logger.info('Prior authorization submitted', {
        authId,
        medicationOrderId,
        medication: order.medication_display,
        patientId: order.patient_id,
      });

      return {
        authId,
        status: 'pending',
        responseMessage: 'Prior authorization request has been submitted and is pending review.',
      };
    } catch (error) {
      this.handleError('Failed to submit prior authorization', error);
    }
  }

  // ---------------------------------------------------------------------------
  // EPCS Verification
  // ---------------------------------------------------------------------------

  async verifyEPCS(
    prescriberId: string,
    medicationOrderId: string,
    mfaToken: string
  ): Promise<EPCSResult> {
    try {
      if (!mfaToken || mfaToken.trim().length === 0) {
        return {
          verified: false,
          deaSchedule: '',
          reason: 'Multi-factor authentication token is required for EPCS',
        };
      }

      // Fetch the medication order
      const order = await this.db('medication_requests')
        .where({ id: medicationOrderId })
        .first<MedicationOrderRow>();

      if (!order) {
        throw new NotFoundError('Medication Order', medicationOrderId);
      }

      // Check if the medication is a controlled substance
      const schedule = this.getSchedule(order.medication_code);
      if (!schedule) {
        return {
          verified: true,
          deaSchedule: 'NONE',
          reason: 'Medication is not a controlled substance; EPCS verification not required.',
        };
      }

      // Verify the prescriber has a valid DEA number
      const prescriber = await this.db('practitioners')
        .where({ id: prescriberId })
        .first<PrescriberRow>();

      if (!prescriber) {
        throw new NotFoundError('Prescriber', prescriberId);
      }

      if (!prescriber.dea_number || prescriber.dea_number.trim().length === 0) {
        // Log the failed EPCS attempt
        await this.logEPCSActivity(prescriberId, medicationOrderId, 'FAILED', 'No DEA number on file');

        return {
          verified: false,
          deaSchedule: schedule,
          reason: 'Prescriber does not have a valid DEA number on file.',
        };
      }

      // Validate DEA number format (2 letters + 7 digits)
      const deaPattern = /^[A-Za-z]{2}\d{7}$/;
      if (!deaPattern.test(prescriber.dea_number)) {
        await this.logEPCSActivity(prescriberId, medicationOrderId, 'FAILED', 'Invalid DEA format');

        return {
          verified: false,
          deaSchedule: schedule,
          reason: 'Prescriber DEA number format is invalid.',
        };
      }

      // Verify MFA token (in a production system this would validate against
      // a TOTP/HOTP token or hardware token; here we validate structure)
      const mfaValid = this.validateMFAToken(mfaToken);
      if (!mfaValid) {
        await this.logEPCSActivity(prescriberId, medicationOrderId, 'FAILED', 'Invalid MFA token');

        return {
          verified: false,
          deaSchedule: schedule,
          reason: 'Multi-factor authentication verification failed.',
        };
      }

      // Log successful EPCS verification
      await this.logEPCSActivity(prescriberId, medicationOrderId, 'SUCCESS', undefined);

      this.logger.info('EPCS verification successful', {
        prescriberId,
        medicationOrderId,
        deaSchedule: schedule,
      });

      return {
        verified: true,
        deaSchedule: schedule,
      };
    } catch (error) {
      this.handleError('Failed to verify EPCS', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Controlled Substance Utilities
  // ---------------------------------------------------------------------------

  isControlledSubstance(rxnormCode: string): boolean {
    return rxnormCode in DEA_SCHEDULES;
  }

  getSchedule(rxnormCode: string): string | null {
    return DEA_SCHEDULES[rxnormCode] || null;
  }

  // ---------------------------------------------------------------------------
  // Structured Sig Generation
  // ---------------------------------------------------------------------------

  generateStructuredSig(dosage: DosageInstruction): string {
    if (!dosage || Object.keys(dosage).length === 0) {
      return '';
    }

    // If there is already a text sig, return it
    if (dosage.text) {
      return dosage.text;
    }

    const parts: string[] = [];

    // Method (e.g., "Take", "Apply", "Inject")
    const method = dosage.method?.coding?.[0]?.display;
    if (method) {
      parts.push(method);
    } else {
      parts.push('Take');
    }

    // Dose quantity (e.g., "1 tablet", "5 mL")
    const doseQty = dosage.doseAndRate?.[0]?.doseQuantity;
    if (doseQty?.value !== undefined) {
      const unit = doseQty.unit || 'tablet';
      const qty = doseQty.value;
      // Pluralize if value > 1
      const unitDisplay = qty > 1 && !unit.endsWith('s') && unit !== 'mL'
        ? `${unit}s`
        : unit;
      parts.push(`${qty} ${unitDisplay}`);
    }

    // Route (e.g., "by mouth", "topically")
    const route = dosage.route?.coding?.[0]?.display;
    if (route) {
      parts.push(`by ${route.toLowerCase()}`);
    } else {
      parts.push('by mouth');
    }

    // Frequency (e.g., "twice daily", "every 8 hours")
    const timing = dosage.timing;
    if (timing?.code?.text) {
      parts.push(timing.code.text);
    } else if (timing?.repeat) {
      const repeat = timing.repeat;
      if (repeat.frequency && repeat.period && repeat.periodUnit) {
        if (repeat.frequency === 1 && repeat.period === 1 && repeat.periodUnit === 'd') {
          parts.push('once daily');
        } else if (repeat.frequency === 2 && repeat.period === 1 && repeat.periodUnit === 'd') {
          parts.push('twice daily');
        } else if (repeat.frequency === 3 && repeat.period === 1 && repeat.periodUnit === 'd') {
          parts.push('three times daily');
        } else if (repeat.frequency === 4 && repeat.period === 1 && repeat.periodUnit === 'd') {
          parts.push('four times daily');
        } else if (repeat.frequency === 1 && repeat.periodUnit === 'h') {
          parts.push(`every ${repeat.period} hours`);
        } else if (repeat.frequency === 1 && repeat.periodUnit === 'wk') {
          parts.push(`every ${repeat.period} week${repeat.period > 1 ? 's' : ''}`);
        } else {
          parts.push(
            `${repeat.frequency} time${repeat.frequency > 1 ? 's' : ''} every ${repeat.period} ${repeat.periodUnit}`
          );
        }
      }

      // Time of day
      if (repeat.when && repeat.when.length > 0) {
        const whenMap: Record<string, string> = {
          MORN: 'in the morning',
          MORN_early: 'in the early morning',
          MORN_late: 'in the late morning',
          AFT: 'in the afternoon',
          EVE: 'in the evening',
          NIGHT: 'at night',
          PHS: 'after sleep',
          HS: 'at bedtime',
          AC: 'before meals',
          ACM: 'before breakfast',
          ACD: 'before lunch',
          ACV: 'before dinner',
          PC: 'after meals',
          PCM: 'after breakfast',
          PCD: 'after lunch',
          PCV: 'after dinner',
          CM: 'with breakfast',
          CD: 'with lunch',
          CV: 'with dinner',
        };
        const whenStr = repeat.when
          .map((w) => whenMap[w] || w)
          .join(' and ');
        parts.push(whenStr);
      }
    }

    // As needed
    if (dosage.asNeededBoolean) {
      parts.push('as needed');
    } else if (dosage.asNeededCodeableConcept?.text) {
      parts.push(`as needed for ${dosage.asNeededCodeableConcept.text}`);
    }

    // Additional instructions (e.g., "with food", "on an empty stomach")
    if (dosage.additionalInstruction && dosage.additionalInstruction.length > 0) {
      const addlInstr = dosage.additionalInstruction
        .map((ai) => ai.text)
        .filter(Boolean)
        .join('; ');
      if (addlInstr) {
        parts.push(addlInstr);
      }
    }

    // Max dose
    if (dosage.maxDosePerPeriod) {
      const maxNum = dosage.maxDosePerPeriod.numerator;
      const maxDen = dosage.maxDosePerPeriod.denominator;
      if (maxNum?.value !== undefined && maxDen?.value !== undefined) {
        parts.push(
          `(max ${maxNum.value} ${maxNum.unit || ''} per ${maxDen.value} ${maxDen.unit || ''})`
        );
      }
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private async logEPCSActivity(
    prescriberId: string,
    medicationOrderId: string,
    result: 'SUCCESS' | 'FAILED',
    reason?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    try {
      await this.db('epcs_audit_log').insert({
        id: uuidv4(),
        prescriber_id: prescriberId,
        medication_order_id: medicationOrderId,
        verification_result: result,
        failure_reason: reason || null,
        timestamp: now,
        created_at: now,
      });
    } catch (err) {
      this.logger.warn('Failed to log EPCS activity', {
        prescriberId,
        medicationOrderId,
        result,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private validateMFAToken(token: string): boolean {
    // In production, this would validate a TOTP/HOTP token.
    // For now, accept tokens that are 6-8 digit numeric strings
    // (standard TOTP length).
    const tokenPattern = /^\d{6,8}$/;
    return tokenPattern.test(token.trim());
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private mapGenderToNCPDP(gender?: string): string {
    if (!gender) return '0'; // Unknown
    switch (gender.toLowerCase()) {
      case 'male':
        return '1';
      case 'female':
        return '2';
      default:
        return '0';
    }
  }

  private formatNCPDPDate(dateStr: string): string {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getDispenseQuantity(dispenseRequest: Record<string, unknown>): string {
    const quantity = dispenseRequest?.quantity as
      | { value?: number }
      | undefined;
    return quantity?.value?.toString() || '30';
  }

  private getDaysSupply(dispenseRequest: Record<string, unknown>): string {
    const expectedSupply = dispenseRequest?.expectedSupplyDuration as
      | { value?: number }
      | undefined;
    return expectedSupply?.value?.toString() || '30';
  }

  private getRefills(dispenseRequest: Record<string, unknown>): string {
    const refills = dispenseRequest?.numberOfRepeatsAllowed;
    return refills !== undefined ? String(refills) : '0';
  }

  private getSubstitutionCode(substitution: Record<string, unknown>): string {
    // 0 = Substitution allowed, 1 = Substitution NOT allowed
    const allowed = substitution?.allowedBoolean;
    if (allowed === false) return '1';
    return '0';
  }

  private buildStructuredSigXml(dosage: DosageInstruction): string {
    if (!dosage || Object.keys(dosage).length === 0) {
      return '<CodeSystem/>';
    }

    const doseQty = dosage.doseAndRate?.[0]?.doseQuantity;
    const route = dosage.route?.coding?.[0];
    const timing = dosage.timing;

    let xml = '<CodeSystem>SNOMED</CodeSystem>\n';

    // Dose
    if (doseQty?.value !== undefined) {
      xml += `          <Dose>
            <DoseValue>${doseQty.value}</DoseValue>
            <DoseUnitOfMeasure>${this.escapeXml(doseQty.unit || 'tablet')}</DoseUnitOfMeasure>
          </Dose>\n`;
    }

    // Route
    if (route?.display) {
      xml += `          <RouteOfAdministration>${this.escapeXml(route.display)}</RouteOfAdministration>\n`;
    }

    // Frequency
    if (timing?.repeat) {
      const repeat = timing.repeat;
      if (repeat.frequency !== undefined && repeat.period !== undefined) {
        xml += `          <Frequency>
            <FrequencyNumericValue>${repeat.frequency}</FrequencyNumericValue>
            <FrequencyUnits>${this.escapeXml(repeat.periodUnit || 'd')}</FrequencyUnits>
          </Frequency>\n`;
      }
    }

    return xml;
  }
}

export const ePrescribingService = new EPrescribingService();
