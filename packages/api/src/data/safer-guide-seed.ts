// =============================================================================
// SAFER Guides Seed Data - All 8 guides with practices
// Based on ONC SAFER Guides (Safety Assurance Factors for EHR Resilience)
// Required for CY 2026 IPPS attestation per FY 2026 final rule (2025-14681)
// =============================================================================

export interface SaferGuideSeed {
  guideNumber: number;
  title: string;
  practices: {
    practiceNumber: string;
    description: string;
    required: boolean;
  }[];
}

export const saferGuides: SaferGuideSeed[] = [
  {
    guideNumber: 1,
    title: 'High Priority Practices',
    practices: [
      { practiceNumber: '1.1', description: 'Develop, implement, and regularly review a safety plan for the EHR-enabled health IT system', required: true },
      { practiceNumber: '1.2', description: 'Ensure adequate staffing and resources for safe EHR use and maintenance', required: true },
      { practiceNumber: '1.3', description: 'Establish processes for identifying and addressing EHR-related safety concerns', required: true },
      { practiceNumber: '1.4', description: 'Monitor and address EHR-related patient safety events and near misses', required: true },
      { practiceNumber: '1.5', description: 'Ensure adequate training and competency assessment for all EHR users', required: true },
      { practiceNumber: '1.6', description: 'Establish a governance structure for EHR safety oversight', required: true },
      { practiceNumber: '1.7', description: 'Regularly assess and optimize clinical decision support', required: true },
      { practiceNumber: '1.8', description: 'Conduct regular testing and validation of EHR functionality', required: true },
    ],
  },
  {
    guideNumber: 2,
    title: 'Patient Identification',
    practices: [
      { practiceNumber: '2.1', description: 'Implement processes to ensure correct patient identification during registration', required: true },
      { practiceNumber: '2.2', description: 'Use at least two patient identifiers when matching patients to records', required: true },
      { practiceNumber: '2.3', description: 'Implement processes to prevent duplicate medical records', required: true },
      { practiceNumber: '2.4', description: 'Implement processes to detect and merge duplicate records', required: true },
      { practiceNumber: '2.5', description: 'Train staff on patient identification best practices', required: true },
      { practiceNumber: '2.6', description: 'Monitor and address patient identification errors', required: true },
      { practiceNumber: '2.7', description: 'Implement alerts for potential patient identification issues', required: false },
      { practiceNumber: '2.8', description: 'Use standardized naming conventions and data entry formats', required: true },
      { practiceNumber: '2.9', description: 'Implement procedures for unknown/unidentified patients', required: true },
      { practiceNumber: '2.10', description: 'Regularly audit patient identification processes', required: false },
    ],
  },
  {
    guideNumber: 3,
    title: 'Computerized Provider Order Entry with Decision Support',
    practices: [
      { practiceNumber: '3.1', description: 'Implement CPOE for medication orders with clinical decision support', required: true },
      { practiceNumber: '3.2', description: 'Display relevant patient information at the point of ordering', required: true },
      { practiceNumber: '3.3', description: 'Implement drug-drug interaction checking', required: true },
      { practiceNumber: '3.4', description: 'Implement drug-allergy interaction checking', required: true },
      { practiceNumber: '3.5', description: 'Provide dose range checking for medications', required: true },
      { practiceNumber: '3.6', description: 'Implement duplicate order checking', required: true },
      { practiceNumber: '3.7', description: 'Monitor and evaluate CDS alert override rates', required: true },
      { practiceNumber: '3.8', description: 'Regularly review and update clinical decision support content', required: true },
      { practiceNumber: '3.9', description: 'Minimize non-actionable and nuisance alerts', required: false },
      { practiceNumber: '3.10', description: 'Ensure orders are transmitted to the correct recipient', required: true },
      { practiceNumber: '3.11', description: 'Implement verbal/telephone order management policies', required: true },
    ],
  },
  {
    guideNumber: 4,
    title: 'Test Results Reporting and Follow-Up',
    practices: [
      { practiceNumber: '4.1', description: 'Ensure test results are routed to the ordering provider', required: true },
      { practiceNumber: '4.2', description: 'Implement processes for timely review and acknowledgment of test results', required: true },
      { practiceNumber: '4.3', description: 'Track whether patients are notified of test results within appropriate timeframes', required: true },
      { practiceNumber: '4.4', description: 'Implement escalation procedures for unacknowledged critical results', required: true },
      { practiceNumber: '4.5', description: 'Maintain documentation of patient notification of results', required: true },
      { practiceNumber: '4.6', description: 'Track abnormal results requiring follow-up actions', required: true },
      { practiceNumber: '4.7', description: 'Implement processes for managing results when ordering provider is unavailable', required: true },
      { practiceNumber: '4.8', description: 'Monitor test result turnaround times', required: false },
      { practiceNumber: '4.9', description: 'Regularly audit test result follow-up compliance', required: false },
      { practiceNumber: '4.10', description: 'Provide trending and historical result comparison', required: false },
    ],
  },
  {
    guideNumber: 5,
    title: 'Clinician Communication',
    practices: [
      { practiceNumber: '5.1', description: 'Implement secure messaging for clinical communication', required: true },
      { practiceNumber: '5.2', description: 'Track and ensure timely response to clinical messages', required: true },
      { practiceNumber: '5.3', description: 'Implement escalation for unread urgent messages', required: true },
      { practiceNumber: '5.4', description: 'Provide message delegation and covering provider workflows', required: true },
      { practiceNumber: '5.5', description: 'Implement incident reporting and safety event tracking', required: true },
      { practiceNumber: '5.6', description: 'Ensure EHR training and competency for all clinical staff', required: true },
      { practiceNumber: '5.7', description: 'Document care team roles and responsibilities in the EHR', required: true },
      { practiceNumber: '5.8', description: 'Implement standardized communication templates for handoffs', required: false },
      { practiceNumber: '5.9', description: 'Monitor communication-related safety events', required: false },
      { practiceNumber: '5.10', description: 'Ensure referral tracking and communication loop closure', required: true },
    ],
  },
  {
    guideNumber: 6,
    title: 'Patient Identification and Matching',
    practices: [
      { practiceNumber: '6.1', description: 'Implement probabilistic or deterministic patient matching algorithms', required: true },
      { practiceNumber: '6.2', description: 'Use confidence scoring for potential matches', required: true },
      { practiceNumber: '6.3', description: 'Display potential duplicates during patient registration', required: true },
      { practiceNumber: '6.4', description: 'Implement workflows for merging confirmed duplicate records', required: true },
      { practiceNumber: '6.5', description: 'Maintain audit trail for all merge operations', required: true },
      { practiceNumber: '6.6', description: 'Implement temporary/unknown patient workflows', required: true },
      { practiceNumber: '6.7', description: 'Regularly run batch duplicate detection', required: false },
      { practiceNumber: '6.8', description: 'Monitor duplicate creation rates and trends', required: false },
      { practiceNumber: '6.9', description: 'Ensure patient photos are associated with records where possible', required: false },
      { practiceNumber: '6.10', description: 'Implement real-time duplicate detection alerts', required: true },
    ],
  },
  {
    guideNumber: 7,
    title: 'System Configuration and Interfaces',
    practices: [
      { practiceNumber: '7.1', description: 'Monitor system availability and uptime', required: true },
      { practiceNumber: '7.2', description: 'Implement system health dashboards for administrators', required: true },
      { practiceNumber: '7.3', description: 'Monitor and alert on response time degradation', required: true },
      { practiceNumber: '7.4', description: 'Implement automated monitoring of system interfaces', required: true },
      { practiceNumber: '7.5', description: 'Maintain system configuration documentation', required: true },
      { practiceNumber: '7.6', description: 'Implement change management processes for system updates', required: true },
      { practiceNumber: '7.7', description: 'Test system changes in a non-production environment before deployment', required: true },
      { practiceNumber: '7.8', description: 'Monitor interface message queues and error rates', required: false },
      { practiceNumber: '7.9', description: 'Implement disaster recovery and business continuity procedures', required: true },
      { practiceNumber: '7.10', description: 'Regularly test backup and recovery procedures', required: false },
      { practiceNumber: '7.11', description: 'Monitor and manage system resource utilization', required: false },
    ],
  },
  {
    guideNumber: 8,
    title: 'System-System Interfaces',
    practices: [
      { practiceNumber: '8.1', description: 'Maintain an inventory of all active system interfaces', required: true },
      { practiceNumber: '8.2', description: 'Monitor interface status and message throughput', required: true },
      { practiceNumber: '8.3', description: 'Implement error handling and retry logic for interface failures', required: true },
      { practiceNumber: '8.4', description: 'Track and investigate interface errors and data mismatches', required: true },
      { practiceNumber: '8.5', description: 'Validate data integrity across system boundaries', required: true },
      { practiceNumber: '8.6', description: 'Implement alerting for interface outages or degradation', required: true },
      { practiceNumber: '8.7', description: 'Document interface specifications and data mappings', required: true },
      { practiceNumber: '8.8', description: 'Test interfaces after system updates or configuration changes', required: true },
      { practiceNumber: '8.9', description: 'Implement acknowledgment tracking for sent messages', required: false },
      { practiceNumber: '8.10', description: 'Regularly audit interface data quality and completeness', required: false },
    ],
  },
];
