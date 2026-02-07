import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Download,
  Eye,
  FileText,
  File,
  FileCode,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useDocuments,
  useUploadDocument,
  type DocumentReference,
} from '@/hooks/use-api';
import api from '@/lib/api';

interface DocumentsTabProps {
  patientId: string;
}

const statusColors: Record<string, string> = {
  current:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  superseded:
    'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  'entered-in-error':
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsTab({ patientId }: DocumentsTabProps) {
  const { data: documents, isLoading, error } = useDocuments(patientId);
  const uploadDocument = useUploadDocument();

  const [searchQuery, setSearchQuery] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState('clinical');
  const [uploadDescription, setUploadDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);

  const filteredDocs = (documents || []).filter((doc) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      doc.type.toLowerCase().includes(query) ||
      doc.description.toLowerCase().includes(query) ||
      doc.author.toLowerCase().includes(query)
    );
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setUploadFile(file);
  };

  const handleUpload = useCallback(async () => {
    if (!uploadFile) return;
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('type', uploadType);
    formData.append('description', uploadDescription);

    await uploadDocument.mutateAsync({ patientId, formData });
    setUploadDialogOpen(false);
    setUploadFile(null);
    setUploadDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [uploadFile, uploadType, uploadDescription, patientId, uploadDocument]);

  const handleDownload = useCallback(
    async (doc: DocumentReference) => {
      if (doc.url) {
        window.open(doc.url, '_blank');
      } else {
        try {
          const response = await api.get(
            `/patients/${patientId}/documents/${doc.id}/download`,
            { responseType: 'blob' },
          );
          const url = window.URL.createObjectURL(
            new Blob([response.data]),
          );
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', doc.description || 'document');
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
        } catch {
          // Download failed silently
        }
      }
    },
    [patientId],
  );

  const handleExportCCDA = useCallback(async () => {
    setExporting(true);
    try {
      const response = await api.get(
        `/patients/${patientId}/documents/export/ccda`,
        { responseType: 'blob' },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `patient_${patientId}_ccda.xml`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Export failed silently
    } finally {
      setExporting(false);
    }
  }, [patientId]);

  const handleExportFHIR = useCallback(async () => {
    setExporting(true);
    try {
      const response = await api.get(
        `/patients/${patientId}/documents/export/fhir`,
        { responseType: 'blob' },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `patient_${patientId}_fhir_bundle.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Export failed silently
    } finally {
      setExporting(false);
    }
  }, [patientId]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">
            Failed to load documents. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents
              </CardTitle>
              <CardDescription>
                Clinical documents, attachments, and export options
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="gap-1"
                onClick={handleExportCCDA}
                disabled={exporting}
              >
                <FileCode className="h-4 w-4" />
                Export C-CDA
              </Button>
              <Button
                variant="outline"
                className="gap-1"
                onClick={handleExportFHIR}
                disabled={exporting}
              >
                <FileCode className="h-4 w-4" />
                Export FHIR
              </Button>
              <Button
                className="gap-1"
                onClick={() => setUploadDialogOpen(true)}
              >
                <Upload className="h-4 w-4" />
                Upload Document
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{doc.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(doc.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>{doc.author}</TableCell>
                    <TableCell className="font-medium">
                      {doc.description}
                    </TableCell>
                    <TableCell>{formatFileSize(doc.size)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusColors[doc.status] || ''}
                      >
                        {doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {doc.url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(doc.url, '_blank')}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownload(doc)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredDocs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      {documents && documents.length > 0
                        ? 'No documents match the search query.'
                        : 'No documents on file for this patient.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a new document to the patient's chart.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="docFile">File</Label>
              <Input
                id="docFile"
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              {uploadFile && (
                <p className="text-xs text-muted-foreground">
                  {uploadFile.name} ({formatFileSize(uploadFile.size)})
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clinical">Clinical Document</SelectItem>
                  <SelectItem value="lab">Lab Report</SelectItem>
                  <SelectItem value="imaging">Imaging Report</SelectItem>
                  <SelectItem value="consent">Consent Form</SelectItem>
                  <SelectItem value="referral">Referral Letter</SelectItem>
                  <SelectItem value="insurance">Insurance Document</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="docDescription">Description</Label>
              <Input
                id="docDescription"
                placeholder="Brief description of the document..."
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || uploadDocument.isPending}
            >
              {uploadDocument.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
