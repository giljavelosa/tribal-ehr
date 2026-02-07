import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Shield,
  Search,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShieldCheck,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/toast';
import api from '@/lib/api';

interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress: string;
  statusCode: number;
  method: string;
  endpoint: string;
  userAgent?: string;
  sessionId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  clinicalContext?: string;
}

interface AuditSearchParams {
  dateFrom: string;
  dateTo: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  page: number;
  limit: number;
}

interface IntegrityResult {
  valid: boolean;
  totalRecords: number;
  checkedRecords: number;
  invalidRecords: number;
  message: string;
}

const actionTypes = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT'];
const resourceTypes = ['Patient', 'Encounter', 'Condition', 'Observation', 'MedicationRequest', 'AllergyIntolerance', 'Immunization', 'User', 'System'];

export function AuditLogPage() {
  const [filters, setFilters] = useState<AuditSearchParams>({
    dateFrom: '',
    dateTo: '',
    userId: '',
    action: 'all',
    resourceType: 'all',
    resourceId: '',
    page: 1,
    limit: 25,
  });
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [integrityResult, setIntegrityResult] = useState<IntegrityResult | null>(null);
  const [integrityDialogOpen, setIntegrityDialogOpen] = useState(false);

  const buildParams = () => {
    const params: Record<string, string | number> = {
      page: filters.page,
      limit: filters.limit,
    };
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.userId) params.userId = filters.userId;
    if (filters.action !== 'all') params.action = filters.action;
    if (filters.resourceType !== 'all') params.resourceType = filters.resourceType;
    if (filters.resourceId) params.resourceId = filters.resourceId;
    return params;
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'audit', filters],
    queryFn: async () => {
      const response = await api.get<{
        data: AuditEvent[];
        total: number;
        page: number;
        totalPages: number;
      }>('/api/v1/audit', { params: buildParams() });
      return response.data;
    },
    staleTime: 30 * 1000,
  });

  const verifyIntegrityMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get<IntegrityResult>('/api/v1/audit/verify-integrity');
      return response.data;
    },
    onSuccess: (result) => {
      setIntegrityResult(result);
      setIntegrityDialogOpen(true);
    },
    onError: () => {
      toast({ title: 'Verification failed', description: 'Unable to verify audit log integrity.', variant: 'destructive' });
    },
  });

  const handleExport = async (format: 'csv' | 'fhir') => {
    try {
      const params = { ...buildParams(), format };
      const response = await api.get('/api/v1/audit/export', {
        params,
        responseType: 'blob',
      });
      const ext = format === 'csv' ? '.csv' : '.json';
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-log${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Export downloaded' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  const handleViewDetail = (event: AuditEvent) => {
    setSelectedEvent(event);
    setDetailDialogOpen(true);
  };

  const events = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const statusBadgeVariant = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return 'default' as const;
    if (statusCode >= 400 && statusCode < 500) return 'outline' as const;
    return 'destructive' as const;
  };

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="alert">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div className="text-center">
              <p className="font-semibold">Unable to load audit log</p>
              <p className="mt-1 text-sm text-muted-foreground">Please try again later.</p>
            </div>
            <Button onClick={() => window.location.reload()}>Refresh</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground">
            System audit trail and compliance monitoring
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => verifyIntegrityMutation.mutate()}
            disabled={verifyIntegrityMutation.isPending}
            className="gap-2"
          >
            {verifyIntegrityMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Verify Integrity
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('fhir')} className="gap-2">
            <Download className="h-4 w-4" />
            Export FHIR
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="audit-date-from">Date From</Label>
              <Input
                id="audit-date-from"
                type="datetime-local"
                value={filters.dateFrom}
                onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value, page: 1 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-date-to">Date To</Label>
              <Input
                id="audit-date-to"
                type="datetime-local"
                value={filters.dateTo}
                onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value, page: 1 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-user">User</Label>
              <Input
                id="audit-user"
                placeholder="User ID or name"
                value={filters.userId}
                onChange={(e) => setFilters((p) => ({ ...p, userId: e.target.value, page: 1 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-resource-id">Resource ID</Label>
              <Input
                id="audit-resource-id"
                placeholder="Resource ID"
                value={filters.resourceId}
                onChange={(e) => setFilters((p) => ({ ...p, resourceId: e.target.value, page: 1 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={filters.action}
                onValueChange={(v) => setFilters((p) => ({ ...p, action: v, page: 1 }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actionTypes.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resource Type</Label>
              <Select
                value={filters.resourceType}
                onValueChange={(v) => setFilters((p) => ({ ...p, resourceType: v, page: 1 }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {resourceTypes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardDescription aria-live="polite">
              {isLoading ? 'Loading...' : `${total} event${total !== 1 ? 's' : ''} found`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12" role="status" aria-label="Loading audit events">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Shield className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No audit events found for the selected filters.</p>
            </div>
          ) : (
            <Table aria-label="Audit log events">
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Resource ID</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id} className="cursor-pointer" onClick={() => handleViewDetail(event)}>
                    <TableCell className="text-xs">
                      {new Date(event.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="text-sm">{event.userName || event.userId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{event.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{event.resourceType}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs font-mono">
                      {event.resourceId}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{event.ipAddress}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(event.statusCode)}>
                        {event.statusCode}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetail(event);
                        }}
                        aria-label="View event detail"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Page {filters.page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page >= totalPages}
                  onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event detail dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Event Detail</DialogTitle>
            <DialogDescription>
              Event ID: {selectedEvent?.id}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
                  <p>{new Date(selectedEvent.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">User</p>
                  <p>{selectedEvent.userName || selectedEvent.userId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Action</p>
                  <Badge variant="outline">{selectedEvent.action}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge variant={statusBadgeVariant(selectedEvent.statusCode)}>
                    {selectedEvent.statusCode}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Resource Type</p>
                  <p>{selectedEvent.resourceType}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Resource ID</p>
                  <p className="font-mono text-sm">{selectedEvent.resourceId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">IP Address</p>
                  <p className="font-mono text-sm">{selectedEvent.ipAddress}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Method / Endpoint</p>
                  <p className="font-mono text-sm">{selectedEvent.method} {selectedEvent.endpoint}</p>
                </div>
                {selectedEvent.sessionId && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Session ID</p>
                    <p className="truncate font-mono text-xs">{selectedEvent.sessionId}</p>
                  </div>
                )}
                {selectedEvent.userAgent && (
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">User Agent</p>
                    <p className="truncate text-xs">{selectedEvent.userAgent}</p>
                  </div>
                )}
                {selectedEvent.clinicalContext && (
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Clinical Context</p>
                    <p className="text-sm">{selectedEvent.clinicalContext}</p>
                  </div>
                )}
              </div>

              {selectedEvent.oldValue && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-2 text-sm font-medium text-muted-foreground">Previous Value</p>
                    <pre className="max-h-[200px] overflow-auto rounded-lg bg-muted p-3 text-xs">
                      {JSON.stringify(selectedEvent.oldValue, null, 2)}
                    </pre>
                  </div>
                </>
              )}

              {selectedEvent.newValue && (
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">New Value</p>
                  <pre className="max-h-[200px] overflow-auto rounded-lg bg-muted p-3 text-xs">
                    {JSON.stringify(selectedEvent.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Integrity verification dialog */}
      <Dialog open={integrityDialogOpen} onOpenChange={setIntegrityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Audit Log Integrity Verification</DialogTitle>
            <DialogDescription>Results of hash chain integrity check</DialogDescription>
          </DialogHeader>
          {integrityResult && (
            <div className="flex flex-col items-center gap-4 py-4">
              {integrityResult.valid ? (
                <CheckCircle2 className="h-16 w-16 text-green-600" />
              ) : (
                <XCircle className="h-16 w-16 text-destructive" />
              )}
              <Badge
                className="text-lg"
                variant={integrityResult.valid ? 'default' : 'destructive'}
              >
                {integrityResult.valid ? 'Integrity Verified' : 'Integrity Compromised'}
              </Badge>
              <div className="space-y-1 text-center text-sm">
                <p>Total records: {integrityResult.totalRecords}</p>
                <p>Records checked: {integrityResult.checkedRecords}</p>
                {integrityResult.invalidRecords > 0 && (
                  <p className="font-semibold text-destructive">
                    Invalid records: {integrityResult.invalidRecords}
                  </p>
                )}
                <p className="mt-2 text-muted-foreground">{integrityResult.message}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIntegrityDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
