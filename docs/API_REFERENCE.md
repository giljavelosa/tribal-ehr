# Tribal EHR -- API Reference

**Version:** 1.0
**Last Updated:** 2026-02-05
**Base URL:** `https://api.yourdomain.com`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Common Conventions](#2-common-conventions)
3. [Patients](#3-patients)
4. [Encounters](#4-encounters)
5. [Conditions](#5-conditions)
6. [Observations](#6-observations)
7. [Allergies](#7-allergies)
8. [Medications](#8-medications)
9. [Orders (CPOE)](#9-orders-cpoe)
10. [Procedures](#10-procedures)
11. [Immunizations](#11-immunizations)
12. [Care Plans](#12-care-plans)
13. [Care Teams](#13-care-teams)
14. [Goals](#14-goals)
15. [Documents](#15-documents)
16. [Devices](#16-devices)
17. [Scheduling](#17-scheduling)
18. [Audit](#18-audit)
19. [FHIR Proxy](#19-fhir-proxy)
20. [CDS Hooks](#20-cds-hooks)
21. [Bulk Data Export](#21-bulk-data-export)
22. [Health Check](#22-health-check)
23. [Rate Limiting](#23-rate-limiting)

---

## 1. Authentication

### 1.1 Login

Authenticate a user and obtain a JWT access token.

```http
POST /api/v1/auth/login
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "dr.smith@hospital.org",
  "password": "SecurePassword123!"
}
```

**Response (200 OK) -- MFA not required:**

```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
  "expiresIn": 900,
  "tokenType": "Bearer",
  "user": {
    "id": "usr-a1b2c3d4",
    "email": "dr.smith@hospital.org",
    "role": "physician",
    "name": "Dr. Jane Smith"
  }
}
```

**Response (200 OK) -- MFA required:**

```json
{
  "mfaRequired": true,
  "mfaToken": "mfa-temp-token-xyz",
  "message": "Multi-factor authentication required"
}
```

### 1.2 MFA Verification

Complete multi-factor authentication with a TOTP code.

```http
POST /api/v1/auth/mfa/verify
Content-Type: application/json
```

**Request Body:**

```json
{
  "mfaToken": "mfa-temp-token-xyz",
  "totpCode": "123456"
}
```

**Response (200 OK):**

```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
  "expiresIn": 900,
  "tokenType": "Bearer",
  "user": {
    "id": "usr-a1b2c3d4",
    "email": "dr.smith@hospital.org",
    "role": "physician",
    "name": "Dr. Jane Smith"
  }
}
```

### 1.3 Token Refresh

Obtain a new access token using a refresh token.

```http
POST /api/v1/auth/refresh
Content-Type: application/json
```

**Request Body:**

```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}
```

**Response (200 OK):**

```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

### 1.4 Logout

Invalidate the current session and tokens.

```http
POST /api/v1/auth/logout
Authorization: Bearer {accessToken}
```

**Response (204 No Content)**

### 1.5 Current User

Retrieve the authenticated user's identity.

```http
GET /api/v1/auth/me
Authorization: Bearer {accessToken}
```

**Response (200 OK):**

```json
{
  "id": "usr-a1b2c3d4",
  "email": "dr.smith@hospital.org",
  "role": "physician",
  "name": "Dr. Jane Smith",
  "mfaEnabled": true,
  "lastLogin": "2026-02-05T08:30:00Z"
}
```

### 1.6 OAuth 2.0 Token Endpoint

For SMART on FHIR applications and system-to-system authentication.

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
```

**Authorization Code Grant:**

```
grant_type=authorization_code
&code={authorization_code}
&redirect_uri=https://app.example.com/callback
&client_id=smart-app-123
&code_verifier={pkce_code_verifier}
```

**Client Credentials Grant (Backend Services):**

```
grant_type=client_credentials
&scope=system/*.read
&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
&client_assertion={signed_jwt}
```

**Response (200 OK):**

```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "patient/*.read launch/patient openid fhirUser",
  "patient": "pat-12345",
  "encounter": "enc-67890"
}
```

### 1.7 SMART Discovery

```http
GET /.well-known/smart-configuration
```

Returns the SMART on FHIR configuration document. See [FHIR_CONFORMANCE.md](FHIR_CONFORMANCE.md) for the full response structure.

---

## 2. Common Conventions

### 2.1 Authentication Header

All API endpoints (except `/api/v1/auth/login`, `/health`, and `/.well-known/*`) require a valid Bearer token:

```http
Authorization: Bearer {accessToken}
```

### 2.2 Content Type

All request and response bodies use JSON:

```http
Content-Type: application/json
Accept: application/json
```

### 2.3 Pagination

List endpoints support pagination via query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `limit` | integer | 20 | Items per page (max: 100) |
| `sort` | string | varies | Sort field (e.g., `name`, `-createdAt` for descending) |

**Paginated Response Envelope:**

```json
{
  "data": [ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### 2.4 Error Response Format

All errors follow a consistent format:

```json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "dateOfBirth",
        "message": "Must be a valid date in YYYY-MM-DD format"
      }
    ]
  }
}
```

**Standard Error Codes:**

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `VALIDATION_ERROR` | Request body or query parameter validation failed |
| 400 | `INVALID_REQUEST` | Malformed request |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 401 | `TOKEN_EXPIRED` | Access token has expired |
| 403 | `FORBIDDEN` | Insufficient permissions for this action |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Duplicate resource or version conflict |
| 422 | `UNPROCESSABLE_ENTITY` | Business rule violation |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

### 2.5 Date and Time Format

All dates use ISO 8601 format:

- **Date only**: `2026-02-05`
- **Date and time**: `2026-02-05T14:30:00Z` (UTC)
- **Date range queries**: `startDate=2026-01-01&endDate=2026-02-05`

---

## 3. Patients

### 3.1 List Patients

```http
GET /api/v1/patients
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Search by name (partial match) |
| `mrn` | string | Search by medical record number (exact) |
| `birthdate` | date | Filter by date of birth |
| `gender` | string | Filter by gender (`male`, `female`, `other`, `unknown`) |
| `active` | boolean | Filter by active status |
| `page` | integer | Page number |
| `limit` | integer | Items per page |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "pat-12345",
      "mrn": "MRN-001234",
      "fhirId": "fhir-patient-abc",
      "firstName": "John",
      "lastName": "Doe",
      "dateOfBirth": "1985-03-15",
      "gender": "male",
      "race": "2106-3",
      "ethnicity": "2186-5",
      "preferredLanguage": "en",
      "address": {
        "line": ["123 Main St"],
        "city": "Springfield",
        "state": "IL",
        "postalCode": "62701"
      },
      "telecom": [
        { "system": "phone", "value": "555-0123", "use": "home" },
        { "system": "email", "value": "john.doe@email.com" }
      ],
      "active": true,
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-02-01T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### 3.2 Get Patient by ID

```http
GET /api/v1/patients/:id
Authorization: Bearer {token}
```

**Response (200 OK):** Single patient object (same structure as list item).

### 3.3 Create Patient

```http
POST /api/v1/patients
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "mrn": "MRN-001234",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1985-03-15",
  "gender": "male",
  "race": "2106-3",
  "ethnicity": "2186-5",
  "preferredLanguage": "en",
  "address": {
    "line": ["123 Main St"],
    "city": "Springfield",
    "state": "IL",
    "postalCode": "62701"
  },
  "telecom": [
    { "system": "phone", "value": "555-0123", "use": "home" },
    { "system": "email", "value": "john.doe@email.com" }
  ]
}
```

**Response (201 Created):**

```json
{
  "id": "pat-12345",
  "mrn": "MRN-001234",
  "fhirId": "fhir-patient-abc",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1985-03-15",
  "gender": "male",
  "active": true,
  "createdAt": "2026-02-05T10:00:00Z"
}
```

### 3.4 Update Patient

```http
PUT /api/v1/patients/:id
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:** Same structure as create (partial updates supported).

**Response (200 OK):** Updated patient object.

### 3.5 Delete Patient (Deactivate)

```http
DELETE /api/v1/patients/:id
Authorization: Bearer {token}
```

**Response (204 No Content)**

Soft-deletes the patient by setting `active: false`. PHI is retained per HIPAA retention requirements.

---

## 4. Encounters

### 4.1 List Encounters

```http
GET /api/v1/encounters
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `patientId` | string | Filter by patient |
| `status` | string | Filter by status (`planned`, `in-progress`, `finished`, `cancelled`) |
| `class` | string | Filter by class (`AMB`, `IMP`, `EMER`) |
| `startDate` | date | Period start date (on or after) |
| `endDate` | date | Period end date (on or before) |
| `practitionerId` | string | Filter by practitioner |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "enc-67890",
      "fhirId": "fhir-encounter-xyz",
      "patientId": "pat-12345",
      "practitionerId": "usr-a1b2c3d4",
      "status": "in-progress",
      "class": "AMB",
      "type": "Office Visit",
      "typeCode": "99213",
      "periodStart": "2026-02-05T09:00:00Z",
      "periodEnd": null,
      "reason": "Annual checkup",
      "diagnoses": [],
      "createdAt": "2026-02-05T09:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false }
}
```

### 4.2 Get Encounter by ID

```http
GET /api/v1/encounters/:id
Authorization: Bearer {token}
```

### 4.3 Create Encounter

```http
POST /api/v1/encounters
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "patientId": "pat-12345",
  "class": "AMB",
  "type": "Office Visit",
  "typeCode": "99213",
  "reason": "Annual checkup",
  "practitionerId": "usr-a1b2c3d4"
}
```

**Response (201 Created):** Encounter object with `status: "in-progress"`.

### 4.4 Update Encounter

```http
PUT /api/v1/encounters/:id
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "status": "finished",
  "periodEnd": "2026-02-05T09:45:00Z",
  "diagnoses": [
    {
      "code": "Z00.00",
      "system": "http://hl7.org/fhir/sid/icd-10-cm",
      "display": "Encounter for general adult medical examination without abnormal findings"
    }
  ]
}
```

### 4.5 Delete Encounter

```http
DELETE /api/v1/encounters/:id
Authorization: Bearer {token}
```

**Response (204 No Content)**

---

## 5. Conditions

### 5.1 List Conditions

```http
GET /api/v1/conditions
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `patientId` | string | Filter by patient (required) |
| `category` | string | `problem-list-item`, `encounter-diagnosis`, `health-concern` |
| `clinicalStatus` | string | `active`, `inactive`, `resolved` |
| `encounterId` | string | Filter by encounter |

### 5.2 Get Condition by ID

```http
GET /api/v1/conditions/:id
Authorization: Bearer {token}
```

### 5.3 Create Condition

```http
POST /api/v1/conditions
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "patientId": "pat-12345",
  "encounterId": "enc-67890",
  "category": "problem-list-item",
  "clinicalStatus": "active",
  "verificationStatus": "confirmed",
  "code": {
    "system": "http://snomed.info/sct",
    "code": "44054006",
    "display": "Diabetes mellitus type 2"
  },
  "onsetDate": "2024-06-15"
}
```

**Response (201 Created):** Condition object with FHIR reference.

### 5.4 Update Condition

```http
PUT /api/v1/conditions/:id
Authorization: Bearer {token}
Content-Type: application/json
```

### 5.5 Delete Condition

```http
DELETE /api/v1/conditions/:id
Authorization: Bearer {token}
```

---

## 6. Observations

### 6.1 List Observations

```http
GET /api/v1/observations
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `patientId` | string | Filter by patient (required) |
| `category` | string | `vital-signs`, `laboratory`, `social-history`, `survey` |
| `code` | string | LOINC code (e.g., `8480-6` for systolic BP) |
| `startDate` | date | Effective date range start |
| `endDate` | date | Effective date range end |
| `status` | string | `final`, `preliminary`, `amended` |
| `encounterId` | string | Filter by encounter |

### 6.2 Get Observation by ID

```http
GET /api/v1/observations/:id
Authorization: Bearer {token}
```

### 6.3 Create Observation

```http
POST /api/v1/observations
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body (Vital Signs):**

```json
{
  "patientId": "pat-12345",
  "encounterId": "enc-67890",
  "category": "vital-signs",
  "status": "final",
  "code": {
    "system": "http://loinc.org",
    "code": "85354-9",
    "display": "Blood pressure panel with all children optional"
  },
  "effectiveDate": "2026-02-05T09:15:00Z",
  "components": [
    {
      "code": { "system": "http://loinc.org", "code": "8480-6", "display": "Systolic blood pressure" },
      "value": 120,
      "unit": "mmHg"
    },
    {
      "code": { "system": "http://loinc.org", "code": "8462-4", "display": "Diastolic blood pressure" },
      "value": 80,
      "unit": "mmHg"
    }
  ]
}
```

**Request Body (Lab Result):**

```json
{
  "patientId": "pat-12345",
  "encounterId": "enc-67890",
  "category": "laboratory",
  "status": "final",
  "code": {
    "system": "http://loinc.org",
    "code": "4548-4",
    "display": "Hemoglobin A1c"
  },
  "effectiveDate": "2026-02-05T10:00:00Z",
  "value": 6.5,
  "unit": "%",
  "referenceRange": {
    "low": 4.0,
    "high": 5.6,
    "text": "Normal: < 5.7%"
  },
  "interpretation": "high"
}
```

### 6.4 Update Observation

```http
PUT /api/v1/observations/:id
Authorization: Bearer {token}
Content-Type: application/json
```

### 6.5 Delete Observation

```http
DELETE /api/v1/observations/:id
Authorization: Bearer {token}
```

---

## 7. Allergies

### 7.1 List Allergies

```http
GET /api/v1/allergies
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `patientId` | string | Filter by patient (required) |
| `clinicalStatus` | string | `active`, `inactive`, `resolved` |
| `type` | string | `allergy`, `intolerance` |
| `category` | string | `food`, `medication`, `environment`, `biologic` |
| `criticality` | string | `low`, `high`, `unable-to-assess` |

### 7.2 Get Allergy by ID

```http
GET /api/v1/allergies/:id
Authorization: Bearer {token}
```

### 7.3 Create Allergy

```http
POST /api/v1/allergies
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "patientId": "pat-12345",
  "clinicalStatus": "active",
  "type": "allergy",
  "category": "medication",
  "criticality": "high",
  "code": {
    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
    "code": "7980",
    "display": "Penicillin"
  },
  "reactions": [
    {
      "substance": { "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "7980", "display": "Penicillin" },
      "manifestation": { "system": "http://snomed.info/sct", "code": "39579001", "display": "Anaphylaxis" },
      "severity": "severe"
    }
  ],
  "onsetDate": "2020-01-15"
}
```

### 7.4 Update Allergy

```http
PUT /api/v1/allergies/:id
Authorization: Bearer {token}
Content-Type: application/json
```

### 7.5 Delete Allergy

```http
DELETE /api/v1/allergies/:id
Authorization: Bearer {token}
```

---

## 8. Medications

### 8.1 List Medications

```http
GET /api/v1/medications
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `patientId` | string | Filter by patient (required) |
| `status` | string | `active`, `completed`, `cancelled`, `stopped` |
| `intent` | string | `order`, `plan`, `proposal` |

### 8.2 Get Medication by ID

```http
GET /api/v1/medications/:id
Authorization: Bearer {token}
```

### 8.3 Create Medication Request

```http
POST /api/v1/medications
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "patientId": "pat-12345",
  "encounterId": "enc-67890",
  "status": "active",
  "intent": "order",
  "medication": {
    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
    "code": "860975",
    "display": "Metformin 500 MG Oral Tablet"
  },
  "dosageInstruction": {
    "text": "Take 1 tablet by mouth twice daily with meals",
    "timing": { "frequency": 2, "period": 1, "periodUnit": "d" },
    "route": { "system": "http://snomed.info/sct", "code": "26643006", "display": "Oral route" },
    "doseQuantity": { "value": 500, "unit": "mg" }
  },
  "dispenseQuantity": "60",
  "refills": 3
}
```

### 8.4 Update Medication

```http
PUT /api/v1/medications/:id
Authorization: Bearer {token}
Content-Type: application/json
```

### 8.5 Delete (Discontinue) Medication

```http
DELETE /api/v1/medications/:id
Authorization: Bearer {token}
```

Sets the medication status to `stopped`.

---

## 9. Orders (CPOE)

### 9.1 Create Medication Order

```http
POST /api/v1/orders/medications
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "patientId": "pat-12345",
  "encounterId": "enc-67890",
  "medication": {
    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
    "code": "860975",
    "display": "Metformin 500 MG Oral Tablet"
  },
  "dosageInstruction": {
    "text": "Take 1 tablet by mouth twice daily",
    "timing": { "frequency": 2, "period": 1, "periodUnit": "d" },
    "doseQuantity": { "value": 500, "unit": "mg" }
  },
  "priority": "routine"
}
```

**Response (201 Created):**

```json
{
  "id": "ord-001",
  "orderType": "medication",
  "status": "pending",
  "patientId": "pat-12345",
  "cdsCards": [
    {
      "summary": "Drug Interaction Warning",
      "indicator": "warning",
      "detail": "Potential interaction between Metformin and current medication.",
      "source": { "label": "Tribal EHR CDS" }
    }
  ],
  "createdAt": "2026-02-05T10:00:00Z"
}
```

### 9.2 Sign Medication Order

```http
POST /api/v1/orders/medications/:id/sign
Authorization: Bearer {token}
```

Signs the order, triggering CDS `order-sign` hook and pharmacy transmission via HL7v2.

**Response (200 OK):**

```json
{
  "id": "ord-001",
  "status": "active",
  "signedAt": "2026-02-05T10:01:00Z",
  "signedBy": "usr-a1b2c3d4"
}
```

### 9.3 Create Lab Order

```http
POST /api/v1/orders/labs
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "patientId": "pat-12345",
  "encounterId": "enc-67890",
  "tests": [
    {
      "code": { "system": "http://loinc.org", "code": "4548-4", "display": "Hemoglobin A1c" },
      "priority": "routine"
    },
    {
      "code": { "system": "http://loinc.org", "code": "2345-7", "display": "Glucose" },
      "priority": "routine"
    }
  ],
  "clinicalIndication": "Diabetes management",
  "specimenType": "blood",
  "priority": "routine"
}
```

### 9.4 Create Imaging Order

```http
POST /api/v1/orders/imaging
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "patientId": "pat-12345",
  "encounterId": "enc-67890",
  "study": {
    "code": { "system": "http://loinc.org", "code": "36643-5", "display": "Chest X-ray 2 views" },
    "modality": "XR",
    "bodyPart": "Chest"
  },
  "clinicalIndication": "Cough for 3 weeks",
  "priority": "routine"
}
```

### 9.5 List Orders

```http
GET /api/v1/orders
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `patientId` | string | Filter by patient |
| `orderType` | string | `medication`, `lab`, `imaging` |
| `status` | string | `pending`, `active`, `completed`, `cancelled` |
| `priority` | string | `routine`, `urgent`, `stat` |
| `startDate` | date | Orders placed after this date |
| `endDate` | date | Orders placed before this date |

### 9.6 Get Order by ID

```http
GET /api/v1/orders/:id
Authorization: Bearer {token}
```

### 9.7 Cancel Order

```http
DELETE /api/v1/orders/:id
Authorization: Bearer {token}
```

---

## 10. Procedures

### 10.1 List Procedures

```http
GET /api/v1/procedures
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `patientId` | string | Filter by patient (required) |
| `status` | string | `preparation`, `in-progress`, `completed`, `not-done` |
| `code` | string | Procedure code (SNOMED CT, CPT) |
| `startDate` | date | Performed date range start |
| `endDate` | date | Performed date range end |

### 10.2 Create Procedure

```http
POST /api/v1/procedures
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "patientId": "pat-12345",
  "encounterId": "enc-67890",
  "status": "completed",
  "code": {
    "system": "http://snomed.info/sct",
    "code": "80146002",
    "display": "Appendectomy"
  },
  "performedDate": "2026-02-05T11:00:00Z",
  "performerId": "usr-a1b2c3d4",
  "note": "Uncomplicated laparoscopic appendectomy"
}
```

### 10.3 Get, Update, Delete

Standard REST operations following the same pattern as other resources.

---

## 11. Immunizations

### 11.1 List Immunizations

```http
GET /api/v1/immunizations
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `patientId` | string | Filter by patient (required) |
| `status` | string | `completed`, `entered-in-error`, `not-done` |
| `vaccineCode` | string | CVX vaccine code |
| `startDate` | date | Administration date range start |
| `endDate` | date | Administration date range end |

### 11.2 Create Immunization

```http
POST /api/v1/immunizations
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "patientId": "pat-12345",
  "status": "completed",
  "vaccineCode": {
    "system": "http://hl7.org/fhir/sid/cvx",
    "code": "208",
    "display": "SARS-COV-2 (COVID-19) vaccine, mRNA, spike protein, LNP, preservative free, 30 mcg/0.3mL dose"
  },
  "occurrenceDate": "2026-02-05T10:30:00Z",
  "lotNumber": "EW0150",
  "expirationDate": "2026-06-30",
  "site": { "system": "http://snomed.info/sct", "code": "368209003", "display": "Right arm" },
  "route": { "system": "http://snomed.info/sct", "code": "78421000", "display": "Intramuscular route" },
  "performer": "usr-a1b2c3d4"
}
```

### 11.3 Transmit to Immunization Registry

```http
POST /api/v1/immunizations/:id/transmit
Authorization: Bearer {token}
```

Triggers VXU^V04 HL7v2 message transmission to the configured immunization information system (IIS).

**Response (200 OK):**

```json
{
  "transmissionId": "tx-001",
  "status": "sent",
  "hl7MessageId": "MSG-VXU-001",
  "sentAt": "2026-02-05T10:31:00Z"
}
```

---

## 12. Care Plans

### 12.1 List Care Plans

```http
GET /api/v1/care-plans
Authorization: Bearer {token}
```

**Query Parameters:** `patientId` (required), `status`, `category`

### 12.2 Create Care Plan

```http
POST /api/v1/care-plans
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "patientId": "pat-12345",
  "status": "active",
  "intent": "plan",
  "title": "Diabetes Management Plan",
  "description": "Comprehensive diabetes management including medication, diet, and exercise",
  "periodStart": "2026-02-05",
  "periodEnd": "2026-08-05",
  "activities": [
    { "detail": "Monitor blood glucose twice daily" },
    { "detail": "Metformin 500mg twice daily" },
    { "detail": "Dietary counseling referral" },
    { "detail": "HbA1c every 3 months" }
  ]
}
```

### 12.3 Get, Update, Delete

Standard REST operations.

---

## 13. Care Teams

### 13.1 List Care Teams

```http
GET /api/v1/care-teams
Authorization: Bearer {token}
```

**Query Parameters:** `patientId` (required), `status`

### 13.2 Create Care Team

```http
POST /api/v1/care-teams
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "patientId": "pat-12345",
  "status": "active",
  "name": "Diabetes Care Team",
  "participants": [
    { "memberId": "usr-a1b2c3d4", "role": "Primary Care Physician" },
    { "memberId": "usr-e5f6g7h8", "role": "Endocrinologist" },
    { "memberId": "usr-i9j0k1l2", "role": "Dietitian" }
  ]
}
```

### 13.3 Get, Update, Delete

Standard REST operations.

---

## 14. Goals

### 14.1 List Goals

```http
GET /api/v1/goals
Authorization: Bearer {token}
```

**Query Parameters:** `patientId` (required), `lifecycleStatus`

### 14.2 Create Goal

```http
POST /api/v1/goals
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "patientId": "pat-12345",
  "lifecycleStatus": "active",
  "achievementStatus": "in-progress",
  "description": {
    "text": "HbA1c below 7.0%"
  },
  "startDate": "2026-02-05",
  "targetDate": "2026-08-05"
}
```

### 14.3 Get, Update, Delete

Standard REST operations.

---

## 15. Documents

### 15.1 List Documents

```http
GET /api/v1/documents
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `patientId` | string | Filter by patient (required) |
| `type` | string | Document type (`ccd`, `discharge`, `referral`, `progress-note`) |
| `status` | string | Document status (`current`, `superseded`) |
| `startDate` | date | Date range start |
| `endDate` | date | Date range end |

### 15.2 Create C-CDA Document

```http
POST /api/v1/documents/ccda/create
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "patientId": "pat-12345",
  "type": "ccd",
  "encounterId": "enc-67890",
  "sections": ["allergies", "medications", "problems", "procedures", "results", "vitals", "immunizations", "care-team", "goals"]
}
```

**Response (201 Created):**

```json
{
  "id": "doc-001",
  "type": "ccd",
  "format": "application/hl7-v3+xml",
  "status": "current",
  "downloadUrl": "/api/v1/documents/doc-001/download",
  "createdAt": "2026-02-05T10:00:00Z"
}
```

### 15.3 Import C-CDA Document

```http
POST /api/v1/documents/ccda/import
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Form Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `file` | file | C-CDA XML document |
| `patientId` | string | Target patient (optional; auto-matched from C-CDA) |

**Response (200 OK):**

```json
{
  "id": "doc-import-001",
  "status": "parsed",
  "matchedPatient": "pat-12345",
  "sections": {
    "allergies": 3,
    "medications": 5,
    "problems": 8,
    "procedures": 2,
    "results": 12,
    "immunizations": 6
  },
  "reconciliationUrl": "/api/v1/documents/ccda/doc-import-001/reconcile"
}
```

### 15.4 Download Document

```http
GET /api/v1/documents/:id/download
Authorization: Bearer {token}
```

Returns the raw document file with appropriate `Content-Type` header.

---

## 16. Devices

### 16.1 List Patient Devices

```http
GET /api/v1/patients/:patientId/devices
Authorization: Bearer {token}
```

### 16.2 Add Implantable Device

```http
POST /api/v1/patients/:patientId/devices
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "udi": "(01)00844588003288(17)141120(10)7654321D(21)10987654d321",
  "deviceName": "Pacemaker Model ABC",
  "type": "Cardiac Pacemaker",
  "manufacturer": "MedDevice Corp",
  "manufactureDate": "2024-01-15",
  "expirationDate": "2034-01-15",
  "lotNumber": "7654321D",
  "serialNumber": "10987654d321",
  "status": "active"
}
```

### 16.3 Parse UDI

```http
POST /api/v1/devices/parse-udi
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "udiString": "(01)00844588003288(17)141120(10)7654321D(21)10987654d321"
}
```

**Response (200 OK):**

```json
{
  "deviceIdentifier": "00844588003288",
  "manufactureDate": "2014-11-20",
  "lotNumber": "7654321D",
  "serialNumber": "10987654d321"
}
```

### 16.4 Get, Update, Delete

Standard REST operations.

---

## 17. Scheduling

### 17.1 List Appointments

```http
GET /api/v1/scheduling
Authorization: Bearer {token}
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `patientId` | string | Filter by patient |
| `practitionerId` | string | Filter by practitioner |
| `status` | string | `proposed`, `booked`, `arrived`, `fulfilled`, `cancelled`, `noshow` |
| `startDate` | date | Appointments starting on or after |
| `endDate` | date | Appointments starting on or before |
| `appointmentType` | string | Appointment type |

### 17.2 Create Appointment

```http
POST /api/v1/scheduling
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "patientId": "pat-12345",
  "practitionerId": "usr-a1b2c3d4",
  "status": "booked",
  "appointmentType": "Follow-up",
  "startTime": "2026-02-10T14:00:00Z",
  "endTime": "2026-02-10T14:30:00Z",
  "reason": "Diabetes follow-up",
  "note": "Patient requested afternoon appointment"
}
```

### 17.3 Get, Update, Delete

Standard REST operations.

---

## 18. Audit

### 18.1 Query Audit Events

```http
GET /api/v1/audit/events
Authorization: Bearer {token}
```

**Required Role:** `admin`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | datetime | Events recorded on or after (required) |
| `endDate` | datetime | Events recorded on or before (required) |
| `userId` | string | Filter by user |
| `patientId` | string | Filter by patient accessed |
| `action` | string | `create`, `read`, `update`, `delete`, `export`, `print` |
| `resourceType` | string | Resource type accessed |
| `outcome` | string | `success`, `failure` |
| `sort` | string | Sort field (default: `-recorded`) |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "audit-001",
      "eventType": "rest",
      "action": "read",
      "userId": "usr-a1b2c3d4",
      "userRole": "physician",
      "patientId": "pat-12345",
      "resourceType": "Patient",
      "resourceId": "pat-12345",
      "detail": { "method": "GET", "path": "/api/v1/patients/pat-12345" },
      "outcome": "success",
      "recorded": "2026-02-05T10:00:00Z",
      "eventHash": "a3f2b1c4d5e6..."
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 1200, "totalPages": 24, "hasNextPage": true, "hasPreviousPage": false }
}
```

### 18.2 Get Audit Event by ID

```http
GET /api/v1/audit/events/:id
Authorization: Bearer {token}
```

### 18.3 Generate Audit Report

```http
GET /api/v1/audit/reports
Authorization: Bearer {token}
```

**Query Parameters:** Same as audit events query, plus:

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | `json` (default), `csv`, `pdf` |

### 18.4 Verify Audit Chain Integrity

```http
GET /api/v1/audit/verify
Authorization: Bearer {token}
```

**Response (200 OK):**

```json
{
  "status": "valid",
  "totalEvents": 45230,
  "verifiedAt": "2026-02-05T10:00:00Z",
  "chainStart": "2026-01-01T00:00:00Z",
  "chainEnd": "2026-02-05T09:59:59Z",
  "brokenLinks": 0
}
```

---

## 19. FHIR Proxy

The API server proxies FHIR requests to the HAPI FHIR backend, adding authentication and audit logging.

### 19.1 FHIR Resource Access

All standard FHIR REST interactions are available through the proxy:

```http
GET /fhir/{ResourceType}
GET /fhir/{ResourceType}/{id}
GET /fhir/{ResourceType}/{id}/_history
GET /fhir/{ResourceType}/{id}/_history/{vid}
POST /fhir/{ResourceType}
PUT /fhir/{ResourceType}/{id}
DELETE /fhir/{ResourceType}/{id}
```

### 19.2 FHIR Search

```http
GET /fhir/Patient?name=Smith&birthdate=1985-03-15
Authorization: Bearer {token}
Accept: application/fhir+json
```

### 19.3 FHIR Operations

```http
GET /fhir/Patient/{id}/$everything
POST /fhir/Patient/$validate
GET /fhir/ValueSet/$expand?url={valueSetUrl}
GET /fhir/metadata
```

### 19.4 FHIR CapabilityStatement

```http
GET /fhir/metadata
```

No authentication required. Returns the full FHIR CapabilityStatement. See [FHIR_CONFORMANCE.md](FHIR_CONFORMANCE.md) for details.

---

## 20. CDS Hooks

### 20.1 Service Discovery

```http
GET /api/v1/cds-services
Authorization: Bearer {token}
```

**Response (200 OK):**

```json
{
  "services": [
    {
      "hook": "patient-view",
      "title": "Preventive Care Reminders",
      "description": "Displays preventive care reminders based on age, gender, and clinical history",
      "id": "preventive-care",
      "prefetch": {
        "patient": "Patient/{{context.patientId}}",
        "conditions": "Condition?patient={{context.patientId}}&clinical-status=active",
        "immunizations": "Immunization?patient={{context.patientId}}"
      }
    },
    {
      "hook": "order-select",
      "title": "Medication Safety Check",
      "description": "Checks for drug-drug interactions and medication-allergy conflicts",
      "id": "medication-safety",
      "prefetch": {
        "patient": "Patient/{{context.patientId}}",
        "medications": "MedicationRequest?patient={{context.patientId}}&status=active",
        "allergies": "AllergyIntolerance?patient={{context.patientId}}&clinical-status=active"
      }
    },
    {
      "hook": "order-sign",
      "title": "Order Validation",
      "description": "Final safety checks before order signing",
      "id": "order-validation",
      "prefetch": {
        "patient": "Patient/{{context.patientId}}"
      }
    }
  ]
}
```

### 20.2 Invoke CDS Hook

```http
POST /api/v1/cds-services/{serviceId}
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "hookInstance": "d1577c69-dfbe-44ad-ba6d-3e05e953b2ea",
  "hook": "order-select",
  "context": {
    "userId": "Practitioner/usr-a1b2c3d4",
    "patientId": "pat-12345",
    "encounterId": "enc-67890",
    "selections": ["MedicationRequest/draft-001"],
    "draftOrders": {
      "resourceType": "Bundle",
      "entry": [
        {
          "resource": {
            "resourceType": "MedicationRequest",
            "id": "draft-001",
            "status": "draft",
            "intent": "order",
            "medicationCodeableConcept": {
              "coding": [{ "system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "860975", "display": "Metformin 500 MG" }]
            },
            "subject": { "reference": "Patient/pat-12345" }
          }
        }
      ]
    }
  },
  "prefetch": {
    "patient": { "resourceType": "Patient", "id": "pat-12345" },
    "medications": { "resourceType": "Bundle", "entry": [] },
    "allergies": { "resourceType": "Bundle", "entry": [] }
  }
}
```

**Response (200 OK):**

```json
{
  "cards": [
    {
      "uuid": "card-001",
      "summary": "No drug interactions detected",
      "indicator": "info",
      "detail": "Metformin 500 MG does not interact with current medications.",
      "source": {
        "label": "Tribal EHR CDS",
        "url": "https://ehr.yourdomain.com/cds"
      }
    }
  ]
}
```

---

## 21. Bulk Data Export

### 21.1 Initiate Export

```http
GET /fhir/$export
Authorization: Bearer {token}
Accept: application/fhir+json
Prefer: respond-async
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `_outputFormat` | string | `application/fhir+ndjson` (default) |
| `_since` | instant | Only resources modified after this date |
| `_type` | string | Comma-separated resource types |

**Response (202 Accepted):**

```http
HTTP/1.1 202 Accepted
Content-Location: /fhir/bulk-status/job-abc123
```

### 21.2 Check Export Status

```http
GET /fhir/bulk-status/job-abc123
Authorization: Bearer {token}
```

See [FHIR_CONFORMANCE.md](FHIR_CONFORMANCE.md) for full Bulk Data Access documentation.

### 21.3 Delete Export Job

```http
DELETE /fhir/bulk-status/job-abc123
Authorization: Bearer {token}
```

---

## 22. Health Check

### 22.1 API Health

```http
GET /health
```

No authentication required.

**Response (200 OK):**

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-02-05T10:00:00Z",
  "services": {
    "database": { "status": "connected", "latency": "2ms" },
    "redis": { "status": "connected", "latency": "1ms" },
    "rabbitmq": { "status": "connected", "latency": "3ms" },
    "fhir": { "status": "connected", "latency": "15ms" }
  }
}
```

**Response (503 Service Unavailable) -- Degraded:**

```json
{
  "status": "unhealthy",
  "version": "1.0.0",
  "timestamp": "2026-02-05T10:00:00Z",
  "services": {
    "database": { "status": "connected", "latency": "2ms" },
    "redis": { "status": "disconnected", "error": "Connection refused" },
    "rabbitmq": { "status": "connected", "latency": "3ms" },
    "fhir": { "status": "connected", "latency": "15ms" }
  }
}
```

---

## 23. Rate Limiting

### Default Limits

| Endpoint Category | Window | Max Requests | Notes |
|-------------------|--------|-------------|-------|
| Authentication (`/api/v1/auth/*`) | 15 minutes | 20 | Prevent brute force |
| FHIR Read (`GET /fhir/*`) | 1 minute | 300 | Per authenticated user |
| FHIR Write (`POST/PUT/DELETE /fhir/*`) | 1 minute | 60 | Per authenticated user |
| API Read (`GET /api/v1/*`) | 1 minute | 200 | Per authenticated user |
| API Write (`POST/PUT/DELETE /api/v1/*`) | 1 minute | 100 | Per authenticated user |
| Bulk Export (`/fhir/$export`) | 1 hour | 5 | Resource-intensive operation |
| CDS Hooks (`/api/v1/cds-services/*`) | 1 minute | 100 | Per authenticated user |

### Rate Limit Headers

All responses include rate limit headers:

```http
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 195
X-RateLimit-Reset: 1738749660
Retry-After: 60
```

### Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
Content-Type: application/json
```

```json
{
  "error": {
    "status": 429,
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please retry after 45 seconds.",
    "retryAfter": 45
  }
}
```
