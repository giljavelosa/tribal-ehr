// =============================================================================
// C-CDA R2.1 Document Generation and Consumption Service
// ONC Certification: 170.315(b)(1) Transitions of Care
//                    170.315(b)(2) Clinical Information Reconciliation
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError } from '../utils/errors';

// -----------------------------------------------------------------------------
// C-CDA OIDs and Template IDs
// -----------------------------------------------------------------------------

const CCDA_OIDS = {
  CCD_DOCUMENT: '2.16.840.1.113883.10.20.22.1.2',
  REFERRAL_NOTE: '2.16.840.1.113883.10.20.22.1.14',
  DISCHARGE_SUMMARY: '2.16.840.1.113883.10.20.22.1.8',
  TRANSFER_SUMMARY: '2.16.840.1.113883.10.20.22.1.13',
  US_REALM_HEADER: '2.16.840.1.113883.10.20.22.1.1',
  ALLERGIES_SECTION: '2.16.840.1.113883.10.20.22.2.6.1',
  MEDICATIONS_SECTION: '2.16.840.1.113883.10.20.22.2.1.1',
  PROBLEM_LIST_SECTION: '2.16.840.1.113883.10.20.22.2.5.1',
  PROCEDURES_SECTION: '2.16.840.1.113883.10.20.22.2.7.1',
  RESULTS_SECTION: '2.16.840.1.113883.10.20.22.2.3.1',
  VITAL_SIGNS_SECTION: '2.16.840.1.113883.10.20.22.2.4.1',
  IMMUNIZATIONS_SECTION: '2.16.840.1.113883.10.20.22.2.2.1',
  PLAN_OF_CARE_SECTION: '2.16.840.1.113883.10.20.22.2.10',
  SOCIAL_HISTORY_SECTION: '2.16.840.1.113883.10.20.22.2.17',
  ENCOUNTERS_SECTION: '2.16.840.1.113883.10.20.22.2.22.1',
  ALLERGY_CONCERN_ACT: '2.16.840.1.113883.10.20.22.4.30',
  ALLERGY_OBSERVATION: '2.16.840.1.113883.10.20.22.4.7',
  MEDICATION_ACTIVITY: '2.16.840.1.113883.10.20.22.4.16',
  PROBLEM_CONCERN_ACT: '2.16.840.1.113883.10.20.22.4.3',
  PROBLEM_OBSERVATION: '2.16.840.1.113883.10.20.22.4.4',
  PROCEDURE_ACTIVITY: '2.16.840.1.113883.10.20.22.4.14',
  RESULT_ORGANIZER: '2.16.840.1.113883.10.20.22.4.1',
  RESULT_OBSERVATION: '2.16.840.1.113883.10.20.22.4.2',
  VITAL_SIGN_ORGANIZER: '2.16.840.1.113883.10.20.22.4.26',
  VITAL_SIGN_OBSERVATION: '2.16.840.1.113883.10.20.22.4.27',
  IMMUNIZATION_ACTIVITY: '2.16.840.1.113883.10.20.22.4.52',
  PLAN_OF_CARE_ACTIVITY: '2.16.840.1.113883.10.20.22.4.39',
  ENCOUNTER_ACTIVITY: '2.16.840.1.113883.10.20.22.4.49',
  SMOKING_STATUS: '2.16.840.1.113883.10.20.22.4.78',
} as const;

const LOINC_SECTION_CODES: Record<string, { code: string; display: string }> = {
  ALLERGIES: { code: '48765-2', display: 'Allergies and adverse reactions Document' },
  MEDICATIONS: { code: '10160-0', display: 'History of Medication use Narrative' },
  PROBLEMS: { code: '11450-4', display: 'Problem list - Reported' },
  PROCEDURES: { code: '47519-4', display: 'History of Procedures Document' },
  RESULTS: { code: '30954-2', display: 'Relevant diagnostic tests/laboratory data Narrative' },
  VITAL_SIGNS: { code: '8716-3', display: 'Vital signs' },
  IMMUNIZATIONS: { code: '11369-6', display: 'History of Immunization Narrative' },
  PLAN_OF_CARE: { code: '18776-5', display: 'Plan of care note' },
  SOCIAL_HISTORY: { code: '29762-2', display: 'Social history Narrative' },
  ENCOUNTERS: { code: '46240-8', display: 'History of encounters' },
};

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ParsedCCDA {
  patient: ParsedPatient;
  allergies: ParsedAllergy[];
  medications: ParsedMedication[];
  problems: ParsedProblem[];
  procedures: ParsedProcedure[];
  results: ParsedResult[];
  vitals: ParsedVital[];
  immunizations: ParsedImmunization[];
  encounters: ParsedEncounter[];
}

export interface ParsedPatient {
  name?: { given?: string; family?: string };
  gender?: string;
  birthDate?: string;
  race?: string;
  ethnicity?: string;
  language?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  phone?: string;
  identifiers?: Array<{ system?: string; value?: string }>;
}

export interface ParsedAllergy {
  code?: string;
  codeSystem?: string;
  displayName?: string;
  status?: string;
  severity?: string;
  reactions?: Array<{ code?: string; displayName?: string }>;
  onsetDate?: string;
}

export interface ParsedMedication {
  code?: string;
  codeSystem?: string;
  displayName?: string;
  status?: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  startDate?: string;
  endDate?: string;
}

export interface ParsedProblem {
  code?: string;
  codeSystem?: string;
  displayName?: string;
  status?: string;
  onsetDate?: string;
  resolvedDate?: string;
}

export interface ParsedProcedure {
  code?: string;
  codeSystem?: string;
  displayName?: string;
  status?: string;
  date?: string;
}

export interface ParsedResult {
  code?: string;
  codeSystem?: string;
  displayName?: string;
  value?: string;
  unit?: string;
  date?: string;
  interpretation?: string;
  referenceRange?: string;
}

export interface ParsedVital {
  code?: string;
  codeSystem?: string;
  displayName?: string;
  value?: string;
  unit?: string;
  date?: string;
}

export interface ParsedImmunization {
  code?: string;
  codeSystem?: string;
  displayName?: string;
  date?: string;
  status?: string;
  lotNumber?: string;
}

export interface ParsedEncounter {
  code?: string;
  codeSystem?: string;
  displayName?: string;
  startDate?: string;
  endDate?: string;
  performer?: string;
}

export interface ReconciliationItem {
  type: 'allergy' | 'medication' | 'problem';
  incoming: Record<string, unknown>;
  existing?: Record<string, unknown>;
  status: 'new' | 'matched' | 'conflict';
  conflictDetails?: string;
}

export interface ReconciliationResult {
  patientId: string;
  newItems: ReconciliationItem[];
  matchedItems: ReconciliationItem[];
  conflictItems: ReconciliationItem[];
  reconciliationDate: string;
}

interface ReferralData {
  referringProvider?: { name: string; npi?: string };
  referredToProvider?: { name: string; npi?: string; specialty?: string };
  reason?: string;
  urgency?: 'routine' | 'urgent' | 'stat';
  clinicalHistory?: string;
  requestedServices?: string;
}

// -----------------------------------------------------------------------------
// Database Row Interfaces
// -----------------------------------------------------------------------------

interface PatientRow {
  id: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  birth_date?: string;
  race_code?: string;
  race_display?: string;
  ethnicity_code?: string;
  ethnicity_display?: string;
  language?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  phone?: string;
  mrn?: string;
  ssn?: string;
  organization_id?: string;
}

interface AllergyRow {
  id: string;
  patient_id: string;
  clinical_status: string;
  code_code?: string;
  code_system?: string;
  code_display?: string;
  criticality?: string;
  onset_datetime?: string;
  reactions?: string;
}

interface MedicationRow {
  id: string;
  patient_id: string;
  status: string;
  medication_code?: string;
  medication_system?: string;
  medication_display?: string;
  dosage_text?: string;
  route_code?: string;
  route_display?: string;
  frequency_text?: string;
  start_date?: string;
  end_date?: string;
  authored_on?: string;
}

interface ConditionRow {
  id: string;
  patient_id: string;
  clinical_status: string;
  code_code?: string;
  code_system?: string;
  code_display?: string;
  onset_datetime?: string;
  abatement_datetime?: string;
}

interface ProcedureRow {
  id: string;
  patient_id: string;
  status: string;
  code_code?: string;
  code_system?: string;
  code_display?: string;
  performed_date_time?: string;
}

interface VitalRow {
  id: string;
  patient_id: string;
  code_code?: string;
  code_system?: string;
  code_display?: string;
  value_quantity?: number;
  value_unit?: string;
  effective_date_time?: string;
  components?: string;
}

interface ResultRow {
  id: string;
  patient_id: string;
  code_code?: string;
  code_system?: string;
  code_display?: string;
  value_quantity?: number;
  value_unit?: string;
  value_string?: string;
  effective_date_time?: string;
  interpretation_code?: string;
  interpretation_display?: string;
  reference_range_text?: string;
}

interface ImmunizationRow {
  id: string;
  patient_id: string;
  status: string;
  vaccine_code?: string;
  vaccine_system?: string;
  vaccine_display?: string;
  occurrence_date_time?: string;
  lot_number?: string;
}

interface CarePlanRow {
  id: string;
  patient_id: string;
  status: string;
  title?: string;
  description?: string;
  activity?: string;
}

interface EncounterRow {
  id: string;
  patient_id: string;
  status: string;
  class_code?: string;
  type_code?: string;
  type_system?: string;
  type_display?: string;
  period_start?: string;
  period_end?: string;
  participant?: string;
}

interface SmokingRow {
  id: string;
  value_code?: string;
  value_system?: string;
  value_display?: string;
  effective_date_time?: string;
}

// -----------------------------------------------------------------------------
// XML Escape Helper
// -----------------------------------------------------------------------------

