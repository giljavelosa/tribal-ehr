# USCDI v6 Compliance Assessment
## Tribal EHR Project

**Assessment Date:** 2026-02-06  
**USCDI Version:** v6 (2025)  
**US Core FHIR IG:** 9.0.0

---

## Summary

| Status | Count |
|--------|-------|
| ✅ Compliant | 18 |
| ⚠️ Partial | 5 |
| ❌ Missing | 4 |

**Overall Compliance: ~78%**

---

## Data Class Assessment

### ✅ COMPLIANT (18)

| Data Class | Status | Implementation |
|------------|--------|----------------|
| **Allergies & Intolerances** | ✅ | `allergy_intolerances` table, AllergyIntolerance FHIR |
| **Care Plan** | ✅ | `care_plans` table, CarePlan FHIR |
| **Care Team Members** | ✅ | `care_teams` + `care_team_members` tables |
| **Clinical Notes** | ✅ | `clinical_notes` table, 8+ note types supported |
| **Conditions/Problems** | ✅ | `conditions` table, SNOMED-CT coded |
| **Diagnostic Imaging** | ✅ | Via `orders` table (imaging orders) |
| **Encounters** | ✅ | `encounters` table with type, diagnosis, disposition |
| **Goals** | ✅ | `goals` table |
| **Immunizations** | ✅ | `immunizations` table with lot number |
| **Laboratory** | ✅ | `orders` + `observations` tables, LOINC coded |
| **Medical Devices** | ✅ | `devices` table with UDI support |
| **Medications** | ✅ | `medication_requests` table, RxNorm coded |
| **Observations** | ✅ | `observations` table, multi-category support |
| **Orders** | ✅ | `orders` table (med, lab, imaging, procedure) |
| **Procedures** | ✅ | `procedures` table, CPT/SNOMED coded |
| **Provenance** | ✅ | `provenance` table with author, timestamp, org |
| **Vital Signs** | ✅ | Via observations (category: vital-signs) |
| **Audit Events** | ✅ | `audit_events` table |

---

### ⚠️ PARTIAL COMPLIANCE (5)

| Data Class | Status | Gap |
|------------|--------|-----|
| **Patient Demographics** | ⚠️ | Missing: Tribal Affiliation, Occupation, Interpreter Needed, Previous Address/Name |
| **Health Insurance** | ⚠️ | Has `insurance_coverages` but missing: Payer Identifier (NPI/NCPDP), Coverage Status enum |
| **Health Status Assessments** | ⚠️ | Observations support exists but missing: Structured SDOH assessments, QuestionnaireResponse |
| **Goals & Preferences** | ⚠️ | Has goals but missing: Advance Directives, Treatment Intervention Preference, Care Experience Preference |
| **Clinical Tests** | ⚠️ | Lab/imaging tests exist but missing: Structured clinical test result profiles |

---

### ❌ MISSING (4)

| Data Class | Status | Required Implementation |
|------------|--------|------------------------|
| **Family Health History** | ❌ | Need `family_member_history` table + FamilyMemberHistory FHIR |
| **Facility Information** | ❌ | Need `locations` table with NPI, type, address |
| **Adverse Events** | ❌ | Need `adverse_events` table for clinical intervention side effects |
| **Average Blood Pressure** | ❌ | Need specific observation profile for averaged BP readings |

---

## Detailed Gap Analysis

### 1. Patient Demographics Gaps

**Missing Fields:**
```sql
-- Need to add to patients table:
tribal_affiliation VARCHAR(100)        -- Tribal nation/affiliation
tribal_enrollment_number VARCHAR(50)   -- Tribal enrollment ID
occupation_code VARCHAR(20)            -- ISCO/SOC code
occupation_display VARCHAR(200)        -- Job title
occupation_industry_code VARCHAR(20)   -- NAICS code
occupation_industry_display VARCHAR(200)
interpreter_needed BOOLEAN DEFAULT false
previous_names JSONB                   -- Array of former names
```

**Missing Related Tables:**
- `patient_previous_addresses` (for address history)

### 2. Family Health History (NEW TABLE NEEDED)

