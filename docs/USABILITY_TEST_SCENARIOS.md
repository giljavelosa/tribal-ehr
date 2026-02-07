# Summative Usability Test Scenarios -- Tribal EHR

**Document Purpose:** Task-based scenarios for summative (validation) usability testing of the Tribal EHR system, covering each Safety-Enhanced Design (SED) referenced certification criterion under ONC HTI-1 (45 CFR 170.315).

**Test Environment:** Tribal EHR React frontend running at `http://localhost:5173` with seeded test data. Participants use a desktop browser (Chrome or Edge, latest stable release). Screen and audio recording is active. A facilitator reads each scenario aloud; the participant performs the task without coaching.

**Global Metrics Captured for Every Scenario:**

| Metric | Method |
|---|---|
| Task Success (Pass / Fail / Partial) | Facilitator observation |
| Time on Task (seconds) | Stopwatch from first click to final confirmation |
| Number of Errors | Count of incorrect clicks, wrong fields, or mis-selections |
| Path Deviations | Steps taken beyond the optimal path |
| Participant Satisfaction (1-5) | Post-task Likert rating |
| Severity of Failures | 0 = cosmetic, 1 = minor, 2 = major, 3 = catastrophic |

---

## Scenario 1 -- CPOE: Medications (a)(1)

**Criterion:** 170.315(a)(1) -- Computerized Provider Order Entry -- Medications

**Prerequisites:**
- Logged in as: `dr.chen` / `Test1234!` (role: Physician)
- Patient chart open for: Maria Garcia (DOB 1985-03-15, MRN TRB-10042)
- Patient has at least one active medication (Lisinopril 10 mg oral daily)

**Steps:**

1. From the patient chart, click the **Meds** tab.
2. Verify the active medication list loads and displays Lisinopril 10 mg.
3. Click the **Prescribe** button in the card header.
4. In the Prescribe Medication dialog, enter Medication Name: `Metformin`.
5. Enter Dose: `500mg`.
6. Select Route: `Oral` from the dropdown.
7. Enter Frequency / SIG: `Take 1 tablet twice daily with meals`.
8. Optionally enter Notes: `Start low dose, titrate as needed`.
9. Click **Check Interactions** and wait for CDS response.
10. If no critical alerts appear, click **Submit Order**.
11. Verify the new medication appears in the active medication list.
12. Click the Lisinopril row to open its detail view. Click the status action to change dose to 20 mg (modify).
13. Navigate back to the Meds tab. Use the Reconciliation dialog to discontinue Metformin by clicking **Discontinue** next to it.
14. Confirm the medication status updates to `stopped`.

**Expected Outcomes:**
- Step 3: Dialog opens with empty fields; Route defaults to Oral.
- Step 9: CDS cards area renders below the form if interactions exist; otherwise remains empty.
- Step 10: Dialog closes, toast or table refresh shows Metformin as active.
- Step 14: Metformin row shows status badge `stopped` in the table.

**Severity Rating:** 3 (catastrophic) -- incorrect medication entry or failure to record discontinuation is a patient safety event.

---

## Scenario 2 -- CPOE: Laboratory (a)(2)

**Criterion:** 170.315(a)(2) -- Computerized Provider Order Entry -- Laboratory

**Prerequisites:**
- Logged in as: `dr.chen` / `Test1234!`
- Patient chart open for: James Whitefeather (DOB 1972-08-22, MRN TRB-10015)

**Steps:**

1. From the patient chart, click the **Orders** tab.
2. Verify the orders table loads with column headers: Date, Type, Description, Priority, Status, Provider.
3. Click the **New Order** button.
4. In the New Order dialog, select Order Type: `Laboratory`.
5. Verify the Description placeholder changes to `e.g., CBC with Differential`.
6. Enter Description: `CBC with Differential`.
7. Select Priority: `Routine`.
8. Enter Clinical Notes: `Annual wellness screening labs`.
9. Click **Place Order**.
10. Verify the dialog closes and the new order appears in the table with Type badge `Lab`, Status `active`, and Priority `routine`.
11. Filter orders by Type dropdown to `Lab` only.
12. Verify only laboratory orders are displayed.
13. Click the newly created CBC order row to open the Order Detail dialog.
14. Verify all fields (Type, Status, Priority, Order Date, Ordering Provider, Notes) are displayed correctly.

**Expected Outcomes:**
- Step 4: Order Type dropdown shows options: Medication, Laboratory, Imaging, Referral, Procedure.
- Step 9: Submit button is disabled until Description is non-empty.
- Step 10: New CBC order visible in table with purple Lab badge.
- Step 12: Filter correctly hides non-laboratory orders.

