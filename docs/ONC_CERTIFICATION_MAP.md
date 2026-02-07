# Tribal EHR -- ONC Health IT Certification Criterion Map

**Version:** 1.0
**Last Updated:** 2026-02-05
**Regulatory Basis:** 21st Century Cures Act; ONC Health IT Certification Program; HTI-1 Final Rule (45 CFR Part 170)
**Status:** In Progress

---

## Purpose

This document provides a complete, traceable mapping of every ONC Health IT certification criterion to its implementation within the Tribal EHR codebase. Each row identifies the CFR reference, a description of the requirement, the implementing module(s), API endpoint(s), UI component(s), test file(s), and current implementation status.

This mapping is maintained as a living document and is intended for use by:
- ONC-Authorized Certification Bodies (ONC-ACBs) during certification testing
- Internal development teams for implementation tracking
- Quality management system (QMS) audits
- Regulatory compliance reviews

---

## Status Legend

| Status           | Meaning                                                      |
|------------------|--------------------------------------------------------------|
| Complete         | Implemented, tested, and ready for certification review      |
| In Progress      | Implementation underway; partial functionality available      |
| Planned          | Designed but not yet implemented                             |
| N/A              | Not applicable or deprecated by regulation                   |

---

## Certification Criteria Mapping

### (a) Clinical -- Computerized Provider Order Entry and Clinical Functions

#### (a)(1) CPOE -- Medications

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(a)(1) |
| **CFR Reference** | 45 CFR 170.315(a)(1) |
| **Description** | Enable a user to record, change, and access medication orders. The system must allow ordering of medications by authorized providers, display active medication lists, and support order modification and discontinuation. |
| **Module** | `packages/api/src/routes/medications.ts`, `packages/api/src/routes/orders.ts` |
| **API Endpoints** | `POST /api/v1/orders/medications` -- Create medication order |
| | `PUT /api/v1/orders/medications/:id` -- Modify medication order |
| | `DELETE /api/v1/orders/medications/:id` -- Discontinue medication order |
| | `GET /api/v1/medications?patient=:patientId` -- List active medications |
| | `GET /api/v1/orders/medications/:id` -- Retrieve medication order |
| **FHIR Resources** | `MedicationRequest` (us-core-medicationrequest profile) |
| **FHIR Endpoints** | `POST /fhir/MedicationRequest`, `GET /fhir/MedicationRequest?patient=:id` |
| **UI Components** | `packages/frontend/src/pages/orders/MedicationOrder.tsx` -- Medication order entry form |
| | `packages/frontend/src/pages/patients/MedicationList.tsx` -- Active medication list view |
| **Test Files** | `tests/integration/cpoe-medications.test.ts` -- Integration tests for medication CPOE |
| | `tests/unit/medication-order-validation.test.ts` -- Validation rule unit tests |
| | `tests/e2e/cpoe-medication-workflow.spec.ts` -- End-to-end medication ordering workflow |
| **CDS Integration** | `packages/cds-hooks/src/rules/drug-interactions.ts` -- Drug-drug interaction checking on `order-select` |
| **Status** | In Progress |

---

#### (a)(2) CPOE -- Laboratory

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(a)(2) |
| **CFR Reference** | 45 CFR 170.315(a)(2) |
| **Description** | Enable a user to record, change, and access laboratory orders. The system must support creation of lab orders with appropriate test selection, specimen requirements, and order priority. |
| **Module** | `packages/api/src/routes/orders.ts` |
| **API Endpoints** | `POST /api/v1/orders/labs` -- Create lab order |
| | `PUT /api/v1/orders/labs/:id` -- Modify lab order |
| | `DELETE /api/v1/orders/labs/:id` -- Cancel lab order |
| | `GET /api/v1/orders/labs?patient=:patientId` -- List lab orders |
| | `GET /api/v1/orders/labs/:id` -- Retrieve lab order details |
| **FHIR Resources** | `ServiceRequest` (FHIR R4 base), `DiagnosticReport` (us-core-diagnosticreport-lab) |
| **FHIR Endpoints** | `POST /fhir/ServiceRequest`, `GET /fhir/ServiceRequest?patient=:id&category=laboratory` |
| **UI Components** | `packages/frontend/src/pages/orders/LabOrder.tsx` -- Laboratory order entry form |
| | `packages/frontend/src/pages/results/LabResults.tsx` -- Lab results display |
| **Test Files** | `tests/integration/cpoe-laboratory.test.ts` -- Integration tests for lab CPOE |
| | `tests/e2e/cpoe-lab-workflow.spec.ts` -- End-to-end lab ordering and results workflow |
| **HL7v2 Integration** | `packages/hl7-engine/src/messages/orm-o01.ts` -- Outbound ORM^O01 lab order messages |
| | `packages/hl7-engine/src/messages/oru-r01.ts` -- Inbound ORU^R01 lab result messages |
| **Status** | In Progress |

---

#### (a)(3) CPOE -- Diagnostic Imaging

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(a)(3) |
| **CFR Reference** | 45 CFR 170.315(a)(3) |
| **Description** | Enable a user to record, change, and access diagnostic imaging orders. The system must support radiology order entry with clinical indication, priority, and relevant clinical history. |
| **Module** | `packages/api/src/routes/orders.ts` |
| **API Endpoints** | `POST /api/v1/orders/imaging` -- Create imaging order |
| | `PUT /api/v1/orders/imaging/:id` -- Modify imaging order |
| | `DELETE /api/v1/orders/imaging/:id` -- Cancel imaging order |
| | `GET /api/v1/orders/imaging?patient=:patientId` -- List imaging orders |
| | `GET /api/v1/orders/imaging/:id` -- Retrieve imaging order details |
| **FHIR Resources** | `ServiceRequest` (FHIR R4 base), `DiagnosticReport` (us-core-diagnosticreport-note) |
| **FHIR Endpoints** | `POST /fhir/ServiceRequest`, `GET /fhir/ServiceRequest?patient=:id&category=imaging` |
| **UI Components** | `packages/frontend/src/pages/orders/ImagingOrder.tsx` -- Diagnostic imaging order entry form |
| | `packages/frontend/src/pages/results/ImagingResults.tsx` -- Imaging results and report display |
| **Test Files** | `tests/integration/cpoe-imaging.test.ts` -- Integration tests for imaging CPOE |
| | `tests/e2e/cpoe-imaging-workflow.spec.ts` -- End-to-end imaging ordering workflow |
| **Status** | In Progress |

---

#### (a)(5) Demographics

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(a)(5) |
| **CFR Reference** | 45 CFR 170.315(a)(5) |
| **Description** | Enable a user to record, change, and access patient demographic data including: date of birth, sex, race, ethnicity, preferred language, sexual orientation, gender identity, and preliminary cause of death. Must use OMB standards for race/ethnicity and ISO 639-1 for language. |
| **Module** | `packages/api/src/routes/patients.ts` |
| **API Endpoints** | `POST /api/v1/patients` -- Create patient with demographics |
| | `PUT /api/v1/patients/:id` -- Update patient demographics |
| | `GET /api/v1/patients/:id` -- Retrieve patient demographics |
| | `GET /api/v1/patients?name=:name&birthdate=:dob` -- Search patients |
| **FHIR Resources** | `Patient` (us-core-patient profile) |
| **FHIR Endpoints** | `POST /fhir/Patient`, `PUT /fhir/Patient/:id`, `GET /fhir/Patient?name=:name` |
| **UI Components** | `packages/frontend/src/pages/patients/PatientRegistration.tsx` -- Patient registration form |
| | `packages/frontend/src/pages/patients/PatientDemographics.tsx` -- Demographics editing view |
| **Terminology** | OMB race categories (CDC Race & Ethnicity Code Set 1.0), OMB ethnicity, ISO 639-1 language codes |
| **Validation** | `packages/shared/src/utils/validation.ts` -- Demographic field validation rules |
| **Test Files** | `tests/integration/demographics.test.ts` -- Integration tests for demographic recording |
| | `tests/unit/patient-validation.test.ts` -- Validation rule unit tests |
| | `tests/e2e/patient-registration.spec.ts` -- End-to-end patient registration workflow |
| **Status** | In Progress |

---

