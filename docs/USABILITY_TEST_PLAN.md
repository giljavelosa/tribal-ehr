# Usability Test Plan — Tribal EHR v1.0

## ONC § 170.315(g)(3) Safety-Enhanced Design Certification

| Field              | Value                                      |
|--------------------|--------------------------------------------|
| Document Version   | 1.0                                        |
| Date               | 2026-02-06                                 |
| System Under Test  | Tribal EHR v1.0                            |
| Prepared By        | Tribal EHR Usability Team                  |
| Standard           | NISTIR 7742 — Customized Common Industry Format Template for Electronic Health Record Usability Testing |

---

## 1. Test Objectives

The purpose of this usability test is to evaluate the safety, effectiveness, efficiency,
and user satisfaction of nine Safety-Enhanced Design (SED) referenced criteria within
Tribal EHR v1.0. The results will produce the SED test report required for ONC Health
IT Certification under the HTI-1 final rule.

Specific objectives:

- Measure task success rates (effectiveness) for each SED criterion.
- Measure time-on-task (efficiency) for representative clinical workflows.
- Measure user satisfaction via the System Usability Scale (SUS).
- Identify use errors, close calls, and user interface design issues that could
  compromise patient safety.
- Produce quantitative and qualitative evidence for the ONC certification submission.

---

## 2. Scope — SED-Referenced Criteria

The following nine certification criteria require usability testing:

| # | Criterion        | ONC Reference     | Representative Tasks |
|---|------------------|-------------------|----------------------|
| 1 | CPOE — Medications   | § 170.315(a)(1)  | Create, modify, and cancel a medication order |
| 2 | CPOE — Laboratory    | § 170.315(a)(2)  | Order a CBC and a metabolic panel |
| 3 | CPOE — Imaging       | § 170.315(a)(3)  | Order a chest X-ray with clinical indication |
| 4 | Drug-Drug / Drug-Allergy Interaction Checks | § 170.315(a)(4) | Trigger and respond to a drug-drug interaction alert; trigger and respond to a drug-allergy alert |
| 5 | Demographics         | § 170.315(a)(5)  | Record and update patient demographics including preferred language, sexual orientation, and gender identity |
| 6 | Clinical Decision Support | § 170.315(a)(9) | Review and act on a CDS intervention; configure a CDS rule |
| 7 | Implantable Device List  | § 170.315(a)(14) | Record a UDI, view the implantable device list |
| 8 | Clinical Info Reconciliation | § 170.315(b)(2) | Reconcile medications, allergies, and problems from a CCDA |
| 9 | Electronic Prescribing     | § 170.315(b)(3) | Create and transmit an electronic prescription; process a refill request |

Each criterion includes 3-5 discrete tasks. The full task inventory is maintained in a
separate Task Script document distributed to moderators before testing.

---

## 3. Participant Criteria

### 3.1 Sample Size

A minimum of **10 participants per criterion**, consistent with NISTIR 7742 guidance.
Because several criteria share the same user role (prescribing clinician), a single
participant may complete tasks across multiple criteria, but the minimum of 10 unique
participants per criterion must be met.

### 3.2 Eligibility Requirements

- Currently licensed healthcare professionals (physicians, nurse practitioners,
  physician assistants, registered nurses, pharmacists, or medical assistants)
  appropriate to the clinical role each criterion targets.
- At least 1 year of experience using any EHR system in a clinical setting.
- No prior exposure to Tribal EHR.
- No direct affiliation with the Tribal EHR development team.

### 3.3 Demographic Diversity (per NISTIR 7742)

Recruitment must aim for diversity across the following dimensions. The final SED
report will include a participant demographics table.

| Dimension                  | Target Distribution |
|----------------------------|---------------------|
| Professional role          | Mix of physicians, NPs/PAs, RNs, pharmacists, MAs |
| Years of EHR experience    | Range from 1-3 years to 10+ years |
| Age                        | Spread across 25-34, 35-44, 45-54, 55+ brackets |
| Gender                     | No single gender exceeds 70% of the sample |
| Computer/technology literacy | Self-reported beginner, intermediate, advanced |
| Clinical setting familiarity | Inpatient, outpatient, tribal/IHS health facilities |

---

## 4. Recruitment Plan

1. **Source pools**: Partner tribal health organizations, IHS facilities, tribal clinics,
   and affiliated academic medical centers.
2. **Screening survey**: A brief online questionnaire to verify licensure, EHR experience,
   role, and demographic characteristics.
3. **Informed consent**: Each participant signs a consent form covering the purpose of the
   study, voluntary participation, audio/screen recording, data confidentiality, and the
   right to withdraw at any time without penalty.
4. **Compensation**: Each participant receives a $150 gift card upon completion of their
   session.
5. **Timeline**: Recruitment begins 6 weeks before the first test session. Confirmation
   emails with scheduling details are sent 2 weeks before the session date.
