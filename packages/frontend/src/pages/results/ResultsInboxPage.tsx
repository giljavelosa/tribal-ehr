import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Bell,
  Send,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { usePatientContext } from '@/stores/patient-context-store';
import { usePatientContextFromUrl } from '@/hooks/use-patient-context-url';
import api from '@/lib/api';
import {
  useResultsInbox,
  useAcknowledgeResult,
  useBulkAcknowledgeResults,
  type ResultsInboxItem,
} from '@/hooks/use-api';

// Map priority to a display-friendly flag
function getPriorityFlag(result: ResultsInboxItem): 'Normal' | 'Abnormal' | 'Critical' {
  if (result.priority === 'stat') return 'Critical';
  if (result.priority === 'urgent' || result.priority === 'asap') return 'Abnormal';
  return 'Normal';
}

const flagColors: Record<string, string> = {
  Normal: '',
  Abnormal:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  Critical:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

// Map orderType to display type
function getResultType(orderType: string): string {
  switch (orderType) {
    case 'laboratory':
      return 'lab';
    case 'imaging':
      return 'imaging';
    case 'medication':
      return 'medication';
    default:
      return orderType;
  }
}

export function ResultsInboxPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const activePatient = usePatientContext((s) => s.activePatient);
  usePatientContextFromUrl();
  const [searchQuery, setSearchQuery] = useState(() =>
    activePatient ? `${activePatient.firstName} ${activePatient.lastName}` : '',
  );
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAbnormal, setFilterAbnormal] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [detailResult, setDetailResult] = useState<ResultsInboxItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyResult, setNotifyResult] = useState<ResultsInboxItem | null>(null);
  const [notifyMethod, setNotifyMethod] = useState('phone');
  const [notifyNotes, setNotifyNotes] = useState('');
  const [notifying, setNotifying] = useState(false);
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());
  // Track locally acknowledged IDs for optimistic UI update between refetches
  const [locallyAcknowledgedIds, setLocallyAcknowledgedIds] = useState<Set<string>>(new Set());

  // API hooks
  const resultsQuery = useResultsInbox();
  const acknowledgeMutation = useAcknowledgeResult();
  const bulkAcknowledgeMutation = useBulkAcknowledgeResults();

  // The API returns unacknowledged results. We treat "acknowledged" as "reviewed".
  // Since the API only returns unacknowledged results, all items from the query are "unreviewed"
  // unless locally acknowledged (optimistic).
  const results = resultsQuery.data ?? [];

  const isAcknowledged = useCallback(
    (id: string) => locallyAcknowledgedIds.has(id),
    [locallyAcknowledgedIds],
  );

  const unreviewedResults = useMemo(
    () => results.filter((r) => !isAcknowledged(r.id)),
    [results, isAcknowledged],
  );
  const reviewedResults = useMemo(
    () => results.filter((r) => isAcknowledged(r.id)),
    [results, isAcknowledged],
  );
  const criticalCount = useMemo(
    () => unreviewedResults.filter((r) => getPriorityFlag(r) === 'Critical').length,
    [unreviewedResults],
  );

  const applyFilters = useCallback(
    (list: ResultsInboxItem[]) => {
      return list.filter((r) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const testName = r.codeDisplay || '';
          const patientId = r.patientId || '';
          if (
            !testName.toLowerCase().includes(q) &&
            !patientId.toLowerCase().includes(q) &&
            !(r.notes || '').toLowerCase().includes(q)
          )
            return false;
        }
        if (filterType !== 'all') {
          const mappedType = getResultType(r.orderType);
          if (mappedType !== filterType) return false;
        }
        if (filterAbnormal && getPriorityFlag(r) === 'Normal') return false;
        if (dateFrom) {
          const rDate = new Date(r.orderedAt);
          const fDate = new Date(dateFrom);
          if (rDate < fDate) return false;
        }
        if (dateTo) {
          const rDate = new Date(r.orderedAt);
          const tDate = new Date(dateTo);
          tDate.setHours(23, 59, 59, 999);
          if (rDate > tDate) return false;
        }
        return true;
      });
    },
    [searchQuery, filterType, filterAbnormal, dateFrom, dateTo],
  );

  const filteredUnreviewed = useMemo(
    () => applyFilters(unreviewedResults),
    [applyFilters, unreviewedResults],
  );
  const filteredReviewed = useMemo(
    () => applyFilters(reviewedResults),
    [applyFilters, reviewedResults],
  );
  const filteredAll = useMemo(
    () => applyFilters(results),
    [applyFilters, results],
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = (list: ResultsInboxItem[]) => {
    const unreviewedInList = list.filter((r) => !isAcknowledged(r.id));
    const allSelected = unreviewedInList.every((r) => selectedIds.has(r.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      unreviewedInList.forEach((r) => {
        if (allSelected) {
          next.delete(r.id);
        } else {
          next.add(r.id);
        }
      });
      return next;
    });
  };

  const markAsReviewed = useCallback(
    (id: string) => {
      // Optimistic local state update
      setLocallyAcknowledgedIds((prev) => new Set(prev).add(id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      // Fire API call
      acknowledgeMutation.mutate(id);
    },
    [acknowledgeMutation],
  );

  const bulkMarkReviewed = useCallback(() => {
    const ids = Array.from(selectedIds);
    // Optimistic local state
    setLocallyAcknowledgedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setSelectedIds(new Set());
    // Fire API call
    bulkAcknowledgeMutation.mutate(ids);
  }, [selectedIds, bulkAcknowledgeMutation]);

  const openDetail = (result: ResultsInboxItem) => {
    setDetailResult(result);
    setDetailOpen(true);
  };

  const openNotifyDialog = (result: ResultsInboxItem) => {
    setNotifyResult(result);
    setNotifyMethod('phone');
    setNotifyNotes('');
    setNotifyOpen(true);
  };

  const handleNotifyPatient = useCallback(async () => {
    if (!notifyResult) return;
    setNotifying(true);
    try {
      await api.post(`/results-inbox/${notifyResult.id}/notify-patient`, {
        patientId: notifyResult.patientId,
        notificationMethod: notifyMethod,
        notes: notifyNotes || undefined,
      });
      setNotifiedIds((prev) => new Set(prev).add(notifyResult.id));
      setNotifyOpen(false);
    } catch {
      // Silently handle - notification endpoint may not be available
    } finally {
      setNotifying(false);
    }
  }, [notifyResult, notifyMethod, notifyNotes]);

  const renderFilterBar = () => (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Search test, patient ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          aria-label="Search results by test name or patient ID"
        />
      </div>
      <Select value={filterType} onValueChange={setFilterType}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="lab">Lab</SelectItem>
          <SelectItem value="imaging">Imaging</SelectItem>
          <SelectItem value="medication">Medication</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[140px]"
          aria-label="Filter from date"
        />
        <span className="text-muted-foreground" aria-hidden="true">to</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-[140px]"
          aria-label="Filter to date"
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="filterAbnormal"
          checked={filterAbnormal}
          onCheckedChange={(checked) => setFilterAbnormal(checked === true)}
        />
        <Label htmlFor="filterAbnormal" className="cursor-pointer text-sm">
          Urgent/Critical only
        </Label>
      </div>
    </div>
  );

  const renderResultRow = (
    result: ResultsInboxItem,
    showCheckbox: boolean,
    showActions: boolean,
  ) => {
    const flag = getPriorityFlag(result);
    const reviewed = isAcknowledged(result.id);
    return (
      <TableRow
        key={result.id}
        className={`${
          flag === 'Critical' && !reviewed
            ? 'bg-destructive/5'
            : !reviewed
              ? 'bg-primary/5'
              : ''
        }`}
      >
        {showCheckbox && (
          <TableCell>
            {!reviewed && (
              <Checkbox
                checked={selectedIds.has(result.id)}
                onCheckedChange={() => toggleSelect(result.id)}
                aria-label={`Select result ${result.codeDisplay || result.orderType} for patient ${result.patientId}`}
              />
            )}
          </TableCell>
        )}
        <TableCell className="font-medium">{result.patientId}</TableCell>
        <TableCell>{result.codeDisplay || result.orderType}</TableCell>
        <TableCell>
          <span className={flag !== 'Normal' ? 'font-semibold' : ''}>
            {result.notes || result.status}
          </span>
        </TableCell>
        <TableCell>
          {flag !== 'Normal' ? (
            <Badge
              variant={flag === 'Critical' ? 'destructive' : 'outline'}
              className={flagColors[flag] || ''}
            >
              {flag}
            </Badge>
          ) : (
            <Badge variant="outline">Normal</Badge>
          )}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {new Date(result.orderedAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </TableCell>
        <TableCell>
          {reviewed ? (
            <Badge
              variant="outline"
              className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
            >
              Reviewed
            </Badge>
          ) : (
            <Badge variant="secondary">Unreviewed</Badge>
          )}
        </TableCell>
        {showActions && (
          <TableCell>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => openDetail(result)}
              >
                <Eye className="h-3.5 w-3.5" />
                Review
              </Button>
              {!reviewed && (
                <Button
                  size="sm"
                  onClick={() => markAsReviewed(result.id)}
                  disabled={acknowledgeMutation.isPending}
                >
                  Sign
                </Button>
              )}
              {reviewed &&
                (notifiedIds.has(result.id) ? (
                  <Badge
                    variant="outline"
                    className="bg-green-100 text-green-800"
                  >
                    <Bell className="mr-1 h-3 w-3" />
                    Notified
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => openNotifyDialog(result)}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Notify
                  </Button>
                ))}
            </div>
          </TableCell>
        )}
      </TableRow>
    );
  };

  if (resultsQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status" aria-label="Loading results">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" aria-hidden="true" />
        <span className="text-muted-foreground">Loading results...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Results Inbox</h1>
          <p className="text-muted-foreground">
            Review and sign off on patient test results
          </p>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {criticalCount} Critical
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1">
            {unreviewedResults.length} Unreviewed
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="unreviewed">
        <TabsList>
          <TabsTrigger value="unreviewed">
            Unreviewed ({unreviewedResults.length})
          </TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
          <TabsTrigger value="all">All Results</TabsTrigger>
        </TabsList>

        <TabsContent value="unreviewed">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Unreviewed Results</CardTitle>
                  <CardDescription>
                    Results requiring your review and signature
                  </CardDescription>
                </div>
                {selectedIds.size > 0 && (
                  <Button
                    className="gap-1"
                    onClick={bulkMarkReviewed}
                    disabled={bulkAcknowledgeMutation.isPending}
                  >
                    {bulkAcknowledgeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Sign Selected ({selectedIds.size})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {renderFilterBar()}
              <Table aria-label="Unreviewed test results">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          filteredUnreviewed.length > 0 &&
                          filteredUnreviewed.every((r) =>
                            selectedIds.has(r.id),
                          )
                        }
                        onCheckedChange={() =>
                          toggleSelectAll(filteredUnreviewed)
                        }
                        aria-label="Select all unreviewed results"
                      />
                    </TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Flag</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnreviewed.map((r) =>
                    renderResultRow(r, true, true),
                  )}
                  {filteredUnreviewed.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        {unreviewedResults.length > 0
                          ? 'No unreviewed results match the current filters.'
                          : 'All results have been reviewed.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviewed">
          <Card>
            <CardHeader>
              <CardTitle>Reviewed Results</CardTitle>
              <CardDescription>
                Previously reviewed and signed results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderFilterBar()}
              <Table aria-label="Reviewed test results">
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Flag</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReviewed.map((result) => {
                    const flag = getPriorityFlag(result);
                    return (
                      <TableRow
                        key={result.id}
                        className="cursor-pointer"
                        onClick={() => openDetail(result)}
                      >
                        <TableCell className="font-medium">
                          {result.patientId}
                        </TableCell>
                        <TableCell>{result.codeDisplay || result.orderType}</TableCell>
                        <TableCell>{result.notes || result.status}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              flag === 'Critical'
                                ? 'destructive'
                                : 'outline'
                            }
                            className={flagColors[flag] || ''}
                          >
                            {flag}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {new Date(result.orderedAt).toLocaleDateString(
                            'en-US',
                            {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            },
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          >
                            Reviewed
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredReviewed.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        No reviewed results match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Results</CardTitle>
              <CardDescription>
                Complete results history with advanced filtering
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderFilterBar()}
              <Table aria-label="All test results">
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Flag</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAll.map((result) => {
                    const flag = getPriorityFlag(result);
                    const reviewed = isAcknowledged(result.id);
                    return (
                      <TableRow
                        key={result.id}
                        className={`cursor-pointer ${
                          flag === 'Critical' && !reviewed
                            ? 'bg-destructive/5'
                            : !reviewed
                              ? 'bg-primary/5'
                              : ''
                        }`}
                        onClick={() => openDetail(result)}
                      >
                        <TableCell className="font-medium">
                          {result.patientId}
                        </TableCell>
                        <TableCell>{result.codeDisplay || result.orderType}</TableCell>
                        <TableCell>
                          <span
                            className={
                              flag !== 'Normal' ? 'font-semibold' : ''
                            }
                          >
                            {result.notes || result.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              flag === 'Critical'
                                ? 'destructive'
                                : 'outline'
                            }
                            className={flagColors[flag] || ''}
                          >
                            {flag}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {new Date(result.orderedAt).toLocaleDateString(
                            'en-US',
                            {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            },
                          )}
                        </TableCell>
                        <TableCell>
                          {reviewed ? (
                            <Badge
                              variant="outline"
                              className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            >
                              Reviewed
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Unreviewed</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!reviewed && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsReviewed(result.id);
                              }}
                              disabled={acknowledgeMutation.isPending}
                            >
                              Sign
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredAll.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        No results match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Notify Patient Dialog */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notify Patient of Result</DialogTitle>
            <DialogDescription>
              Record how the patient was notified of: {notifyResult?.codeDisplay || notifyResult?.orderType}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Notification Method</Label>
              <Select value={notifyMethod} onValueChange={setNotifyMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="portal">Patient Portal</SelectItem>
                  <SelectItem value="in-person">In Person</SelectItem>
                  <SelectItem value="mail">Mail</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                rows={3}
                placeholder="Any details about the notification..."
                value={notifyNotes}
                onChange={(e) => setNotifyNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={notifying}
              onClick={handleNotifyPatient}
              className="gap-1"
            >
              <Send className="h-4 w-4" />
              {notifying ? 'Recording...' : 'Record Notification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detailResult?.codeDisplay || detailResult?.orderType}</DialogTitle>
            <DialogDescription>
              Patient: {detailResult?.patientId}
            </DialogDescription>
          </DialogHeader>
          {detailResult && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 text-center">
                <span
                  className={`text-2xl font-bold ${
                    getPriorityFlag(detailResult) === 'Critical'
                      ? 'text-destructive'
                      : getPriorityFlag(detailResult) === 'Abnormal'
                        ? 'text-amber-700 dark:text-amber-400'
                        : ''
                  }`}
                >
                  {detailResult.status}
                </span>
                {getPriorityFlag(detailResult) !== 'Normal' && (
                  <Badge
                    variant={
                      getPriorityFlag(detailResult) === 'Critical'
                        ? 'destructive'
                        : 'outline'
                    }
                    className={`ml-3 ${flagColors[getPriorityFlag(detailResult)] || ''}`}
                  >
                    {getPriorityFlag(detailResult)}
                  </Badge>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Type</span>
                  <Badge variant="outline" className="capitalize">
                    {getResultType(detailResult.orderType)}
                  </Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Priority</span>
                  <span className="capitalize">{detailResult.priority}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ordered</span>
                  <span>
                    {new Date(detailResult.orderedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {detailResult.signedAt && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Signed</span>
                      <span>
                        {new Date(detailResult.signedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </>
                )}
                {detailResult.clinicalIndication && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clinical Indication</span>
                      <span>{detailResult.clinicalIndication}</span>
                    </div>
                  </>
                )}
                {detailResult.notes && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Notes</span>
                      <span>{detailResult.notes}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
            {detailResult && !isAcknowledged(detailResult.id) && (
              <Button
                className="gap-1"
                onClick={() => {
                  markAsReviewed(detailResult.id);
                  setDetailOpen(false);
                }}
                disabled={acknowledgeMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark as Reviewed
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