#### (a)(9) Clinical Decision Support

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(a)(9) |
| **CFR Reference** | 45 CFR 170.315(a)(9) |
| **Description** | Implement evidence-based clinical decision support interventions. Must support: problem list-based interventions, medication allergy checking, drug-drug interaction checking, demographic-based interventions (preventive care), and lab value-based interventions. Users must be able to configure, enable/disable, and track CDS interventions. Source attribution required. |
| **Module** | `packages/cds-hooks/src/engine/cds-engine.ts`, `packages/cds-hooks/src/rules/` |
| **API Endpoints** | `GET /api/v1/cds-services` -- CDS Hooks service discovery |
| | `POST /api/v1/cds-services/medication-safety` -- Drug interaction and allergy checks |
| | `POST /api/v1/cds-services/preventive-care` -- Age/gender-based preventive care reminders |
| | `POST /api/v1/cds-services/lab-alerts` -- Lab value-based alerts |
| | `GET /api/v1/admin/cds/rules` -- List configurable CDS rules |
| | `PUT /api/v1/admin/cds/rules/:id` -- Enable/disable/configure CDS rule |
| **FHIR Resources** | Uses `Patient`, `MedicationRequest`, `AllergyIntolerance`, `Condition`, `Observation` as prefetch |
| **UI Components** | `packages/frontend/src/components/ui/CdsAlertBanner.tsx` -- CDS alert display component |
| | `packages/frontend/src/pages/admin/CdsConfiguration.tsx` -- CDS rule configuration admin page |
| **CDS Rules** | `packages/cds-hooks/src/rules/preventive-care.ts` -- Preventive care rules |
| | `packages/cds-hooks/src/rules/drug-interactions.ts` -- Drug-drug interaction database |
| | `packages/cds-hooks/src/rules/allergy-checking.ts` -- Medication-allergy cross-checking |
| | `packages/cds-hooks/src/rules/lab-alerts.ts` -- Critical lab value alerts |
| **Test Files** | `tests/integration/cds-hooks.test.ts` -- CDS Hooks integration tests |
| | `tests/unit/cds-engine.test.ts` -- CDS engine unit tests |
| | `tests/unit/preventive-care-rules.test.ts` -- Preventive care rule unit tests |
| | `tests/e2e/cds-alert-workflow.spec.ts` -- End-to-end CDS alert workflow |
| **Status** | In Progress |

---

#### (a)(14) Implantable Device List

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(a)(14) |
| **CFR Reference** | 45 CFR 170.315(a)(14) |
| **Description** | Record, change, and access a patient's implantable device list. Must parse Unique Device Identifier (UDI) to populate: Device Identifier (DI), manufacturing date, expiration date, lot number, serial number, distinct identification code. Must associate devices with patients. |
| **Module** | `packages/api/src/routes/devices.ts` |
| **API Endpoints** | `POST /api/v1/patients/:patientId/devices` -- Add implantable device |
| | `PUT /api/v1/patients/:patientId/devices/:id` -- Update device record |
| | `DELETE /api/v1/patients/:patientId/devices/:id` -- Remove device |
| | `GET /api/v1/patients/:patientId/devices` -- List patient's implantable devices |
| | `GET /api/v1/devices/:id` -- Retrieve device details |
| | `POST /api/v1/devices/parse-udi` -- Parse UDI barcode string |
| **FHIR Resources** | `Device` (us-core-implantable-device profile) |
| **FHIR Endpoints** | `POST /fhir/Device`, `GET /fhir/Device?patient=:id&type=implantable` |
| **UI Components** | `packages/frontend/src/pages/patients/ImplantableDeviceList.tsx` -- Device list and management UI |
| | `packages/frontend/src/components/ui/UdiScanner.tsx` -- UDI barcode scanner/parser component |
| **Validation** | UDI parsing per FDA GUDID specifications |
| **Test Files** | `tests/integration/implantable-devices.test.ts` -- Integration tests for device management |
| | `tests/unit/udi-parser.test.ts` -- UDI parsing unit tests |
| | `tests/e2e/implantable-device-workflow.spec.ts` -- End-to-end device recording workflow |
| **Status** | In Progress |

---

### (b) Care Coordination -- Transitions of Care and Electronic Prescribing

#### (b)(1) Transitions of Care -- C-CDA Create

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(b)(1) |
| **CFR Reference** | 45 CFR 170.315(b)(1) |
| **Description** | Create a transition of care / referral summary document formatted as a C-CDA (Consolidated Clinical Document Architecture). The C-CDA must include: patient demographics, encounters, problems, medications, medication allergies, procedures, results, vital signs, immunizations, care team members, goals, health concerns, assessment and plan, and unique device identifiers. Must conform to C-CDA R2.1. |
| **Module** | `packages/api/src/routes/documents.ts` |
| **API Endpoints** | `POST /api/v1/documents/ccda/create` -- Generate C-CDA document for patient |
| | `POST /api/v1/documents/ccda/create?type=ccd` -- Generate Continuity of Care Document |
| | `POST /api/v1/documents/ccda/create?type=discharge` -- Generate Discharge Summary |
| | `POST /api/v1/documents/ccda/create?type=referral` -- Generate Referral Note |
| | `GET /api/v1/documents/:id/download` -- Download generated C-CDA |
| **FHIR Resources** | `DocumentReference` (us-core-documentreference), `Composition`, `Bundle` |
| **FHIR Endpoints** | `POST /fhir/DocumentReference`, `GET /fhir/DocumentReference?patient=:id` |
| **FHIR Operations** | `$document` -- Generate FHIR Document Bundle |
| **UI Components** | `packages/frontend/src/pages/patients/TransitionOfCare.tsx` -- C-CDA generation wizard |
| | `packages/frontend/src/pages/patients/DocumentViewer.tsx` -- C-CDA document viewer |
| **C-CDA Sections** | Allergies and Intolerances, Assessment and Plan, Care Team, Encounters, Goals, Health Concerns, Immunizations, Medical Equipment (UDI), Medications, Problems, Procedures, Results, Social History, Vital Signs |
| **Validation** | C-CDA R2.1 schema validation using `config/fhir-profiles/` |
| **Test Files** | `tests/integration/ccda-create.test.ts` -- C-CDA creation integration tests |
| | `tests/unit/ccda-generator.test.ts` -- C-CDA generation unit tests |
| | `tests/e2e/transition-of-care.spec.ts` -- End-to-end TOC workflow |
| **Status** | In Progress |

---

#### (b)(2) Transitions of Care -- C-CDA Receive

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(b)(2) |
| **CFR Reference** | 45 CFR 170.315(b)(2) |
| **Description** | Receive, display, and incorporate data from a C-CDA formatted transition of care document. Must parse C-CDA R2.1 documents, display all sections to the user, and allow the user to reconcile and incorporate data (problems, medications, allergies) into the patient's record. |
| **Module** | `packages/api/src/routes/documents.ts` |
| **API Endpoints** | `POST /api/v1/documents/ccda/import` -- Upload and parse C-CDA document |
| | `GET /api/v1/documents/ccda/:id/preview` -- Preview parsed C-CDA data |
| | `POST /api/v1/documents/ccda/:id/reconcile` -- Reconcile and incorporate C-CDA data |
| **FHIR Resources** | `DocumentReference`, `Patient`, `Condition`, `MedicationRequest`, `AllergyIntolerance` |
| **UI Components** | `packages/frontend/src/pages/patients/CcdaImport.tsx` -- C-CDA upload and preview |
| | `packages/frontend/src/pages/patients/ReconciliationView.tsx` -- Data reconciliation interface |
| **Test Files** | `tests/integration/ccda-receive.test.ts` -- C-CDA reception integration tests |
| | `tests/unit/ccda-parser.test.ts` -- C-CDA parsing unit tests |
| | `tests/e2e/ccda-import-reconcile.spec.ts` -- End-to-end import and reconciliation workflow |
| **Status** | In Progress |

---

#### (b)(3) Electronic Prescribing

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(b)(3) |
| **CFR Reference** | 45 CFR 170.315(b)(3) |
| **Description** | Enable electronic transmission of prescriptions using the NCPDP SCRIPT standard. Must support new prescriptions, refill requests, cancellation requests, and change requests. Must include structured and codified SIG (directions). |
| **Module** | `packages/api/src/routes/medications.ts`, `packages/hl7-engine/` |
| **API Endpoints** | `POST /api/v1/prescriptions/send` -- Transmit new prescription electronically |
| | `POST /api/v1/prescriptions/refill` -- Process refill request |
| | `POST /api/v1/prescriptions/cancel` -- Cancel prescription |
| | `GET /api/v1/prescriptions?patient=:patientId` -- List prescriptions |
| | `GET /api/v1/prescriptions/:id/status` -- Check transmission status |
| **FHIR Resources** | `MedicationRequest` (us-core-medicationrequest) |
| **UI Components** | `packages/frontend/src/pages/orders/PrescriptionForm.tsx` -- Electronic prescription entry |
| | `packages/frontend/src/pages/orders/PrescriptionHistory.tsx` -- Prescription history and status |
| **External Standards** | NCPDP SCRIPT 2017071 (required version) |
| **Test Files** | `tests/integration/e-prescribing.test.ts` -- E-prescribing integration tests |
| | `tests/e2e/e-prescribing-workflow.spec.ts` -- End-to-end prescribing workflow |
| **Status** | In Progress |

