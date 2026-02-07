# Tribal EHR -- FHIR Conformance Statement

**Version:** 1.0
**Last Updated:** 2026-02-05
**FHIR Version:** R4 (4.0.1)
**US Core Version:** STU6 (6.1.0)
**Server Implementation:** HAPI FHIR JPA Server v6.x

---

## Table of Contents

1. [Server Configuration](#server-configuration)
2. [Supported Resources](#supported-resources)
3. [FHIR Operations](#fhir-operations)
4. [Security](#security)
5. [Bulk Data Access](#bulk-data-access)
6. [CapabilityStatement](#capabilitystatement)
7. [Error Handling](#error-handling)
8. [Pagination](#pagination)
9. [Include and RevInclude](#include-and-revinclude)
10. [Terminology Services](#terminology-services)

---

## 1. Server Configuration

| Property | Value |
|----------|-------|
| FHIR Version | R4 (4.0.1) |
| Base URL | `{server}/fhir` |
| Default Port | 8080 |
| Implementation | HAPI FHIR JPA Server |
| Database Backend | PostgreSQL 16 |
| Implementation Guide | hl7.fhir.us.core 6.1.0 |
| Validation | Enabled (request validation against profiles) |
| Narrative Generation | Disabled |
| CORS | Enabled (configurable origins) |
| OpenAPI/Swagger | Enabled at `/fhir/api-docs` |
| Bulk Export | Enabled |
| Multiple Delete | Enabled (admin only) |
| External References | Allowed |
| Placeholder References | Allowed |

**Configuration File:** `packages/fhir-server/application.yaml`

---

## 2. Supported Resources

### 2.1 Patient

| Property | Value |
|----------|-------|
| **Resource** | Patient |
| **Profile** | [US Core Patient](http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient) (`us-core-patient`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `identifier` | token | Patient MRN or other identifier (e.g., `identifier=http://hospital.org/mrn\|12345`) |
| `name` | string | Patient name (family, given, or full name search) |
| `family` | string | Family (last) name |
| `given` | string | Given (first) name |
| `birthdate` | date | Date of birth (supports prefixes: `eq`, `lt`, `gt`, `ge`, `le`) |
| `gender` | token | Administrative gender (`male`, `female`, `other`, `unknown`) |
| `address` | string | Address (any part) |
| `address-city` | string | City |
| `address-state` | string | State |
| `address-postalcode` | string | Postal/ZIP code |
| `telecom` | token | Phone or email |
| `race` | token | US Core Race extension |
| `ethnicity` | token | US Core Ethnicity extension |
| `_lastUpdated` | date | Last modification date |
| `_count` | number | Page size |
| `_sort` | string | Sort parameter |

---

### 2.2 Encounter

| Property | Value |
|----------|-------|
| **Resource** | Encounter |
| **Profile** | [US Core Encounter](http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter) (`us-core-encounter`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `patient` | reference | Patient reference |
| `date` | date | Encounter date/period |
| `status` | token | Encounter status (`planned`, `in-progress`, `finished`, `cancelled`) |
| `class` | token | Encounter class (AMB, IMP, EMER, etc.) |
| `type` | token | Encounter type code |
| `identifier` | token | Encounter identifier |
| `participant` | reference | Participating practitioner |
| `location` | reference | Location of encounter |
| `_lastUpdated` | date | Last modification date |

---

### 2.3 Condition

| Property | Value |
|----------|-------|
| **Resource** | Condition |
| **Profiles** | [US Core Condition Problems and Health Concerns](http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns) (`us-core-condition-problems-health-concerns`), [US Core Condition Encounter Diagnosis](http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-encounter-diagnosis) (`us-core-condition-encounter-diagnosis`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `patient` | reference | Patient reference |
| `category` | token | Condition category (`problem-list-item`, `encounter-diagnosis`, `health-concern`) |
| `clinical-status` | token | Clinical status (`active`, `recurrence`, `relapse`, `inactive`, `remission`, `resolved`) |
| `verification-status` | token | Verification status (`confirmed`, `unconfirmed`, `provisional`, `differential`, `refuted`) |
| `code` | token | Condition code (SNOMED CT, ICD-10-CM) |
| `onset-date` | date | Date of onset |
| `recorded-date` | date | Date recorded |
| `encounter` | reference | Associated encounter |
| `_lastUpdated` | date | Last modification date |

---

### 2.4 Observation

| Property | Value |
|----------|-------|
| **Resource** | Observation |
| **Profiles** | [US Core Vital Signs](http://hl7.org/fhir/us/core/StructureDefinition/us-core-vital-signs) (`us-core-vital-signs`), [US Core Laboratory Result](http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab) (`us-core-laboratory-result`), [US Core Smoking Status](http://hl7.org/fhir/us/core/StructureDefinition/us-core-smokingstatus) (`us-core-smokingstatus`), [US Core SDOH Assessment](http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-sdoh-assessment) (`us-core-observation-sdoh-assessment`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `patient` | reference | Patient reference |
| `category` | token | Observation category (`vital-signs`, `laboratory`, `social-history`, `survey`, `sdoh`) |
| `code` | token | Observation code (LOINC) |
| `date` | date | Observation effective date |
| `status` | token | Observation status (`registered`, `preliminary`, `final`, `amended`, `corrected`) |
| `value-quantity` | quantity | Numeric value with unit |
| `value-concept` | token | Coded value |
| `encounter` | reference | Associated encounter |
| `combo-code` | token | Component code for multi-component observations |
| `combo-value-quantity` | quantity | Component value for multi-component observations |
| `_lastUpdated` | date | Last modification date |

---

### 2.5 AllergyIntolerance

| Property | Value |
|----------|-------|
| **Resource** | AllergyIntolerance |
| **Profile** | [US Core AllergyIntolerance](http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance) (`us-core-allergyintolerance`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `patient` | reference | Patient reference |
| `clinical-status` | token | Clinical status (`active`, `inactive`, `resolved`) |
| `verification-status` | token | Verification status |
| `type` | token | Type (`allergy`, `intolerance`) |
| `category` | token | Category (`food`, `medication`, `environment`, `biologic`) |
| `criticality` | token | Criticality (`low`, `high`, `unable-to-assess`) |
| `code` | token | Allergen code (RxNorm, SNOMED CT, NDF-RT) |
| `date` | date | Date recorded |
| `_lastUpdated` | date | Last modification date |

---

### 2.6 MedicationRequest

| Property | Value |
|----------|-------|
| **Resource** | MedicationRequest |
| **Profile** | [US Core MedicationRequest](http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest) (`us-core-medicationrequest`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `patient` | reference | Patient reference |
| `status` | token | Order status (`active`, `completed`, `cancelled`, `stopped`, `draft`, `on-hold`) |
| `intent` | token | Order intent (`proposal`, `plan`, `order`, `original-order`, `reflex-order`) |
| `medication` | reference | Medication reference |
| `code` | token | Medication code (RxNorm) |
| `authoredon` | date | Date order was written |
| `encounter` | reference | Associated encounter |
| `requester` | reference | Prescribing practitioner |
| `_include` | special | `MedicationRequest:medication` to include referenced Medication |
| `_lastUpdated` | date | Last modification date |

---

### 2.7 Procedure

| Property | Value |
|----------|-------|
| **Resource** | Procedure |
| **Profile** | [US Core Procedure](http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure) (`us-core-procedure`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `patient` | reference | Patient reference |
| `date` | date | Procedure performance date |
| `status` | token | Procedure status (`preparation`, `in-progress`, `completed`, `not-done`) |
| `code` | token | Procedure code (SNOMED CT, CPT, HCPCS) |
| `encounter` | reference | Associated encounter |
| `_lastUpdated` | date | Last modification date |

---

### 2.8 Immunization

| Property | Value |
|----------|-------|
| **Resource** | Immunization |
| **Profile** | [US Core Immunization](http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization) (`us-core-immunization`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `patient` | reference | Patient reference |
| `date` | date | Immunization date |
| `status` | token | Immunization status (`completed`, `entered-in-error`, `not-done`) |
| `vaccine-code` | token | Vaccine code (CVX) |
| `_lastUpdated` | date | Last modification date |

---

### 2.9 CarePlan

| Property | Value |
|----------|-------|
| **Resource** | CarePlan |
| **Profile** | [US Core CarePlan](http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan) (`us-core-careplan`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `patient` | reference | Patient reference |
| `category` | token | Care plan category (`assess-plan`) |
| `date` | date | Care plan period |
| `status` | token | Care plan status (`draft`, `active`, `on-hold`, `revoked`, `completed`) |
| `_lastUpdated` | date | Last modification date |

---

### 2.10 CareTeam

| Property | Value |
|----------|-------|
| **Resource** | CareTeam |
| **Profile** | [US Core CareTeam](http://hl7.org/fhir/us/core/StructureDefinition/us-core-careteam) (`us-core-careteam`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `patient` | reference | Patient reference |
| `status` | token | Care team status (`proposed`, `active`, `suspended`, `inactive`) |
| `_lastUpdated` | date | Last modification date |

---

### 2.11 Goal

| Property | Value |
|----------|-------|
| **Resource** | Goal |
| **Profile** | [US Core Goal](http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal) (`us-core-goal`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `patient` | reference | Patient reference |
| `lifecycle-status` | token | Goal lifecycle status (`proposed`, `planned`, `accepted`, `active`, `on-hold`, `completed`, `cancelled`) |
| `target-date` | date | Target date for goal achievement |
| `_lastUpdated` | date | Last modification date |

---

### 2.12 DocumentReference

| Property | Value |
|----------|-------|
| **Resource** | DocumentReference |
| **Profile** | [US Core DocumentReference](http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference) (`us-core-documentreference`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `patient` | reference | Patient reference |
| `category` | token | Document category |
| `type` | token | Document type (LOINC document type codes) |
| `date` | date | Document creation date |
| `status` | token | Document status (`current`, `superseded`, `entered-in-error`) |
| `period` | date | Time of service documented |
| `_lastUpdated` | date | Last modification date |

---

### 2.13 Device

| Property | Value |
|----------|-------|
| **Resource** | Device |
| **Profile** | [US Core Implantable Device](http://hl7.org/fhir/us/core/StructureDefinition/us-core-implantable-device) (`us-core-implantable-device`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `patient` | reference | Patient reference |
| `type` | token | Device type |
| `udi-carrier` | string | UDI barcode string |
| `udi-di` | string | UDI Device Identifier (DI) |
| `status` | token | Device status (`active`, `inactive`, `entered-in-error`) |
| `_lastUpdated` | date | Last modification date |

---

### 2.14 DiagnosticReport

| Property | Value |
|----------|-------|
| **Resource** | DiagnosticReport |
| **Profiles** | [US Core DiagnosticReport for Laboratory Results Reporting](http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab) (`us-core-diagnosticreport-lab`), [US Core DiagnosticReport for Report and Note Exchange](http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-note) (`us-core-diagnosticreport-note`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `patient` | reference | Patient reference |
| `category` | token | Report category (`LAB`, `LP29684-5` for radiology, `LP29708-2` for cardiology) |
| `code` | token | Report code (LOINC) |
| `date` | date | Report date |
| `status` | token | Report status (`registered`, `partial`, `preliminary`, `final`, `amended`, `corrected`, `appended`) |
| `encounter` | reference | Associated encounter |
| `_lastUpdated` | date | Last modification date |

---

### 2.15 Provenance

| Property | Value |
|----------|-------|
| **Resource** | Provenance |
| **Profile** | [US Core Provenance](http://hl7.org/fhir/us/core/StructureDefinition/us-core-provenance) (`us-core-provenance`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes (auto-generated) |
| **Update** | No (immutable) |
| **Delete** | No |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `target` | reference | Target resource the provenance applies to |
| `recorded` | date | When the provenance was recorded |
| `agent` | reference | Agent who performed the activity |
| `_lastUpdated` | date | Last modification date |

---

### 2.16 Coverage

| Property | Value |
|----------|-------|
| **Resource** | Coverage |
| **Profile** | FHIR R4 Base Coverage |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `patient` | reference | Patient (beneficiary) reference |
| `type` | token | Coverage type |
| `status` | token | Coverage status (`active`, `cancelled`, `draft`, `entered-in-error`) |
| `payor` | reference | Payor organization |
| `subscriber-id` | token | Subscriber identifier |
| `_lastUpdated` | date | Last modification date |

---

### 2.17 Organization

| Property | Value |
|----------|-------|
| **Resource** | Organization |
| **Profile** | [US Core Organization](http://hl7.org/fhir/us/core/StructureDefinition/us-core-organization) (`us-core-organization`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `name` | string | Organization name |
| `identifier` | token | NPI or other identifier |
| `address` | string | Organization address |
| `type` | token | Organization type |
| `_lastUpdated` | date | Last modification date |

---

### 2.18 Practitioner

| Property | Value |
|----------|-------|
| **Resource** | Practitioner |
| **Profile** | [US Core Practitioner](http://hl7.org/fhir/us/core/StructureDefinition/us-core-practitioner) (`us-core-practitioner`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `name` | string | Practitioner name |
| `identifier` | token | NPI or other identifier |
| `_lastUpdated` | date | Last modification date |

---

### 2.19 PractitionerRole

| Property | Value |
|----------|-------|
| **Resource** | PractitionerRole |
| **Profile** | [US Core PractitionerRole](http://hl7.org/fhir/us/core/StructureDefinition/us-core-practitionerrole) (`us-core-practitionerrole`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `practitioner` | reference | Practitioner reference |
| `organization` | reference | Organization reference |
| `specialty` | token | Specialty code |
| `role` | token | Role code |
| `_lastUpdated` | date | Last modification date |

---

### 2.20 Location

| Property | Value |
|----------|-------|
| **Resource** | Location |
| **Profile** | [US Core Location](http://hl7.org/fhir/us/core/StructureDefinition/us-core-location) (`us-core-location`) |
| **Read** | Yes |
| **Search** | Yes |
| **Create** | Yes |
| **Update** | Yes |
| **Delete** | Yes (soft delete) |

**Supported Search Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_id` | token | Logical resource ID |
| `name` | string | Location name |
| `address` | string | Location address |
| `address-city` | string | City |
| `address-state` | string | State |
| `address-postalcode` | string | Postal code |
| `type` | token | Location type |
| `_lastUpdated` | date | Last modification date |

---

## 3. FHIR Operations

### 3.1 $export (Bulk Data Export)

| Property | Value |
|----------|-------|
| **Operation** | `$export` |
| **Levels** | System (`GET /fhir/$export`), Patient (`GET /fhir/Patient/$export`), Group (`GET /fhir/Group/:id/$export`) |
| **Method** | GET or POST |
| **Async** | Yes (returns 202 Accepted with Content-Location for polling) |
| **Output Format** | NDJSON (`application/fhir+ndjson`) |

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_outputFormat` | string | Output format (default: `application/fhir+ndjson`) |
| `_since` | instant | Only include resources modified after this date |
| `_type` | string | Comma-separated list of resource types to include |
| `_typeFilter` | string | FHIR search queries to filter resources by type |

### 3.2 $validate

| Property | Value |
|----------|-------|
| **Operation** | `$validate` |
| **Level** | Type (e.g., `POST /fhir/Patient/$validate`) |
| **Method** | POST |
| **Description** | Validate a resource against its declared profile |

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `resource` | Resource | The resource to validate (in request body) |
| `profile` | uri | Profile to validate against (optional; uses meta.profile if not specified) |
| `mode` | code | Validation mode: `create`, `update`, `delete` |

**Response:** `OperationOutcome` with validation results (issues, warnings, errors).

### 3.3 $expand

| Property | Value |
|----------|-------|
| **Operation** | `$expand` |
| **Level** | Type (`GET /fhir/ValueSet/$expand` or `GET /fhir/ValueSet/:id/$expand`) |
| **Method** | GET or POST |
| **Description** | Expand a ValueSet to list all codes in the value set |

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | uri | ValueSet URL to expand |
| `filter` | string | Text filter for code display |
| `count` | integer | Number of codes to return |
| `offset` | integer | Offset for pagination |
| `includeDesignations` | boolean | Include designations in expansion |

### 3.4 $lookup

| Property | Value |
|----------|-------|
| **Operation** | `$lookup` |
| **Level** | Type (`GET /fhir/CodeSystem/$lookup`) |
| **Method** | GET or POST |
| **Description** | Look up details for a specific code in a code system |

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `system` | uri | Code system URL |
| `code` | code | Code to look up |
| `version` | string | Code system version |
| `displayLanguage` | code | Language for display text |

### 3.5 $translate

| Property | Value |
|----------|-------|
| **Operation** | `$translate` |
| **Level** | Type (`POST /fhir/ConceptMap/$translate`) |
| **Method** | POST |
| **Description** | Translate a code from one code system to another using a ConceptMap |

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | uri | ConceptMap URL |
| `system` | uri | Source code system |
| `code` | code | Source code |
| `targetsystem` | uri | Target code system |

### 3.6 $everything

| Property | Value |
|----------|-------|
| **Operation** | `$everything` |
| **Level** | Instance (`GET /fhir/Patient/:id/$everything`) |
| **Method** | GET |
| **Description** | Retrieve all resources related to a specific patient |

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | date | Start date for filtering resources |
| `end` | date | End date for filtering resources |
| `_since` | instant | Only include resources modified after this date |
| `_type` | string | Comma-separated list of resource types to include |
| `_count` | integer | Page size |

**Response:** FHIR `Bundle` of type `searchset` containing all patient-related resources.

---

## 4. Security

### 4.1 SMART on FHIR Authorization

Tribal EHR implements SMART App Launch Framework (v2.0) for authorization of FHIR API access.

**Discovery Endpoint:** `GET /.well-known/smart-configuration`

```json
{
  "issuer": "{server}",
  "authorization_endpoint": "{server}/oauth/authorize",
  "token_endpoint": "{server}/oauth/token",
  "registration_endpoint": "{server}/oauth/register",
  "jwks_uri": "{server}/oauth/jwks",
  "scopes_supported": [
    "openid",
    "fhirUser",
    "launch",
    "launch/patient",
    "offline_access",
    "patient/*.read",
    "patient/*.write",
    "user/*.read",
    "user/*.write",
    "system/*.read",
    "system/*.write"
  ],
  "response_types_supported": ["code"],
  "grant_types_supported": [
    "authorization_code",
    "client_credentials",
    "refresh_token"
  ],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": [
    "client_secret_basic",
    "client_secret_post",
    "private_key_jwt"
  ],
  "capabilities": [
    "launch-ehr",
    "launch-standalone",
    "client-public",
    "client-confidential-symmetric",
    "client-confidential-asymmetric",
    "context-ehr-patient",
    "context-ehr-encounter",
    "context-standalone-patient",
    "permission-offline",
    "permission-patient",
    "permission-user",
    "sso-openid-connect",
    "smart-granular-scopes"
  ]
}
```

### 4.2 Supported Scopes

| Scope Pattern | Description | Example |
|---------------|-------------|---------|
| `patient/{resource}.read` | Read access to a specific resource type for the patient in context | `patient/Observation.read` |
| `patient/{resource}.write` | Write access to a specific resource type for the patient in context | `patient/MedicationRequest.write` |
| `patient/*.read` | Read access to all resource types for the patient in context | `patient/*.read` |
| `patient/*.write` | Write access to all resource types for the patient in context | `patient/*.write` |
| `user/{resource}.read` | Read access scoped to the current user's access level | `user/Patient.read` |
| `user/{resource}.write` | Write access scoped to the current user's access level | `user/Patient.write` |
| `user/*.read` | Read all resources the user has access to | `user/*.read` |
| `system/{resource}.read` | System-level read access (backend services) | `system/Patient.read` |
| `system/*.read` | System-level read access to all resources | `system/*.read` |
| `launch` | EHR launch context | `launch` |
| `launch/patient` | Request patient context during standalone launch | `launch/patient` |
| `openid` | OpenID Connect identity token | `openid` |
| `fhirUser` | FHIR user identity claim | `fhirUser` |
| `offline_access` | Refresh token for long-lived access | `offline_access` |

### 4.3 SMART Granular Scopes (v2)

Tribal EHR supports SMART v2 granular scopes for fine-grained resource access:

```
patient/Observation.rs?category=http://terminology.hl7.org/CodeSystem/observation-category|laboratory
patient/Condition.rs?category=http://terminology.hl7.org/CodeSystem/condition-category|problem-list-item
```

### 4.4 Token Endpoint

**Request:**
```http
POST /oauth/token HTTP/1.1
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code={authorization_code}
&redirect_uri={redirect_uri}
&client_id={client_id}
&code_verifier={pkce_verifier}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "launch/patient patient/*.read openid fhirUser",
  "patient": "patient-123",
  "encounter": "encounter-456",
  "id_token": "eyJ...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}
```

---

## 5. Bulk Data Access

Tribal EHR supports the FHIR Bulk Data Access (Flat FHIR) Implementation Guide v2.0.

### 5.1 Export Initiation

**System-Level Export:**
```http
GET /fhir/$export
Accept: application/fhir+json
Prefer: respond-async
Authorization: Bearer {access_token}
```

**Patient-Level Export:**
```http
GET /fhir/Patient/$export?_type=Patient,Observation,Condition
Accept: application/fhir+json
Prefer: respond-async
Authorization: Bearer {access_token}
```

**Group-Level Export:**
```http
GET /fhir/Group/{group_id}/$export
Accept: application/fhir+json
Prefer: respond-async
Authorization: Bearer {access_token}
```

**Response (202 Accepted):**
```http
HTTP/1.1 202 Accepted
Content-Location: /fhir/bulk-status/export-job-123
```

### 5.2 Status Polling

```http
GET /fhir/bulk-status/export-job-123
Authorization: Bearer {access_token}
```

**In Progress (202):**
```http
HTTP/1.1 202 Accepted
X-Progress: Exporting resources (45% complete)
Retry-After: 30
```

**Complete (200):**
```json
{
  "transactionTime": "2026-02-05T12:00:00Z",
  "request": "/fhir/$export",
  "requiresAccessToken": true,
  "output": [
    {
      "type": "Patient",
      "url": "/fhir/bulk-data/export-job-123/Patient.ndjson",
      "count": 1500
    },
    {
      "type": "Observation",
      "url": "/fhir/bulk-data/export-job-123/Observation.ndjson",
      "count": 45000
    }
  ],
  "error": []
}
```

### 5.3 Data Retrieval

```http
GET /fhir/bulk-data/export-job-123/Patient.ndjson
Accept: application/fhir+ndjson
Authorization: Bearer {access_token}
```

Response: NDJSON format (one JSON resource per line).

### 5.4 Job Deletion

```http
DELETE /fhir/bulk-status/export-job-123
Authorization: Bearer {access_token}
```

---

## 6. CapabilityStatement

The FHIR server publishes its CapabilityStatement at `GET /fhir/metadata`.

**Key CapabilityStatement Properties:**

```json
{
  "resourceType": "CapabilityStatement",
  "status": "active",
  "kind": "instance",
  "fhirVersion": "4.0.1",
  "format": ["application/fhir+json", "application/fhir+xml"],
  "implementationGuide": [
    "http://hl7.org/fhir/us/core/ImplementationGuide/hl7.fhir.us.core|6.1.0"
  ],
  "rest": [
    {
      "mode": "server",
      "security": {
        "service": [
          {
            "coding": [
              {
                "system": "http://terminology.hl7.org/CodeSystem/restful-security-service",
                "code": "SMART-on-FHIR"
              }
            ]
          }
        ],
        "extension": [
          {
            "url": "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris",
            "extension": [
              { "url": "authorize", "valueUri": "{server}/oauth/authorize" },
              { "url": "token", "valueUri": "{server}/oauth/token" },
              { "url": "register", "valueUri": "{server}/oauth/register" },
              { "url": "manage", "valueUri": "{server}/oauth/manage" }
            ]
          }
        ]
      },
      "resource": [
        {
          "type": "Patient",
          "profile": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
          "interaction": [
            { "code": "read" },
            { "code": "vread" },
            { "code": "search-type" },
            { "code": "create" },
            { "code": "update" },
            { "code": "delete" }
          ],
          "searchParam": [
            { "name": "_id", "type": "token" },
            { "name": "identifier", "type": "token" },
            { "name": "name", "type": "string" },
            { "name": "birthdate", "type": "date" },
            { "name": "gender", "type": "token" }
          ]
        }
      ]
    }
  ]
}
```

*(The actual CapabilityStatement includes all 20+ supported resources with their full search parameters, interactions, and profiles.)*

---

## 7. Error Handling

All FHIR errors are returned as `OperationOutcome` resources per the FHIR specification.

### Error Response Format

```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "not-found",
      "diagnostics": "Resource Patient/nonexistent-id not found",
      "details": {
        "text": "The requested resource does not exist"
      }
    }
  ]
}
```

### HTTP Status Code Mapping

| HTTP Status | FHIR Issue Code | Description |
|-------------|-----------------|-------------|
| 400 | `invalid`, `structure`, `required`, `value` | Invalid request, malformed resource, missing required fields |
| 401 | `login`, `unknown` | Authentication required or failed |
| 403 | `forbidden`, `security` | Insufficient permissions or scope |
| 404 | `not-found` | Resource not found |
| 405 | `not-supported` | Interaction not supported for resource type |
| 409 | `conflict`, `duplicate` | Version conflict or duplicate resource |
| 410 | `deleted` | Resource has been deleted |
| 412 | `conflict` | Precondition failed (ETag mismatch) |
| 422 | `invariant`, `business-rule` | Validation error against profile |
| 429 | `throttled` | Rate limit exceeded |
| 500 | `exception` | Internal server error |

### Validation Error Example

```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "invariant",
      "diagnostics": "Patient.name: minimum required = 1, but only found 0",
      "location": ["Patient.name"],
      "expression": ["Patient.name"]
    },
    {
      "severity": "error",
      "code": "value",
      "diagnostics": "Patient.gender: Value 'X' is not in the value set http://hl7.org/fhir/ValueSet/administrative-gender",
      "location": ["Patient.gender"],
      "expression": ["Patient.gender"]
    }
  ]
}
```

---

## 8. Pagination

FHIR search results are paginated using the standard FHIR pagination model.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `_count` | integer | 20 | Number of resources per page (max: 1000) |
| `_offset` | integer | 0 | Starting offset for results |

### Bundle Links

Search results are returned as FHIR `Bundle` resources with navigation links:

```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 150,
  "link": [
    {
      "relation": "self",
      "url": "{server}/fhir/Patient?name=Smith&_count=20&_offset=0"
    },
    {
      "relation": "next",
      "url": "{server}/fhir/Patient?name=Smith&_count=20&_offset=20"
    },
    {
      "relation": "last",
      "url": "{server}/fhir/Patient?name=Smith&_count=20&_offset=140"
    }
  ],
  "entry": [
    {
      "fullUrl": "{server}/fhir/Patient/123",
      "resource": { "resourceType": "Patient", "id": "123" },
      "search": { "mode": "match" }
    }
  ]
}
```

---

## 9. Include and RevInclude

### _include

Request related resources to be included in the search results:

```http
GET /fhir/MedicationRequest?patient=123&_include=MedicationRequest:medication
```

**Supported _include Parameters:**

| Base Resource | Include Path | Included Resource |
|---------------|-------------|-------------------|
| MedicationRequest | `MedicationRequest:medication` | Medication |
| MedicationRequest | `MedicationRequest:requester` | Practitioner |
| MedicationRequest | `MedicationRequest:encounter` | Encounter |
| Encounter | `Encounter:participant` | Practitioner |
| Encounter | `Encounter:location` | Location |
| Procedure | `Procedure:performer` | Practitioner |
| DiagnosticReport | `DiagnosticReport:result` | Observation |
| CarePlan | `CarePlan:care-team` | CareTeam |
| CareTeam | `CareTeam:participant` | Practitioner |

### _revinclude

Request resources that reference the matched resources:

```http
GET /fhir/Patient/123?_revinclude=Observation:patient
```

**Supported _revinclude Parameters:**

| Base Resource | RevInclude Path | Referencing Resource |
|---------------|----------------|---------------------|
| Patient | `Observation:patient` | Observation |
| Patient | `Condition:patient` | Condition |
| Patient | `MedicationRequest:patient` | MedicationRequest |
| Patient | `Encounter:patient` | Encounter |
| Patient | `Procedure:patient` | Procedure |
| Patient | `AllergyIntolerance:patient` | AllergyIntolerance |
| Patient | `Immunization:patient` | Immunization |
| Patient | `Provenance:target` | Provenance |
| Encounter | `Condition:encounter` | Condition |
| Encounter | `Observation:encounter` | Observation |

---

## 10. Terminology Services

### Supported Code Systems

| Code System | URI | Usage |
|-------------|-----|-------|
| SNOMED CT | `http://snomed.info/sct` | Conditions, procedures, observations |
| LOINC | `http://loinc.org` | Observations, lab tests, document types |
| RxNorm | `http://www.nlm.nih.gov/research/umls/rxnorm` | Medications |
| ICD-10-CM | `http://hl7.org/fhir/sid/icd-10-cm` | Diagnoses |
| CPT | `http://www.ama-assn.org/go/cpt` | Procedures |
| CVX | `http://hl7.org/fhir/sid/cvx` | Vaccines |
| HCPCS | `http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets` | Procedures and supplies |
| NDF-RT | `http://hl7.org/fhir/ndfrt` | Drug classifications |
| OMB Race | `urn:oid:2.16.840.1.113883.6.238` | Race and ethnicity |
| ISO 639-1 | `urn:ietf:bcp:47` | Preferred language |
| NUCC | `http://nucc.org/provider-taxonomy` | Provider specialties |
| GUDID | `http://hl7.org/fhir/NamingSystem/fda-udi` | Unique device identifiers |

### Supported Value Sets

The FHIR server loads value sets from the US Core STU6 Implementation Guide, including:

- US Core Birth Sex
- US Core Race
- US Core Ethnicity
- OMB Race Categories
- US Core Condition Category Codes
- US Core Observation Category Codes
- US Core DocumentReference Category
- US Core Provenance Participant Type
- Simple Language (BCP 47)
- Detailed Race
- Detailed Ethnicity

### Terminology Operations

- `GET /fhir/ValueSet/$expand?url={valueSetUrl}&filter={text}` -- Expand and search a value set
- `GET /fhir/CodeSystem/$lookup?system={system}&code={code}` -- Look up code details
- `POST /fhir/ConceptMap/$translate` -- Translate between code systems
- `GET /fhir/CodeSystem/$validate-code?system={system}&code={code}` -- Validate a code

### Configuration

Terminology resources are configured in `config/terminology/` and loaded into the FHIR server at startup.
