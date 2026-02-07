import React, { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { usePatient, useAllergies } from '@/hooks/use-api';
import { usePatientContext } from '@/stores/patient-context-store';
import { BreakGlassDialog } from '@/components/patient/BreakGlassDialog';
import { BreakGlassRequiredError } from '@/lib/api';

// Lazy-loaded tab components
const SummaryTab = lazy(() =>
  import('@/components/patient/SummaryTab').then((m) => ({
    default: m.SummaryTab,
  })),
);
const ProblemsTab = lazy(() =>
  import('@/components/patient/ProblemsTab').then((m) => ({
    default: m.ProblemsTab,
  })),
);
const MedicationsTab = lazy(() =>
  import('@/components/patient/MedicationsTab').then((m) => ({
    default: m.MedicationsTab,
  })),
);
const AllergiesTab = lazy(() =>
  import('@/components/patient/AllergiesTab').then((m) => ({
    default: m.AllergiesTab,
  })),
);
const VitalsTab = lazy(() =>
  import('@/components/patient/VitalsTab').then((m) => ({
    default: m.VitalsTab,
  })),
);
const LabResultsTab = lazy(() =>
  import('@/components/patient/LabResultsTab').then((m) => ({
    default: m.LabResultsTab,
  })),
);
const NotesTab = lazy(() =>
  import('@/components/patient/NotesTab').then((m) => ({
    default: m.NotesTab,
  })),
);
const OrdersTab = lazy(() =>
  import('@/components/patient/OrdersTab').then((m) => ({
    default: m.OrdersTab,
  })),
);
const ImmunizationsTab = lazy(() =>
  import('@/components/patient/ImmunizationsTab').then((m) => ({
    default: m.ImmunizationsTab,
  })),
);
const CarePlanTab = lazy(() =>
  import('@/components/patient/CarePlanTab').then((m) => ({
    default: m.CarePlanTab,
  })),
);
const DocumentsTab = lazy(() =>
  import('@/components/patient/DocumentsTab').then((m) => ({
    default: m.DocumentsTab,
  })),
);
const DevicesTab = lazy(() =>
  import('@/components/patient/DevicesTab').then((m) => ({
    default: m.DevicesTab,
  })),
);
const FamilyHistoryTab = lazy(() =>
  import('@/components/patient/FamilyHistoryTab').then((m) => ({
    default: m.FamilyHistoryTab,
  })),
);
const HistoryTab = lazy(() =>
  import('@/components/patient/HistoryTab').then((m) => ({
    default: m.HistoryTab,
  })),
);

const TAB_KEYS = [
  'summary',
  'problems',
  'medications',
  'allergies',
  'vitals',
  'results',
  'notes',
  'orders',
  'immunizations',
  'care-plan',
  'devices',
  'documents',
  'family-history',
  'history',
] as const;

type TabKey = (typeof TAB_KEYS)[number];

const TAB_LABELS: Record<TabKey, string> = {
  summary: 'Summary',
  problems: 'Problems',
  medications: 'Meds',
  allergies: 'Allergies',
  vitals: 'Vitals',
  results: 'Results',
  notes: 'Notes',
  orders: 'Orders',
  immunizations: 'Immunizations',
  'care-plan': 'Care Plan',
  devices: 'Devices',
  documents: 'Documents',
  'family-history': 'Family Hx',
  history: 'History',
};

function TabLoadingFallback() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

export function PatientChartPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const patientId = id || '';
  const { data: patient, isLoading, error, refetch } = usePatient(patientId);
  const { data: allergies } = useAllergies(patientId);
  const setPatientContext = usePatientContext((s) => s.setPatientContext);
  const clearPatientContext = usePatientContext((s) => s.clearPatientContext);

  // Break-glass state
  const [breakGlassOpen, setBreakGlassOpen] = useState(false);
  const breakGlassRequired =
    error instanceof BreakGlassRequiredError ||
    (error instanceof Error && error.message?.includes('Emergency access override required'));

  // Set global patient context when patient data loads
  useEffect(() => {
    if (patient) {
      setPatientContext(patient, allergies || []);
    }
  }, [patient, allergies, setPatientContext]);

  const currentTab = (searchParams.get('tab') as TabKey) || 'summary';

  const handleTabChange = useCallback(
    (tab: string) => {
      setSearchParams({ tab }, { replace: true });
    },
    [setSearchParams],
  );

  // Callback from SummaryTab to switch tabs via "View All" links
  const handleSummaryTabSwitch = useCallback(
    (tab: string) => {
      handleTabChange(tab);
    },
    [handleTabChange],
  );

  if (error) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          className="gap-2"
          onClick={() => { clearPatientContext(); navigate('/patients'); }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Patients
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            {breakGlassRequired ? (
              <>
                <p className="text-destructive font-semibold">
                  This patient&apos;s data is restricted by consent directives.
                </p>
                <p className="text-muted-foreground mt-2 text-sm">
                  Emergency access override (break-glass) is required to view this record.
                </p>
                <Button
                  variant="destructive"
                  className="mt-4"
                  onClick={() => setBreakGlassOpen(true)}
                >
                  Request Emergency Access
                </Button>
                <BreakGlassDialog
                  open={breakGlassOpen}
                  onClose={() => setBreakGlassOpen(false)}
                  patientId={patientId}
                  onBreakGlassGranted={() => {
                    setBreakGlassOpen(false);
                    refetch();
                  }}
                />
              </>
            ) : (
              <>
                <p className="text-destructive">
                  Failed to load patient record. The patient may not exist or an
                  error occurred.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate('/patients')}
                >
                  Return to Patient List
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !patient) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded bg-muted" />
          <div className="space-y-2">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
        <div className="h-10 animate-pulse rounded bg-muted" />
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Back navigation */}
      <Button
        variant="ghost"
        className="gap-2 mb-2 self-start"
        onClick={() => { clearPatientContext(); navigate('/patients'); }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Patients
      </Button>

      {/* Patient Banner is now rendered in MainLayout for persistence across all routes */}

      {/* Chart Tabs */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="mt-2">
        <TabsList className="flex w-full flex-wrap justify-start gap-0.5">
          {TAB_KEYS.map((key) => (
            <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
              {TAB_LABELS[key]}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4">
          <Suspense fallback={<TabLoadingFallback />}>
            <TabsContent value="summary" className="mt-0">
              <SummaryTab
                patientId={patientId}
                onTabChange={handleSummaryTabSwitch}
              />
            </TabsContent>

            <TabsContent value="problems" className="mt-0">
              <ProblemsTab patientId={patientId} />
            </TabsContent>

            <TabsContent value="medications" className="mt-0">
              <MedicationsTab patientId={patientId} />
            </TabsContent>

            <TabsContent value="allergies" className="mt-0">
              <AllergiesTab patientId={patientId} />
            </TabsContent>

            <TabsContent value="vitals" className="mt-0">
              <VitalsTab patientId={patientId} />
            </TabsContent>

            <TabsContent value="results" className="mt-0">
              <LabResultsTab patientId={patientId} />
            </TabsContent>

            <TabsContent value="notes" className="mt-0">
              <NotesTab patientId={patientId} />
            </TabsContent>

            <TabsContent value="orders" className="mt-0">
              <OrdersTab patientId={patientId} />
            </TabsContent>

            <TabsContent value="immunizations" className="mt-0">
              <ImmunizationsTab patientId={patientId} />
            </TabsContent>

            <TabsContent value="care-plan" className="mt-0">
              <CarePlanTab patientId={patientId} />
            </TabsContent>

            <TabsContent value="devices" className="mt-0">
              <DevicesTab patientId={patientId} />
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
              <DocumentsTab patientId={patientId} />
            </TabsContent>

            <TabsContent value="family-history" className="mt-0">
              <FamilyHistoryTab patientId={patientId} />
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <HistoryTab patientId={patientId} />
            </TabsContent>
          </Suspense>
        </div>
      </Tabs>
    </div>
  );
}