---

### (c) Clinical Quality Measures

#### (c)(1) CQM -- Record and Export

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(c)(1) |
| **CFR Reference** | 45 CFR 170.315(c)(1) |
| **Description** | Record the data required to calculate clinical quality measures (CQMs) and export CQM data in QRDA Category I (individual patient) format. Must capture all data elements defined by CMS eCQMs. |
| **Module** | `packages/api/src/routes/observations.ts`, `packages/api/src/routes/conditions.ts`, `packages/api/src/routes/procedures.ts` |
| **API Endpoints** | `GET /api/v1/quality/cqm/data?patient=:patientId&measure=:measureId` -- Retrieve CQM data for patient |
| | `POST /api/v1/quality/cqm/export/qrda1` -- Export QRDA Category I for patient |
| | `GET /api/v1/quality/cqm/measures` -- List available CQM definitions |
| **FHIR Resources** | `MeasureReport`, `Measure`, `Observation`, `Condition`, `Procedure`, `Encounter` |
| **FHIR Endpoints** | `GET /fhir/MeasureReport?patient=:id`, `POST /fhir/Measure/$evaluate-measure` |
| **UI Components** | `packages/frontend/src/pages/admin/CqmDashboard.tsx` -- CQM dashboard and export |
| **Test Files** | `tests/integration/cqm-record-export.test.ts` -- CQM data recording and QRDA I export tests |
| | `tests/unit/qrda-generator.test.ts` -- QRDA I generation unit tests |
| **Status** | In Progress |

---

#### (c)(2) CQM -- Import and Calculate

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(c)(2) |
| **CFR Reference** | 45 CFR 170.315(c)(2) |
| **Description** | Import CQM data in QRDA Category I format and calculate CQM results. Must correctly interpret QRDA Category I documents and apply measure logic to calculate numerator, denominator, exclusions, and exceptions. |
| **Module** | `packages/api/src/routes/documents.ts` |
| **API Endpoints** | `POST /api/v1/quality/cqm/import/qrda1` -- Import QRDA Category I document |
| | `POST /api/v1/quality/cqm/calculate` -- Calculate CQM results for measure and population |
| | `GET /api/v1/quality/cqm/results?measure=:measureId&period=:period` -- Retrieve calculated results |
| **FHIR Resources** | `MeasureReport`, `Bundle` |
| **UI Components** | `packages/frontend/src/pages/admin/CqmCalculation.tsx` -- CQM calculation and results view |
| **Test Files** | `tests/integration/cqm-import-calculate.test.ts` -- CQM import and calculation tests |
| **Status** | In Progress |

---

#### (c)(3) CQM -- Report

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(c)(3) |
| **CFR Reference** | 45 CFR 170.315(c)(3) |
| **Description** | Report CQM results in QRDA Category III (aggregate) format. Must generate QRDA Category III documents for submission to CMS and other reporting bodies. |
| **Module** | `packages/api/src/routes/documents.ts` |
| **API Endpoints** | `POST /api/v1/quality/cqm/export/qrda3` -- Export QRDA Category III (aggregate) |
| | `GET /api/v1/quality/cqm/report?period=:period` -- Generate CQM summary report |
| **FHIR Resources** | `MeasureReport` (summary type) |
| **UI Components** | `packages/frontend/src/pages/admin/CqmReporting.tsx` -- CQM aggregate reporting and export |
| **Test Files** | `tests/integration/cqm-report.test.ts` -- QRDA Category III generation and reporting tests |
| | `tests/unit/qrda3-generator.test.ts` -- QRDA III generation unit tests |
| **Status** | In Progress |

---

### (d) Privacy and Security

#### (d)(1) Authentication, Access Control, Authorization

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(d)(1) |
| **CFR Reference** | 45 CFR 170.315(d)(1) |
| **Description** | Verify against a unique identifier that a person seeking access is the one claimed (authentication). Assign a unique identifier for each user. Establish and enforce role-based access control (authorization) based on the role of the user. |
| **Module** | `packages/auth/src/oauth/authorization-server.ts`, `packages/auth/src/rbac/`, `packages/api/src/middleware/auth.ts` |
| **API Endpoints** | `POST /api/v1/auth/login` -- User authentication |
| | `POST /api/v1/auth/token` -- OAuth 2.0 token endpoint |
| | `POST /api/v1/auth/refresh` -- Token refresh |
| | `POST /api/v1/auth/logout` -- Session termination |
| | `GET /api/v1/auth/me` -- Current user identity |
| | `GET /api/v1/admin/users` -- User management (admin) |
| | `POST /api/v1/admin/users` -- Create user with role |
| | `PUT /api/v1/admin/users/:id/role` -- Assign/change role |
| **FHIR Endpoints** | All FHIR endpoints require Bearer token authentication |
| **UI Components** | `packages/frontend/src/pages/LoginPage.tsx` -- Login form with credential entry |
| | `packages/frontend/src/pages/admin/UserManagement.tsx` -- User and role administration |
| **Configuration** | `packages/shared/src/constants/roles.ts` -- Role definitions and permission mappings |
| **Middleware** | `packages/api/src/middleware/auth.ts` -- JWT validation and RBAC enforcement on every request |
| **Test Files** | `tests/integration/authentication.test.ts` -- Authentication flow integration tests |
| | `tests/integration/authorization-rbac.test.ts` -- RBAC enforcement integration tests |
| | `tests/unit/jwt-validation.test.ts` -- Token validation unit tests |
| | `tests/e2e/login-workflow.spec.ts` -- End-to-end login workflow |
| **Status** | In Progress |

---

#### (d)(2) Auditable Events and Tamper-Resistance

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(d)(2) |
| **CFR Reference** | 45 CFR 170.315(d)(2) |
| **Description** | Record actions related to electronic health information in an audit log. The audit log must be tamper-resistant. Must record: date and time, user identity, action performed, patient whose record was accessed, and the outcome. Audit entries must not be able to be modified or deleted by any user. |
| **Module** | `packages/api/src/middleware/audit.ts`, `packages/api/src/routes/audit.ts` |
| **API Endpoints** | `GET /api/v1/audit/events` -- Query audit log (admin/compliance only) |
| | `GET /api/v1/audit/events/:id` -- Retrieve specific audit event |
| | `GET /api/v1/audit/verify` -- Verify audit chain integrity |
| **Database** | `packages/api/src/db/migrations/018_create_audit_events.ts` -- Audit events table with hash chain |
| **Tamper Resistance** | Hash-chained audit log: each event's hash includes the previous event's hash (SHA-256 chain). Any modification to a historical event breaks the chain and is detected by the verification endpoint. The `audit_events` table uses PostgreSQL row-level security to prevent UPDATE and DELETE operations. |
| **Recorded Fields** | Event type, action (C/R/U/D), user ID, user role, patient ID, resource type, resource ID, detail (JSONB), outcome (success/failure), timestamp, previous hash, event hash |
| **Middleware** | `packages/api/src/middleware/audit.ts` -- Automatically captures all API operations on clinical resources |
| **UI Components** | `packages/frontend/src/pages/admin/AuditLog.tsx` -- Audit log viewer with search and filtering |
| **Test Files** | `tests/integration/audit-events.test.ts` -- Audit event recording integration tests |
| | `tests/unit/audit-hash-chain.test.ts` -- Hash chain integrity unit tests |
| | `tests/e2e/audit-tamper-detection.spec.ts` -- End-to-end tamper detection verification |
| **Status** | In Progress |

---

#### (d)(3) Audit Report(s)

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(d)(3) |
| **CFR Reference** | 45 CFR 170.315(d)(3) |
| **Description** | Enable a user to create an audit report for a specific time period, and sort entries in the audit log. The report must include all auditable events as defined in (d)(2). |
| **Module** | `packages/api/src/routes/audit.ts` |
| **API Endpoints** | `GET /api/v1/audit/reports` -- Generate audit report with date range |
| | `GET /api/v1/audit/reports?startDate=:start&endDate=:end&userId=:userId` -- Filtered report |
| | `GET /api/v1/audit/reports?patientId=:patientId` -- Patient-specific access report |
| | `GET /api/v1/audit/reports/export?format=csv` -- Export audit report as CSV |
| | `GET /api/v1/audit/reports/export?format=pdf` -- Export audit report as PDF |
| **Sorting** | Supports sorting by: timestamp (asc/desc), user, action, resource type, patient |
| **Filtering** | By date range, user ID, patient ID, action type, resource type, outcome |
| **UI Components** | `packages/frontend/src/pages/admin/AuditReport.tsx` -- Audit report generation and export |
| **Test Files** | `tests/integration/audit-reports.test.ts` -- Audit report generation integration tests |
| | `tests/e2e/audit-report-workflow.spec.ts` -- End-to-end audit report generation and export |
| **Status** | In Progress |