**Severity Rating:** 2 (major) -- failure to place or view lab orders delays diagnostic workflows.

---

## Scenario 3 -- CPOE: Diagnostic Imaging (a)(3)

**Criterion:** 170.315(a)(3) -- Computerized Provider Order Entry -- Diagnostic Imaging

**Prerequisites:**
- Logged in as: `dr.chen` / `Test1234!`
- Patient chart open for: Sarah Runningdeer (DOB 1990-11-03, MRN TRB-10028)
- Patient has an active problem: Chronic Cough

**Steps:**

1. From the patient chart, click the **Orders** tab.
2. Click **New Order**.
3. Select Order Type: `Imaging`.
4. Verify the Description placeholder changes to `e.g., Chest X-Ray PA/Lateral`.
5. Enter Description: `Chest X-Ray PA and Lateral`.
6. Select Priority: `Urgent`.
7. Enter Clinical Notes: `Persistent cough x 6 weeks, rule out pneumonia. Hx of smoking.`
8. Click **Place Order**.
9. Verify the dialog closes and the imaging order appears with an amber Imaging badge, `urgent` priority badge (secondary variant), and `active` status.
10. Click the order row and verify the detail dialog shows the clinical notes.

**Expected Outcomes:**
- Step 3: Imaging option is available and selectable.
- Step 6: Priority dropdown offers Routine, Urgent, ASAP, STAT.
- Step 9: Imaging type badge renders with amber color and FileImage icon.
- Step 10: Notes section in detail dialog shows the full clinical indication text.

**Severity Rating:** 2 (major) -- missing clinical indication on imaging orders can cause order rejection or patient safety issues.

---

## Scenario 4 -- Drug-Drug and Drug-Allergy Interaction Checks (a)(4)

**Criterion:** 170.315(a)(4) -- Drug-Drug, Drug-Allergy Interaction Checks

**Prerequisites:**
- Logged in as: `dr.chen` / `Test1234!`
- Patient chart open for: Maria Garcia (DOB 1985-03-15, MRN TRB-10042)
- Patient has documented allergy: Penicillin (category: Medication, criticality: High)
- Patient has active medication: Lisinopril 10 mg oral daily
- CDS service is running and configured with drug interaction rules

**Steps:**

1. Click the **Meds** tab.
2. Verify the PatientBanner at the top of the chart displays the Penicillin allergy.
3. Click **Prescribe**.
4. Enter Medication Name: `Amoxicillin` (a penicillin-class antibiotic).
5. Enter Dose: `500mg`, Route: `Oral`, Frequency: `Every 8 hours for 10 days`.
6. Click **Check Interactions**.
7. Verify a CDS card appears with indicator `critical` (red border, red background) displaying a drug-allergy alert for Penicillin cross-reactivity.
8. Verify the **Submit Order** button is disabled while a critical CDS card is unresolved.
9. Click the **Override** button on the critical CDS card.
10. In the CDS Override Dialog, verify the alert summary is shown.
11. Select Override Reason: `Clinical judgment -- benefits outweigh risks`.
12. Enter Additional Justification: `Patient tolerates cephalosporins; amoxicillin challenge planned under observation`.
13. Click **Confirm Override** (destructive red button).
14. Verify the critical card is removed from the CDS cards area.
15. Verify the **Submit Order** button is now enabled.
16. Click **Submit Order** and verify the medication is recorded.

**Expected Outcomes:**
- Step 7: CdsCardList renders critical card sorted to top, with source attribution and severity badge.
- Step 8: Submit button remains disabled (`cdsCards.some(c => c.indicator === 'critical')` evaluates true).
- Step 13: Override dialog closes; override is recorded via `useCdsOverride` mutation.
- Step 15: With no remaining critical cards, submission is unblocked.

**Severity Rating:** 3 (catastrophic) -- failure to display or enforce drug-allergy checks is a direct patient safety hazard.

---

## Scenario 5 -- Demographics Recording (a)(5)

**Criterion:** 170.315(a)(5) -- Demographics (USCDI v3)

**Prerequisites:**
- Logged in as: `front.desk` / `Test1234!` (role: Registration Clerk)
- Starting from the Patient List page (`/patients`)

**Steps:**

