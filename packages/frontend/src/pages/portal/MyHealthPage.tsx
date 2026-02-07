import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Heart,
  Pill,
  AlertTriangle,
  Syringe,
  Activity,
  Loader2,
  AlertCircle,
  FileJson,
  FileCode,
  Printer,
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
import { toast } from '@/components/ui/toast';
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

interface HealthSummaryExport {
  generatedAt: string;
  demographics: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    mrn: string;
  };
  allergies: Array<{ substance: string; reaction: string; criticality: string }>;
  medications: Array<{ name: string; dosage: string; status: string }>;
  conditions: Array<{ name: string; status: string; onsetDate: string | null }>;
  immunizations: Array<{ vaccine: string; date: string | null; status: string }>;
  recentVitals: Array<{ name: string; value: string; date: string | null }>;
  recentLabs: Array<{ name: string; value: string; date: string | null; referenceRange: string | null }>;
}

export function MyHealthPage() {
  const [downloadingCCDA, setDownloadingCCDA] = useState(false);
  const [downloadingFHIR, setDownloadingFHIR] = useState(false);
  const [loadingPrint, setLoadingPrint] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['portal', 'health-summary'],
    queryFn: async () => {
      const response = await api.get<HealthSummary>('/api/v1/portal/me/health-summary');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const todayStamp = new Date().toISOString().slice(0, 10);

  const handleExportCCDA = async () => {
    try {
      setDownloadingCCDA(true);
      const response = await api.get('/api/v1/portal/me/export/ccda', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `health-record-${todayStamp}.xml`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast({
        title: 'Export failed',
        description: 'Unable to export your health record as C-CDA. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingCCDA(false);
    }
  };

  const handleExportFHIR = async () => {
    try {
      setDownloadingFHIR(true);
      const response = await api.get('/api/v1/portal/me/export/fhir', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `health-record-${todayStamp}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast({
        title: 'Export failed',
        description: 'Unable to export your health record as FHIR JSON. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingFHIR(false);
    }
  };

  const handlePrintSummary = async () => {
    try {
      setLoadingPrint(true);
      const response = await api.get<{ data: HealthSummaryExport }>('/api/v1/portal/me/export/pdf');
      const summary = response.data.data;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({
          title: 'Pop-up blocked',
          description: 'Please allow pop-ups to print your health summary.',
          variant: 'destructive',
        });
        return;
      }

      const buildTableRows = (items: Array<Record<string, string | null>>, keys: string[]): string =>
        items
          .map(
            (item) =>
              `<tr>${keys.map((k) => `<td style="padding:6px 12px;border:1px solid #ddd;">${item[k] ?? '--'}</td>`).join('')}</tr>`,
          )
          .join('');

      const html = `<!DOCTYPE html>
<html><head><title>Health Summary - ${summary.demographics.firstName} ${summary.demographics.lastName}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 24px; border-bottom: 2px solid #2563eb; padding-bottom: 4px; color: #2563eb; }
  .subtitle { color: #666; font-size: 13px; margin-bottom: 16px; }
  .demo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 12px; }
  .demo-grid dt { font-weight: bold; font-size: 13px; }
  .demo-grid dd { margin: 0; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 13px; }
  th { background: #f3f4f6; text-align: left; padding: 6px 12px; border: 1px solid #ddd; font-weight: 600; }
  td { padding: 6px 12px; border: 1px solid #ddd; }
  .empty { color: #999; font-style: italic; padding: 12px 0; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>Patient Health Summary</h1>
<p class="subtitle">Generated on ${new Date(summary.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
<h2>Demographics</h2>
<dl class="demo-grid">
  <dt>Name</dt><dd>${summary.demographics.firstName} ${summary.demographics.lastName}</dd>
  <dt>Date of Birth</dt><dd>${summary.demographics.dateOfBirth ? new Date(summary.demographics.dateOfBirth).toLocaleDateString() : '--'}</dd>
  <dt>Gender</dt><dd>${summary.demographics.gender || '--'}</dd>
  <dt>MRN</dt><dd>${summary.demographics.mrn || '--'}</dd>
</dl>

<h2>Allergies</h2>
${summary.allergies.length === 0 ? '<p class="empty">No known allergies</p>' : `<table><thead><tr><th>Substance</th><th>Reaction</th><th>Criticality</th></tr></thead><tbody>${buildTableRows(summary.allergies, ['substance', 'reaction', 'criticality'])}</tbody></table>`}

<h2>Medications</h2>
${summary.medications.length === 0 ? '<p class="empty">No active medications</p>' : `<table><thead><tr><th>Medication</th><th>Dosage</th><th>Status</th></tr></thead><tbody>${buildTableRows(summary.medications, ['name', 'dosage', 'status'])}</tbody></table>`}

<h2>Conditions</h2>
${summary.conditions.length === 0 ? '<p class="empty">No active conditions</p>' : `<table><thead><tr><th>Condition</th><th>Status</th><th>Onset Date</th></tr></thead><tbody>${buildTableRows(summary.conditions, ['name', 'status', 'onsetDate'])}</tbody></table>`}

<h2>Immunizations</h2>
${summary.immunizations.length === 0 ? '<p class="empty">No immunization records</p>' : `<table><thead><tr><th>Vaccine</th><th>Date</th><th>Status</th></tr></thead><tbody>${buildTableRows(summary.immunizations, ['vaccine', 'date', 'status'])}</tbody></table>`}

<h2>Recent Vital Signs</h2>
${summary.recentVitals.length === 0 ? '<p class="empty">No recent vitals</p>' : `<table><thead><tr><th>Measurement</th><th>Value</th><th>Date</th></tr></thead><tbody>${buildTableRows(summary.recentVitals, ['name', 'value', 'date'])}</tbody></table>`}

<h2>Recent Lab Results</h2>
${summary.recentLabs.length === 0 ? '<p class="empty">No recent labs</p>' : `<table><thead><tr><th>Test</th><th>Value</th><th>Date</th><th>Reference Range</th></tr></thead><tbody>${buildTableRows(summary.recentLabs, ['name', 'value', 'date', 'referenceRange'])}</tbody></table>`}

<script>window.onload = function() { window.print(); }</script>
</body></html>`;

      printWindow.document.write(html);
      printWindow.document.close();
    } catch {
      toast({
        title: 'Print failed',
        description: 'Unable to load your health summary for printing. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingPrint(false);
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCCDA}
            disabled={downloadingCCDA}
            className="gap-2"
          >
            {downloadingCCDA ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileCode className="h-4 w-4" aria-hidden="true" />
            )}
            Export C-CDA
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportFHIR}
            disabled={downloadingFHIR}
            className="gap-2"
          >
            {downloadingFHIR ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileJson className="h-4 w-4" aria-hidden="true" />
            )}
            Export FHIR JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintSummary}
            disabled={loadingPrint}
            className="gap-2"
          >
            {loadingPrint ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Printer className="h-4 w-4" aria-hidden="true" />
            )}
            Print Summary
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