---

#### (d)(7) End-User Device Encryption

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(d)(7) |
| **CFR Reference** | 45 CFR 170.315(d)(7) |
| **Description** | Encrypt electronic health information stored on end-user devices using a FIPS 140-2 validated algorithm. If the technology does not store ePHI locally, demonstrate that no ePHI is cached or stored on the client device. |
| **Module** | `packages/frontend/src/lib/security.ts` |
| **Implementation** | Tribal EHR is a web application that does not persist PHI on end-user devices. All clinical data is served from the API and rendered in-memory in the browser. |
| **Controls** | No `localStorage` or `IndexedDB` storage of PHI. Session tokens stored in `httpOnly` secure cookies with `SameSite=Strict`. Browser cache headers: `Cache-Control: no-store, no-cache` on all API responses containing PHI. Service Worker (if present) does not cache clinical data. |
| **UI Components** | Not applicable (no local PHI storage) |
| **Test Files** | `tests/e2e/no-local-phi-storage.spec.ts` -- Verify no PHI in localStorage, sessionStorage, or IndexedDB |
| | `tests/integration/cache-headers.test.ts` -- Verify correct cache-control headers |
| **Status** | In Progress |

---

#### (d)(9) Trusted Connection

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(d)(9) |
| **CFR Reference** | 45 CFR 170.315(d)(9) |
| **Description** | Establish a trusted connection between the technology and an external network or system. Must use a trusted connection (TLS 1.2 or higher) with certificate validation. |
| **Module** | `packages/api/src/config/tls.ts`, `docker-compose.yml` (production overlay) |
| **Implementation** | All external connections use TLS 1.2+ with certificate verification. Internal container-to-container communication occurs over the Docker bridge network. Production deployment uses TLS termination at the reverse proxy (nginx) with certificates from a trusted Certificate Authority. |
| **Configuration** | TLS cipher suites restricted to FIPS 140-2 approved algorithms. Certificate pinning for connections to known external systems (pharmacy, laboratory, public health). |
| **API Endpoints** | All endpoints served over HTTPS in production |
| **FHIR Endpoints** | All FHIR endpoints served over HTTPS with mutual TLS option for system-to-system |
| **Test Files** | `tests/integration/tls-connection.test.ts` -- TLS configuration and cipher suite validation |
| | `tests/integration/certificate-validation.test.ts` -- Certificate verification tests |
| **Status** | In Progress |

---

#### (d)(10) Auditing Actions on Health Information

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(d)(10) |
| **CFR Reference** | 45 CFR 170.315(d)(10) |
| **Description** | Record actions on health information in accordance with the standard specified in the ONC criterion. Must record: the action(s) performed, the date and time, the user who performed the action, and the patient whose record was accessed. This extends (d)(2) with specific action tracking requirements. |
| **Module** | `packages/api/src/middleware/audit.ts` |
| **API Endpoints** | Same as (d)(2) -- audit middleware captures all actions automatically |
| **Actions Tracked** | Create (C), Read (R), Update (U), Delete (D), Export (E), Print (P), Query (Q), Transmit (T) |
| **Granularity** | Field-level change tracking: audit log records which fields were modified in update operations (old value hash, new value hash) |
| **Implementation** | The audit middleware (`packages/api/src/middleware/audit.ts`) wraps every route handler. For read operations, it records the resource accessed. For write operations, it records the fields changed. For exports (C-CDA, QRDA, Bulk Data), it records the scope and destination. |
| **Test Files** | `tests/integration/action-auditing.test.ts` -- Comprehensive action auditing tests |
| | `tests/unit/audit-action-types.test.ts` -- Action type classification unit tests |
| **Status** | In Progress |

---

#### (d)(12) Encrypt Authentication Credentials

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(d)(12) |
| **CFR Reference** | 45 CFR 170.315(d)(12) |
| **Description** | Encrypt authentication credentials (passwords, tokens, etc.) at rest and in transit. Must use standards-based encryption and secure hashing for stored credentials. |
| **Module** | `packages/auth/src/password/`, `packages/auth/src/oauth/authorization-server.ts` |
| **Implementation** | **In Transit**: All authentication endpoints served over TLS 1.2+. Credentials never transmitted in URL query parameters. **At Rest**: Passwords hashed with bcrypt (cost factor 12). OAuth client secrets hashed with SHA-256. JWT signing keys stored in environment variables (never in code or database). TOTP secrets encrypted with AES-256-GCM before storage. |
| **Configuration** | `ENCRYPTION_KEY` environment variable (256-bit) for symmetric encryption of secrets at rest |
| **Test Files** | `tests/unit/password-hashing.test.ts` -- Password hashing verification tests |
| | `tests/integration/credential-encryption.test.ts` -- Credential encryption at rest and in transit tests |
| **Status** | In Progress |

---

#### (d)(13) Multi-Factor Authentication

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(d)(13) |
| **CFR Reference** | 45 CFR 170.315(d)(13) |
| **Description** | Require multi-factor authentication for user access. Must support at least two of: something you know (password), something you have (token/device), something you are (biometric). |
| **Module** | `packages/auth/src/mfa/totp.ts` |
| **API Endpoints** | `POST /api/v1/auth/mfa/setup` -- Initialize MFA enrollment (generate TOTP secret + QR code) |
| | `POST /api/v1/auth/mfa/verify` -- Verify TOTP code during login |
| | `POST /api/v1/auth/mfa/disable` -- Disable MFA (admin action, requires re-authentication) |
| | `GET /api/v1/auth/mfa/status` -- Check MFA enrollment status |
| **Implementation** | TOTP per RFC 6238 (Time-Based One-Time Password). Factor 1: Password (something you know). Factor 2: TOTP authenticator app code (something you have). MFA is required for all clinical user roles. TOTP secrets are encrypted at rest with AES-256-GCM. Backup codes generated at enrollment for recovery. |
| **UI Components** | `packages/frontend/src/pages/LoginPage.tsx` -- MFA challenge step in login flow |
| | `packages/frontend/src/pages/admin/MfaSetup.tsx` -- MFA enrollment with QR code display |
| **Test Files** | `tests/integration/mfa-authentication.test.ts` -- MFA flow integration tests |
| | `tests/unit/totp-generation.test.ts` -- TOTP generation and verification unit tests |
| | `tests/e2e/mfa-login-workflow.spec.ts` -- End-to-end MFA login workflow |
| **Status** | In Progress |

---

### (f) Public Health

#### (f)(1) Transmission to Immunization Registries

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(f)(1) |
| **CFR Reference** | 45 CFR 170.315(f)(1) |
| **Description** | Create immunization information for electronic transmission to immunization registries using HL7v2 VXU (V04) messages. Must conform to CDC Implementation Guide for Immunization Messaging. Must transmit patient demographics, vaccine administered, lot number, manufacturer, administration date, and site. |
| **Module** | `packages/hl7-engine/src/messages/vxu-v04.ts`, `packages/api/src/routes/immunizations.ts` |
| **API Endpoints** | `POST /api/v1/immunizations` -- Record immunization |
| | `POST /api/v1/immunizations/:id/transmit` -- Transmit to immunization registry |
| | `GET /api/v1/immunizations/:id/transmission-status` -- Check registry transmission status |
| **FHIR Resources** | `Immunization` (us-core-immunization profile) |
| **FHIR Endpoints** | `POST /fhir/Immunization`, `GET /fhir/Immunization?patient=:id` |
| **HL7v2 Messages** | VXU^V04 (Unsolicited Vaccination Record Update) -- outbound to registry |
| | ACK^V04 -- Acknowledgment from registry |
| **Transport** | MLLP over TLS to state/jurisdictional immunization information system (IIS) |
| **UI Components** | `packages/frontend/src/pages/patients/ImmunizationRecord.tsx` -- Immunization entry and history |
| | `packages/frontend/src/pages/patients/ImmunizationTransmission.tsx` -- Registry submission status |
| **Test Files** | `tests/integration/immunization-registry.test.ts` -- Immunization registry transmission tests |
| | `tests/unit/vxu-message-builder.test.ts` -- VXU message construction unit tests |
| | `tests/e2e/immunization-workflow.spec.ts` -- End-to-end immunization recording and transmission |
| **Status** | In Progress |