1. Click the **Register New Patient** button to navigate to `/patients/register`.
2. Verify the 5-step registration wizard loads with step indicator showing: Demographics, Contact Info, Emergency Contacts, Insurance, Consent & Review.
3. **Step 1 -- Demographics:**
   - Enter First Name: `Thomas`, Middle Name: `Ray`, Last Name: `Clearwater`.
   - Enter Date of Birth: `1988-06-14`.
   - Select Gender: `Male`.
   - Select Sex at Birth: `Male`.
   - Select Gender Identity: `Identifies as Male`.
   - Select Sexual Orientation: `Straight (Heterosexual)`.
   - Select Race: `American Indian or Alaska Native`.
   - Select Ethnicity: `Not Hispanic or Latino`.
   - Select Preferred Language: `English`.
   - Select Marital Status: `Married`.
   - Enter SSN: `555-12-3456`.
4. Click **Next**. Verify validation passes and step 2 loads.
5. **Step 2 -- Contact Info:**
   - Enter Address Line 1: `1420 Cedar Ridge Road`.
   - Enter City: `Pine Ridge`, State: `SD`, ZIP: `57770`.
   - Enter Phone: `(605) 555-0198`.
   - Enter Email: `t.clearwater@email.com`.
6. Click **Next**.
7. **Step 3 -- Emergency Contacts:**
   - Primary: Name: `Anna Clearwater`, Phone: `(605) 555-0199`, Relationship: `Spouse`.
8. Click **Next**.
9. **Step 4 -- Insurance:** Enter Insurance Plan: `IHS Direct Care`, Member ID: `IHS-884721`. Click **Next**.
10. **Step 5 -- Consent & Review:**
    - Verify the review panel displays all entered data accurately including Gender Identity, Sexual Orientation, Race, and Ethnicity.
    - Check the **Consent to Treatment** checkbox.
    - Click **Register Patient**.
11. Verify redirect to the new patient's chart page.

**Expected Outcomes:**
- Step 3: Gender Identity dropdown includes SNOMED-coded options (Male, Female, Non-binary, Transgender Male FTM, Transgender Female MTF, Other, Declined).
- Step 3: Sexual Orientation dropdown includes SNOMED-coded options (Heterosexual, Homosexual, Bisexual, Other, Declined, Unknown).
- Step 3: Race dropdown includes all OMB categories plus "Declined to specify".
- Step 4: Validation prevents advancing without required fields (First Name, Last Name, DOB, Gender, Sex).
- Step 10: Review section shows all USCDI v3 demographic data elements.
- Step 11: Patient is created with correct FHIR-mapped coding (e.g., Race code `1002-5` for American Indian).

**Severity Rating:** 2 (major) -- failure to capture USCDI v3 demographics blocks certification; incorrect coding causes downstream data quality issues.

---

## Scenario 6 -- Clinical Decision Support (a)(9)

**Criterion:** 170.315(a)(9) -- Clinical Decision Support

**Prerequisites:**
- Logged in as: `dr.chen` / `Test1234!`
- Patient chart open for: Robert Eaglebear (DOB 1958-04-30, MRN TRB-10003)
- Patient is 67 years old with active problem: Type 2 Diabetes
- CDS service configured with patient-view hook rules (e.g., A1C screening reminder, preventive care)

**Steps:**

1. Open the patient chart for Robert Eaglebear.
2. Verify the **Summary** tab loads by default.
3. In the Summary tab, locate the **Clinical Decision Support** card spanning full width at the top of the grid.
4. Verify at least one CDS card is displayed (e.g., "A1C screening overdue" or "Diabetic eye exam recommended").
5. Read the card detail text and verify source attribution is displayed (Source label and optional Reference link).
6. Click the **Accept** button on an informational (blue) CDS card.
7. Verify the card is dismissed from the list.
8. If a warning-level (amber) card is present, click the **Override** button.
9. In the Override Dialog, select reason: `Already addressed / previously evaluated`.
10. Click **Confirm Override**.
11. Verify the warning card is removed.
12. Locate the feedback widget ("Was this helpful?") on a remaining card. Click **Yes**.
13. Verify the feedback text changes to "Thank you for your feedback".

**Expected Outcomes:**
- Step 3: CDS section renders only when `cdsCards.length > 0`; card spans `md:col-span-2`.
- Step 5: Each card displays source label and optional URL per DSI requirements under 170.315(b)(11).
- Step 6: Accepted card animates out; `onAccept` callback filters it from state.
- Step 10: Override mutation fires with `reasonCode`, `hookInstance`, and `patientId`.
- Step 12: `cdsFeedback.mutate` is called with `{ cardId, outcome: 'helpful' }`.

**Severity Rating:** 2 (major) -- CDS alerts that fail to render or cannot be actioned undermine clinical safety and block certification.

---

## Scenario 7 -- Implantable Device List (a)(14)

