import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Heart,
  Pill,
  AlertTriangle,
  Syringe,
  Activity,
  Download,
  Loader2,
  AlertCircle,
  FileJson,
  FileCode,
  FileText,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import api from '@/lib/api';

interface HealthSummary {
  conditions: Array<{
    id: string;
    display: string;
    clinicalStatus: string;
    onsetDate?: string;
    note?: string;
  }>;
  medications: Array<{
    id: string;
    medication: string;
    dose: string;
    frequency: string;
    prescriber?: string;
    status: string;
  }>;
  allergies: Array<{
    id: string;
    allergen: string;
    category: string;
    criticality: string;
    reactions: Array<{ manifestation: string; severity: string }>;
  }>;
  immunizations: Array<{
    id: string;
    vaccineDisplay: string;
    occurrenceDateTime: string;
    status: string;
    performer?: string;
    lotNumber?: string;
  }>;
  vitals: Array<{
    id: string;
    date: string;
    systolicBP?: number;
    diastolicBP?: number;
    heartRate?: number;
    temperature?: number;
    temperatureUnit?: string;
    spO2?: number;
    weight?: number;
    weightUnit?: string;
    height?: number;
    heightUnit?: string;
    bmi?: number;
  }>;
}

export function MyHealthPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['portal', 'health-summary'],
    queryFn: async () => {
      const response = await api.get<HealthSummary>('/api/v1/portal/me/health-summary');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleExportCCDA = async () => {
    try {
      const response = await api.get('/api/v1/portal/me/export/ccda', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'health-record.xml');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Error handled silently; user sees download failure
    }
  };

  const handleExportFHIR = async () => {
    try {
      const response = await api.get('/api/v1/portal/me/export/fhir', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'health-record.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Error handled silently; user sees download failure
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="status" aria-label="Loading health summary">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">Loading your health information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="alert">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <AlertCircle className="h-10 w-10 text-destructive" aria-hidden="true" />
            <div className="text-center">
              <p className="font-semibold">Unable to load health summary</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Please try again or contact your care team for assistance.
              </p>
            </div>
            <Button onClick={() => window.location.reload()}>Refresh Page</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = data;
  const conditions = summary?.conditions ?? [];
  const medications = summary?.medications ?? [];
  const allergies = summary?.allergies ?? [];
  const immunizations = summary?.immunizations ?? [];
  const vitals = summary?.vitals ?? [];
  const latestVitals = vitals.length > 0 ? vitals[0] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">My Health Summary</h1>
          <p className="mt-1 text-muted-foreground">
            A read-only view of your health record
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCCDA} className="gap-2">
            <FileCode className="h-4 w-4" aria-hidden="true" />
            Export C-CDA
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportFHIR} className="gap-2">
            <FileJson className="h-4 w-4" aria-hidden="true" />
            Export FHIR JSON
          </Button>
          <Button variant="outline" size="sm" disabled className="gap-2">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Latest vitals card */}
      {latestVitals && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
              <CardTitle className="text-lg">Recent Vital Signs</CardTitle>
            </div>
            <CardDescription>
              Recorded on {new Date(latestVitals.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              {latestVitals.systolicBP != null && latestVitals.diastolicBP != null && (
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs font-medium text-muted-foreground">Blood Pressure</p>
                  <p className="mt-1 text-xl font-bold">
                    {latestVitals.systolicBP}/{latestVitals.diastolicBP}
                  </p>
                  <p className="text-xs text-muted-foreground">mmHg</p>
                </div>
              )}
              {latestVitals.heartRate != null && (
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs font-medium text-muted-foreground">Heart Rate</p>
                  <p className="mt-1 text-xl font-bold">{latestVitals.heartRate}</p>
                  <p className="text-xs text-muted-foreground">bpm</p>
                </div>
              )}
              {latestVitals.temperature != null && (
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs font-medium text-muted-foreground">Temperature</p>
                  <p className="mt-1 text-xl font-bold">{latestVitals.temperature}</p>
                  <p className="text-xs text-muted-foreground">{latestVitals.temperatureUnit ?? 'F'}</p>
                </div>
              )}
              {latestVitals.spO2 != null && (
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs font-medium text-muted-foreground">Oxygen Saturation</p>
                  <p className="mt-1 text-xl font-bold">{latestVitals.spO2}%</p>
                  <p className="text-xs text-muted-foreground">SpO2</p>
                </div>
              )}
              {latestVitals.weight != null && (
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs font-medium text-muted-foreground">Weight</p>
                  <p className="mt-1 text-xl font-bold">{latestVitals.weight}</p>
                  <p className="text-xs text-muted-foreground">{latestVitals.weightUnit ?? 'lbs'}</p>
                </div>
              )}
              {latestVitals.bmi != null && (
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs font-medium text-muted-foreground">BMI</p>
                  <p className="mt-1 text-xl font-bold">{latestVitals.bmi.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">kg/m2</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="conditions" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="conditions" className="gap-2">
            <Heart className="h-4 w-4" aria-hidden="true" />
            Conditions
          </TabsTrigger>
          <TabsTrigger value="medications" className="gap-2">
            <Pill className="h-4 w-4" aria-hidden="true" />
            Medications
          </TabsTrigger>
          <TabsTrigger value="allergies" className="gap-2">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Allergies
          </TabsTrigger>
          <TabsTrigger value="immunizations" className="gap-2">
            <Syringe className="h-4 w-4" aria-hidden="true" />
            Immunizations
          </TabsTrigger>
          <TabsTrigger value="vitals" className="gap-2">
            <Activity className="h-4 w-4" aria-hidden="true" />
            Vitals History
          </TabsTrigger>
        </TabsList>

        {/* Conditions tab */}
        <TabsContent value="conditions">
          <Card>
            <CardHeader>
              <CardTitle>Active Conditions / Problems</CardTitle>
              <CardDescription>Your current diagnoses and health conditions</CardDescription>
            </CardHeader>
            <CardContent>
              {conditions.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No active conditions on record.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Condition</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Onset Date</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conditions.map((condition) => (
                      <TableRow key={condition.id}>
                        <TableCell className="font-medium">{condition.display}</TableCell>
                        <TableCell>
                          <Badge
                            variant={condition.clinicalStatus === 'active' ? 'default' : 'secondary'}
                          >
                            {condition.clinicalStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {condition.onsetDate
                            ? new Date(condition.onsetDate).toLocaleDateString()
                            : '--'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {condition.note || '--'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Medications tab */}
        <TabsContent value="medications">
          <Card>
            <CardHeader>
              <CardTitle>Current Medications</CardTitle>
              <CardDescription>Your active prescriptions and dosage information</CardDescription>
            </CardHeader>
            <CardContent>
              {medications.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No active medications on record.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medication</TableHead>
                      <TableHead>Dose</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Prescriber</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {medications.map((med) => (
                      <TableRow key={med.id}>
                        <TableCell className="font-medium">{med.medication}</TableCell>
                        <TableCell>{med.dose}</TableCell>
                        <TableCell>{med.frequency}</TableCell>
                        <TableCell>{med.prescriber || '--'}</TableCell>
                        <TableCell>
                          <Badge variant={med.status === 'active' ? 'default' : 'secondary'}>
                            {med.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Allergies tab */}
        <TabsContent value="allergies">
          <Card>
            <CardHeader>
              <CardTitle>Allergies</CardTitle>
              <CardDescription>Known allergies and intolerances</CardDescription>
            </CardHeader>
            <CardContent>
              {allergies.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No known allergies on record.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Allergen</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Criticality</TableHead>
                      <TableHead>Reactions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allergies.map((allergy) => (
                      <TableRow key={allergy.id}>
                        <TableCell className="font-medium">{allergy.allergen}</TableCell>
                        <TableCell className="capitalize">{allergy.category}</TableCell>
                        <TableCell>
                          <Badge
                            variant={allergy.criticality === 'high' ? 'destructive' : 'secondary'}
                          >
                            {allergy.criticality}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {allergy.reactions.length === 0
                            ? '--'
                            : allergy.reactions
                                .map((r) => `${r.manifestation} (${r.severity})`)
                                .join(', ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Immunizations tab */}
        <TabsContent value="immunizations">
          <Card>
            <CardHeader>
              <CardTitle>Immunization History</CardTitle>
              <CardDescription>Record of vaccines received</CardDescription>
            </CardHeader>
            <CardContent>
              {immunizations.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No immunization records available.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vaccine</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Administered By</TableHead>
                      <TableHead>Lot Number</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {immunizations.map((imm) => (
                      <TableRow key={imm.id}>
                        <TableCell className="font-medium">{imm.vaccineDisplay}</TableCell>
                        <TableCell>
                          {new Date(imm.occurrenceDateTime).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={imm.status === 'completed' ? 'default' : 'secondary'}>
                            {imm.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{imm.performer || '--'}</TableCell>
                        <TableCell>{imm.lotNumber || '--'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vitals history tab */}
        <TabsContent value="vitals">
          <Card>
            <CardHeader>
              <CardTitle>Vital Signs History</CardTitle>
              <CardDescription>Previous vital sign measurements</CardDescription>
            </CardHeader>
            <CardContent>
              {vitals.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No vital signs recorded.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>BP</TableHead>
                      <TableHead>HR</TableHead>
                      <TableHead>Temp</TableHead>
                      <TableHead>SpO2</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>BMI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vitals.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>{new Date(v.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {v.systolicBP != null && v.diastolicBP != null
                            ? `${v.systolicBP}/${v.diastolicBP}`
                            : '--'}
                        </TableCell>
                        <TableCell>{v.heartRate ?? '--'}</TableCell>
                        <TableCell>
                          {v.temperature != null ? `${v.temperature} ${v.temperatureUnit ?? 'F'}` : '--'}
                        </TableCell>
                        <TableCell>{v.spO2 != null ? `${v.spO2}%` : '--'}</TableCell>
                        <TableCell>
                          {v.weight != null ? `${v.weight} ${v.weightUnit ?? 'lbs'}` : '--'}
                        </TableCell>
                        <TableCell>{v.bmi != null ? v.bmi.toFixed(1) : '--'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