---

#### (f)(2) Transmission to Public Health -- Syndromic Surveillance

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(f)(2) |
| **CFR Reference** | 45 CFR 170.315(f)(2) |
| **Description** | Create syndromic surveillance information for electronic transmission to public health agencies. Must generate HL7v2 ADT messages conforming to the PHIN Messaging Guide for Syndromic Surveillance. Includes patient demographics, diagnosis, chief complaint, and discharge disposition. |
| **Module** | `packages/hl7-engine/src/messages/adt-a04.ts`, `packages/api/src/routes/encounters.ts` |
| **API Endpoints** | `POST /api/v1/public-health/syndromic` -- Generate syndromic surveillance message |
| | `POST /api/v1/public-health/syndromic/transmit` -- Transmit to public health agency |
| | `GET /api/v1/public-health/syndromic/status` -- Transmission status |
| **HL7v2 Messages** | ADT^A04 (Register a Patient) -- initial encounter notification |
| | ADT^A08 (Update Patient Information) -- encounter updates |
| | ADT^A03 (Discharge/End Visit) -- encounter completion |
| **Transport** | MLLP or SFTP to jurisdictional public health agency |
| **UI Components** | `packages/frontend/src/pages/admin/PublicHealthReporting.tsx` -- Public health reporting dashboard |
| **Test Files** | `tests/integration/syndromic-surveillance.test.ts` -- Syndromic surveillance message generation tests |
| | `tests/unit/adt-message-builder.test.ts` -- ADT message construction unit tests |
| **Status** | In Progress |

---

#### (f)(5) Electronic Case Reporting

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(f)(5) |
| **CFR Reference** | 45 CFR 170.315(f)(5) |
| **Description** | Support electronic initial case reporting (eICR) to public health agencies. Must generate eICR documents conforming to the HL7 CDA R2 IG for eICR (electronic Initial Case Report). Must support trigger-based reporting for reportable conditions. |
| **Module** | `packages/api/src/routes/documents.ts`, `packages/cds-hooks/src/rules/reportable-conditions.ts` |
| **API Endpoints** | `POST /api/v1/public-health/ecr/generate` -- Generate eICR document |
| | `POST /api/v1/public-health/ecr/transmit` -- Submit eICR to AIMS platform |
| | `GET /api/v1/public-health/ecr/reportable-conditions` -- List reportable conditions |
| | `GET /api/v1/public-health/ecr/status` -- Check eICR submission status |
| **Standards** | HL7 CDA R2 Implementation Guide for eICR; RCTC (Reportable Conditions Trigger Codes) value set |
| **CDS Integration** | `packages/cds-hooks/src/rules/reportable-conditions.ts` -- Trigger-based detection of reportable conditions during encounter documentation |
| **UI Components** | `packages/frontend/src/pages/admin/ElectronicCaseReporting.tsx` -- eCR management dashboard |
| **Test Files** | `tests/integration/electronic-case-reporting.test.ts` -- eICR generation and submission tests |
| | `tests/unit/reportable-condition-triggers.test.ts` -- Trigger code matching unit tests |
| **Status** | In Progress |

---

### (g) Design and Performance

#### (g)(3) Safety-Enhanced Design

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(g)(3) |
| **CFR Reference** | 45 CFR 170.315(g)(3) |
| **Description** | Apply user-centered design (UCD) processes to the 9 capabilities specified in the criterion (listed below). Conduct summative usability testing with a minimum of 10 test participants per capability. Provide a NISTIR 7742-formatted usability test report. |
| **UCD Standard** | ISO 9241-210:2019 — Ergonomics of human-system interaction: Human-centred design for interactive systems |
| **SED-Referenced Criteria** | **(a)(1)** CPOE — Medications: `MedicationsTab.tsx`, `OrdersTab.tsx` |
| | **(a)(2)** CPOE — Laboratory: `OrdersTab.tsx` (type=laboratory) |
| | **(a)(3)** CPOE — Diagnostic Imaging: `OrdersTab.tsx` (type=imaging) |
| | **(a)(4)** Drug-Drug/Drug-Allergy Checks: `MedicationsTab.tsx` + `CdsCardList.tsx` + `CdsOverrideDialog.tsx`, CDS engine (9 handlers) |
| | **(a)(5)** Demographics: `PatientRegistrationPage.tsx` (gender identity, sexual orientation, multi-race, ethnicity) |
| | **(a)(9)** Clinical Decision Support: `SummaryTab.tsx` (patient-view CDS), `CdsCardList.tsx`, `CdsOverrideDialog.tsx`, 9 registered CDS handlers |
| | **(a)(14)** Implantable Device List: `DevicesTab.tsx`, `devices.ts` routes |
| | **(b)(2)** Clinical Information Reconciliation: `MedicationsTab.tsx` reconciliation dialog, `POST /allergies/reconcile`, `POST /conditions/reconcile` |
| | **(b)(3)** Electronic Prescribing: `MedicationsTab.tsx` prescribe dialog |
| **DSI Source Attribution** | §170.315(b)(11) — CDS cards display `source.label` and `source.url` link per card. Override reasons persisted to `cds_overrides` table. |
| **Override Persistence** | `cds_overrides` table: card_id, user_id, patient_id, hook_instance, reason_code, reason_text, card_summary, timestamp |
| **CDS Feedback** | `cds_feedback` table: card_id, user_id, outcome, outcome_timestamp |
| **Documentation** | `docs/SED_REPORT_NISTIR_7742.md` — Complete NISTIR 7742 usability test report |
| | `docs/USABILITY_TEST_PLAN.md` — Summative usability test plan |
| | `docs/USABILITY_TEST_SCENARIOS.md` — 9 task scenarios (one per criterion) |
| **API Endpoints** | `GET /cds-services` — Discovery (9 services) |
| | `POST /cds-services/:hookId` — CDS invocation |
| | `POST /cds-services/overrides` — Record override |
| | `POST /cds-services/feedback` — Record feedback |
| | `GET /cds-services/overrides/:patientId` — Patient overrides |
| | `POST /allergies/reconcile` — Allergy reconciliation |
| | `POST /conditions/reconcile` — Problem reconciliation |
| **Migration** | `024_create_cds_overrides.ts` — `cds_overrides` + `cds_feedback` tables |
| **Test Files** | `tests/unit/cds/cds-override.test.ts`, `tests/integration/api/cds-hooks.test.ts` |
| **Status** | In Progress |

---

#### (g)(4) Quality Management System

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(g)(4) |
| **CFR Reference** | 45 CFR 170.315(g)(4) |
| **Description** | The developer must use a quality management system (QMS) in the design, development, testing, and maintenance of the health IT. Must follow a recognized QMS framework (e.g., ISO 9001, FDA 21 CFR 820, or IEC 62304). |
| **Implementation** | Tribal EHR follows a QMS aligned with IEC 62304 (Medical Device Software Lifecycle) and ISO 9001:2015. |
| **Processes** | **Requirements Management**: ONC criterion mapping (this document), user stories in issue tracker. **Design Control**: Architecture documentation (ARCHITECTURE.md), design reviews via pull requests. **Implementation**: Coding standards enforced by ESLint/TypeScript strict mode, peer code review required. **Verification**: Automated unit, integration, and E2E test suites with CI/CD. **Validation**: User acceptance testing (UAT) with clinical stakeholders. **Risk Management**: Security risk assessments, HIPAA risk analysis. **Change Control**: Git-based version control, semantic versioning, change log maintenance. **Problem Resolution**: Issue tracking, bug triage, root cause analysis for production incidents. |
| **Documentation** | `docs/ARCHITECTURE.md` -- System architecture |
| | `docs/ONC_CERTIFICATION_MAP.md` -- Requirements traceability (this document) |
| | `docs/API_REFERENCE.md` -- API specification |
| | `docs/DEPLOYMENT_GUIDE.md` -- Deployment procedures |
| | `docs/FHIR_CONFORMANCE.md` -- Standards conformance |
| **Test Coverage** | Target: 90%+ line coverage for all packages. Measured via Jest --coverage. |
| **Status** | In Progress |

---