**Criterion:** 170.315(a)(14) -- Implantable Device List

**Prerequisites:**
- Logged in as: `dr.chen` / `Test1234!`
- Patient chart open for: James Whitefeather (DOB 1972-08-22, MRN TRB-10015)
- Patient currently has no devices on file

**Steps:**

1. From the patient chart, click the **Devices** tab.
2. Verify the Implantable Devices card loads with the UDI compliance description: "UDI-compliant implantable device list per 170.315(a)(14)".
3. Verify the table shows "No implantable devices on file."
4. Click the **Add Device** button.
5. In the Add Implantable Device dialog, enter:
   - UDI (Barcode / HRF): `(01)00884838000025(17)260815(10)A456(21)SN789012345`
   - Device Type: `Cardiac Pacemaker`
   - Manufacturer: `Medtronic`
   - Model: `Azure XT DR MRI`
   - Serial Number: `SN789012345`
   - Lot Number: `A456`
   - Expiration Date: `2026-08-15`
   - Status: `Active`
6. Click **Add Device**.
7. Verify the dialog closes and the device row appears in the table with columns: Device Type, Manufacturer, Model, UDI (truncated to first 20 characters with ellipsis), Expiration, Status.
8. Verify the UDI column shows monospace font text: `(01)00884838000025(1...`.
9. Click the device row to open the Device Detail dialog.
10. Verify all fields are displayed: full UDI string (monospace, word-break), Device Type, Manufacturer, Model, Serial Number, Lot Number, Expiration date (formatted MM/DD/YYYY), and Status badge (green "active").
11. Close the detail dialog.

**Expected Outcomes:**
- Step 5: UDI field has monospace styling (`font-mono`) for barcode readability.
- Step 6: Add Device button is disabled until Device Type and Manufacturer are filled (required fields).
- Step 7: Device row appears immediately after mutation succeeds.
- Step 10: Detail dialog renders each field conditionally (model, serial, lot only shown if present).

**Severity Rating:** 2 (major) -- incomplete UDI recording or inability to view device details violates FDA UDI requirements and 170.315(a)(14).

---

## Scenario 8 -- Clinical Information Reconciliation (b)(2)

**Criterion:** 170.315(b)(2) -- Clinical Information Reconciliation

**Prerequisites:**
- Logged in as: `dr.chen` / `Test1234!`
- Patient chart open for: Maria Garcia (DOB 1985-03-15, MRN TRB-10042)
- Patient has active medications: Lisinopril 10 mg, Metformin 500 mg
- Patient has active allergies: Penicillin (High), Sulfa (Low)
- Patient has active problems: Hypertension, Type 2 Diabetes

**Steps:**

**Part A -- Medication Reconciliation:**
1. Click the **Meds** tab.
2. Click the **Reconciliation** button (with RefreshCw icon).
3. Verify the Medication Reconciliation dialog opens with the description: "Review and verify the patient's current medication list."
4. Verify active medications are listed with name, dose, route, and frequency.
5. For Lisinopril, click **Continue** to confirm it remains active.
6. For Metformin, click **Modify** to indicate a dosage change is needed.
7. Click **Complete Reconciliation** to finalize.
8. Verify the dialog closes.

**Part B -- Allergy Reconciliation:**
9. Click the **Allergies** tab.
10. Verify active allergies display with criticality badges (Penicillin = High/red, Sulfa = Low/green).
11. Click the Edit (pencil) icon on the Sulfa allergy row.
12. In the Edit Allergy dialog, change Clinical Status from `Active` to `Resolved`.
13. Click **Update Allergy**.
14. Verify the Sulfa allergy row now shows status badge `resolved`.

**Part C -- Problem Reconciliation:**
15. Click the **Problems** tab.
16. Review the active problem list for accuracy.
17. Verify both Hypertension and Type 2 Diabetes are displayed with ICD-10 codes.

**Expected Outcomes:**
- Step 3: Dialog lists only active medications (filtered by `status === 'active'`).
- Step 5-6: Continue / Modify / Discontinue buttons are present for each medication row.
- Step 12: Clinical Status dropdown offers Active, Inactive, Resolved.
- Step 14: Allergy table refreshes via React Query invalidation.

**Severity Rating:** 2 (major) -- incomplete reconciliation during transitions of care leads to medication errors and patient harm.

---

## Scenario 9 -- Electronic Prescribing (b)(3)

**Criterion:** 170.315(b)(3) -- Electronic Prescribing

