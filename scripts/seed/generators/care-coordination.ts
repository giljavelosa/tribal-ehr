import { Knex } from 'knex';
import crypto from 'crypto';
import { SeededRNG, formatDate, addDays, batchInsert } from '../utils';
import { CLINICAL_PROFILES, ProfileType } from '../profiles/clinical-profiles';
import { GeneratedPatients } from './patients';
import { GeneratedUsers } from './users';

// ---------------------------------------------------------------------------
// Care plan templates by profile
// ---------------------------------------------------------------------------

interface CarePlanTemplate {
  title: string;
  description: string;
  activities: { detail: string; status: string }[];
}

const CARE_PLAN_TEMPLATES: Record<string, CarePlanTemplate[]> = {
  DIABETIC: [
    {
      title: 'Diabetes Management Plan',
      description: 'Comprehensive care plan for Type 2 diabetes mellitus management including medication adherence, dietary modifications, and monitoring.',
      activities: [
        { detail: 'Monitor blood glucose levels daily', status: 'in-progress' },
        { detail: 'A1C testing every 3 months', status: 'in-progress' },
        { detail: 'Diabetic diet counseling', status: 'completed' },
        { detail: 'Annual diabetic eye exam', status: 'scheduled' },
        { detail: 'Foot examination at each visit', status: 'in-progress' },
      ],
    },
  ],
  CARDIAC: [
    {
      title: 'Cardiac Care Plan',
      description: 'Care plan for cardiovascular disease management including medication management, lifestyle modifications, and cardiac monitoring.',
      activities: [
        { detail: 'Monitor blood pressure daily', status: 'in-progress' },
        { detail: 'Lipid panel every 6 months', status: 'in-progress' },
        { detail: 'Cardiac rehabilitation program', status: 'scheduled' },
        { detail: 'Low-sodium diet education', status: 'completed' },
      ],
    },
  ],
  SNF: [
    {
      title: 'SNF Comprehensive Care Plan',
      description: 'Skilled nursing facility care plan addressing multiple chronic conditions, fall prevention, and activities of daily living.',
      activities: [
        { detail: 'Fall risk assessment weekly', status: 'in-progress' },
        { detail: 'Medication reconciliation monthly', status: 'in-progress' },
        { detail: 'Physical therapy 3x/week', status: 'in-progress' },
        { detail: 'Wound care assessment daily', status: 'in-progress' },
        { detail: 'Nutritional status monitoring', status: 'in-progress' },
        { detail: 'Pain management reassessment', status: 'in-progress' },
      ],
    },
  ],
  INPATIENT: [
    {
      title: 'Inpatient Care Plan',
      description: 'Acute care plan for inpatient management including treatment protocols and discharge planning.',
      activities: [
        { detail: 'Daily labs and vital signs monitoring', status: 'in-progress' },
        { detail: 'Respiratory therapy as indicated', status: 'in-progress' },
        { detail: 'Discharge planning initiated', status: 'in-progress' },
      ],
    },
  ],
  MENTAL_HEALTH: [
    {
      title: 'Behavioral Health Treatment Plan',
      description: 'Mental health care plan including psychotherapy, medication management, and crisis prevention.',
      activities: [
        { detail: 'Individual therapy sessions weekly', status: 'in-progress' },
        { detail: 'Medication adherence monitoring', status: 'in-progress' },
        { detail: 'PHQ-9 depression screening monthly', status: 'in-progress' },
        { detail: 'Safety planning review', status: 'completed' },
        { detail: 'Group therapy enrollment', status: 'scheduled' },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Goal templates by profile
// ---------------------------------------------------------------------------

interface GoalTemplate {
  description: string;
  achievementStatus: string;
}

const GOAL_TEMPLATES: Record<string, GoalTemplate[]> = {
  DIABETIC: [
    { description: 'Maintain HbA1c below 7.0%', achievementStatus: 'in-progress' },
    { description: 'Fasting blood glucose 80-130 mg/dL', achievementStatus: 'in-progress' },
    { description: 'Lose 5% of body weight within 6 months', achievementStatus: 'in-progress' },
    { description: 'Complete diabetic eye exam annually', achievementStatus: 'achieved' },
    { description: 'Maintain blood pressure below 130/80 mmHg', achievementStatus: 'in-progress' },
  ],
  CARDIAC: [
    { description: 'Maintain blood pressure below 130/80 mmHg', achievementStatus: 'in-progress' },
    { description: 'LDL cholesterol below 100 mg/dL', achievementStatus: 'in-progress' },
    { description: 'Exercise 150 minutes per week', achievementStatus: 'in-progress' },
    { description: 'Sodium intake below 2000 mg/day', achievementStatus: 'in-progress' },
  ],
  SNF: [
    { description: 'Maintain functional mobility with assistive device', achievementStatus: 'in-progress' },
    { description: 'Zero falls during SNF stay', achievementStatus: 'achieved' },
    { description: 'Wound healing to stage 1 or better', achievementStatus: 'in-progress' },
    { description: 'Adequate nutritional intake (>75% of meals)', achievementStatus: 'in-progress' },
    { description: 'Pain level maintained at 3/10 or below', achievementStatus: 'in-progress' },
    { description: 'Discharge to home within 90 days', achievementStatus: 'in-progress' },
  ],
  INPATIENT: [
    { description: 'Resolution of acute presenting symptoms', achievementStatus: 'in-progress' },
    { description: 'Stable vital signs for 24 hours pre-discharge', achievementStatus: 'in-progress' },
    { description: 'Successful transition to oral medications', achievementStatus: 'in-progress' },
  ],
  MENTAL_HEALTH: [
    { description: 'Reduce PHQ-9 score to below 10', achievementStatus: 'in-progress' },
    { description: 'Attend all scheduled therapy appointments', achievementStatus: 'in-progress' },
    { description: 'Develop and practice 3 coping strategies', achievementStatus: 'achieved' },
    { description: 'Return to full-time employment within 6 months', achievementStatus: 'in-progress' },
    { description: 'Establish consistent sleep schedule', achievementStatus: 'in-progress' },
  ],
};

export async function seedCareCoordination(
  trx: Knex.Transaction,
  patients: GeneratedPatients,
  users: GeneratedUsers,
  rng: SeededRNG,
): Promise<void> {
  const now = new Date().toISOString();
  const today = new Date();

  const carePlanRows: Record<string, unknown>[] = [];
  const careTeamRows: Record<string, unknown>[] = [];
  const goalRows: Record<string, unknown>[] = [];

  for (const patient of patients.patients) {
    const profile = CLINICAL_PROFILES[patient.profile];

    // ----- CARE TEAMS -----
    // Every patient gets at least one care team
    if (profile.hasCareTeam || rng.chance(0.3)) {
      const careTeamId = crypto.randomUUID();
      const pcp = rng.pick(users.physicians);
      const nurse = users.nurses.length > 0 ? rng.pick(users.nurses) : null;
      const specialist = users.physicians.length > 1
        ? rng.pick(users.physicians.filter(p => p !== pcp))
        : null;

      const participants: Record<string, unknown>[] = [
        {
          role: [{ text: 'Primary Care Physician' }],
          member: { reference: `Practitioner/${pcp}`, display: 'PCP' },
        },
      ];

      if (nurse) {
        participants.push({
          role: [{ text: 'Care Coordinator' }],
          member: { reference: `Practitioner/${nurse}`, display: 'Nurse' },
        });
      }

      if (specialist && profile.hasCareTeam) {
        participants.push({
          role: [{ text: 'Specialist' }],
          member: { reference: `Practitioner/${specialist}`, display: 'Specialist' },
        });
      }

      const startDate = formatDate(addDays(today, -rng.randomInt(30, 365)));

      careTeamRows.push({
        id: careTeamId,
        patient_id: patient.id,
        fhir_id: null,
        status: 'active',
        name: `Care Team for ${patient.firstName} ${patient.lastName}`,
        period_start: startDate,
        period_end: null,
        participant: JSON.stringify(participants),
        note: null,
        created_at: now,
        updated_at: now,
      });

      // ----- CARE PLANS -----
      if (profile.hasCarePlan) {
        const templates = CARE_PLAN_TEMPLATES[patient.profile];
        if (templates && templates.length > 0) {
          const template = rng.pick(templates);
          const carePlanId = crypto.randomUUID();
          const isCompleted = rng.chance(0.2);
          const planStart = formatDate(addDays(today, -rng.randomInt(30, 300)));
          const planEnd = isCompleted
            ? formatDate(addDays(new Date(planStart), rng.randomInt(60, 180)))
            : null;

          carePlanRows.push({
            id: carePlanId,
            patient_id: patient.id,
            fhir_id: null,
            status: isCompleted ? 'completed' : 'active',
            intent: 'plan',
            title: template.title,
            description: template.description,
            period_start: planStart,
            period_end: planEnd,
            author_id: pcp,
            care_team_ids: JSON.stringify([careTeamId]),
            addresses: JSON.stringify(
              profile.conditionCodes.map(c => ({ reference: `Condition/${c}` }))
            ),
            goal_ids: JSON.stringify([]),
            activity: JSON.stringify(
              template.activities.map(a => ({
                detail: {
                  description: a.detail,
                  status: a.status,
                },
              }))
            ),
            note: null,
            created_at: now,
            updated_at: now,
          });

          // ----- GOALS -----
          if (profile.goalRange.max > 0) {
            const goalTemplates = GOAL_TEMPLATES[patient.profile];
            if (goalTemplates && goalTemplates.length > 0) {
              const numGoals = rng.randomInt(profile.goalRange.min, profile.goalRange.max);
              const selectedGoals = rng.pickN(goalTemplates, numGoals);
              const goalIds: string[] = [];

              for (const goalTmpl of selectedGoals) {
                const goalId = crypto.randomUUID();
                goalIds.push(goalId);

                const goalStartDate = planStart;
                const targetDate = formatDate(
                  addDays(new Date(goalStartDate), rng.randomInt(180, 365))
                );

                // Determine lifecycle status
                let lifecycleStatus: string;
                if (isCompleted) {
                  lifecycleStatus = rng.chance(0.7) ? 'completed' : 'accepted';
                } else {
                  lifecycleStatus = rng.chance(0.8) ? 'active' : 'accepted';
                }

                goalRows.push({
                  id: goalId,
                  patient_id: patient.id,
                  fhir_id: null,
                  lifecycle_status: lifecycleStatus,
                  achievement_status: goalTmpl.achievementStatus,
                  description_text: goalTmpl.description,
                  start_date: goalStartDate,
                  target_date: targetDate,
                  status_date: formatDate(today),
                  expressed_by_id: pcp,
                  addresses: JSON.stringify(
                    profile.conditionCodes.slice(0, 1).map(c => ({ reference: `Condition/${c}` }))
                  ),
                  note: null,
                  created_at: now,
                  updated_at: now,
                });
              }

              // Update care plan with goal IDs (we update the row in our array before insert)
              const cpRow = carePlanRows[carePlanRows.length - 1];
              cpRow.goal_ids = JSON.stringify(goalIds);
            }
          }
        }
      }
    }
  }

  await batchInsert(trx, 'care_teams', careTeamRows);
  await batchInsert(trx, 'care_plans', carePlanRows);
  await batchInsert(trx, 'goals', goalRows);

  console.log(`  - care_teams: ${careTeamRows.length} rows`);
  console.log(`  - care_plans: ${carePlanRows.length} rows`);
  console.log(`  - goals: ${goalRows.length} rows`);
}
