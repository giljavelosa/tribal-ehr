import { Knex } from 'knex';
import crypto from 'crypto';
import { SeededRNG, batchInsert } from '../utils';
import { SEED_CONFIG } from '../config';
import { GeneratedPatients } from './patients';
import { GeneratedUsers } from './users';

// ---------------------------------------------------------------------------
// Message subject templates
// ---------------------------------------------------------------------------

const MESSAGE_SUBJECTS_PATIENT = [
  'Lab Results for {{patient}}',
  'Medication Question - {{patient}}',
  'Referral Request - {{patient}}',
  'Follow-up Required - {{patient}}',
  'Abnormal Lab Results - {{patient}}',
  'Imaging Results - {{patient}}',
  'Prescription Renewal - {{patient}}',
  'Discharge Summary Review - {{patient}}',
  'Care Plan Update - {{patient}}',
  'Critical Lab Value - {{patient}}',
];

const MESSAGE_SUBJECTS_ADMIN = [
  'Schedule Change Request',
  'Staff Meeting Reminder',
  'Policy Update - Clinical Documentation',
  'Holiday Coverage Schedule',
  'Training Session: New EHR Features',
  'Compliance Reminder: Annual HIPAA Training',
  'Equipment Maintenance Notice',
  'Department Budget Review',
  'Quality Improvement Initiative',
  'IT System Maintenance Window',
];

const MESSAGE_BODIES_PATIENT = [
  'Lab results are available for review. Please see attached. Normal values noted except as flagged. Please follow up with the patient at their next scheduled appointment.',
  'Patient inquired about medication side effects. Current medications reviewed. No changes recommended at this time. Continue monitoring.',
  'Requesting referral to {{specialty}} for further evaluation. Patient has been experiencing persistent symptoms despite current treatment regimen.',
  'Patient needs follow-up visit within 2 weeks to reassess condition. Please schedule at earliest availability.',
  'Flagging abnormal lab result requiring attention. Please review and determine if medication adjustment is needed.',
  'Imaging results reviewed. Findings are consistent with clinical presentation. Recommend follow-up imaging in 6 months.',
  'Patient requesting prescription renewal for current medications. Last office visit was within 12 months. Approved for 90-day supply.',
  'Discharge summary has been finalized. Please review and co-sign. Follow-up visit scheduled for 2 weeks post-discharge.',
  'Care plan has been updated based on recent visit findings. New goals added for the next quarter.',
  'Critical lab value reported. Patient has been notified. Please review and document clinical response.',
];

const MESSAGE_BODIES_ADMIN = [
  'Due to the upcoming holiday, we need to finalize the on-call schedule. Please respond with your availability.',
  'Reminder: Monthly staff meeting scheduled for next Tuesday at 12:00 PM in Conference Room A.',
  'Please review the updated documentation policy effective next month. All clinical notes must include structured data elements.',
  'The holiday coverage schedule has been posted. Please review your assigned dates and confirm by end of week.',
  'New EHR training sessions are available. Please sign up for one of the available time slots this month.',
  'Annual HIPAA training is due. Please complete the online module by the end of this month.',
  'The medical equipment in Exam Room 3 is scheduled for maintenance this Thursday. Room will be unavailable 8am-12pm.',
  'Quarterly budget review meeting scheduled. Please bring updated department expense reports.',
  'New quality improvement measures are being implemented. Please review the attached guidelines.',
  'Planned system maintenance this Saturday 2am-6am. EHR will be in read-only mode.',
];

const SPECIALTIES = [
  'Cardiology', 'Endocrinology', 'Orthopedics', 'Psychiatry',
  'Pulmonology', 'Nephrology', 'Neurology', 'Gastroenterology',
];