#### (g)(5) Accessibility-Centered Design

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(g)(5) |
| **CFR Reference** | 45 CFR 170.315(g)(5) |
| **Description** | The technology must be designed following an accessibility-centered design standard. Must demonstrate conformance with a recognized accessibility standard (Section 508, WCAG 2.1 Level AA, or equivalent). |
| **Module** | `packages/frontend/` |
| **Implementation** | Tribal EHR's frontend is built using shadcn/ui, which is based on Radix UI primitives. Radix UI provides built-in accessibility features including: ARIA attributes, keyboard navigation, focus management, screen reader compatibility, and proper semantic HTML. All custom components follow WCAG 2.1 Level AA guidelines. |
| **Accessibility Features** | **Keyboard Navigation**: All interactive elements are keyboard-accessible with visible focus indicators. **Screen Reader Support**: ARIA labels, roles, and live regions for dynamic content. **Color Contrast**: Minimum 4.5:1 contrast ratio for normal text, 3:1 for large text. **Form Labels**: All form controls have associated labels. **Error Identification**: Form validation errors identified by color, icon, and text. **Responsive Design**: Layout adapts to viewport size and zoom levels up to 200%. **Skip Navigation**: Skip-to-content links for keyboard users. |
| **UI Components** | `packages/frontend/src/components/ui/` -- All UI primitives use Radix UI accessibility features |
| | `packages/frontend/src/components/layout/` -- Accessible navigation and page structure |
| **Testing** | Automated accessibility testing with axe-core in E2E tests |
| **Test Files** | `tests/e2e/accessibility.spec.ts` -- WCAG 2.1 AA automated accessibility audit |
| | `tests/e2e/keyboard-navigation.spec.ts` -- Keyboard navigation verification |
| **Standards** | WCAG 2.1 Level AA, Section 508, WAI-ARIA 1.2 |
| **Status** | In Progress |

---

#### (g)(6) Consolidated CDA Creation Performance

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(g)(6) |
| **CFR Reference** | 45 CFR 170.315(g)(6) |
| **Description** | The technology must be able to create a C-CDA document conformant to the standard within a specified time frame. Must generate valid C-CDA R2.1 documents. Performance requirements per the ONC test procedure. |
| **Module** | `packages/api/src/routes/documents.ts` |
| **API Endpoints** | `POST /api/v1/documents/ccda/create` -- Generate C-CDA (same as (b)(1)) |
| **Performance Target** | C-CDA generation must complete within 10 seconds for a typical patient record |
| **Validation** | Generated C-CDA documents validated against: C-CDA R2.1 schema (XSD), Schematron rules, vocabulary checks (SNOMED CT, LOINC, RxNorm, ICD-10), content checks for required sections |
| **Test Files** | `tests/integration/ccda-performance.test.ts` -- C-CDA generation performance benchmarks |
| | `tests/unit/ccda-validation.test.ts` -- C-CDA structural and vocabulary validation tests |
| **Status** | In Progress |

---

#### (g)(7) Application Access -- Patient Selection

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(g)(7) |
| **CFR Reference** | 45 CFR 170.315(g)(7) |
| **Description** | The technology must be able to receive a request with a patient identifier and return the FHIR resources for that patient. This is the foundation of the SMART on FHIR patient-level API access. |
| **Module** | `packages/api/src/routes/fhir-proxy.ts`, `packages/auth/src/oauth/` |
| **API Endpoints** | `GET /fhir/Patient/:id` -- Retrieve patient by ID |
| | `GET /fhir/Patient?identifier=:mrn` -- Search patient by MRN |
| | `GET /fhir/Patient/:id/$everything` -- All resources for a patient |
| **FHIR Resources** | `Patient` (us-core-patient) |
| **Auth Scopes** | `patient/Patient.read`, `user/Patient.read`, `launch/patient` |
| **SMART Configuration** | `packages/auth/src/oauth/smart-configuration.ts` -- Discovery document |
| **UI Components** | Patient selection is embedded in the SMART launch flow |
| **Test Files** | `tests/integration/patient-selection-api.test.ts` -- Patient selection API tests |
| | `tests/integration/smart-launch.test.ts` -- SMART on FHIR launch flow tests |
| **Status** | In Progress |

---

#### (g)(8) Application Access -- Data Category Request (Deprecated)

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(g)(8) |
| **CFR Reference** | 45 CFR 170.315(g)(8) |
| **Description** | **DEPRECATED** -- This criterion has been deprecated by ONC in favor of (g)(10). Previously required API access to specific data categories. Tribal EHR implements the successor criterion (g)(10) which provides comprehensive FHIR-based API access. |
| **Successor** | 170.315(g)(10) -- Standardized API for Patient and Population Services |
| **Status** | N/A (Deprecated -- superseded by (g)(10)) |

---

#### (g)(9) Application Access -- All Data Request

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(g)(9) |
| **CFR Reference** | 45 CFR 170.315(g)(9) |
| **Description** | Respond to requests for all data for a single patient. Must return a complete set of patient data as defined by the USCDI (United States Core Data for Interoperability). Must support FHIR R4 format. |
| **Module** | `packages/api/src/routes/fhir-proxy.ts` |
| **API Endpoints** | `GET /fhir/Patient/:id/$everything` -- Retrieve all data for a patient |
| | `GET /fhir/$export?patient=:id` -- Bulk export for single patient |
| **FHIR Resources** | All US Core resources for the patient returned in a FHIR Bundle |
| **USCDI Data Classes** | Patient Demographics, Allergies and Intolerances, Assessment and Plan of Treatment, Care Team Members, Clinical Notes, Clinical Tests, Encounters, Goals, Health Concerns, Immunizations, Medications, Problems, Procedures, Provenance, Unique Device Identifiers, Vital Signs, Laboratory Results, SDOH Assessment |
| **Auth Scopes** | `patient/*.read`, `user/*.read` |
| **Test Files** | `tests/integration/all-data-request.test.ts` -- $everything operation integration tests |
| | `tests/integration/uscdi-completeness.test.ts` -- USCDI data class completeness verification |
| **Status** | In Progress |

---

#### (g)(10) Standardized API for Patient and Population Services

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(g)(10) |
| **CFR Reference** | 45 CFR 170.315(g)(10) |
| **Description** | Provide a standardized API using FHIR R4, US Core Implementation Guide, SMART App Launch, and Bulk Data Access for patient-level and population-level data access. This is the primary API certification criterion under the 21st Century Cures Act. Must support: single patient access (SMART App Launch), multiple patient access (Bulk Data), and standardized scopes. |
| **Module** | `packages/api/src/routes/fhir-proxy.ts`, `packages/auth/src/oauth/`, `packages/fhir-server/` |
| **API Endpoints -- Single Patient** | `GET /fhir/Patient/:id` -- Patient demographics |
| | `GET /fhir/AllergyIntolerance?patient=:id` -- Allergies |
| | `GET /fhir/Condition?patient=:id` -- Conditions/problems |
| | `GET /fhir/Observation?patient=:id&category=vital-signs` -- Vital signs |
| | `GET /fhir/Observation?patient=:id&category=laboratory` -- Lab results |
| | `GET /fhir/MedicationRequest?patient=:id` -- Medications |
| | `GET /fhir/Procedure?patient=:id` -- Procedures |
| | `GET /fhir/Immunization?patient=:id` -- Immunizations |
| | `GET /fhir/CarePlan?patient=:id` -- Care plans |
| | `GET /fhir/CareTeam?patient=:id` -- Care teams |
| | `GET /fhir/Goal?patient=:id` -- Goals |
| | `GET /fhir/Encounter?patient=:id` -- Encounters |
| | `GET /fhir/DiagnosticReport?patient=:id` -- Diagnostic reports |
| | `GET /fhir/DocumentReference?patient=:id` -- Documents |
| | `GET /fhir/Device?patient=:id` -- Implantable devices |
| | `GET /fhir/Provenance?target=:resourceId` -- Provenance |
| **API Endpoints -- Population** | `POST /fhir/Group/:id/$export` -- Group-level bulk export |
| | `POST /fhir/Patient/$export` -- Patient-level bulk export |
| | `POST /fhir/$export` -- System-level bulk export |
| | `GET /fhir/bulk-status/:id` -- Polling for bulk export status |
| **SMART Configuration** | `GET /.well-known/smart-configuration` -- SMART discovery |
| | `GET /fhir/metadata` -- FHIR CapabilityStatement |
| | `GET /oauth/authorize` -- Authorization endpoint |
| | `POST /oauth/token` -- Token endpoint |
| | `POST /oauth/register` -- Dynamic client registration |
| **Auth Scopes** | `patient/*.read`, `patient/*.write`, `user/*.read`, `user/*.write`, `system/*.read`, `launch`, `launch/patient`, `openid`, `fhirUser`, `offline_access` |
| **Profiles** | US Core STU6 (IG 6.1.0) -- all 20+ profiles |
| **Bulk Data** | FHIR Bulk Data Access IG v2.0 -- NDJSON format, polling model, Group/Patient/System level |
| **UI Components** | `packages/frontend/src/pages/admin/SmartAppManagement.tsx` -- SMART app registration and management |
| **FHIR Server Config** | `packages/fhir-server/application.yaml` -- HAPI FHIR US Core IG configuration |
| **Test Files** | `tests/integration/g10-standardized-api.test.ts` -- Comprehensive (g)(10) API tests |
| | `tests/integration/smart-app-launch.test.ts` -- SMART App Launch flow tests |
| | `tests/integration/bulk-data-export.test.ts` -- Bulk Data Access tests |
| | `tests/integration/us-core-profiles.test.ts` -- US Core profile conformance tests |
| | `tests/e2e/smart-app-launch.spec.ts` -- End-to-end SMART app launch |
| **Status** | In Progress |

