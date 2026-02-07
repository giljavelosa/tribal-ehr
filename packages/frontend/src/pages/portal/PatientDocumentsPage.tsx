import React from 'react';
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

export function PatientDocumentsPage() {
  const { data: documents, isLoading, error } = useQuery({
    queryKey: ['portal', 'documents'],
    queryFn: async () => {
      const response = await api.get<PatientDocument[]>('/api/v1/portal/me/documents');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

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
      // Silent failure; user sees that download did not initiate
    }
  };

  const handleExportCCDA = async () => {
    try {
      const response = await api.get('/api/v1/portal/me/export/ccda', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'complete-health-record.xml');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Silent failure
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
      link.setAttribute('download', 'complete-health-record.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Silent failure
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

      {/* Export all records */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Export All Records</CardTitle>
          <CardDescription>
            Download your complete health record in standard formats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={handleExportCCDA}>
              <FileCode className="h-4 w-4" aria-hidden="true" />
              Export as C-CDA (XML)
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExportFHIR}>
              <FileJson className="h-4 w-4" aria-hidden="true" />
              Export as FHIR JSON Bundle
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