6. **Backup participants**: Recruit 2 additional participants per criterion to account for
   no-shows or disqualifications.

---

## 5. Test Environment

### 5.1 Hardware

- Workstation: Desktop PC or laptop with a minimum 15-inch display at 1920x1080 resolution.
- Peripherals: Standard USB keyboard and mouse.
- Screen and audio recording equipment (OBS Studio or Morae).
- External webcam for facial expression capture (optional, with participant consent).

### 5.2 Software

| Component       | Specification |
|-----------------|---------------|
| System Under Test | Tribal EHR v1.0 — React 18 / TypeScript / Tailwind CSS frontend |
| Backend         | Node.js / Express API, PostgreSQL 16, HAPI FHIR R4 server |
| Browser         | Google Chrome (latest stable release) |
| Operating System | Windows 11 or macOS 14+ |
| Recording       | OBS Studio 30+ for screen and audio capture |

### 5.3 Test Data

A pre-configured test database with realistic but synthetic patient records (generated
via Synthea) will be loaded before each session. The dataset includes patients with
active medications, known allergies, implantable devices, and pending reconciliation
documents to support all nine criteria.

### 5.4 Network

All sessions use a dedicated test environment hosted on an isolated staging server.
Internet connectivity of at least 25 Mbps is required. The FHIR server and all
supporting services (Redis, RabbitMQ) run within the same Docker Compose stack to
eliminate external latency variability.

---

## 6. Methodology

### 6.1 Study Design

Moderated, in-person (or remote via secure video conference) lab-based usability testing
using the **concurrent think-aloud protocol**.

### 6.2 Session Structure

Each session lasts approximately **60-90 minutes** and follows this sequence:

1. **Welcome and orientation** (5 min) — Moderator introduces the study purpose, reviews
   the consent form, and explains the think-aloud method.
2. **Pre-test questionnaire** (5 min) — Collects demographic data, professional background,
   and technology experience.
3. **Training walkthrough** (5 min) — Brief guided tour of the Tribal EHR navigation
   structure. No criterion-specific features are demonstrated.
4. **Task execution** (40-60 min) — Participant completes assigned tasks across the
   applicable criteria. Task order is counterbalanced across participants to mitigate
   learning effects.
5. **Post-test SUS questionnaire** (5 min) — Participant completes the 10-item System
   Usability Scale.
6. **Debrief interview** (5-10 min) — Open-ended questions about pain points, positive
   experiences, and suggestions for improvement.

### 6.3 Think-Aloud Protocol

Participants are instructed to verbalize their thought process continuously while
performing tasks. The moderator uses neutral prompts ("What are you thinking now?",
"What do you expect to happen?") when the participant falls silent for more than
15 seconds. The moderator does not offer guidance or hints.

### 6.4 Task Scenarios

Each task scenario includes:

- A brief clinical narrative providing context.
- A clearly stated goal (e.g., "Order amoxicillin 500 mg TID for 10 days for this patient").
- Defined success criteria (optimal path, acceptable path, task failure).
- A maximum time limit after which the task is marked incomplete.

---

## 7. Data Collection Instruments

### 7.1 Task Completion Tracking

For every task, the data logger records:

| Metric              | Definition |
|---------------------|------------|
| Task success        | Pass (completed without assistance), Pass with difficulty (completed with non-critical deviations), Fail (not completed or required moderator intervention) |
| Task path deviation | Number of unnecessary clicks or navigation steps beyond the optimal path |
| Assists             | Count of moderator hints or interventions provided |

### 7.2 Time-on-Task Recording

- Timing starts when the moderator reads the task scenario aloud and the participant
  acknowledges understanding.
- Timing ends when the participant declares completion or the maximum time limit is
  reached.
- All times are recorded in seconds using the screen recording timestamp.

### 7.3 Error Logging

Errors are categorized as:

| Error Type   | Definition |
|--------------|------------|
| Use error    | Action or omission that produces a different result than intended by the manufacturer or expected by the user |
| Close call   | User begins an erroneous action but self-corrects before it takes effect |
| Slip         | Unintended action (e.g., clicking the wrong button) |
| Mistake      | Intentional action based on incorrect understanding |

Each error is logged with a timestamp, task ID, description, and severity rating
(cosmetic, minor, major, catastrophic).

### 7.4 System Usability Scale (SUS)

The standard 10-item SUS questionnaire (Brooke, 1996) is administered post-test. Each
item is rated on a 5-point Likert scale from "Strongly Disagree" to "Strongly Agree."
The composite SUS score (0-100) is calculated per the standard scoring algorithm.

### 7.5 Qualitative Data

- Think-aloud transcripts (derived from audio recordings).
- Moderator observation notes.
- Debrief interview notes and direct participant quotes.

---

## 8. Analysis Methodology

### 8.1 Effectiveness