```sql
CREATE TABLE family_member_history (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  relationship_code VARCHAR(20),     -- e.g., 'FTH', 'MTH', 'SIB'
  relationship_display VARCHAR(50),
  name VARCHAR(200),
  sex VARCHAR(20),
  born_date DATE,
  deceased_boolean BOOLEAN,
  deceased_date DATE,
  condition_code VARCHAR(20),        -- SNOMED-CT
  condition_display VARCHAR(200),
  condition_onset_age INTEGER,
  condition_outcome_code VARCHAR(20),
  note TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 3. Facility/Location Information (NEW TABLE NEEDED)

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY,
  fhir_id VARCHAR(64),
  status VARCHAR(20),
  name VARCHAR(200) NOT NULL,
  type_code VARCHAR(20),             -- HL7 ServiceDeliveryLocationRoleType
  type_display VARCHAR(100),
  npi VARCHAR(10),                   -- National Provider Identifier
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  postal_code VARCHAR(10),
  country VARCHAR(3) DEFAULT 'US',
  phone VARCHAR(30),
  managing_organization_id UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 4. Advance Directives (NEW TABLE NEEDED)

```sql
CREATE TABLE advance_directives (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  type_code VARCHAR(50),             -- LOINC code
  type_display VARCHAR(200),         -- e.g., 'DNR', 'Living Will', 'POLST'
  status VARCHAR(20),
  document_reference_id UUID,
  custodian_name VARCHAR(200),
  custodian_phone VARCHAR(30),
  verified_date DATE,
  verified_by UUID REFERENCES users(id),
  treatment_intervention_preferences JSONB,
  care_experience_preferences JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 5. Adverse Events (NEW TABLE NEEDED)

```sql
CREATE TABLE adverse_events (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  encounter_id UUID REFERENCES encounters(id),
  event_code VARCHAR(20),
  event_display VARCHAR(200),
  category VARCHAR(50),              -- 'medication-mishap', 'product-problem', etc.
  actuality VARCHAR(20),             -- 'actual' or 'potential'
  date TIMESTAMP,
  detected_date TIMESTAMP,
  recorded_date TIMESTAMP,
  seriousness_code VARCHAR(20),
  outcome_code VARCHAR(20),
  suspect_entity_type VARCHAR(50),   -- Medication, Device, Procedure, etc.
  suspect_entity_id UUID,
  recorder_id UUID REFERENCES users(id),
  contributor_id UUID REFERENCES users(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## SDOH Assessment Gaps

USCDI v6 requires structured SDOH screening using standardized instruments:

| Assessment | LOINC Panel | Status |
|------------|-------------|--------|
| Food Insecurity | 88122-7 (Hunger Vital Sign) | ❌ Missing |
| Housing Instability | 71802-3 | ❌ Missing |
| Transportation | 93030-5 | ❌ Missing |
| Financial Strain | 76513-1 | ❌ Missing |
| Social Isolation | 93667-4 | ❌ Missing |
| Stress | 76542-0 (PSS-4) | ❌ Missing |
| Physical Activity | 77592-4 | ⚠️ Via observations |
| Alcohol Use | 72109-2 (AUDIT-C) | ⚠️ Via observations |
| Substance Use | 82667-7 | ⚠️ Via observations |

**Recommendation:** Create `screening_assessments` table or use QuestionnaireResponse

---

## Recommended Priority Fixes

### High Priority (Certification Impact)
1. **Add Tribal Affiliation** to patient demographics (critical for Tribal EHR!)
2. **Create Family Health History** table and API
3. **Create Locations/Facility** table for facility information
4. **Add Advance Directives** support

### Medium Priority
5. Add Occupation fields to patient demographics
6. Create Adverse Events tracking
7. Add structured SDOH screening assessments
8. Add Average Blood Pressure observation support

### Lower Priority
9. Add previous address tracking
10. Add interpreter needed flag
11. Enhance Coverage with payer NPI

---

## Migration Script Needed

```bash
# Generate new migration
cd ~/tribal-ehr
npx knex migrate:make add_uscdi_v6_elements --knexfile packages/api/knexfile.ts
```

---

## References

- [USCDI v6 Standard](https://www.healthit.gov/isa/uscdi)
- [US Core FHIR IG 9.0.0](https://hl7.org/fhir/us/core/)
- [ONC HTI-1 Certification Requirements](https://www.healthit.gov/topic/certification-ehrs/certification-health-it)
