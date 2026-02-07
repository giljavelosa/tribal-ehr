#!/bin/bash
# ONC Certification Test Suite
# Tests all criteria required for ONC Health IT Certification
# Run this to verify the system meets certification requirements

set -e

echo "=========================================="
echo "  Tribal EHR - ONC Certification Tests"
echo "=========================================="

API_BASE="http://localhost:3001"
FHIR_BASE="http://localhost:8080/fhir"

PASS=0
FAIL=0
SKIP=0

# Helper function
test_endpoint() {
  local description="$1"
  local url="$2"
  local expected_status="$3"

  echo -n "  Testing: $description... "

  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

  if [ "$status" = "$expected_status" ]; then
    echo "PASS (HTTP $status)"
    PASS=$((PASS + 1))
  else
    echo "FAIL (Expected HTTP $expected_status, got $status)"
    FAIL=$((FAIL + 1))
  fi
}

test_json_field() {
  local description="$1"
  local url="$2"
  local field="$3"
  local expected="$4"

  echo -n "  Testing: $description... "

  value=$(curl -s "$url" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('$field',''))" 2>/dev/null || echo "ERROR")

  if [ "$value" = "$expected" ]; then
    echo "PASS"
    PASS=$((PASS + 1))
  else
    echo "FAIL (Expected '$expected', got '$value')"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "--- §170.315(g)(10): Standardized API ---"
echo ""

# FHIR Server Availability
test_endpoint "FHIR Server metadata endpoint" "$FHIR_BASE/metadata" "200"

# FHIR CapabilityStatement
echo -n "  Testing: CapabilityStatement fhirVersion... "
fhir_version=$(curl -s "$FHIR_BASE/metadata" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('fhirVersion',''))" 2>/dev/null || echo "ERROR")
if [ "$fhir_version" = "4.0.1" ]; then
  echo "PASS (R4)"
  PASS=$((PASS + 1))
else
  echo "FAIL (Expected 4.0.1, got $fhir_version)"
  FAIL=$((FAIL + 1))
fi

# Test all USCDI resource types are supported
for resource in Patient Encounter Condition Observation AllergyIntolerance MedicationRequest Procedure Immunization CarePlan CareTeam Goal DocumentReference Device Provenance DiagnosticReport Coverage; do
  test_endpoint "FHIR $resource search" "$FHIR_BASE/$resource?_count=1" "200"
done

echo ""
echo "--- §170.315(g)(7)-(9): SMART on FHIR ---"
echo ""

test_endpoint "SMART configuration endpoint" "$API_BASE/.well-known/smart-configuration" "200"
test_endpoint "OAuth authorize endpoint exists" "$API_BASE/auth/authorize" "400"
test_endpoint "OAuth token endpoint exists" "$API_BASE/auth/token" "400"

echo ""
echo "--- API Health & Infrastructure ---"
echo ""

test_endpoint "API health endpoint" "$API_BASE/health" "200"
test_endpoint "API v1 patients endpoint" "$API_BASE/api/v1/patients" "401"

echo ""
echo "--- §170.315(a)(9): CDS Hooks ---"
echo ""

test_endpoint "CDS Hooks discovery" "$API_BASE/cds-services" "200"

echo ""
echo "--- §170.315(b)(1): Transitions of Care - C-CDA ---"
echo ""

test_endpoint "C-CDA export endpoint exists" "$API_BASE/api/v1/documents/ccda" "401"

echo ""
echo "--- §170.315(d)(1)-(3): Audit Trail ---"
echo ""

test_endpoint "Audit events endpoint" "$API_BASE/api/v1/audit" "401"

echo ""
echo "--- §170.315(g)(10): Bulk FHIR Export ---"
echo ""

# Bulk export requires Prefer: respond-async header per FHIR Bulk Data IG
echo -n "  Testing: Bulk export endpoint... "
bulk_status=$(curl -s -o /dev/null -w "%{http_code}" -H "Prefer: respond-async" -H "Accept: application/fhir+json" "$FHIR_BASE/\$export" 2>/dev/null || echo "000")
if [ "$bulk_status" = "202" ] || [ "$bulk_status" = "200" ]; then
  echo "PASS (HTTP $bulk_status)"
  PASS=$((PASS + 1))
else
  echo "FAIL (Expected HTTP 202 or 200, got $bulk_status)"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "=========================================="
echo "  Results: $PASS passed, $FAIL failed, $SKIP skipped"
echo "=========================================="

if [ $FAIL -gt 0 ]; then
  echo "  STATUS: SOME TESTS FAILED"
  exit 1
else
  echo "  STATUS: ALL TESTS PASSED"
  exit 0
fi