- **Task success rate** per criterion = (number of Pass results / total attempts) x 100.
- Results are reported as a percentage with 95% confidence intervals.
- Error rates and error types are tabulated per task and per criterion.

### 8.2 Efficiency

- **Mean time-on-task** per task and per criterion, reported in seconds.
- **Median time-on-task** is also reported to account for outlier sessions.
- **Task path deviations** are averaged and compared to the optimal path length.
- Failed tasks are excluded from efficiency calculations but noted separately.

### 8.3 Satisfaction

- **Mean SUS score** across all participants, reported with standard deviation.
- SUS scores are interpreted using the Bangor adjective scale (Acceptable >= 68).
- Individual SUS item scores are reviewed for patterns indicating specific usability
  concerns (e.g., consistently low scores on "I found the system unnecessarily complex").

### 8.4 Safety Analysis

- All use errors and close calls are reviewed by a clinical safety analyst.
- Root causes are categorized (navigation confusion, labeling ambiguity, workflow
  mismatch, missing feedback, etc.).
- A risk priority matrix (severity x frequency) is produced to prioritize remediation.

### 8.5 Reporting

The final SED test report will follow the NISTIR 7742 CIF template and include:

- EHR and test environment description.
- Participant demographics summary table.
- Per-criterion results: effectiveness, efficiency, satisfaction.
- Error analysis with risk ratings.
- Screenshots illustrating key findings.
- Recommended design improvements and their implementation status.

---

## 9. Roles and Responsibilities

| Role                    | Responsibility |
|-------------------------|----------------|
| **Usability Lead**      | Owns the test plan, coordinates logistics, reviews the final report |
| **Test Moderator**      | Conducts sessions, reads task scenarios, manages think-aloud prompts |
| **Data Logger**         | Records task success, errors, and timestamps in real time during sessions |
| **Clinical SME**        | Validates task scenarios for clinical accuracy, reviews safety-related errors |
| **Technical Support**   | Configures the test environment, resets test data between sessions, troubleshoots |
| **Recruiting Coordinator** | Screens and schedules participants, distributes consent forms and compensation |
| **Report Author**       | Compiles quantitative and qualitative data into the NISTIR 7742 SED report |

---

## 10. Schedule / Timeline

| Phase                        | Duration       | Target Dates        |
|------------------------------|----------------|---------------------|
| Test plan finalization        | 1 week         | Weeks 1             |
| Task script development       | 2 weeks        | Weeks 2-3           |
| Test environment setup        | 1 week         | Week 3              |
| Participant recruitment       | 4 weeks        | Weeks 2-5           |
| Pilot test (2 participants)   | 3 days         | Week 5              |
| Pilot debrief and revisions   | 2 days         | Week 5              |
| Usability test sessions       | 3 weeks        | Weeks 6-8           |
| Data analysis                 | 2 weeks        | Weeks 9-10          |
| Draft SED report              | 1 week         | Week 11             |
| Clinical safety review        | 1 week         | Week 12             |
| Final SED report delivery     | —              | End of Week 12      |

Total estimated duration: **12 weeks** from test plan approval to final report.

---

## 11. Risks and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Insufficient participant recruitment | Medium | High | Begin recruitment early; maintain a backup pool of 2 extra participants per criterion; offer flexible scheduling (evenings, weekends) |
| Participant no-shows | Medium | Medium | Overbook by 20%; send reminders 48 hours and 2 hours before each session |
| Test environment instability | Low | High | Run full dry-run 1 week before testing; keep a standby laptop with a local Docker environment; technical support on-site during all sessions |
| Synthetic test data does not cover required scenarios | Low | High | Clinical SME reviews all test data 2 weeks before testing; create additional Synthea patient records as needed |
| Think-aloud protocol inhibits natural behavior | Medium | Low | Use relaxed think-aloud variant; remind participants there are no wrong answers; moderator maintains neutral tone |
| Recording equipment failure | Low | Medium | Use redundant recording (OBS on primary machine plus backup audio recorder); verify equipment before each session |
| Moderator bias influencing results | Low | High | Use standardized task scripts with no leading language; moderator training session before pilot test; secondary reviewer audits 20% of session recordings |
| Remote session connectivity issues | Medium | Medium | Require participants to test their connection 24 hours before the session; provide a phone-based backup audio channel |

---

## References

- NISTIR 7742: Customized Common Industry Format Template for Electronic Health Record
  Usability Testing. National Institute of Standards and Technology, 2010.
- Brooke, J. (1996). SUS: A "Quick and Dirty" Usability Scale. In P. W. Jordan et al.
  (Eds.), Usability Evaluation in Industry (pp. 189-194).
- ONC Health IT Certification Program: § 170.315(g)(3) Safety-Enhanced Design.
- 21st Century Cures Act Final Rule (HTI-1), 2024.

---

*End of Usability Test Plan*