function xmlEscape(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatCCDADate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  // Convert ISO date (2024-01-15T10:30:00Z) to HL7 format (20240115103000)
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function nowHL7(): string {
  return formatCCDADate(new Date().toISOString());
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class CCDAService extends BaseService {
  constructor() {
    super('CCDAService');
  }

  // ---------------------------------------------------------------------------
  // Generate CCD (Continuity of Care Document)
  // ---------------------------------------------------------------------------

  async generateCCD(patientId: string): Promise<string> {
    try {
      const patient = await this.fetchPatient(patientId);
      const allergies = await this.fetchAllergies(patientId);
      const medications = await this.fetchMedications(patientId);
      const conditions = await this.fetchConditions(patientId);
      const procedures = await this.fetchProcedures(patientId);
      const results = await this.fetchResults(patientId);
      const vitals = await this.fetchVitals(patientId);
      const immunizations = await this.fetchImmunizations(patientId);
      const carePlans = await this.fetchCarePlans(patientId);
      const encounters = await this.fetchEncounters(patientId);
      const smokingStatus = await this.fetchSmokingStatus(patientId);

      const documentId = uuidv4();
      const effectiveTime = nowHL7();

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="CDA.xsl"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:sdtc="urn:hl7-org:sdtc" xsi:schemaLocation="urn:hl7-org:v3 CDA.xsd">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <templateId root="${CCDA_OIDS.US_REALM_HEADER}" extension="2015-08-01"/>
  <templateId root="${CCDA_OIDS.CCD_DOCUMENT}" extension="2015-08-01"/>
  <id root="2.16.840.1.113883.19.5.99999.1" extension="${xmlEscape(documentId)}"/>
  <code code="34133-9" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Summarization of Episode Note"/>
  <title>Continuity of Care Document</title>
  <effectiveTime value="${effectiveTime}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25" codeSystemName="Confidentiality" displayName="normal"/>
  <languageCode code="en-US"/>
${this.buildRecordTarget(patient)}
${this.buildAuthor(effectiveTime)}
${this.buildCustodian()}
  <component>
    <structuredBody>
${this.buildAllergiesSection(allergies)}
${this.buildMedicationsSection(medications)}
${this.buildProblemsSection(conditions)}
${this.buildProceduresSection(procedures)}
${this.buildResultsSection(results)}
${this.buildVitalSignsSection(vitals)}
${this.buildImmunizationsSection(immunizations)}
${this.buildPlanOfCareSection(carePlans)}
${this.buildSocialHistorySection(smokingStatus)}
${this.buildEncountersSection(encounters)}
    </structuredBody>
  </component>
</ClinicalDocument>`;

      this.logger.info('CCD generated', { patientId, documentId });
      return xml;
    } catch (error) {
      this.handleError('Failed to generate CCD', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Generate Referral Note
  // ---------------------------------------------------------------------------

  async generateReferralNote(patientId: string, referralData: ReferralData): Promise<string> {
    try {
      const patient = await this.fetchPatient(patientId);
      const allergies = await this.fetchAllergies(patientId);
      const medications = await this.fetchMedications(patientId);
      const conditions = await this.fetchConditions(patientId);
      const vitals = await this.fetchVitals(patientId);
      const immunizations = await this.fetchImmunizations(patientId);
      const results = await this.fetchResults(patientId);

      const documentId = uuidv4();
      const effectiveTime = nowHL7();

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="CDA.xsl"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:sdtc="urn:hl7-org:sdtc" xsi:schemaLocation="urn:hl7-org:v3 CDA.xsd">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <templateId root="${CCDA_OIDS.US_REALM_HEADER}" extension="2015-08-01"/>
  <templateId root="${CCDA_OIDS.REFERRAL_NOTE}" extension="2015-08-01"/>
  <id root="2.16.840.1.113883.19.5.99999.1" extension="${xmlEscape(documentId)}"/>
  <code code="57133-1" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Referral note"/>
  <title>Referral Note</title>
  <effectiveTime value="${effectiveTime}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25" codeSystemName="Confidentiality" displayName="normal"/>
  <languageCode code="en-US"/>
${this.buildRecordTarget(patient)}
${this.buildAuthor(effectiveTime)}
${this.buildCustodian()}
${referralData.referredToProvider ? this.buildInformationRecipient(referralData.referredToProvider) : ''}
  <component>
    <structuredBody>
      <component>
        <section>
          <templateId root="1.3.6.1.4.1.19376.1.5.3.1.3.1"/>
          <code code="42349-1" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Reason for referral"/>
          <title>Reason for Referral</title>
          <text>
            <paragraph>${xmlEscape(referralData.reason || 'Referral for evaluation and management')}</paragraph>
${referralData.clinicalHistory ? `            <paragraph>Clinical History: ${xmlEscape(referralData.clinicalHistory)}</paragraph>` : ''}
${referralData.requestedServices ? `            <paragraph>Requested Services: ${xmlEscape(referralData.requestedServices)}</paragraph>` : ''}
${referralData.urgency ? `            <paragraph>Urgency: ${xmlEscape(referralData.urgency)}</paragraph>` : ''}
          </text>
        </section>
      </component>
${this.buildAllergiesSection(allergies)}
${this.buildMedicationsSection(medications)}
${this.buildProblemsSection(conditions)}
${this.buildResultsSection(results)}
${this.buildVitalSignsSection(vitals)}
${this.buildImmunizationsSection(immunizations)}
    </structuredBody>
  </component>
</ClinicalDocument>`;

      this.logger.info('Referral note generated', { patientId, documentId });
      return xml;
    } catch (error) {
      this.handleError('Failed to generate referral note', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Generate Discharge Summary
  // ---------------------------------------------------------------------------

  async generateDischargeSummary(patientId: string, encounterId: string): Promise<string> {
    try {
      const patient = await this.fetchPatient(patientId);
      const allergies = await this.fetchAllergies(patientId);
      const medications = await this.fetchMedications(patientId);
      const conditions = await this.fetchConditions(patientId);
      const procedures = await this.fetchProcedures(patientId);
      const vitals = await this.fetchVitals(patientId);
      const results = await this.fetchResults(patientId);

      const encounter = await this.db('encounters').where({ id: encounterId, patient_id: patientId }).first<EncounterRow>();
      if (!encounter) {
        throw new NotFoundError('Encounter', encounterId);
      }

      const documentId = uuidv4();
      const effectiveTime = nowHL7();

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="CDA.xsl"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:sdtc="urn:hl7-org:sdtc" xsi:schemaLocation="urn:hl7-org:v3 CDA.xsd">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <templateId root="${CCDA_OIDS.US_REALM_HEADER}" extension="2015-08-01"/>
  <templateId root="${CCDA_OIDS.DISCHARGE_SUMMARY}" extension="2015-08-01"/>
  <id root="2.16.840.1.113883.19.5.99999.1" extension="${xmlEscape(documentId)}"/>
  <code code="18842-5" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Discharge summary"/>
  <title>Discharge Summary</title>
  <effectiveTime value="${effectiveTime}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25" codeSystemName="Confidentiality" displayName="normal"/>
  <languageCode code="en-US"/>
${this.buildRecordTarget(patient)}
${this.buildAuthor(effectiveTime)}
${this.buildCustodian()}
  <componentOf>
    <encompassingEncounter>
      <id root="2.16.840.1.113883.19" extension="${xmlEscape(encounterId)}"/>
      <effectiveTime>
${encounter.period_start ? `        <low value="${formatCCDADate(encounter.period_start)}"/>` : '        <low nullFlavor="NI"/>'}
${encounter.period_end ? `        <high value="${formatCCDADate(encounter.period_end)}"/>` : '        <high nullFlavor="NI"/>'}
      </effectiveTime>
    </encompassingEncounter>
  </componentOf>
  <component>
    <structuredBody>
${this.buildAllergiesSection(allergies)}
${this.buildMedicationsSection(medications)}
${this.buildProblemsSection(conditions)}
${this.buildProceduresSection(procedures)}
${this.buildResultsSection(results)}
${this.buildVitalSignsSection(vitals)}
      <component>
        <section>
          <templateId root="1.3.6.1.4.1.19376.1.5.3.1.3.33"/>
          <code code="11535-2" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Hospital discharge Dx"/>
          <title>Discharge Diagnosis</title>
          <text>
            <list>
${conditions.filter(c => c.clinical_status === 'active').map(c => `              <item>${xmlEscape(c.code_display || 'Unknown')}</item>`).join('\n')}
            </list>
          </text>
        </section>
      </component>
      <component>
        <section>
          <templateId root="1.3.6.1.4.1.19376.1.5.3.1.3.31"/>
          <code code="8648-8" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Hospital course"/>
          <title>Hospital Course</title>
          <text>
            <paragraph>See clinical notes for detailed hospital course.</paragraph>
          </text>
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>`;

      this.logger.info('Discharge summary generated', { patientId, encounterId, documentId });
      return xml;
    } catch (error) {
      this.handleError('Failed to generate discharge summary', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Generate Transfer Summary
  // ---------------------------------------------------------------------------

  async generateTransferSummary(patientId: string, encounterId: string): Promise<string> {
    try {
      const patient = await this.fetchPatient(patientId);
      const allergies = await this.fetchAllergies(patientId);
      const medications = await this.fetchMedications(patientId);
      const conditions = await this.fetchConditions(patientId);
      const procedures = await this.fetchProcedures(patientId);
      const vitals = await this.fetchVitals(patientId);
      const results = await this.fetchResults(patientId);
      const immunizations = await this.fetchImmunizations(patientId);
      const carePlans = await this.fetchCarePlans(patientId);

      const encounter = await this.db('encounters').where({ id: encounterId, patient_id: patientId }).first<EncounterRow>();
      if (!encounter) {
        throw new NotFoundError('Encounter', encounterId);
      }

      const documentId = uuidv4();
      const effectiveTime = nowHL7();

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="CDA.xsl"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:sdtc="urn:hl7-org:sdtc" xsi:schemaLocation="urn:hl7-org:v3 CDA.xsd">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <templateId root="${CCDA_OIDS.US_REALM_HEADER}" extension="2015-08-01"/>
  <templateId root="${CCDA_OIDS.TRANSFER_SUMMARY}" extension="2015-08-01"/>
  <id root="2.16.840.1.113883.19.5.99999.1" extension="${xmlEscape(documentId)}"/>
  <code code="18761-7" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Provider-unspecified transfer summary"/>
  <title>Transfer Summary</title>
  <effectiveTime value="${effectiveTime}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25" codeSystemName="Confidentiality" displayName="normal"/>
  <languageCode code="en-US"/>
${this.buildRecordTarget(patient)}
${this.buildAuthor(effectiveTime)}
${this.buildCustodian()}
  <componentOf>
    <encompassingEncounter>
      <id root="2.16.840.1.113883.19" extension="${xmlEscape(encounterId)}"/>
      <effectiveTime>
${encounter.period_start ? `        <low value="${formatCCDADate(encounter.period_start)}"/>` : '        <low nullFlavor="NI"/>'}
${encounter.period_end ? `        <high value="${formatCCDADate(encounter.period_end)}"/>` : '        <high nullFlavor="NI"/>'}
      </effectiveTime>
    </encompassingEncounter>
  </componentOf>
  <component>
    <structuredBody>
${this.buildAllergiesSection(allergies)}
${this.buildMedicationsSection(medications)}
${this.buildProblemsSection(conditions)}
${this.buildProceduresSection(procedures)}
${this.buildResultsSection(results)}
${this.buildVitalSignsSection(vitals)}
${this.buildImmunizationsSection(immunizations)}
${this.buildPlanOfCareSection(carePlans)}
    </structuredBody>
  </component>
</ClinicalDocument>`;

      this.logger.info('Transfer summary generated', { patientId, encounterId, documentId });
      return xml;
    } catch (error) {
      this.handleError('Failed to generate transfer summary', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Parse incoming C-CDA
  // ---------------------------------------------------------------------------

  async parseCCDA(xmlString: string): Promise<ParsedCCDA> {
    try {
      if (!xmlString || !xmlString.includes('ClinicalDocument')) {
        throw new ValidationError('Invalid C-CDA document: missing ClinicalDocument root element');
      }

      const parsed: ParsedCCDA = {
        patient: this.parsePatientFromXml(xmlString),
        allergies: this.parseAllergiesFromXml(xmlString),
        medications: this.parseMedicationsFromXml(xmlString),
        problems: this.parseProblemsFromXml(xmlString),
        procedures: this.parseProceduresFromXml(xmlString),
        results: this.parseResultsFromXml(xmlString),
        vitals: this.parseVitalsFromXml(xmlString),
        immunizations: this.parseImmunizationsFromXml(xmlString),
        encounters: this.parseEncountersFromXml(xmlString),
      };

      this.logger.info('C-CDA parsed', {
        allergies: parsed.allergies.length,
        medications: parsed.medications.length,
        problems: parsed.problems.length,
        procedures: parsed.procedures.length,
        results: parsed.results.length,
        vitals: parsed.vitals.length,
        immunizations: parsed.immunizations.length,
        encounters: parsed.encounters.length,
      });

      return parsed;
    } catch (error) {
      this.handleError('Failed to parse C-CDA', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Reconcile imported data against existing patient records
  // ---------------------------------------------------------------------------

  async reconcile(patientId: string, parsed: ParsedCCDA): Promise<ReconciliationResult> {
    try {
      await this.fetchPatient(patientId);

      const result: ReconciliationResult = {
        patientId,
        newItems: [],
        matchedItems: [],
        conflictItems: [],
        reconciliationDate: new Date().toISOString(),
      };

      // Reconcile allergies
      const existingAllergies = await this.fetchAllergies(patientId);
      for (const incoming of parsed.allergies) {
        const match = existingAllergies.find(
          (ea) => ea.code_code && ea.code_code === incoming.code
        );
        if (!match) {
          result.newItems.push({
            type: 'allergy',
            incoming: incoming as unknown as Record<string, unknown>,
            status: 'new',
          });
        } else if (match.clinical_status !== incoming.status) {
          result.conflictItems.push({
            type: 'allergy',
            incoming: incoming as unknown as Record<string, unknown>,
            existing: {
              code: match.code_code,
              displayName: match.code_display,
              status: match.clinical_status,
            },
            status: 'conflict',
            conflictDetails: `Status mismatch: existing='${match.clinical_status}', incoming='${incoming.status}'`,
          });
        } else {
          result.matchedItems.push({
            type: 'allergy',
            incoming: incoming as unknown as Record<string, unknown>,
            existing: {
              code: match.code_code,
              displayName: match.code_display,
              status: match.clinical_status,
            },
            status: 'matched',
          });
        }
      }

      // Reconcile medications
      const existingMedications = await this.fetchMedications(patientId);
      for (const incoming of parsed.medications) {
        const match = existingMedications.find(
          (em) => em.medication_code && em.medication_code === incoming.code
        );
        if (!match) {
          result.newItems.push({
            type: 'medication',
            incoming: incoming as unknown as Record<string, unknown>,
            status: 'new',
          });
        } else if (match.status !== incoming.status) {
          result.conflictItems.push({
            type: 'medication',
            incoming: incoming as unknown as Record<string, unknown>,
            existing: {
              code: match.medication_code,
              displayName: match.medication_display,
              status: match.status,
            },
            status: 'conflict',
            conflictDetails: `Status mismatch: existing='${match.status}', incoming='${incoming.status}'`,
          });
        } else {
          result.matchedItems.push({
            type: 'medication',
            incoming: incoming as unknown as Record<string, unknown>,
            existing: {
              code: match.medication_code,
              displayName: match.medication_display,
              status: match.status,
            },
            status: 'matched',
          });
        }
      }

      // Reconcile problems
      const existingProblems = await this.fetchConditions(patientId);
      for (const incoming of parsed.problems) {
        const match = existingProblems.find(
          (ep) => ep.code_code && ep.code_code === incoming.code
        );
        if (!match) {
          result.newItems.push({
            type: 'problem',
            incoming: incoming as unknown as Record<string, unknown>,
            status: 'new',
          });
        } else if (match.clinical_status !== incoming.status) {
          result.conflictItems.push({
            type: 'problem',
            incoming: incoming as unknown as Record<string, unknown>,
            existing: {
              code: match.code_code,
              displayName: match.code_display,
              status: match.clinical_status,
            },
            status: 'conflict',
            conflictDetails: `Status mismatch: existing='${match.clinical_status}', incoming='${incoming.status}'`,
          });
        } else {
          result.matchedItems.push({
            type: 'problem',
            incoming: incoming as unknown as Record<string, unknown>,
            existing: {
              code: match.code_code,
              displayName: match.code_display,
              status: match.clinical_status,
            },
            status: 'matched',
          });
        }
      }

      this.logger.info('Reconciliation completed', {
        patientId,
        newItems: result.newItems.length,
        matchedItems: result.matchedItems.length,
        conflictItems: result.conflictItems.length,
      });

      return result;
    } catch (error) {
      this.handleError('Failed to reconcile C-CDA data', error);
    }
  }

  // ===========================================================================
  // Data Fetching Methods
  // ===========================================================================

  private async fetchPatient(patientId: string): Promise<PatientRow> {
    const patient = await this.db('patients').where({ id: patientId }).first<PatientRow>();
    if (!patient) {
      throw new NotFoundError('Patient', patientId);
    }
    return patient;
  }

  private async fetchAllergies(patientId: string): Promise<AllergyRow[]> {
    return this.db('allergy_intolerances')
      .where({ patient_id: patientId })
      .orderBy('created_at', 'desc');
  }

  private async fetchMedications(patientId: string): Promise<MedicationRow[]> {
    return this.db('medication_requests')
      .where({ patient_id: patientId })
      .orderBy('authored_on', 'desc');
  }

  private async fetchConditions(patientId: string): Promise<ConditionRow[]> {
    return this.db('conditions')
      .where({ patient_id: patientId })
      .orderBy('recorded_date', 'desc');
  }

  private async fetchProcedures(patientId: string): Promise<ProcedureRow[]> {
    return this.db('procedures')
      .where({ patient_id: patientId })
      .orderBy('performed_date_time', 'desc');
  }

  private async fetchResults(patientId: string): Promise<ResultRow[]> {
    return this.db('observations')
      .where({ patient_id: patientId })
      .where('category_code', 'laboratory')
      .orderBy('effective_date_time', 'desc');
  }

  private async fetchVitals(patientId: string): Promise<VitalRow[]> {
    return this.db('observations')
      .where({ patient_id: patientId })
      .where('category_code', 'vital-signs')
      .orderBy('effective_date_time', 'desc');
  }

  private async fetchImmunizations(patientId: string): Promise<ImmunizationRow[]> {
    return this.db('immunizations')
      .where({ patient_id: patientId })
      .orderBy('occurrence_date_time', 'desc');
  }

  private async fetchCarePlans(patientId: string): Promise<CarePlanRow[]> {
    return this.db('care_plans')
      .where({ patient_id: patientId, status: 'active' })
      .orderBy('created_at', 'desc');
  }

  private async fetchEncounters(patientId: string): Promise<EncounterRow[]> {
    return this.db('encounters')
      .where({ patient_id: patientId })
      .orderBy('period_start', 'desc')
      .limit(50);
  }

  private async fetchSmokingStatus(patientId: string): Promise<SmokingRow | undefined> {
    return this.db('observations')
      .where({ patient_id: patientId, code_code: '72166-2' })
      .orderBy('effective_date_time', 'desc')
      .first<SmokingRow>();
  }

  // ===========================================================================
  // C-CDA Section Builders
  // ===========================================================================

  private buildRecordTarget(patient: PatientRow): string {
    const genderCode = patient.gender === 'male' ? 'M' : patient.gender === 'female' ? 'F' : 'UN';
    return `  <recordTarget>
    <patientRole>
      <id root="2.16.840.1.113883.19.5" extension="${xmlEscape(patient.id)}"/>
${patient.mrn ? `      <id root="2.16.840.1.113883.4.1" extension="${xmlEscape(patient.mrn)}"/>` : ''}
      <addr use="HP">
${patient.street_address ? `        <streetAddressLine>${xmlEscape(patient.street_address)}</streetAddressLine>` : '        <streetAddressLine nullFlavor="NI"/>'}
${patient.city ? `        <city>${xmlEscape(patient.city)}</city>` : '        <city nullFlavor="NI"/>'}
${patient.state ? `        <state>${xmlEscape(patient.state)}</state>` : '        <state nullFlavor="NI"/>'}
${patient.zip_code ? `        <postalCode>${xmlEscape(patient.zip_code)}</postalCode>` : '        <postalCode nullFlavor="NI"/>'}
${patient.country ? `        <country>${xmlEscape(patient.country)}</country>` : '        <country>US</country>'}
      </addr>
${patient.phone ? `      <telecom value="tel:${xmlEscape(patient.phone)}" use="HP"/>` : '      <telecom nullFlavor="NI"/>'}
      <patient>
        <name use="L">
${patient.first_name ? `          <given>${xmlEscape(patient.first_name)}</given>` : '          <given nullFlavor="NI"/>'}
${patient.last_name ? `          <family>${xmlEscape(patient.last_name)}</family>` : '          <family nullFlavor="NI"/>'}
        </name>
        <administrativeGenderCode code="${genderCode}" codeSystem="2.16.840.1.113883.5.1" displayName="${xmlEscape(patient.gender || 'Unknown')}"/>
${patient.birth_date ? `        <birthTime value="${formatCCDADate(patient.birth_date) || xmlEscape(patient.birth_date.replace(/-/g, ''))}"/>` : '        <birthTime nullFlavor="NI"/>'}
${patient.race_code ? `        <raceCode code="${xmlEscape(patient.race_code)}" codeSystem="2.16.840.1.113883.6.238" codeSystemName="Race &amp; Ethnicity - CDC" displayName="${xmlEscape(patient.race_display || '')}"/>` : '        <raceCode nullFlavor="NI"/>'}
${patient.ethnicity_code ? `        <ethnicGroupCode code="${xmlEscape(patient.ethnicity_code)}" codeSystem="2.16.840.1.113883.6.238" codeSystemName="Race &amp; Ethnicity - CDC" displayName="${xmlEscape(patient.ethnicity_display || '')}"/>` : '        <ethnicGroupCode nullFlavor="NI"/>'}
${patient.language ? `        <languageCommunication>
          <languageCode code="${xmlEscape(patient.language)}"/>
          <preferenceInd value="true"/>
        </languageCommunication>` : ''}
      </patient>
    </patientRole>
  </recordTarget>`;
  }

  private buildAuthor(effectiveTime: string): string {
    return `  <author>
    <time value="${effectiveTime}"/>
    <assignedAuthor>
      <id root="2.16.840.1.113883.4.6" extension="000000000"/>
      <addr>
        <streetAddressLine>Tribal Health Facility</streetAddressLine>
        <city>Community</city>
        <state>US</state>
        <postalCode>00000</postalCode>
        <country>US</country>
      </addr>
      <telecom use="WP" value="tel:+1-555-000-0000"/>
      <assignedAuthoringDevice>
        <manufacturerModelName>Tribal EHR System</manufacturerModelName>
        <softwareName>Tribal EHR v1.0</softwareName>
      </assignedAuthoringDevice>
      <representedOrganization>
        <id root="2.16.840.1.113883.19.5"/>
        <name>Tribal Health Organization</name>
        <telecom use="WP" value="tel:+1-555-000-0000"/>
        <addr>
          <streetAddressLine>Tribal Health Facility</streetAddressLine>
          <city>Community</city>
          <state>US</state>
          <postalCode>00000</postalCode>
          <country>US</country>
        </addr>
      </representedOrganization>
    </assignedAuthor>
  </author>`;
  }

  private buildCustodian(): string {
    return `  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id root="2.16.840.1.113883.19.5"/>
        <name>Tribal Health Organization</name>
        <telecom use="WP" value="tel:+1-555-000-0000"/>
        <addr>
          <streetAddressLine>Tribal Health Facility</streetAddressLine>
          <city>Community</city>
          <state>US</state>
          <postalCode>00000</postalCode>
          <country>US</country>
        </addr>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>`;
  }

  private buildInformationRecipient(provider: { name: string; npi?: string; specialty?: string }): string {
    return `  <informationRecipient>
    <intendedRecipient>
${provider.npi ? `      <id root="2.16.840.1.113883.4.6" extension="${xmlEscape(provider.npi)}"/>` : '      <id nullFlavor="NI"/>'}
      <informationRecipient>
        <name>
          <prefix>Dr.</prefix>
          <given>${xmlEscape(provider.name.split(' ')[0] || '')}</given>
          <family>${xmlEscape(provider.name.split(' ').slice(1).join(' ') || provider.name)}</family>
        </name>
      </informationRecipient>
    </intendedRecipient>
  </informationRecipient>`;
  }

  // ---------------------------------------------------------------------------
  // Allergies Section
  // ---------------------------------------------------------------------------

  private buildAllergiesSection(allergies: AllergyRow[]): string {
    const sectionCode = LOINC_SECTION_CODES.ALLERGIES;
    const hasEntries = allergies.length > 0;

    const tableRows = allergies.map((a) =>
      `              <tr>
                <td>${xmlEscape(a.code_display || 'Unknown')}</td>
                <td>${xmlEscape(a.clinical_status)}</td>
                <td>${xmlEscape(a.criticality || 'N/A')}</td>
                <td>${xmlEscape(a.onset_datetime || 'Unknown')}</td>
              </tr>`
    ).join('\n');

    const entries = allergies.map((a) => {
      let reactionsXml = '';
      if (a.reactions) {
        try {
          const reactions = JSON.parse(a.reactions);
          reactionsXml = reactions.map((r: Record<string, unknown>) => {
            const manifestations = (r.manifestation as Array<Record<string, unknown>>) || [];
            return manifestations.map((m: Record<string, unknown>) => {
              const coding = ((m as Record<string, unknown>).coding as Array<Record<string, unknown>>)?.[0] || {};
              return `                <entryRelationship typeCode="MFST" inversionInd="true">
                  <observation classCode="OBS" moodCode="EVN">
                    <templateId root="2.16.840.1.113883.10.20.22.4.9" extension="2014-06-09"/>
                    <id root="${uuidv4()}"/>
                    <code code="ASSERTION" codeSystem="2.16.840.1.113883.5.4"/>
                    <statusCode code="completed"/>
                    <value xsi:type="CD" code="${xmlEscape(coding.code as string || '')}" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT" displayName="${xmlEscape(coding.display as string || '')}"/>
                  </observation>
                </entryRelationship>`;
            }).join('\n');
          }).join('\n');
        } catch {
          // Skip malformed reactions
        }
      }

      return `          <entry typeCode="DRIV">
            <act classCode="ACT" moodCode="EVN">
              <templateId root="${CCDA_OIDS.ALLERGY_CONCERN_ACT}" extension="2015-08-01"/>
              <id root="${uuidv4()}"/>
              <code code="CONC" codeSystem="2.16.840.1.113883.5.6" displayName="Concern"/>
              <statusCode code="${a.clinical_status === 'active' ? 'active' : 'completed'}"/>
              <effectiveTime>
${a.onset_datetime ? `                <low value="${formatCCDADate(a.onset_datetime)}"/>` : '                <low nullFlavor="NI"/>'}
              </effectiveTime>
              <entryRelationship typeCode="SUBJ">
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="${CCDA_OIDS.ALLERGY_OBSERVATION}" extension="2014-06-09"/>
                  <id root="${xmlEscape(a.id)}"/>
                  <code code="ASSERTION" codeSystem="2.16.840.1.113883.5.4"/>
                  <statusCode code="completed"/>
                  <effectiveTime>
${a.onset_datetime ? `                    <low value="${formatCCDADate(a.onset_datetime)}"/>` : '                    <low nullFlavor="NI"/>'}
                  </effectiveTime>
                  <value xsi:type="CD" code="${xmlEscape(a.code_code || '')}" codeSystem="${xmlEscape(a.code_system || '2.16.840.1.113883.6.88')}" codeSystemName="RxNorm" displayName="${xmlEscape(a.code_display || '')}"/>
${reactionsXml}
                </observation>
              </entryRelationship>
            </act>
          </entry>`;
    }).join('\n');

    return `      <component>
        <section>
          <templateId root="${CCDA_OIDS.ALLERGIES_SECTION}" extension="2015-08-01"/>
          <code code="${sectionCode.code}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${xmlEscape(sectionCode.display)}"/>
          <title>Allergies and Adverse Reactions</title>
          <text>
${hasEntries ? `            <table border="1" width="100%">
              <thead>
                <tr>
                  <th>Substance</th>
                  <th>Status</th>
                  <th>Criticality</th>
                  <th>Onset Date</th>
                </tr>
              </thead>
              <tbody>
${tableRows}
              </tbody>
            </table>` : '            <paragraph>No known allergies</paragraph>'}
          </text>
${entries}
        </section>
      </component>`;
  }

  // ---------------------------------------------------------------------------
  // Medications Section
  // ---------------------------------------------------------------------------

  private buildMedicationsSection(medications: MedicationRow[]): string {
    const sectionCode = LOINC_SECTION_CODES.MEDICATIONS;
    const hasEntries = medications.length > 0;

    const tableRows = medications.map((m) =>
      `              <tr>
                <td>${xmlEscape(m.medication_display || 'Unknown')}</td>
                <td>${xmlEscape(m.dosage_text || 'N/A')}</td>
                <td>${xmlEscape(m.route_display || 'N/A')}</td>
                <td>${xmlEscape(m.frequency_text || 'N/A')}</td>
                <td>${xmlEscape(m.status)}</td>
                <td>${xmlEscape(m.start_date || m.authored_on || 'Unknown')}</td>
              </tr>`
    ).join('\n');

    const entries = medications.map((m) =>
      `          <entry typeCode="DRIV">
            <substanceAdministration classCode="SBADM" moodCode="${m.status === 'active' ? 'INT' : 'EVN'}">
              <templateId root="${CCDA_OIDS.MEDICATION_ACTIVITY}" extension="2014-06-09"/>
              <id root="${xmlEscape(m.id)}"/>
              <statusCode code="${m.status === 'active' ? 'active' : 'completed'}"/>
              <effectiveTime xsi:type="IVL_TS">
${m.start_date || m.authored_on ? `                <low value="${formatCCDADate(m.start_date || m.authored_on)}"/>` : '                <low nullFlavor="NI"/>'}
${m.end_date ? `                <high value="${formatCCDADate(m.end_date)}"/>` : '                <high nullFlavor="NI"/>'}
              </effectiveTime>
${m.route_code ? `              <routeCode code="${xmlEscape(m.route_code)}" codeSystem="2.16.840.1.113883.3.26.1.1" codeSystemName="NCI Thesaurus" displayName="${xmlEscape(m.route_display || '')}"/>` : ''}
              <consumable>
                <manufacturedProduct classCode="MANU">
                  <templateId root="2.16.840.1.113883.10.20.22.4.23" extension="2014-06-09"/>
                  <manufacturedMaterial>
                    <code code="${xmlEscape(m.medication_code || '')}" codeSystem="2.16.840.1.113883.6.88" codeSystemName="RxNorm" displayName="${xmlEscape(m.medication_display || '')}"/>
                  </manufacturedMaterial>
                </manufacturedProduct>
              </consumable>
            </substanceAdministration>
          </entry>`
    ).join('\n');

    return `      <component>
        <section>
          <templateId root="${CCDA_OIDS.MEDICATIONS_SECTION}" extension="2014-06-09"/>
          <code code="${sectionCode.code}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${xmlEscape(sectionCode.display)}"/>
          <title>Medications</title>
          <text>
${hasEntries ? `            <table border="1" width="100%">
              <thead>
                <tr>
                  <th>Medication</th>
                  <th>Dosage</th>
                  <th>Route</th>
                  <th>Frequency</th>
                  <th>Status</th>
                  <th>Start Date</th>
                </tr>
              </thead>
              <tbody>
${tableRows}
              </tbody>
            </table>` : '            <paragraph>No current medications</paragraph>'}
          </text>
${entries}
        </section>
      </component>`;
  }

  // ---------------------------------------------------------------------------
  // Problem List Section
  // ---------------------------------------------------------------------------

  private buildProblemsSection(conditions: ConditionRow[]): string {
    const sectionCode = LOINC_SECTION_CODES.PROBLEMS;
    const hasEntries = conditions.length > 0;

    const tableRows = conditions.map((c) =>
      `              <tr>
                <td>${xmlEscape(c.code_display || 'Unknown')}</td>
                <td>${xmlEscape(c.code_code || '')}</td>
                <td>${xmlEscape(c.clinical_status)}</td>
                <td>${xmlEscape(c.onset_datetime || 'Unknown')}</td>
              </tr>`
    ).join('\n');

    const entries = conditions.map((c) =>
      `          <entry typeCode="DRIV">
            <act classCode="ACT" moodCode="EVN">
              <templateId root="${CCDA_OIDS.PROBLEM_CONCERN_ACT}" extension="2015-08-01"/>
              <id root="${uuidv4()}"/>
              <code code="CONC" codeSystem="2.16.840.1.113883.5.6" displayName="Concern"/>
              <statusCode code="${c.clinical_status === 'active' ? 'active' : 'completed'}"/>
              <effectiveTime>
${c.onset_datetime ? `                <low value="${formatCCDADate(c.onset_datetime)}"/>` : '                <low nullFlavor="NI"/>'}
${c.abatement_datetime ? `                <high value="${formatCCDADate(c.abatement_datetime)}"/>` : ''}
              </effectiveTime>
              <entryRelationship typeCode="SUBJ">
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="${CCDA_OIDS.PROBLEM_OBSERVATION}" extension="2015-08-01"/>
                  <id root="${xmlEscape(c.id)}"/>
                  <code code="55607006" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT" displayName="Problem"/>
                  <statusCode code="completed"/>
                  <effectiveTime>
${c.onset_datetime ? `                    <low value="${formatCCDADate(c.onset_datetime)}"/>` : '                    <low nullFlavor="NI"/>'}
${c.abatement_datetime ? `                    <high value="${formatCCDADate(c.abatement_datetime)}"/>` : ''}
                  </effectiveTime>
                  <value xsi:type="CD" code="${xmlEscape(c.code_code || '')}" codeSystem="${xmlEscape(c.code_system || '2.16.840.1.113883.6.96')}" codeSystemName="SNOMED CT" displayName="${xmlEscape(c.code_display || '')}"/>
                </observation>
              </entryRelationship>
            </act>
          </entry>`
    ).join('\n');

    return `      <component>
        <section>
          <templateId root="${CCDA_OIDS.PROBLEM_LIST_SECTION}" extension="2015-08-01"/>
          <code code="${sectionCode.code}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${xmlEscape(sectionCode.display)}"/>
          <title>Problem List</title>
          <text>
${hasEntries ? `            <table border="1" width="100%">
              <thead>
                <tr>
                  <th>Problem</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Onset Date</th>
                </tr>
              </thead>
              <tbody>
${tableRows}
              </tbody>
            </table>` : '            <paragraph>No known problems</paragraph>'}
          </text>
${entries}
        </section>
      </component>`;
  }

  // ---------------------------------------------------------------------------
  // Procedures Section
  // ---------------------------------------------------------------------------

  private buildProceduresSection(procedures: ProcedureRow[]): string {
    const sectionCode = LOINC_SECTION_CODES.PROCEDURES;
    const hasEntries = procedures.length > 0;

    const tableRows = procedures.map((p) =>
      `              <tr>
                <td>${xmlEscape(p.code_display || 'Unknown')}</td>
                <td>${xmlEscape(p.code_code || '')}</td>
                <td>${xmlEscape(p.status)}</td>
                <td>${xmlEscape(p.performed_date_time || 'Unknown')}</td>
              </tr>`
    ).join('\n');

    const entries = procedures.map((p) =>
      `          <entry typeCode="DRIV">
            <procedure classCode="PROC" moodCode="EVN">
              <templateId root="${CCDA_OIDS.PROCEDURE_ACTIVITY}" extension="2014-06-09"/>
              <id root="${xmlEscape(p.id)}"/>
              <code code="${xmlEscape(p.code_code || '')}" codeSystem="${xmlEscape(p.code_system || '2.16.840.1.113883.6.96')}" codeSystemName="SNOMED CT" displayName="${xmlEscape(p.code_display || '')}"/>
              <statusCode code="${p.status === 'completed' ? 'completed' : 'active'}"/>
${p.performed_date_time ? `              <effectiveTime value="${formatCCDADate(p.performed_date_time)}"/>` : '              <effectiveTime nullFlavor="NI"/>'}
            </procedure>
          </entry>`
    ).join('\n');

    return `      <component>
        <section>
          <templateId root="${CCDA_OIDS.PROCEDURES_SECTION}" extension="2014-06-09"/>
          <code code="${sectionCode.code}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${xmlEscape(sectionCode.display)}"/>
          <title>Procedures</title>
          <text>
${hasEntries ? `            <table border="1" width="100%">
              <thead>
                <tr>
                  <th>Procedure</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
${tableRows}
              </tbody>
            </table>` : '            <paragraph>No procedures recorded</paragraph>'}
          </text>
${entries}
        </section>
      </component>`;
  }

  // ---------------------------------------------------------------------------
  // Results Section
  // ---------------------------------------------------------------------------

  private buildResultsSection(results: ResultRow[]): string {
    const sectionCode = LOINC_SECTION_CODES.RESULTS;
    const hasEntries = results.length > 0;

    const tableRows = results.map((r) =>
      `              <tr>
                <td>${xmlEscape(r.code_display || 'Unknown')}</td>
                <td>${r.value_quantity !== undefined && r.value_quantity !== null ? `${r.value_quantity} ${xmlEscape(r.value_unit || '')}` : xmlEscape(r.value_string || 'N/A')}</td>
                <td>${xmlEscape(r.interpretation_display || 'N/A')}</td>
                <td>${xmlEscape(r.reference_range_text || 'N/A')}</td>
                <td>${xmlEscape(r.effective_date_time || 'Unknown')}</td>
              </tr>`
    ).join('\n');

    const entries = results.map((r) =>
      `          <entry typeCode="DRIV">
            <organizer classCode="CLUSTER" moodCode="EVN">
              <templateId root="${CCDA_OIDS.RESULT_ORGANIZER}" extension="2015-08-01"/>
              <id root="${uuidv4()}"/>
              <code code="${xmlEscape(r.code_code || '')}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${xmlEscape(r.code_display || '')}"/>
              <statusCode code="completed"/>
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="${CCDA_OIDS.RESULT_OBSERVATION}" extension="2015-08-01"/>
                  <id root="${xmlEscape(r.id)}"/>
                  <code code="${xmlEscape(r.code_code || '')}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${xmlEscape(r.code_display || '')}"/>
                  <statusCode code="completed"/>
${r.effective_date_time ? `                  <effectiveTime value="${formatCCDADate(r.effective_date_time)}"/>` : '                  <effectiveTime nullFlavor="NI"/>'}
${r.value_quantity !== undefined && r.value_quantity !== null ? `                  <value xsi:type="PQ" value="${r.value_quantity}" unit="${xmlEscape(r.value_unit || '')}"/>` : r.value_string ? `                  <value xsi:type="ST">${xmlEscape(r.value_string)}</value>` : '                  <value xsi:type="PQ" nullFlavor="NI"/>'}
${r.interpretation_code ? `                  <interpretationCode code="${xmlEscape(r.interpretation_code)}" codeSystem="2.16.840.1.113883.5.83" codeSystemName="Observation Interpretation" displayName="${xmlEscape(r.interpretation_display || '')}"/>` : ''}
${r.reference_range_text ? `                  <referenceRange>
                    <observationRange>
                      <text>${xmlEscape(r.reference_range_text)}</text>
                    </observationRange>
                  </referenceRange>` : ''}
                </observation>
              </component>
            </organizer>
          </entry>`
    ).join('\n');

    return `      <component>
        <section>
          <templateId root="${CCDA_OIDS.RESULTS_SECTION}" extension="2015-08-01"/>
          <code code="${sectionCode.code}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${xmlEscape(sectionCode.display)}"/>
          <title>Results</title>
          <text>
${hasEntries ? `            <table border="1" width="100%">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Value</th>
                  <th>Interpretation</th>
                  <th>Reference Range</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
${tableRows}
              </tbody>
            </table>` : '            <paragraph>No results available</paragraph>'}
          </text>
${entries}
        </section>
      </component>`;
  }

  // ---------------------------------------------------------------------------
  // Vital Signs Section
  // ---------------------------------------------------------------------------

  private buildVitalSignsSection(vitals: VitalRow[]): string {
    const sectionCode = LOINC_SECTION_CODES.VITAL_SIGNS;
    const hasEntries = vitals.length > 0;

    const tableRows = vitals.map((v) =>
      `              <tr>
                <td>${xmlEscape(v.code_display || 'Unknown')}</td>
                <td>${v.value_quantity !== undefined && v.value_quantity !== null ? `${v.value_quantity} ${xmlEscape(v.value_unit || '')}` : 'N/A'}</td>
                <td>${xmlEscape(v.effective_date_time || 'Unknown')}</td>
              </tr>`
    ).join('\n');

    const entries = vitals.map((v) =>
      `          <entry typeCode="DRIV">
            <organizer classCode="CLUSTER" moodCode="EVN">
              <templateId root="${CCDA_OIDS.VITAL_SIGN_ORGANIZER}" extension="2015-08-01"/>
              <id root="${uuidv4()}"/>
              <code code="46680005" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT" displayName="Vital signs"/>
              <statusCode code="completed"/>
${v.effective_date_time ? `              <effectiveTime value="${formatCCDADate(v.effective_date_time)}"/>` : '              <effectiveTime nullFlavor="NI"/>'}
              <component>
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="${CCDA_OIDS.VITAL_SIGN_OBSERVATION}" extension="2014-06-09"/>
                  <id root="${xmlEscape(v.id)}"/>
                  <code code="${xmlEscape(v.code_code || '')}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${xmlEscape(v.code_display || '')}"/>
                  <statusCode code="completed"/>
${v.effective_date_time ? `                  <effectiveTime value="${formatCCDADate(v.effective_date_time)}"/>` : '                  <effectiveTime nullFlavor="NI"/>'}
${v.value_quantity !== undefined && v.value_quantity !== null ? `                  <value xsi:type="PQ" value="${v.value_quantity}" unit="${xmlEscape(v.value_unit || '')}"/>` : '                  <value xsi:type="PQ" nullFlavor="NI"/>'}
                </observation>
              </component>
            </organizer>
          </entry>`
    ).join('\n');

    return `      <component>
        <section>
          <templateId root="${CCDA_OIDS.VITAL_SIGNS_SECTION}" extension="2015-08-01"/>
          <code code="${sectionCode.code}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${xmlEscape(sectionCode.display)}"/>
          <title>Vital Signs</title>
          <text>
${hasEntries ? `            <table border="1" width="100%">
              <thead>
                <tr>
                  <th>Vital Sign</th>
                  <th>Value</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
${tableRows}
              </tbody>
            </table>` : '            <paragraph>No vital signs recorded</paragraph>'}
          </text>
${entries}
        </section>
      </component>`;
  }

  // ---------------------------------------------------------------------------
  // Immunizations Section
  // ---------------------------------------------------------------------------

  private buildImmunizationsSection(immunizations: ImmunizationRow[]): string {
    const sectionCode = LOINC_SECTION_CODES.IMMUNIZATIONS;
    const hasEntries = immunizations.length > 0;

    const tableRows = immunizations.map((i) =>
      `              <tr>
                <td>${xmlEscape(i.vaccine_display || 'Unknown')}</td>
                <td>${xmlEscape(i.occurrence_date_time || 'Unknown')}</td>
                <td>${xmlEscape(i.status)}</td>
                <td>${xmlEscape(i.lot_number || 'N/A')}</td>
              </tr>`
    ).join('\n');

    const entries = immunizations.map((i) =>
      `          <entry typeCode="DRIV">
            <substanceAdministration classCode="SBADM" moodCode="EVN" negationInd="${i.status === 'not-done' ? 'true' : 'false'}">
              <templateId root="${CCDA_OIDS.IMMUNIZATION_ACTIVITY}" extension="2015-08-01"/>
              <id root="${xmlEscape(i.id)}"/>
              <statusCode code="completed"/>
${i.occurrence_date_time ? `              <effectiveTime value="${formatCCDADate(i.occurrence_date_time)}"/>` : '              <effectiveTime nullFlavor="NI"/>'}
              <consumable>
                <manufacturedProduct classCode="MANU">
                  <templateId root="2.16.840.1.113883.10.20.22.4.54" extension="2014-06-09"/>
                  <manufacturedMaterial>
                    <code code="${xmlEscape(i.vaccine_code || '')}" codeSystem="2.16.840.1.113883.12.292" codeSystemName="CVX" displayName="${xmlEscape(i.vaccine_display || '')}"/>
${i.lot_number ? `                    <lotNumberText>${xmlEscape(i.lot_number)}</lotNumberText>` : ''}
                  </manufacturedMaterial>
                </manufacturedProduct>
              </consumable>
            </substanceAdministration>
          </entry>`
    ).join('\n');

    return `      <component>
        <section>
          <templateId root="${CCDA_OIDS.IMMUNIZATIONS_SECTION}" extension="2015-08-01"/>
          <code code="${sectionCode.code}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${xmlEscape(sectionCode.display)}"/>
          <title>Immunizations</title>
          <text>
${hasEntries ? `            <table border="1" width="100%">
              <thead>
                <tr>
                  <th>Vaccine</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Lot Number</th>
                </tr>
              </thead>
              <tbody>
${tableRows}
              </tbody>
            </table>` : '            <paragraph>No immunizations recorded</paragraph>'}
          </text>
${entries}
        </section>
      </component>`;
  }

  // ---------------------------------------------------------------------------
  // Plan of Care Section
  // ---------------------------------------------------------------------------

  private buildPlanOfCareSection(carePlans: CarePlanRow[]): string {
    const sectionCode = LOINC_SECTION_CODES.PLAN_OF_CARE;
    const hasEntries = carePlans.length > 0;

    const tableRows = carePlans.map((cp) =>
      `              <tr>
                <td>${xmlEscape(cp.title || 'Untitled Plan')}</td>
                <td>${xmlEscape(cp.status)}</td>
                <td>${xmlEscape(cp.description || 'N/A')}</td>
              </tr>`
    ).join('\n');

    const entries = carePlans.map((cp) => {
      let activitiesXml = '';
      if (cp.activity) {
        try {
          const activities = JSON.parse(cp.activity);
          activitiesXml = (activities as Array<Record<string, unknown>>).map((act: Record<string, unknown>) => {
            const detail = act.detail as Record<string, unknown> | undefined;
            return `              <entryRelationship typeCode="REFR">
                <act classCode="ACT" moodCode="INT">
                  <templateId root="${CCDA_OIDS.PLAN_OF_CARE_ACTIVITY}"/>
                  <id root="${uuidv4()}"/>
                  <code nullFlavor="NI"/>
                  <statusCode code="${detail?.status || 'active'}"/>
                  <text>${xmlEscape(detail?.description as string || '')}</text>
                </act>
              </entryRelationship>`;
          }).join('\n');
        } catch {
          // Skip malformed activity data
        }
      }

      return `          <entry typeCode="DRIV">
            <act classCode="ACT" moodCode="INT">
              <templateId root="${CCDA_OIDS.PLAN_OF_CARE_ACTIVITY}"/>
              <id root="${xmlEscape(cp.id)}"/>
              <code nullFlavor="NI"/>
              <statusCode code="${cp.status === 'active' ? 'active' : 'completed'}"/>
              <text>${xmlEscape(cp.description || cp.title || '')}</text>
${activitiesXml}
            </act>
          </entry>`;
    }).join('\n');

    return `      <component>
        <section>
          <templateId root="${CCDA_OIDS.PLAN_OF_CARE_SECTION}" extension="2014-06-09"/>
          <code code="${sectionCode.code}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${xmlEscape(sectionCode.display)}"/>
          <title>Plan of Care</title>
          <text>
${hasEntries ? `            <table border="1" width="100%">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
${tableRows}
              </tbody>
            </table>` : '            <paragraph>No active care plans</paragraph>'}
          </text>
${entries}
        </section>
      </component>`;
  }

  // ---------------------------------------------------------------------------
  // Social History Section (Smoking Status)
  // ---------------------------------------------------------------------------

  private buildSocialHistorySection(smokingStatus: SmokingRow | undefined): string {
    const sectionCode = LOINC_SECTION_CODES.SOCIAL_HISTORY;

    return `      <component>
        <section>
          <templateId root="${CCDA_OIDS.SOCIAL_HISTORY_SECTION}" extension="2015-08-01"/>
          <code code="${sectionCode.code}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${xmlEscape(sectionCode.display)}"/>
          <title>Social History</title>
          <text>
            <table border="1" width="100%">
              <thead>
                <tr>
                  <th>Social History Element</th>
                  <th>Value</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Smoking Status</td>
                  <td>${smokingStatus ? xmlEscape(smokingStatus.value_display || 'Unknown') : 'Unknown'}</td>
                  <td>${smokingStatus ? xmlEscape(smokingStatus.effective_date_time || 'Unknown') : 'Unknown'}</td>
                </tr>
              </tbody>
            </table>
          </text>
          <entry typeCode="DRIV">
            <observation classCode="OBS" moodCode="EVN">
              <templateId root="${CCDA_OIDS.SMOKING_STATUS}" extension="2014-06-09"/>
              <id root="${smokingStatus ? xmlEscape(smokingStatus.id) : uuidv4()}"/>
              <code code="72166-2" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="Tobacco smoking status"/>
              <statusCode code="completed"/>
${smokingStatus?.effective_date_time ? `              <effectiveTime value="${formatCCDADate(smokingStatus.effective_date_time)}"/>` : '              <effectiveTime nullFlavor="NI"/>'}
${smokingStatus?.value_code ? `              <value xsi:type="CD" code="${xmlEscape(smokingStatus.value_code)}" codeSystem="${xmlEscape(smokingStatus.value_system || '2.16.840.1.113883.6.96')}" codeSystemName="SNOMED CT" displayName="${xmlEscape(smokingStatus.value_display || '')}"/>` : '              <value xsi:type="CD" code="266927001" codeSystem="2.16.840.1.113883.6.96" codeSystemName="SNOMED CT" displayName="Unknown if ever smoked"/>'}
            </observation>
          </entry>
        </section>
      </component>`;
  }

  // ---------------------------------------------------------------------------
  // Encounters Section
  // ---------------------------------------------------------------------------

  private buildEncountersSection(encounters: EncounterRow[]): string {
    const sectionCode = LOINC_SECTION_CODES.ENCOUNTERS;
    const hasEntries = encounters.length > 0;

    const tableRows = encounters.map((e) =>
      `              <tr>
                <td>${xmlEscape(e.type_display || e.class_code || 'Unknown')}</td>
                <td>${xmlEscape(e.period_start || 'Unknown')}</td>
                <td>${xmlEscape(e.period_end || 'Ongoing')}</td>
                <td>${xmlEscape(e.status)}</td>
              </tr>`
    ).join('\n');

    const entries = encounters.map((e) =>
      `          <entry typeCode="DRIV">
            <encounter classCode="ENC" moodCode="EVN">
              <templateId root="${CCDA_OIDS.ENCOUNTER_ACTIVITY}" extension="2015-08-01"/>
              <id root="${xmlEscape(e.id)}"/>
${e.type_code ? `              <code code="${xmlEscape(e.type_code)}" codeSystem="${xmlEscape(e.type_system || '2.16.840.1.113883.6.12')}" codeSystemName="CPT" displayName="${xmlEscape(e.type_display || '')}"/>` : '              <code nullFlavor="NI"/>'}
              <effectiveTime>
${e.period_start ? `                <low value="${formatCCDADate(e.period_start)}"/>` : '                <low nullFlavor="NI"/>'}
${e.period_end ? `                <high value="${formatCCDADate(e.period_end)}"/>` : '                <high nullFlavor="NI"/>'}
              </effectiveTime>
            </encounter>
          </entry>`
    ).join('\n');

    return `      <component>
        <section>
          <templateId root="${CCDA_OIDS.ENCOUNTERS_SECTION}" extension="2015-08-01"/>
          <code code="${sectionCode.code}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${xmlEscape(sectionCode.display)}"/>
          <title>Encounters</title>
          <text>
${hasEntries ? `            <table border="1" width="100%">
              <thead>
                <tr>
                  <th>Encounter Type</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
${tableRows}
              </tbody>
            </table>` : '            <paragraph>No encounters recorded</paragraph>'}
          </text>
${entries}
        </section>
      </component>`;
  }

  // ===========================================================================
  // C-CDA XML Parsing Helpers (regex-based extraction)
  // ===========================================================================

  private parsePatientFromXml(xml: string): ParsedPatient {
    const patient: ParsedPatient = {};

    // Extract patient name
    const recordTarget = this.extractBlock(xml, 'recordTarget');
    if (recordTarget) {
      const nameBlock = this.extractBlock(recordTarget, 'name');
      if (nameBlock) {
        patient.name = {
          given: this.extractTextContent(nameBlock, 'given'),
          family: this.extractTextContent(nameBlock, 'family'),
        };
      }

      // Gender
      const genderMatch = recordTarget.match(/administrativeGenderCode[^>]*code="([^"]*)"/);
      if (genderMatch) {
        const genderMap: Record<string, string> = { M: 'male', F: 'female', UN: 'unknown' };
        patient.gender = genderMap[genderMatch[1]] || genderMatch[1];
      }

      // Birth date
      const birthMatch = recordTarget.match(/birthTime[^>]*value="(\d+)"/);
      if (birthMatch) {
        const v = birthMatch[1];
        if (v.length >= 8) {
          patient.birthDate = `${v.substring(0, 4)}-${v.substring(4, 6)}-${v.substring(6, 8)}`;
        }
      }

      // Race
      const raceMatch = recordTarget.match(/raceCode[^>]*displayName="([^"]*)"/);
      if (raceMatch) {
        patient.race = raceMatch[1];
      }

      // Ethnicity
      const ethnicityMatch = recordTarget.match(/ethnicGroupCode[^>]*displayName="([^"]*)"/);
      if (ethnicityMatch) {
        patient.ethnicity = ethnicityMatch[1];
      }

      // Address
      const addrBlock = this.extractBlock(recordTarget, 'addr');
      if (addrBlock) {
        patient.address = {
          street: this.extractTextContent(addrBlock, 'streetAddressLine'),
          city: this.extractTextContent(addrBlock, 'city'),
          state: this.extractTextContent(addrBlock, 'state'),
          zip: this.extractTextContent(addrBlock, 'postalCode'),
          country: this.extractTextContent(addrBlock, 'country'),
        };
      }

      // Phone
      const phoneMatch = recordTarget.match(/telecom[^>]*value="tel:([^"]*)"/);
      if (phoneMatch) {
        patient.phone = phoneMatch[1];
      }

      // Language
      const langMatch = recordTarget.match(/languageCode[^>]*code="([^"]*)"/);
      if (langMatch) {
        patient.language = langMatch[1];
      }

      // Identifiers
      const idMatches = recordTarget.matchAll(/id[^>]*root="([^"]*)"[^>]*extension="([^"]*)"/g);
      patient.identifiers = [];
      for (const idMatch of idMatches) {
        patient.identifiers.push({ system: idMatch[1], value: idMatch[2] });
      }
    }

    return patient;
  }

  private parseAllergiesFromXml(xml: string): ParsedAllergy[] {
    const allergies: ParsedAllergy[] = [];
    const allergySectionOid = CCDA_OIDS.ALLERGIES_SECTION;
    const sectionBlock = this.extractSectionByTemplateId(xml, allergySectionOid);
    if (!sectionBlock) return allergies;

    const entries = this.extractAllBlocks(sectionBlock, 'entry');
    for (const entry of entries) {
      const observation = this.extractBlock(entry, 'observation');
      if (!observation) continue;

      const allergy: ParsedAllergy = {};

      // Extract value element which contains the allergen
      const valueMatch = observation.match(/value[^>]*code="([^"]*)"[^>]*codeSystem="([^"]*)"[^>]*displayName="([^"]*)"/);
      if (valueMatch) {
        allergy.code = valueMatch[1];
        allergy.codeSystem = valueMatch[2];
        allergy.displayName = valueMatch[3];
      }

      // Status from parent act
      const actStatusMatch = entry.match(/<statusCode[^>]*code="([^"]*)"/);
      if (actStatusMatch) {
        allergy.status = actStatusMatch[1] === 'active' ? 'active' : 'inactive';
      }

      // Onset date
      const lowMatch = observation.match(/<low[^>]*value="(\d+)"/);
      if (lowMatch) {
        allergy.onsetDate = this.hl7DateToISO(lowMatch[1]);
      }

      // Reactions
      const reactionObs = this.extractAllBlocks(entry, 'entryRelationship');
      const reactions: Array<{ code?: string; displayName?: string }> = [];
      for (const rel of reactionObs) {
        if (rel.includes('MFST')) {
          const reactionValue = rel.match(/value[^>]*code="([^"]*)"[^>]*displayName="([^"]*)"/);
          if (reactionValue) {
            reactions.push({ code: reactionValue[1], displayName: reactionValue[2] });
          }
        }
      }
      if (reactions.length > 0) {
        allergy.reactions = reactions;
      }

      if (allergy.code || allergy.displayName) {
        allergies.push(allergy);
      }
    }

    return allergies;
  }

  private parseMedicationsFromXml(xml: string): ParsedMedication[] {
    const medications: ParsedMedication[] = [];
    const sectionBlock = this.extractSectionByTemplateId(xml, CCDA_OIDS.MEDICATIONS_SECTION);
    if (!sectionBlock) return medications;

    const entries = this.extractAllBlocks(sectionBlock, 'entry');
    for (const entry of entries) {
      const med: ParsedMedication = {};

      // Extract medication code from manufacturedMaterial
      const materialBlock = this.extractBlock(entry, 'manufacturedMaterial');
      if (materialBlock) {
        const codeMatch = materialBlock.match(/code[^>]*code="([^"]*)"[^>]*codeSystem="([^"]*)"[^>]*displayName="([^"]*)"/);
        if (codeMatch) {
          med.code = codeMatch[1];
          med.codeSystem = codeMatch[2];
          med.displayName = codeMatch[3];
        }
      }

      // Status
      const statusMatch = entry.match(/<statusCode[^>]*code="([^"]*)"/);
      if (statusMatch) {
        med.status = statusMatch[1];
      }

      // Effective time (date range)
      const lowMatch = entry.match(/<low[^>]*value="(\d+)"/);
      if (lowMatch) {
        med.startDate = this.hl7DateToISO(lowMatch[1]);
      }
      const highMatch = entry.match(/<high[^>]*value="(\d+)"/);
      if (highMatch) {
        med.endDate = this.hl7DateToISO(highMatch[1]);
      }

      // Route
      const routeMatch = entry.match(/routeCode[^>]*displayName="([^"]*)"/);
      if (routeMatch) {
        med.route = routeMatch[1];
      }

      if (med.code || med.displayName) {
        medications.push(med);
      }
    }

    return medications;
  }

  private parseProblemsFromXml(xml: string): ParsedProblem[] {
    const problems: ParsedProblem[] = [];
    const sectionBlock = this.extractSectionByTemplateId(xml, CCDA_OIDS.PROBLEM_LIST_SECTION);
    if (!sectionBlock) return problems;

    const entries = this.extractAllBlocks(sectionBlock, 'entry');
    for (const entry of entries) {
      const observation = this.extractBlock(entry, 'observation');
      if (!observation) continue;

      const problem: ParsedProblem = {};

      const valueMatch = observation.match(/value[^>]*code="([^"]*)"[^>]*codeSystem="([^"]*)"[^>]*displayName="([^"]*)"/);
      if (valueMatch) {
        problem.code = valueMatch[1];
        problem.codeSystem = valueMatch[2];
        problem.displayName = valueMatch[3];
      }

      const statusMatch = entry.match(/<statusCode[^>]*code="([^"]*)"/);
      if (statusMatch) {
        problem.status = statusMatch[1] === 'active' ? 'active' : 'resolved';
      }

      const lowMatch = observation.match(/<low[^>]*value="(\d+)"/);
      if (lowMatch) {
        problem.onsetDate = this.hl7DateToISO(lowMatch[1]);
      }

      const highMatch = observation.match(/<high[^>]*value="(\d+)"/);
      if (highMatch) {
        problem.resolvedDate = this.hl7DateToISO(highMatch[1]);
      }

      if (problem.code || problem.displayName) {
        problems.push(problem);
      }
    }

    return problems;
  }

  private parseProceduresFromXml(xml: string): ParsedProcedure[] {
    const procedures: ParsedProcedure[] = [];
    const sectionBlock = this.extractSectionByTemplateId(xml, CCDA_OIDS.PROCEDURES_SECTION);
    if (!sectionBlock) return procedures;

    const entries = this.extractAllBlocks(sectionBlock, 'entry');
    for (const entry of entries) {
      const proc: ParsedProcedure = {};

      const codeMatch = entry.match(/procedure[^>]*>[\s\S]*?<code[^>]*code="([^"]*)"[^>]*codeSystem="([^"]*)"[^>]*displayName="([^"]*)"/);
      if (!codeMatch) {
        const fallback = entry.match(/code[^>]*code="([^"]*)"[^>]*codeSystem="([^"]*)"[^>]*displayName="([^"]*)"/);
        if (fallback) {
          proc.code = fallback[1];
          proc.codeSystem = fallback[2];
          proc.displayName = fallback[3];
        }
      } else {
        proc.code = codeMatch[1];
        proc.codeSystem = codeMatch[2];
        proc.displayName = codeMatch[3];
      }

      const statusMatch = entry.match(/<statusCode[^>]*code="([^"]*)"/);
      if (statusMatch) {
        proc.status = statusMatch[1];
      }

      const dateMatch = entry.match(/effectiveTime[^>]*value="(\d+)"/);
      if (dateMatch) {
        proc.date = this.hl7DateToISO(dateMatch[1]);
      }

      if (proc.code || proc.displayName) {
        procedures.push(proc);
      }
    }

    return procedures;
  }

  private parseResultsFromXml(xml: string): ParsedResult[] {
    const results: ParsedResult[] = [];
    const sectionBlock = this.extractSectionByTemplateId(xml, CCDA_OIDS.RESULTS_SECTION);
    if (!sectionBlock) return results;

    const entries = this.extractAllBlocks(sectionBlock, 'entry');
    for (const entry of entries) {
      const observations = this.extractAllBlocks(entry, 'observation');
      for (const obs of observations) {
        const result: ParsedResult = {};

        const codeMatch = obs.match(/code[^>]*code="([^"]*)"[^>]*codeSystem="([^"]*)"[^>]*displayName="([^"]*)"/);
        if (codeMatch) {
          result.code = codeMatch[1];
          result.codeSystem = codeMatch[2];
          result.displayName = codeMatch[3];
        }

        const valueMatch = obs.match(/value[^>]*xsi:type="PQ"[^>]*value="([^"]*)"[^>]*unit="([^"]*)"/);
        if (valueMatch) {
          result.value = valueMatch[1];
          result.unit = valueMatch[2];
        }

        const dateMatch = obs.match(/effectiveTime[^>]*value="(\d+)"/);
        if (dateMatch) {
          result.date = this.hl7DateToISO(dateMatch[1]);
        }

        const interpMatch = obs.match(/interpretationCode[^>]*displayName="([^"]*)"/);
        if (interpMatch) {
          result.interpretation = interpMatch[1];
        }

        const refRangeBlock = this.extractBlock(obs, 'referenceRange');
        if (refRangeBlock) {
          const text = this.extractTextContent(refRangeBlock, 'text');
          if (text) result.referenceRange = text;
        }

        if (result.code || result.displayName) {
          results.push(result);
        }
      }
    }

    return results;
  }

  private parseVitalsFromXml(xml: string): ParsedVital[] {
    const vitals: ParsedVital[] = [];
    const sectionBlock = this.extractSectionByTemplateId(xml, CCDA_OIDS.VITAL_SIGNS_SECTION);
    if (!sectionBlock) return vitals;

    const entries = this.extractAllBlocks(sectionBlock, 'entry');
    for (const entry of entries) {
      const observations = this.extractAllBlocks(entry, 'observation');
      for (const obs of observations) {
        const vital: ParsedVital = {};

        const codeMatch = obs.match(/code[^>]*code="([^"]*)"[^>]*codeSystem="([^"]*)"[^>]*displayName="([^"]*)"/);
        if (codeMatch) {
          vital.code = codeMatch[1];
          vital.codeSystem = codeMatch[2];
          vital.displayName = codeMatch[3];
        }

        const valueMatch = obs.match(/value[^>]*xsi:type="PQ"[^>]*value="([^"]*)"[^>]*unit="([^"]*)"/);
        if (valueMatch) {
          vital.value = valueMatch[1];
          vital.unit = valueMatch[2];
        }

        const dateMatch = obs.match(/effectiveTime[^>]*value="(\d+)"/);
        if (dateMatch) {
          vital.date = this.hl7DateToISO(dateMatch[1]);
        }

        if (vital.code || vital.displayName) {
          vitals.push(vital);
        }
      }
    }

    return vitals;
  }

  private parseImmunizationsFromXml(xml: string): ParsedImmunization[] {
    const immunizations: ParsedImmunization[] = [];
    const sectionBlock = this.extractSectionByTemplateId(xml, CCDA_OIDS.IMMUNIZATIONS_SECTION);
    if (!sectionBlock) return immunizations;

    const entries = this.extractAllBlocks(sectionBlock, 'entry');
    for (const entry of entries) {
      const imm: ParsedImmunization = {};

      const materialBlock = this.extractBlock(entry, 'manufacturedMaterial');
      if (materialBlock) {
        const codeMatch = materialBlock.match(/code[^>]*code="([^"]*)"[^>]*codeSystem="([^"]*)"[^>]*displayName="([^"]*)"/);
        if (codeMatch) {
          imm.code = codeMatch[1];
          imm.codeSystem = codeMatch[2];
          imm.displayName = codeMatch[3];
        }

        const lotMatch = materialBlock.match(/<lotNumberText>([^<]*)<\/lotNumberText>/);
        if (lotMatch) {
          imm.lotNumber = lotMatch[1];
        }
      }

      const dateMatch = entry.match(/effectiveTime[^>]*value="(\d+)"/);
      if (dateMatch) {
        imm.date = this.hl7DateToISO(dateMatch[1]);
      }

      const negationMatch = entry.match(/negationInd="(true|false)"/);
      imm.status = negationMatch?.[1] === 'true' ? 'not-done' : 'completed';

      if (imm.code || imm.displayName) {
        immunizations.push(imm);
      }
    }

    return immunizations;
  }

  private parseEncountersFromXml(xml: string): ParsedEncounter[] {
    const encounters: ParsedEncounter[] = [];
    const sectionBlock = this.extractSectionByTemplateId(xml, CCDA_OIDS.ENCOUNTERS_SECTION);
    if (!sectionBlock) return encounters;

    const entries = this.extractAllBlocks(sectionBlock, 'entry');
    for (const entry of entries) {
      const enc: ParsedEncounter = {};

      const codeMatch = entry.match(/encounter[^>]*>[\s\S]*?<code[^>]*code="([^"]*)"[^>]*codeSystem="([^"]*)"[^>]*displayName="([^"]*)"/);
      if (!codeMatch) {
        const fallback = entry.match(/code[^>]*code="([^"]*)"[^>]*codeSystem="([^"]*)"[^>]*displayName="([^"]*)"/);
        if (fallback) {
          enc.code = fallback[1];
          enc.codeSystem = fallback[2];
          enc.displayName = fallback[3];
        }
      } else {
        enc.code = codeMatch[1];
        enc.codeSystem = codeMatch[2];
        enc.displayName = codeMatch[3];
      }

      const lowMatch = entry.match(/<low[^>]*value="(\d+)"/);
      if (lowMatch) {
        enc.startDate = this.hl7DateToISO(lowMatch[1]);
      }

      const highMatch = entry.match(/<high[^>]*value="(\d+)"/);
      if (highMatch) {
        enc.endDate = this.hl7DateToISO(highMatch[1]);
      }

      if (enc.code || enc.displayName) {
        encounters.push(enc);
      }
    }

    return encounters;
  }

  // ===========================================================================
  // XML Extraction Utilities
  // ===========================================================================

  private extractBlock(xml: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[0] : null;
  }

  private extractAllBlocks(xml: string, tagName: string): string[] {
    const blocks: string[] = [];
    const regex = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml)) !== null) {
      blocks.push(match[0]);
    }
    return blocks;
  }

  private extractTextContent(xml: string, tagName: string): string | undefined {
    const regex = new RegExp(`<${tagName}[^>]*>([^<]*)<\\/${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : undefined;
  }

  private extractSectionByTemplateId(xml: string, templateId: string): string | null {
    // Find the section that contains this templateId
    const sections = this.extractAllBlocks(xml, 'section');
    for (const section of sections) {
      if (section.includes(`root="${templateId}"`)) {
        return section;
      }
    }
    // Fallback: search in component blocks
    const components = this.extractAllBlocks(xml, 'component');
    for (const comp of components) {
      if (comp.includes(`root="${templateId}"`)) {
        return comp;
      }
    }
    return null;
  }

  private hl7DateToISO(hl7Date: string): string {
    if (hl7Date.length >= 8) {
      const year = hl7Date.substring(0, 4);
      const month = hl7Date.substring(4, 6);
      const day = hl7Date.substring(6, 8);
      let iso = `${year}-${month}-${day}`;
      if (hl7Date.length >= 14) {
        const hour = hl7Date.substring(8, 10);
        const minute = hl7Date.substring(10, 12);
        const second = hl7Date.substring(12, 14);
        iso += `T${hour}:${minute}:${second}Z`;
      }
      return iso;
    }
    return hl7Date;
  }
}

export const ccdaService = new CCDAService();