---

### (h) Direct Messaging

#### (h)(1) Direct Project, Send

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(h)(1) |
| **CFR Reference** | 45 CFR 170.315(h)(1) |
| **Description** | Send health information via the Direct Standard (Direct Project). Must be able to send encrypted health information (including C-CDA documents) to a Direct address. Must support S/MIME encryption and signature per the Direct Project specification. |
| **Module** | `packages/api/src/routes/documents.ts` |
| **API Endpoints** | `POST /api/v1/direct/send` -- Send message via Direct protocol |
| | `POST /api/v1/direct/send-ccda` -- Send C-CDA document via Direct |
| | `GET /api/v1/direct/sent` -- List sent Direct messages |
| | `GET /api/v1/direct/sent/:id/status` -- Check delivery status (MDN) |
| **Implementation** | Direct Protocol transport agent with S/MIME encryption and signing. Certificate management for Direct addresses. Trust anchor management for trust communities (DirectTrust, state HIEs). Message Disposition Notification (MDN) tracking for delivery confirmation. |
| **Configuration** | Direct address domain configuration. HISP (Health Information Service Provider) integration settings. Trust anchor bundle management. |
| **UI Components** | `packages/frontend/src/pages/messages/DirectSend.tsx` -- Direct message composition and sending |
| | `packages/frontend/src/pages/messages/DirectOutbox.tsx` -- Sent message status tracking |
| **Test Files** | `tests/integration/direct-send.test.ts` -- Direct message sending integration tests |
| | `tests/unit/smime-encryption.test.ts` -- S/MIME encryption and signing unit tests |
| | `tests/e2e/direct-send-workflow.spec.ts` -- End-to-end Direct send workflow |
| **Status** | In Progress |

---

#### (h)(2) Direct Project, Receive

| Field | Value |
|-------|-------|
| **Criterion** | 170.315(h)(2) |
| **CFR Reference** | 45 CFR 170.315(h)(2) |
| **Description** | Receive health information via the Direct Standard (Direct Project). Must be able to receive and decrypt S/MIME encrypted messages, verify sender signatures, extract and display enclosed health information (including C-CDA documents), and send Message Disposition Notifications (MDN). |
| **Module** | `packages/api/src/routes/documents.ts` |
| **API Endpoints** | `GET /api/v1/direct/inbox` -- List received Direct messages |
| | `GET /api/v1/direct/inbox/:id` -- Retrieve received message with attachments |
| | `POST /api/v1/direct/inbox/:id/import` -- Import C-CDA from received Direct message |
| **Implementation** | Direct Protocol receiver with S/MIME decryption and signature verification. Automatic MDN generation on successful receipt. Certificate and trust anchor verification. Extracted C-CDA documents available for import per criterion (b)(2). |
| **UI Components** | `packages/frontend/src/pages/messages/DirectInbox.tsx` -- Received Direct messages |
| | `packages/frontend/src/pages/messages/DirectMessageViewer.tsx` -- View received message and attachments |
| **Test Files** | `tests/integration/direct-receive.test.ts` -- Direct message reception integration tests |
| | `tests/unit/smime-decryption.test.ts` -- S/MIME decryption and verification unit tests |
| | `tests/e2e/direct-receive-workflow.spec.ts` -- End-to-end Direct receive workflow |
| **Status** | In Progress |

---

## Criterion Summary Table

