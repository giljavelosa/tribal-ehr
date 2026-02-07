// =============================================================================
// Referral Management Service
// Supports creation, tracking, and closed-loop referral management with
// optional C-CDA attachment for transitions of care
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { BaseService, PaginatedResult, PaginationParams } from './base.service';
import { NotFoundError, ValidationError } from '../utils/errors';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface Referral {
  id: string;
  patientId: string;
  fromProviderId: string;
  fromProviderName?: string;
  toProviderName: string;
  toProviderNPI?: string;
  toFacility?: string;
  specialty: string;
  priority: 'routine' | 'urgent' | 'stat';
  status: string;
  reason: string;
  clinicalNotes?: string;
  ccdaDocumentId?: string;
  consultNote?: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: Array<{
    status: string;
    changedAt: string;
    notes?: string;
  }>;
}

interface ReferralRow {
  id: string;
  patient_id: string;
  from_provider_id: string;
  from_provider_name?: string;
  to_provider_name: string;
  to_provider_npi?: string;
  to_facility?: string;
  specialty: string;
  priority: string;
  status: string;
  reason: string;
  clinical_notes?: string;
  ccda_document_id?: string;
  consult_note?: string;
  status_history?: string; // JSON
  created_at: string;
  updated_at: string;
}

// Valid status transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'cancelled'],
  active: ['accepted', 'declined', 'cancelled'],
  accepted: ['in-progress', 'cancelled'],
  'in-progress': ['completed', 'cancelled'],
  completed: [], // Terminal state
  declined: ['active'], // Can re-send
  cancelled: [], // Terminal state
};

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export class ReferralService extends BaseService {
  constructor() {
    super('ReferralService');
  }

  // ---------------------------------------------------------------------------
  // Create Referral
  // ---------------------------------------------------------------------------

  async createReferral(data: {
    patientId: string;
    fromProviderId: string;
    toProviderName: string;
    toProviderNPI?: string;
    toFacility?: string;
    specialty: string;
    priority: 'routine' | 'urgent' | 'stat';
    reason: string;
    clinicalNotes?: string;
    includeCCDA: boolean;
  }): Promise<Referral> {
    try {
      // Validate required fields
      if (!data.patientId) {
        throw new ValidationError('Patient ID is required');
      }
      if (!data.fromProviderId) {
        throw new ValidationError('From provider ID is required');
      }
      if (!data.toProviderName) {
        throw new ValidationError('To provider name is required');
      }
      if (!data.specialty) {
        throw new ValidationError('Specialty is required');
      }
      if (!data.reason) {
        throw new ValidationError('Referral reason is required');
      }
      if (!['routine', 'urgent', 'stat'].includes(data.priority)) {
        throw new ValidationError('Priority must be routine, urgent, or stat');
      }

      // Verify patient exists
      await this.requireExists('patients', data.patientId, 'Patient');

      // Fetch the referring provider's name
      let fromProviderName = '';
      try {
        const provider = await this.db('practitioners')
          .where({ id: data.fromProviderId })
          .first<{ first_name: string; last_name: string }>();
        if (provider) {
          fromProviderName = `${provider.last_name}, ${provider.first_name}`;
        }
      } catch {
        // Provider table might not have this record
      }

      // Generate C-CDA if requested
      let ccdaDocumentId: string | undefined;
      if (data.includeCCDA) {
        try {
          // Use the C-CDA service to generate a referral note
          const ccdaResult = await this.generateReferralCCDA(
            data.patientId,
            data.fromProviderId,
            data.toProviderName,
            data.reason,
            data.clinicalNotes
          );
          ccdaDocumentId = ccdaResult.id;
        } catch (err) {
          this.logger.warn('Failed to generate C-CDA for referral, proceeding without it', {
            patientId: data.patientId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      const initialHistory = [
        {
          status: 'active',
          changedAt: now,
          notes: 'Referral created',
        },
      ];

      const row: ReferralRow = {
        id,
        patient_id: data.patientId,
        from_provider_id: data.fromProviderId,
        from_provider_name: fromProviderName,
        to_provider_name: data.toProviderName,
        to_provider_npi: data.toProviderNPI,
        to_facility: data.toFacility,
        specialty: data.specialty,
        priority: data.priority,
        status: 'active',
        reason: data.reason,
        clinical_notes: data.clinicalNotes,
        ccda_document_id: ccdaDocumentId,
        status_history: JSON.stringify(initialHistory),
        created_at: now,
        updated_at: now,
      };

      await this.db('referrals').insert(row);

      this.logger.info('Referral created', {
        referralId: id,
        patientId: data.patientId,
        specialty: data.specialty,
        priority: data.priority,
        hasCCDA: !!ccdaDocumentId,
      });

      return this.rowToReferral(row);
    } catch (error) {
      this.handleError('Failed to create referral', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Update Referral Status
  // ---------------------------------------------------------------------------

  async updateStatus(
    referralId: string,
    status: string,
    notes?: string
  ): Promise<Referral> {
    try {
      const existing = await this.db('referrals')
        .where({ id: referralId })
        .first<ReferralRow>();

      if (!existing) {
        throw new NotFoundError('Referral', referralId);
      }

      // Validate status transition
      const allowedTransitions = VALID_STATUS_TRANSITIONS[existing.status] || [];
      if (!allowedTransitions.includes(status)) {
        throw new ValidationError(
          `Invalid status transition from '${existing.status}' to '${status}'. ` +
            `Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`
        );
      }

      const now = new Date().toISOString();

      // Update status history
      let statusHistory: Array<{ status: string; changedAt: string; notes?: string }> = [];
      if (existing.status_history) {
        try {
          statusHistory = JSON.parse(existing.status_history);
        } catch {
          statusHistory = [];
        }
      }

      statusHistory.push({
        status,
        changedAt: now,
        notes,
      });

      await this.db('referrals')
        .where({ id: referralId })
        .update({
          status,
          status_history: JSON.stringify(statusHistory),
          updated_at: now,
        });

      this.logger.info('Referral status updated', {
        referralId,
        previousStatus: existing.status,
        newStatus: status,
      });

      const updated = await this.db('referrals')
        .where({ id: referralId })
        .first<ReferralRow>();

      return this.rowToReferral(updated!);
    } catch (error) {
      this.handleError('Failed to update referral status', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Patient Referrals
  // ---------------------------------------------------------------------------

  async getPatientReferrals(patientId: string): Promise<Referral[]> {
    try {
      await this.requireExists('patients', patientId, 'Patient');

      const rows = await this.db('referrals')
        .where({ patient_id: patientId })
        .orderBy('created_at', 'desc')
        .select<ReferralRow[]>('*');

      return rows.map((row) => this.rowToReferral(row));
    } catch (error) {
      this.handleError('Failed to get patient referrals', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Provider Referrals
  // ---------------------------------------------------------------------------

  async getProviderReferrals(
    providerId: string,
    direction: 'sent' | 'received'
  ): Promise<Referral[]> {
    try {
      let query = this.db('referrals').orderBy('created_at', 'desc');

      if (direction === 'sent') {
        query = query.where({ from_provider_id: providerId });
      } else {
        // For received, match on NPI or provider name
        const provider = await this.db('practitioners')
          .where({ id: providerId })
          .first<{ first_name: string; last_name: string; npi?: string }>();

        if (!provider) {
          throw new NotFoundError('Practitioner', providerId);
        }

        query = query.where(function (this: Knex.QueryBuilder) {
          if (provider.npi) {
            this.where('to_provider_npi', provider.npi);
          }
          this.orWhereRaw("LOWER(to_provider_name) LIKE ?", [
            `%${provider.last_name.toLowerCase()}%`,
          ]);
        });
      }

      const rows = await query.select<ReferralRow[]>('*');
      return rows.map((row) => this.rowToReferral(row));
    } catch (error) {
      this.handleError('Failed to get provider referrals', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Close Referral Loop
  // ---------------------------------------------------------------------------

  async closeReferral(
    referralId: string,
    consultNote?: string
  ): Promise<Referral> {
    try {
      const existing = await this.db('referrals')
        .where({ id: referralId })
        .first<ReferralRow>();

      if (!existing) {
        throw new NotFoundError('Referral', referralId);
      }

      // Allow closing from accepted or in-progress status
      const closableStatuses = ['accepted', 'in-progress'];
      if (!closableStatuses.includes(existing.status)) {
        throw new ValidationError(
          `Referral cannot be closed from status '${existing.status}'. ` +
            `Must be in: ${closableStatuses.join(', ')}`
        );
      }

      const now = new Date().toISOString();

      // Update status history
      let statusHistory: Array<{ status: string; changedAt: string; notes?: string }> = [];
      if (existing.status_history) {
        try {
          statusHistory = JSON.parse(existing.status_history);
        } catch {
          statusHistory = [];
        }
      }

      statusHistory.push({
        status: 'completed',
        changedAt: now,
        notes: consultNote ? 'Referral closed with consultation note' : 'Referral closed',
      });

      await this.db('referrals')
        .where({ id: referralId })
        .update({
          status: 'completed',
          consult_note: consultNote || null,
          status_history: JSON.stringify(statusHistory),
          updated_at: now,
        });

      this.logger.info('Referral closed', {
        referralId,
        hasConsultNote: !!consultNote,
      });

      const updated = await this.db('referrals')
        .where({ id: referralId })
        .first<ReferralRow>();

      return this.rowToReferral(updated!);
    } catch (error) {
      this.handleError('Failed to close referral', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Get Referral by ID
  // ---------------------------------------------------------------------------

  async getById(referralId: string): Promise<Referral> {
    try {
      const row = await this.db('referrals')
        .where({ id: referralId })
        .first<ReferralRow>();

      if (!row) {
        throw new NotFoundError('Referral', referralId);
      }

      return this.rowToReferral(row);
    } catch (error) {
      this.handleError('Failed to get referral', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private rowToReferral(row: ReferralRow): Referral {
    let statusHistory: Array<{ status: string; changedAt: string; notes?: string }> = [];
    if (row.status_history) {
      try {
        statusHistory = JSON.parse(row.status_history);
      } catch {
        statusHistory = [];
      }
    }

    return {
      id: row.id,
      patientId: row.patient_id,
      fromProviderId: row.from_provider_id,
      fromProviderName: row.from_provider_name,
      toProviderName: row.to_provider_name,
      toProviderNPI: row.to_provider_npi,
      toFacility: row.to_facility,
      specialty: row.specialty,
      priority: row.priority as 'routine' | 'urgent' | 'stat',
      status: row.status,
      reason: row.reason,
      clinicalNotes: row.clinical_notes,
      ccdaDocumentId: row.ccda_document_id,
      consultNote: row.consult_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      statusHistory,
    };
  }

  private async generateReferralCCDA(
    patientId: string,
    fromProviderId: string,
    toProviderName: string,
    reason: string,
    clinicalNotes?: string
  ): Promise<{ id: string }> {
    // Fetch patient data for the C-CDA
    const patient = await this.db('patients')
      .where({ id: patientId })
      .first();

    if (!patient) {
      throw new NotFoundError('Patient', patientId);
    }

    // Fetch active conditions
    const conditions = await this.db('conditions')
      .where({ patient_id: patientId })
      .whereIn('clinical_status', ['active', 'recurrence', 'relapse'])
      .select('*');

    // Fetch active medications
    const medications = await this.db('medication_requests')
      .where({ patient_id: patientId })
      .whereIn('status', ['active'])
      .select('*');

    // Fetch allergies
    const allergies = await this.db('allergy_intolerances')
      .where({ patient_id: patientId })
      .select('*');

    // Fetch recent observations
    const observations = await this.db('observations')
      .where({ patient_id: patientId })
      .orderBy('effective_date_time', 'desc')
      .limit(20)
      .select('*');

    // Fetch provider info
    let providerName = '';
    try {
      const provider = await this.db('practitioners')
        .where({ id: fromProviderId })
        .first<{ first_name: string; last_name: string }>();
      if (provider) {
        providerName = `${provider.first_name} ${provider.last_name}`;
      }
    } catch {
      // Provider not found
    }

    const now = new Date().toISOString();
    const documentId = uuidv4();

    // Generate a referral note C-CDA document
    const ccda = this.buildReferralCCDA(
      documentId,
      patient,
      providerName,
      toProviderName,
      reason,
      clinicalNotes || '',
      conditions,
      medications,
      allergies,
      observations,
      now
    );

    // Store the document
    await this.db('documents').insert({
      id: documentId,
      patient_id: patientId,
      type: 'referral-note',
      format: 'application/xml',
      title: `Referral Note - ${toProviderName}`,
      content: ccda,
      author_id: fromProviderId,
      status: 'final',
      created_at: now,
      updated_at: now,
    });

    return { id: documentId };
  }

  private buildReferralCCDA(
    documentId: string,
    patient: Record<string, unknown>,
    fromProviderName: string,
    toProviderName: string,
    reason: string,
    clinicalNotes: string,
    conditions: Array<Record<string, unknown>>,
    medications: Array<Record<string, unknown>>,
    allergies: Array<Record<string, unknown>>,
    observations: Array<Record<string, unknown>>,
    timestamp: string
  ): string {
    const escXml = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const formatCDADate = (dateStr: string) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
    };

    const conditionEntries = conditions
      .map(
        (c) => `
          <entry>
            <act classCode="ACT" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.3"/>
              <id root="${uuidv4()}"/>
              <code code="CONC" codeSystem="2.16.840.1.113883.5.6"/>
              <statusCode code="active"/>
              <entryRelationship typeCode="SUBJ">
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.22.4.4"/>
                  <id root="${c.id}"/>
                  <code code="64572001" codeSystem="2.16.840.1.113883.6.96" displayName="Condition"/>
                  <statusCode code="completed"/>
                  <value xsi:type="CD" code="${escXml(String(c.code_code || ''))}"
                    codeSystem="2.16.840.1.113883.6.90"
                    displayName="${escXml(String(c.code_display || ''))}"/>
                </observation>
              </entryRelationship>
            </act>
          </entry>`
      )
      .join('\n');

    const medicationEntries = medications
      .map(
        (m) => `
          <entry>
            <substanceAdministration classCode="SBADM" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.16"/>
              <id root="${m.id}"/>
              <statusCode code="active"/>
              <consumable>
                <manufacturedProduct classCode="MANU">
                  <templateId root="2.16.840.1.113883.10.20.22.4.23"/>
                  <manufacturedMaterial>
                    <code code="${escXml(String(m.medication_code || ''))}"
                      codeSystem="2.16.840.1.113883.6.88"
                      displayName="${escXml(String(m.medication_display || ''))}"/>
                  </manufacturedMaterial>
                </manufacturedProduct>
              </consumable>
            </substanceAdministration>
          </entry>`
      )
      .join('\n');

    const allergyEntries = allergies
      .map(
        (a) => `
          <entry>
            <act classCode="ACT" moodCode="EVN">
              <templateId root="2.16.840.1.113883.10.20.22.4.30"/>
              <id root="${a.id}"/>
              <code code="CONC" codeSystem="2.16.840.1.113883.5.6"/>
              <statusCode code="active"/>
              <entryRelationship typeCode="SUBJ">
                <observation classCode="OBS" moodCode="EVN">
                  <templateId root="2.16.840.1.113883.10.20.22.4.7"/>
                  <id root="${uuidv4()}"/>
                  <code code="ASSERTION" codeSystem="2.16.840.1.113883.5.4"/>
                  <statusCode code="completed"/>
                  <value xsi:type="CD" code="${escXml(String(a.code_code || ''))}"
                    codeSystem="2.16.840.1.113883.6.88"
                    displayName="${escXml(String(a.code_display || ''))}"/>
                </observation>
              </entryRelationship>
            </act>
          </entry>`
      )
      .join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:sdtc="urn:hl7-org:sdtc">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <!-- Referral Note -->
  <templateId root="2.16.840.1.113883.10.20.22.1.14" extension="2015-08-01"/>
  <!-- US Realm Header -->
  <templateId root="2.16.840.1.113883.10.20.22.1.1" extension="2015-08-01"/>
  <id root="${documentId}"/>
  <code code="57133-1" codeSystem="2.16.840.1.113883.6.1" displayName="Referral note"/>
  <title>Referral Note</title>
  <effectiveTime value="${formatCDADate(timestamp)}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="en-US"/>
  <recordTarget>
    <patientRole>
      <id extension="${escXml(String(patient.mrn || patient.id))}" root="2.16.840.1.113883.19.5"/>
      <patient>
        <name>
          <given>${escXml(String(patient.first_name || ''))}</given>
          <family>${escXml(String(patient.last_name || ''))}</family>
        </name>
        <administrativeGenderCode code="${patient.gender === 'male' ? 'M' : patient.gender === 'female' ? 'F' : 'UN'}"
          codeSystem="2.16.840.1.113883.5.1"/>
        <birthTime value="${formatCDADate(String(patient.date_of_birth || ''))}"/>
      </patient>
    </patientRole>
  </recordTarget>
  <author>
    <time value="${formatCDADate(timestamp)}"/>
    <assignedAuthor>
      <id root="2.16.840.1.113883.19.5"/>
      <assignedPerson>
        <name>${escXml(fromProviderName)}</name>
      </assignedPerson>
    </assignedAuthor>
  </author>
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id root="2.16.840.1.113883.19.5"/>
        <name>Tribal Health Facility</name>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>
  <informationRecipient>
    <intendedRecipient>
      <informationRecipient>
        <name>${escXml(toProviderName)}</name>
      </informationRecipient>
    </intendedRecipient>
  </informationRecipient>
  <component>
    <structuredBody>
      <!-- Reason for Referral -->
      <component>
        <section>
          <templateId root="1.3.6.1.4.1.19376.1.5.3.1.3.1"/>
          <code code="42349-1" codeSystem="2.16.840.1.113883.6.1" displayName="Reason for referral"/>
          <title>Reason for Referral</title>
          <text>
            <paragraph>${escXml(reason)}</paragraph>
            ${clinicalNotes ? `<paragraph>${escXml(clinicalNotes)}</paragraph>` : ''}
          </text>
        </section>
      </component>
      <!-- Problem List -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.5.1"/>
          <code code="11450-4" codeSystem="2.16.840.1.113883.6.1" displayName="Problem list"/>
          <title>Problem List</title>
          <text>
            <list>
              ${conditions.map((c) => `<item>${escXml(String(c.code_display || c.code_code || 'Unknown'))}</item>`).join('\n              ')}
            </list>
          </text>
          ${conditionEntries}
        </section>
      </component>
      <!-- Medications -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.1.1"/>
          <code code="10160-0" codeSystem="2.16.840.1.113883.6.1" displayName="Medications"/>
          <title>Medications</title>
          <text>
            <list>
              ${medications.map((m) => `<item>${escXml(String(m.medication_display || m.medication_code || 'Unknown'))}</item>`).join('\n              ')}
            </list>
          </text>
          ${medicationEntries}
        </section>
      </component>
      <!-- Allergies -->
      <component>
        <section>
          <templateId root="2.16.840.1.113883.10.20.22.2.6.1"/>
          <code code="48765-2" codeSystem="2.16.840.1.113883.6.1" displayName="Allergies"/>
          <title>Allergies and Adverse Reactions</title>
          <text>
            <list>
              ${allergies.map((a) => `<item>${escXml(String(a.code_display || a.code_code || 'Unknown'))}</item>`).join('\n              ')}
            </list>
          </text>
          ${allergyEntries}
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>`;
  }
}

export const referralService = new ReferralService();
