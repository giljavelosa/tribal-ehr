import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Download,
  Loader2,
  AlertCircle,
  FileCode,
  FileJson,
  File,
  Calendar,
  User,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/toast';
import api from '@/lib/api';

interface PatientDocument {
  id: string;
  type: string;
  description: string;
  date: string;
  author: string;
  contentType: string;
  size: number;
  status: string;
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

export function PatientDocumentsPage() {
  const [downloadingCCDA, setDownloadingCCDA] = useState(false);
  const [downloadingFHIR, setDownloadingFHIR] = useState(false);
  const [loadingPrint, setLoadingPrint] = useState(false);

  const { data: documents, isLoading, error } = useQuery({
    queryKey: ['portal', 'documents'],
    queryFn: async () => {
      const response = await api.get<PatientDocument[]>('/api/v1/portal/me/documents');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const todayStamp = new Date().toISOString().slice(0, 10);

  const handleDownload = async (doc: PatientDocument) => {
    try {
      const response = await api.get(`/api/v1/portal/me/documents/${doc.id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const ext = doc.contentType.includes('pdf')
        ? '.pdf'
        : doc.contentType.includes('xml')
          ? '.xml'
          : '';
      link.setAttribute('download', `${doc.description}${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast({
        title: 'Download failed',
        description: 'Unable to download this document. Please try again.',
        variant: 'destructive',
      });
    }
  };

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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.includes('pdf')) return <FileText className="h-5 w-5 text-red-600" aria-hidden="true" />;
    if (contentType.includes('xml')) return <FileCode className="h-5 w-5 text-orange-600" aria-hidden="true" />;
    if (contentType.includes('json')) return <FileJson className="h-5 w-5 text-blue-600" aria-hidden="true" />;
    return <File className="h-5 w-5 text-gray-600" aria-hidden="true" />;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="status">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">Loading documents...</p>
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
              <p className="font-semibold">Unable to load documents</p>
              <p className="mt-1 text-sm text-muted-foreground">Please try again later.</p>
            </div>
            <Button onClick={() => window.location.reload()}>Refresh</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const docs = documents ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Documents</h1>
          <p className="mt-1 text-muted-foreground">
            Access your health documents and export records
          </p>
        </div>
      </div>

      {/* Download My Health Data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Download My Health Data</CardTitle>
          <CardDescription>
            Download your complete health record in standard formats or print a summary
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExportCCDA}
              disabled={downloadingCCDA}
            >
              {downloadingCCDA ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileCode className="h-4 w-4" aria-hidden="true" />
              )}
              Download Health Summary (C-CDA)
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExportFHIR}
              disabled={downloadingFHIR}
            >
              {downloadingFHIR ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileJson className="h-4 w-4" aria-hidden="true" />
              )}
              Download Health Data (FHIR JSON)
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handlePrintSummary}
              disabled={loadingPrint}
            >
              {loadingPrint ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Printer className="h-4 w-4" aria-hidden="true" />
              )}
              Print Health Summary
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documents list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available Documents</CardTitle>
          <CardDescription>
            {docs.length} document{docs.length !== 1 ? 's' : ''} available
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {docs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <FileText className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
              <p className="text-muted-foreground">No documents available.</p>
            </div>
          ) : (
            <>
              {/* Mobile-friendly card list */}
              <div className="block sm:hidden">
                <ul role="list" aria-label="Documents list">
                  {docs.map((doc, idx) => (
                    <li key={doc.id}>
                      {idx > 0 && <Separator />}
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          {getFileIcon(doc.contentType)}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{doc.description}</p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" aria-hidden="true" />
                                {new Date(doc.date).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" aria-hidden="true" />
                                {doc.author}
                              </span>
                              <span>{formatFileSize(doc.size)}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <Badge variant="outline">{doc.type}</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                                onClick={() => handleDownload(doc)}
                                aria-label={`Download ${doc.description}`}
                              >
                                <Download className="h-3 w-3" aria-hidden="true" />
                                Download
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="w-[100px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getFileIcon(doc.contentType)}
                            <span className="font-medium">{doc.description}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{doc.type}</Badge>
                        </TableCell>
                        <TableCell>{new Date(doc.date).toLocaleDateString()}</TableCell>
                        <TableCell>{doc.author}</TableCell>
                        <TableCell>{formatFileSize(doc.size)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleDownload(doc)}
                            aria-label={`Download ${doc.description}`}
                          >
                            <Download className="h-4 w-4" aria-hidden="true" />
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
