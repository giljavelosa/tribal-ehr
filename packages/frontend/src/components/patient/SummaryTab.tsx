import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Brain,
  Calendar,
  ClipboardList,
  Heart,
  Pill,
  Shield,
  Stethoscope,
  Syringe,
  Users,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  useConditions,
  useMedications,
  useAllergies,
  useVitals,
  useEncounters,
  useImmunizations,
  useCarePlans,
  type Condition,
  type MedicationRequest,
  type AllergyIntolerance,
  type VitalSigns,
  type Encounter,
  type Immunization,
  type CarePlan,
  type CareTeamMember,
} from '@/hooks/use-api';
import { useCdsInvoke, useCdsFeedback } from '@/hooks/use-cds';
import { CdsCardList } from '@/components/cds/CdsCardList';
import { CdsOverrideDialog } from '@/components/cds/CdsOverrideDialog';
import type { CDSCard } from '@/types/cds';

interface SummaryTabProps {
  patientId: string;
  onTabChange?: (tab: string) => void;
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-4 w-1/2 rounded bg-muted" />
      <div className="h-4 w-2/3 rounded bg-muted" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-4 text-center text-sm text-muted-foreground">{message}</p>
  );
}

export function SummaryTab({ patientId, onTabChange }: SummaryTabProps) {
  const { data: conditions, isLoading: loadingConditions } =
    useConditions(patientId);
  const { data: medications, isLoading: loadingMedications } =
    useMedications(patientId);
  const { data: allergies, isLoading: loadingAllergies } =
    useAllergies(patientId);
  const { data: vitals, isLoading: loadingVitals } = useVitals(patientId);
  const { data: encounters, isLoading: loadingEncounters } =
    useEncounters(patientId);
  const { data: immunizations, isLoading: loadingImmunizations } =
    useImmunizations(patientId);
  const { data: carePlans, isLoading: loadingCarePlans } =
    useCarePlans(patientId);

  const activeProblems = (conditions || []).filter(
    (c) =>
      c.clinicalStatus === 'active' &&
      c.category === 'problem-list-item',
  );
  const activeMedications = (medications || []).filter(
    (m) => m.status === 'active',
  );
  const activeAllergies = (allergies || []).filter(
    (a) => a.clinicalStatus === 'active',
  );
  const recentVitals = vitals && vitals.length > 0 ? vitals[0] : null;
  const recentEncounters = (encounters || []).slice(0, 5);
  const activeCarePlans = (carePlans || []).filter(
    (cp) => cp.status === 'active',
  );

  // Collect all care team members from active care plans
  const careTeam: CareTeamMember[] = [];
  const seenIds = new Set<string>();
  activeCarePlans.forEach((cp) => {
    cp.careTeam.forEach((member) => {
      if (!seenIds.has(member.id)) {
        seenIds.add(member.id);
        careTeam.push(member);
      }
    });
  });

  // CDS patient-view integration
  const cdsInvoke = useCdsInvoke();
  const cdsFeedback = useCdsFeedback();
  const [cdsCards, setCdsCards] = useState<CDSCard[]>([]);
  const [cdsHookInstance, setCdsHookInstance] = useState('');
  const [overrideCard, setOverrideCard] = useState<CDSCard | null>(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    cdsInvoke
      .mutateAsync({
        hook: 'patient-view',
        context: { userId: 'current-user', patientId },
      })
      .then((result) => {
        if (result.cards?.length) {
          setCdsCards(result.cards);
          setCdsHookInstance(result.hookInstance);
        }
      })
      .catch(() => {
        // CDS failure should not break patient view
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const handleCdsAccept = useCallback((card: CDSCard) => {
    setCdsCards((prev) => prev.filter((c) => c !== card));
  }, []);

  const handleCdsOverride = useCallback((card: CDSCard) => {
    setOverrideCard(card);
    setOverrideDialogOpen(true);
  }, []);

  const handleOverrideComplete = useCallback(() => {
    if (overrideCard) {
      setCdsCards((prev) => prev.filter((c) => c !== overrideCard));
    }
    setOverrideCard(null);
  }, [overrideCard]);

  const handleCdsFeedback = useCallback(
    (cardId: string, outcome: string) => {
      cdsFeedback.mutate({ cardId, outcome });
    },
    [cdsFeedback],
  );

  return (
    <>
    <div className="grid gap-5 md:grid-cols-2 lg:gap-6">
      {/* Clinical Decision Support */}
      {cdsCards.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" />
              Clinical Decision Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CdsCardList
              cards={cdsCards}
              hookInstance={cdsHookInstance}
              patientId={patientId}
              onAccept={handleCdsAccept}
              onOverride={handleCdsOverride}
              onFeedback={handleCdsFeedback}
            />
          </CardContent>
        </Card>
      )}

      {/* Active Problems */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" />
              Active Problems
            </CardTitle>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => onTabChange?.('problems')}
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingConditions ? (
            <LoadingSkeleton />
          ) : activeProblems.length === 0 ? (
            <EmptyState message="No active problems on file" />
          ) : (
            <div className="space-y-2">
              {activeProblems.map((problem) => (
                <div
                  key={problem.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{problem.display}</span>
                  <Badge variant="outline" className="text-xs font-mono">
                    {problem.code}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Medications */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Pill className="h-4 w-4" />
              Active Medications
            </CardTitle>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => onTabChange?.('medications')}
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMedications ? (
            <LoadingSkeleton />
          ) : activeMedications.length === 0 ? (
            <EmptyState message="No active medications" />
          ) : (
            <div className="space-y-3">
              {activeMedications.map((med) => (
                <div key={med.id} className="text-sm">
                  <p className="font-medium">{med.medication}</p>
                  <p className="text-muted-foreground">
                    {med.dose} {med.route} {med.frequency}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allergies */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4" />
              Allergies
            </CardTitle>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => onTabChange?.('allergies')}
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAllergies ? (
            <LoadingSkeleton />
          ) : activeAllergies.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                NKDA
              </Badge>
              <span className="text-sm text-muted-foreground">
                No Known Drug Allergies
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {activeAllergies.map((allergy) => (
                <div
                  key={allergy.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    {allergy.criticality === 'high' && (
                      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span
                      className={
                        allergy.criticality === 'high'
                          ? 'font-medium text-destructive'
                          : ''
                      }
                    >
                      {allergy.allergen}
                    </span>
                  </div>
                  <Badge
                    variant={
                      allergy.criticality === 'high'
                        ? 'destructive'
                        : 'outline'
                    }
                    className="text-xs"
                  >
                    {allergy.category}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Vitals */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Recent Vitals
            </CardTitle>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => onTabChange?.('vitals')}
            >
              View All
            </Button>
          </div>
          {recentVitals && (
            <CardDescription>
              Recorded:{' '}
              {new Date(recentVitals.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {loadingVitals ? (
            <LoadingSkeleton />
          ) : !recentVitals ? (
            <EmptyState message="No vitals recorded" />
          ) : (
            <div className="space-y-2 text-sm">
              {recentVitals.systolicBP != null &&
                recentVitals.diastolicBP != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Blood Pressure</span>
                    <span>
                      {recentVitals.systolicBP}/{recentVitals.diastolicBP} mmHg
                    </span>
                  </div>
                )}
              {recentVitals.heartRate != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Heart Rate</span>
                  <span>{recentVitals.heartRate} bpm</span>
                </div>
              )}
              {recentVitals.respiratoryRate != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resp Rate</span>
                  <span>{recentVitals.respiratoryRate} /min</span>
                </div>
              )}
              {recentVitals.temperature != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Temperature</span>
                  <span>
                    {recentVitals.temperature}{' '}
                    {recentVitals.temperatureUnit || 'F'}
                  </span>
                </div>
              )}
              {recentVitals.spO2 != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SpO2</span>
                  <span>{recentVitals.spO2}%</span>
                </div>
              )}
              {recentVitals.weight != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weight</span>
                  <span>
                    {recentVitals.weight}{' '}
                    {recentVitals.weightUnit || 'lbs'}
                  </span>
                </div>
              )}
              {recentVitals.bmi != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">BMI</span>
                  <span>{recentVitals.bmi}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Encounters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="h-4 w-4" />
              Recent Encounters
            </CardTitle>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => onTabChange?.('notes')}
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingEncounters ? (
            <LoadingSkeleton />
          ) : recentEncounters.length === 0 ? (
            <EmptyState message="No encounters on file" />
          ) : (
            <div className="space-y-3">
              {recentEncounters.map((encounter) => (
                <div key={encounter.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{encounter.type}</span>
                    <Badge variant="outline" className="text-xs">
                      {encounter.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>
                      {new Date(encounter.period.start).toLocaleDateString(
                        'en-US',
                        { month: 'short', day: 'numeric', year: 'numeric' },
                      )}
                    </span>
                    {encounter.provider && (
                      <>
                        <Separator orientation="vertical" className="h-3" />
                        <span>{encounter.provider}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Immunization Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Syringe className="h-4 w-4" />
              Immunizations
            </CardTitle>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => onTabChange?.('immunizations')}
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingImmunizations ? (
            <LoadingSkeleton />
          ) : !immunizations || immunizations.length === 0 ? (
            <EmptyState message="No immunization records" />
          ) : (
            <div className="space-y-2">
              {immunizations.slice(0, 5).map((imm) => (
                <div
                  key={imm.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{imm.vaccineDisplay}</span>
                  <span className="text-muted-foreground">
                    {new Date(imm.occurrenceDateTime).toLocaleDateString(
                      'en-US',
                      { month: 'short', year: 'numeric' },
                    )}
                  </span>
                </div>
              ))}
              {immunizations.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{immunizations.length - 5} more records
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Care Team */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Care Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCarePlans ? (
            <LoadingSkeleton />
          ) : careTeam.length === 0 ? (
            <EmptyState message="No care team members assigned" />
          ) : (
            <div className="space-y-3">
              {careTeam.map((member) => (
                <div key={member.id} className="text-sm">
                  <p className="font-medium">{member.name}</p>
                  <p className="text-muted-foreground">
                    {member.role}
                    {member.specialty ? ` - ${member.specialty}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Care Plans */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Active Care Plans
            </CardTitle>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => onTabChange?.('careplan')}
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingCarePlans ? (
            <LoadingSkeleton />
          ) : activeCarePlans.length === 0 ? (
            <EmptyState message="No active care plans" />
          ) : (
            <div className="space-y-3">
              {activeCarePlans.map((plan) => (
                <div key={plan.id} className="text-sm">
                  <p className="font-medium">{plan.title}</p>
                  <p className="text-muted-foreground">
                    {plan.goals.filter((g) => g.status === 'active' || g.status === 'accepted').length} active goals
                    {' / '}
                    {plan.activities.filter((a) => a.status === 'in-progress').length} in-progress activities
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    {/* CDS Override Dialog */}
    <CdsOverrideDialog
      open={overrideDialogOpen}
      card={overrideCard}
      patientId={patientId}
      hookInstance={cdsHookInstance}
      onClose={() => setOverrideDialogOpen(false)}
      onOverridden={handleOverrideComplete}
    />
    </>
  );
}