export async function seedConsentsAndMessages(
  trx: Knex.Transaction,
  patients: GeneratedPatients,
  users: GeneratedUsers,
  rng: SeededRNG,
): Promise<void> {
  const now = new Date().toISOString();
  const dateStart = new Date(SEED_CONFIG.DATE_RANGE_START);
  const dateEnd = new Date(SEED_CONFIG.DATE_RANGE_END);

  // ----- CONSENTS -----
  const consentRows: Record<string, unknown>[] = [];

  for (const patient of patients.patients) {
    // Every patient gets a treatment consent
    const consentDate = rng.randomDate(dateStart, dateEnd);

    consentRows.push({
      id: crypto.randomUUID(),
      patient_id: patient.id,
      fhir_id: null,
      status: 'active',
      scope: 'treatment',
      category: 'medical-consent',
      date_time: consentDate.toISOString(),
      policy_rule: 'http://terminology.hl7.org/CodeSystem/v3-ActCode|OPTIN',
      provision: JSON.stringify({
        type: 'permit',
        period: {
          start: consentDate.toISOString(),
        },
        purpose: [
          { code: 'TREAT', display: 'Treatment' },
          { code: 'HPAYMT', display: 'Healthcare Payment' },
          { code: 'HOPERAT', display: 'Healthcare Operations' },
        ],
      }),
      source_attachment: null,
      created_at: now,
      updated_at: now,
    });

    // ~15% of patients have additional research consent
    if (rng.chance(0.15)) {
      const researchConsentDate = rng.randomDate(consentDate, dateEnd);
      consentRows.push({
        id: crypto.randomUUID(),
        patient_id: patient.id,
        fhir_id: null,
        status: rng.chance(0.8) ? 'active' : 'inactive',
        scope: 'research',
        category: 'research-consent',
        date_time: researchConsentDate.toISOString(),
        policy_rule: 'http://terminology.hl7.org/CodeSystem/v3-ActCode|OPTIN',
        provision: JSON.stringify({
          type: 'permit',
          period: {
            start: researchConsentDate.toISOString(),
            end: new Date(researchConsentDate.getFullYear() + 2, researchConsentDate.getMonth(), researchConsentDate.getDate()).toISOString(),
          },
          purpose: [
            { code: 'HRESCH', display: 'Healthcare Research' },
          ],
        }),
        source_attachment: null,
        created_at: now,
        updated_at: now,
      });
    }
  }

  await batchInsert(trx, 'consents', consentRows);
  console.log(`  - consents: ${consentRows.length} rows`);

  // ----- MESSAGES -----
  const messageRows: Record<string, unknown>[] = [];

  // Collect non-patient staff users for sending/receiving
  const staffIds = [
    ...users.physicians,
    ...users.nurses,
    ...users.medicalAssistants,
    ...users.admins,
  ];

  if (staffIds.length < 2) {
    console.log(`  - messages: 0 rows (insufficient staff users)`);
    return;
  }

  // Generate ~140 patient-related messages
  const numPatientMessages = 140;
  for (let i = 0; i < numPatientMessages; i++) {
    const patient = rng.pick(patients.patients);
    const senderId = rng.pick(staffIds);
    let recipientId = rng.pick(staffIds);
    // Ensure sender != recipient
    while (recipientId === senderId && staffIds.length > 1) {
      recipientId = rng.pick(staffIds);
    }

    const subjectTemplate = rng.pick(MESSAGE_SUBJECTS_PATIENT);
    const subject = subjectTemplate.replace('{{patient}}', `${patient.firstName} ${patient.lastName}`);

    let bodyTemplate = rng.pick(MESSAGE_BODIES_PATIENT);
    bodyTemplate = bodyTemplate.replace('{{specialty}}', rng.pick(SPECIALTIES));

    const createdAt = rng.randomDate(dateStart, dateEnd);
    const isRead = rng.chance(0.7);
    const priority = rng.chance(0.15) ? 'high' : 'normal';

    const messageId = crypto.randomUUID();
    messageRows.push({
      id: messageId,
      sender_id: senderId,
      recipient_id: recipientId,
      patient_id: patient.id,
      subject,
      body: bodyTemplate,
      priority,
      read_at: isRead ? new Date(createdAt.getTime() + rng.randomInt(1, 48) * 3600000).toISOString() : null,
      parent_id: null,
      created_at: createdAt.toISOString(),
    });

    // ~30% of messages get a reply (create a thread)
    if (rng.chance(0.3)) {
      const replyDate = new Date(createdAt.getTime() + rng.randomInt(1, 72) * 3600000);
      if (replyDate < dateEnd) {
        messageRows.push({
          id: crypto.randomUUID(),
          sender_id: recipientId, // Reply goes back
          recipient_id: senderId,
          patient_id: patient.id,
          subject: `Re: ${subject}`,
          body: rng.pick([
            'Thank you for the update. I will follow up with the patient accordingly.',
            'Acknowledged. Will review and take appropriate action.',
            'Thanks for letting me know. I will adjust the treatment plan.',
            'Noted. I will schedule a follow-up appointment.',
            'Will review the results and get back to you shortly.',
          ]),
          priority: 'normal',
          read_at: rng.chance(0.8) ? new Date(replyDate.getTime() + rng.randomInt(1, 24) * 3600000).toISOString() : null,
          parent_id: messageId,
          created_at: replyDate.toISOString(),
        });
      }
    }
  }

  // Generate ~60 administrative messages (no patient reference)
  const numAdminMessages = 60;
  for (let i = 0; i < numAdminMessages; i++) {
    const senderId = rng.pick(staffIds);
    let recipientId = rng.pick(staffIds);
    while (recipientId === senderId && staffIds.length > 1) {
      recipientId = rng.pick(staffIds);
    }

    const subject = rng.pick(MESSAGE_SUBJECTS_ADMIN);
    const body = rng.pick(MESSAGE_BODIES_ADMIN);
    const createdAt = rng.randomDate(dateStart, dateEnd);
    const isRead = rng.chance(0.65);

    messageRows.push({
      id: crypto.randomUUID(),
      sender_id: senderId,
      recipient_id: recipientId,
      patient_id: null,
      subject,
      body,
      priority: rng.chance(0.1) ? 'high' : 'normal',
      read_at: isRead ? new Date(createdAt.getTime() + rng.randomInt(1, 48) * 3600000).toISOString() : null,
      parent_id: null,
      created_at: createdAt.toISOString(),
    });
  }

  await batchInsert(trx, 'messages', messageRows);
  console.log(`  - messages: ${messageRows.length} rows`);
}