**Prerequisites:**
- Logged in as: `dr.chen` / `Test1234!`
- Patient chart open for: Sarah Runningdeer (DOB 1990-11-03, MRN TRB-10028)
- Patient has no known drug allergies (NKDA)

**Steps:**

1. Click the **Meds** tab.
2. Verify the NKDA status is reflected (no active allergies, filter shows empty or NKDA badge on Summary tab).
3. Click **Prescribe**.
4. In the Prescribe Medication dialog, enter the following complete prescription:
   - Medication Name: `Amoxicillin 500mg Capsules`
   - Dose: `500mg`
   - Route: Select `Oral` from dropdown (options include: Oral, Sublingual, Topical, Intravenous, Intramuscular, Subcutaneous, Inhalation, Rectal, Ophthalmic, Otic, Nasal)
   - Frequency / SIG: `Take 1 capsule by mouth three times daily for 10 days`
   - Notes: `For acute sinusitis. Take with food to reduce GI upset. Complete full course.`
5. Click **Check Interactions**.
6. Verify no CDS alerts are returned (NKDA patient, no conflicting medications).
7. Verify the **Submit Order** button is enabled (medication, dose, and frequency are all filled; no critical CDS cards).
8. Click **Submit Order**.
9. Verify the dialog closes and form fields reset to defaults (medication empty, route back to Oral).
10. Verify the prescription appears in the medications table with:
    - Medication: Amoxicillin 500mg Capsules
    - Dose: 500mg
    - Route: oral (lowercase, capitalized via CSS)
    - Frequency: Take 1 capsule by mouth three times daily for 10 days
    - Status: active (green badge)
11. Filter the medication list by status: select `All Statuses` from the filter dropdown.
12. Verify both active and any historical medications are shown.

**Expected Outcomes:**
- Step 3: Dialog title reads "Prescribe Medication" with description mentioning pharmacy review.
- Step 4: Route dropdown presents 11 route options matching NCPDP/SNOMED standard routes.
- Step 7: Submit Order button requires all three fields: medication, dose, frequency (`!formData.medication || !formData.dose || !formData.frequency`).
- Step 9: State resets confirm `setFormData({ medication: '', dose: '', route: 'oral', frequency: '', note: '' })`.
- Step 10: New prescription row visible in table immediately after mutation.

**Severity Rating:** 3 (catastrophic) -- electronic prescriptions with missing SIG, route, or dose create dispensing errors and patient safety events.

---

## Appendix A -- Failure Severity Scale

| Rating | Level | Definition |
|---|---|---|
| 0 | Cosmetic | Visual or labeling issue with no functional impact |
| 1 | Minor | User notices the issue but completes the task without assistance |
| 2 | Major | User requires significant effort or workaround to complete the task; task may be partially failed |
| 3 | Catastrophic | User cannot complete the task, or task completion results in incorrect clinical data that poses a patient safety risk |

## Appendix B -- Test Data Summary

| Patient | MRN | DOB | Key Data |
|---|---|---|---|
| Maria Garcia | TRB-10042 | 1985-03-15 | Penicillin allergy (High), Lisinopril 10 mg, Hypertension, T2DM |
| James Whitefeather | TRB-10015 | 1972-08-22 | No devices, existing lab orders |
| Sarah Runningdeer | TRB-10028 | 1990-11-03 | NKDA, chronic cough, no active meds |
| Robert Eaglebear | TRB-10003 | 1958-04-30 | T2DM, age 67, CDS patient-view triggers |
| Thomas Clearwater | (new) | 1988-06-14 | Created during Scenario 5 registration |

## Appendix C -- Login Credentials

| Username | Password | Role | Used In |
|---|---|---|---|
| `dr.chen` | `Test1234!` | Physician | Scenarios 1-4, 6-9 |
| `front.desk` | `Test1234!` | Registration Clerk | Scenario 5 |

## Appendix D -- Criterion-to-Scenario Cross-Reference

| Criterion | Section | Scenario |
|---|---|---|
| 170.315(a)(1) | CPOE -- Medications | 1 |
| 170.315(a)(2) | CPOE -- Laboratory | 2 |
| 170.315(a)(3) | CPOE -- Diagnostic Imaging | 3 |
| 170.315(a)(4) | Drug-Drug/Drug-Allergy Checks | 4 |
| 170.315(a)(5) | Demographics (USCDI v3) | 5 |
| 170.315(a)(9) | Clinical Decision Support | 6 |
| 170.315(a)(14) | Implantable Device List | 7 |
| 170.315(b)(2) | Clinical Information Reconciliation | 8 |
| 170.315(b)(3) | Electronic Prescribing | 9 |