| Criterion | CFR Reference | Short Description | Primary Module | Primary API Endpoint | Primary UI Component | Primary Test File | Status |
|-----------|---------------|-------------------|----------------|---------------------|---------------------|-------------------|--------|
| (a)(1) | 45 CFR 170.315(a)(1) | CPOE - Medications | `packages/api/src/routes/medications.ts` | `POST /api/v1/orders/medications` | `pages/orders/MedicationOrder.tsx` | `tests/integration/cpoe-medications.test.ts` | In Progress |
| (a)(2) | 45 CFR 170.315(a)(2) | CPOE - Laboratory | `packages/api/src/routes/orders.ts` | `POST /api/v1/orders/labs` | `pages/orders/LabOrder.tsx` | `tests/integration/cpoe-laboratory.test.ts` | In Progress |
| (a)(3) | 45 CFR 170.315(a)(3) | CPOE - Diagnostic Imaging | `packages/api/src/routes/orders.ts` | `POST /api/v1/orders/imaging` | `pages/orders/ImagingOrder.tsx` | `tests/integration/cpoe-imaging.test.ts` | In Progress |
| (a)(5) | 45 CFR 170.315(a)(5) | Demographics | `packages/api/src/routes/patients.ts` | `POST /api/v1/patients` | `pages/patients/PatientRegistration.tsx` | `tests/integration/demographics.test.ts` | In Progress |
| (a)(9) | 45 CFR 170.315(a)(9) | Clinical Decision Support | `packages/cds-hooks/src/engine/cds-engine.ts` | `POST /api/v1/cds-services/{id}` | `components/ui/CdsAlertBanner.tsx` | `tests/integration/cds-hooks.test.ts` | In Progress |
| (a)(14) | 45 CFR 170.315(a)(14) | Implantable Device List | `packages/api/src/routes/devices.ts` | `POST /api/v1/patients/:id/devices` | `pages/patients/ImplantableDeviceList.tsx` | `tests/integration/implantable-devices.test.ts` | In Progress |
| (b)(1) | 45 CFR 170.315(b)(1) | TOC - C-CDA Create | `packages/api/src/routes/documents.ts` | `POST /api/v1/documents/ccda/create` | `pages/patients/TransitionOfCare.tsx` | `tests/integration/ccda-create.test.ts` | In Progress |
| (b)(2) | 45 CFR 170.315(b)(2) | TOC - C-CDA Receive | `packages/api/src/routes/documents.ts` | `POST /api/v1/documents/ccda/import` | `pages/patients/CcdaImport.tsx` | `tests/integration/ccda-receive.test.ts` | In Progress |
| (b)(3) | 45 CFR 170.315(b)(3) | Electronic Prescribing | `packages/api/src/routes/medications.ts` | `POST /api/v1/prescriptions/send` | `pages/orders/PrescriptionForm.tsx` | `tests/integration/e-prescribing.test.ts` | In Progress |
| (c)(1) | 45 CFR 170.315(c)(1) | CQM - Record and Export | `packages/api/src/routes/observations.ts` | `POST /api/v1/quality/cqm/export/qrda1` | `pages/admin/CqmDashboard.tsx` | `tests/integration/cqm-record-export.test.ts` | In Progress |
| (c)(2) | 45 CFR 170.315(c)(2) | CQM - Import and Calculate | `packages/api/src/routes/documents.ts` | `POST /api/v1/quality/cqm/import/qrda1` | `pages/admin/CqmCalculation.tsx` | `tests/integration/cqm-import-calculate.test.ts` | In Progress |
| (c)(3) | 45 CFR 170.315(c)(3) | CQM - Report | `packages/api/src/routes/documents.ts` | `POST /api/v1/quality/cqm/export/qrda3` | `pages/admin/CqmReporting.tsx` | `tests/integration/cqm-report.test.ts` | In Progress |
| (d)(1) | 45 CFR 170.315(d)(1) | Auth, Access Control, AuthZ | `packages/auth/src/` | `POST /api/v1/auth/login` | `pages/LoginPage.tsx` | `tests/integration/authentication.test.ts` | In Progress |
| (d)(2) | 45 CFR 170.315(d)(2) | Auditable Events, Tamper-Resistance | `packages/api/src/middleware/audit.ts` | `GET /api/v1/audit/events` | `pages/admin/AuditLog.tsx` | `tests/integration/audit-events.test.ts` | In Progress |
| (d)(3) | 45 CFR 170.315(d)(3) | Audit Report(s) | `packages/api/src/routes/audit.ts` | `GET /api/v1/audit/reports` | `pages/admin/AuditReport.tsx` | `tests/integration/audit-reports.test.ts` | In Progress |
| (d)(7) | 45 CFR 170.315(d)(7) | End-User Device Encryption | `packages/frontend/src/lib/security.ts` | N/A (no local PHI storage) | N/A | `tests/e2e/no-local-phi-storage.spec.ts` | In Progress |
| (d)(9) | 45 CFR 170.315(d)(9) | Trusted Connection | `packages/api/src/config/tls.ts` | All endpoints (TLS) | N/A | `tests/integration/tls-connection.test.ts` | In Progress |
| (d)(10) | 45 CFR 170.315(d)(10) | Auditing Actions on Health Info | `packages/api/src/middleware/audit.ts` | `GET /api/v1/audit/events` | `pages/admin/AuditLog.tsx` | `tests/integration/action-auditing.test.ts` | In Progress |
| (d)(12) | 45 CFR 170.315(d)(12) | Encrypt Auth Credentials | `packages/auth/src/password/` | `POST /api/v1/auth/login` | N/A | `tests/unit/password-hashing.test.ts` | In Progress |
| (d)(13) | 45 CFR 170.315(d)(13) | Multi-Factor Authentication | `packages/auth/src/mfa/totp.ts` | `POST /api/v1/auth/mfa/verify` | `pages/LoginPage.tsx` (MFA step) | `tests/integration/mfa-authentication.test.ts` | In Progress |
| (f)(1) | 45 CFR 170.315(f)(1) | Immunization Registries | `packages/hl7-engine/src/messages/vxu-v04.ts` | `POST /api/v1/immunizations/:id/transmit` | `pages/patients/ImmunizationRecord.tsx` | `tests/integration/immunization-registry.test.ts` | In Progress |
| (f)(2) | 45 CFR 170.315(f)(2) | Syndromic Surveillance | `packages/hl7-engine/src/messages/adt-a04.ts` | `POST /api/v1/public-health/syndromic` | `pages/admin/PublicHealthReporting.tsx` | `tests/integration/syndromic-surveillance.test.ts` | In Progress |
| (f)(5) | 45 CFR 170.315(f)(5) | Electronic Case Reporting | `packages/api/src/routes/documents.ts` | `POST /api/v1/public-health/ecr/generate` | `pages/admin/ElectronicCaseReporting.tsx` | `tests/integration/electronic-case-reporting.test.ts` | In Progress |
| (g)(3) | 45 CFR 170.315(g)(3) | Safety-Enhanced Design | `docs/SED_REPORT_NISTIR_7742.md`, `docs/USABILITY_TEST_PLAN.md`, `docs/USABILITY_TEST_SCENARIOS.md` | N/A (process) | All 9 SED-referenced criteria UI components | `tests/unit/cds/`, `tests/integration/api/cds-hooks.test.ts` | In Progress |
| (g)(4) | 45 CFR 170.315(g)(4) | Quality Management System | `docs/` (process documentation) | N/A (process) | N/A | N/A (process) | In Progress |
| (g)(5) | 45 CFR 170.315(g)(5) | Accessibility-Centered Design | `packages/frontend/` | N/A | All UI components | `tests/e2e/accessibility.spec.ts` | In Progress |
| (g)(6) | 45 CFR 170.315(g)(6) | C-CDA Creation Performance | `packages/api/src/routes/documents.ts` | `POST /api/v1/documents/ccda/create` | N/A | `tests/integration/ccda-performance.test.ts` | In Progress |
| (g)(7) | 45 CFR 170.315(g)(7) | App Access - Patient Selection | `packages/api/src/routes/fhir-proxy.ts` | `GET /fhir/Patient/:id` | N/A (SMART flow) | `tests/integration/patient-selection-api.test.ts` | In Progress |
| (g)(8) | 45 CFR 170.315(g)(8) | App Access - Data Category | N/A | N/A | N/A | N/A | N/A (Deprecated) |
| (g)(9) | 45 CFR 170.315(g)(9) | App Access - All Data Request | `packages/api/src/routes/fhir-proxy.ts` | `GET /fhir/Patient/:id/$everything` | N/A | `tests/integration/all-data-request.test.ts` | In Progress |
| (g)(10) | 45 CFR 170.315(g)(10) | Standardized API (Patient/Population) | `packages/api/src/routes/fhir-proxy.ts` | `GET /fhir/{Resource}?patient=:id` | `pages/admin/SmartAppManagement.tsx` | `tests/integration/g10-standardized-api.test.ts` | In Progress |
| (h)(1) | 45 CFR 170.315(h)(1) | Direct Project, Send | `packages/api/src/routes/documents.ts` | `POST /api/v1/direct/send` | `pages/messages/DirectSend.tsx` | `tests/integration/direct-send.test.ts` | In Progress |
| (h)(2) | 45 CFR 170.315(h)(2) | Direct Project, Receive | `packages/api/src/routes/documents.ts` | `GET /api/v1/direct/inbox` | `pages/messages/DirectInbox.tsx` | `tests/integration/direct-receive.test.ts` | In Progress |

---

## Appendix: USCDI Data Classes and Elements Mapping

The United States Core Data for Interoperability (USCDI) defines the minimum data classes and elements that must be supported. The following table maps each USCDI v3 data class to the corresponding FHIR resource and Tribal EHR implementation:

| USCDI Data Class | USCDI Data Element | FHIR Resource | US Core Profile | Tribal EHR Route |
|------------------|-------------------|---------------|-----------------|------------------|
| Patient Demographics | First Name, Last Name, DOB, Sex, Race, Ethnicity, Language, Address, Phone, Email | Patient | us-core-patient | `routes/patients.ts` |
| Allergies and Intolerances | Substance (Medication), Substance (Drug Class), Reaction | AllergyIntolerance | us-core-allergyintolerance | `routes/allergies.ts` |
| Assessment and Plan | Assessment and Plan of Treatment | CarePlan | us-core-careplan | `routes/care-plans.ts` |
| Care Team Members | Care Team Member Name, Identifier, Role, Location, Telecom | CareTeam | us-core-careteam | `routes/care-teams.ts` |
| Clinical Notes | Consultation Note, Discharge Summary, History & Physical, Progress Note, Procedure Note, Imaging Narrative | DocumentReference, DiagnosticReport | us-core-documentreference, us-core-diagnosticreport-note | `routes/documents.ts` |
| Clinical Tests | Clinical Test, Clinical Test Result/Value | Observation, DiagnosticReport | us-core-observation-clinical-result, us-core-diagnosticreport-lab | `routes/observations.ts` |
| Encounters | Encounter Type, Encounter Diagnosis, Encounter Disposition, Encounter Time, Encounter Location | Encounter | us-core-encounter | `routes/encounters.ts` |
| Goals | Patient Goals | Goal | us-core-goal | `routes/goals.ts` |
| Health Concerns | Health Concern | Condition | us-core-condition-problems-health-concerns | `routes/conditions.ts` |
| Health Insurance | Coverage Status, Coverage Type, Group Identifier, Member Identifier, Payer Identifier, Subscriber ID, Relationship to Subscriber | Coverage | Coverage (base) | `routes/patients.ts` |
| Immunizations | Vaccines Administered | Immunization | us-core-immunization | `routes/immunizations.ts` |
| Medications | Medications, Dose, Dose Unit, Indication, Instructions, Fill Status | MedicationRequest | us-core-medicationrequest | `routes/medications.ts` |
| Problems | Date of Diagnosis, Date of Resolution, SDOH Problems/Health Concerns | Condition | us-core-condition-problems-health-concerns, us-core-condition-encounter-diagnosis | `routes/conditions.ts` |
| Procedures | Procedures, Performance Time, SDOH Interventions | Procedure | us-core-procedure | `routes/procedures.ts` |
| Provenance | Author, Author Time Stamp, Author Organization | Provenance | us-core-provenance | `middleware/audit.ts` |
| SDOH Assessment | SDOH Assessment | Observation | us-core-observation-sdoh-assessment | `routes/observations.ts` |
| Unique Device Identifier(s) | UDI, Device Description, UDI-DI, Manufacturing Date, Expiration Date, Lot Number, Serial Number, Distinct Identification Code | Device | us-core-implantable-device | `routes/devices.ts` |
| Vital Signs | Diastolic BP, Systolic BP, Body Height, Body Weight, Heart Rate, Respiratory Rate, Body Temperature, Pulse Oximetry, BMI, Head Circumference, Inhaled O2 Concentration | Observation | us-core-vital-signs (and sub-profiles) | `routes/observations.ts` |
| Laboratory | Tests, Values/Results, Result Date, Result Status, Result Interpretation, Specimen Type | Observation, DiagnosticReport | us-core-laboratory-result, us-core-diagnosticreport-lab | `routes/observations.ts` |
| Smoking Status | Smoking Status | Observation | us-core-smokingstatus | `routes/observations.ts` |
