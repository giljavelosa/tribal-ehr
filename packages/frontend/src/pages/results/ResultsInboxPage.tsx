import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Filter,
  Bell,
  Send,
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

interface LabResult {
  id: string;
  patient: string;
  patientId: string;
  test: string;
  result: string;
  units: string;
  referenceRange: string;
  flag: 'Normal' | 'Abnormal' | 'Critical';
  received: string;
  reviewed: boolean;
  reviewedDate?: string;
  resultType: 'lab' | 'imaging' | 'pathology';
}

const mockResults: LabResult[] = [
  {
    id: 'RES-001',
    patient: 'Robert Williams',
    patientId: 'P-001',
    test: 'Potassium',
    result: '6.2',
    units: 'mEq/L',
    referenceRange: '3.5-5.0',
    flag: 'Critical',
    received: '2024-01-12T08:30:00',
    reviewed: false,
    resultType: 'lab',
  },
  {
    id: 'RES-002',
    patient: 'Mary Johnson',
    patientId: 'P-002',
    test: 'CBC with Differential',
    result: 'WBC: 12.5, Hgb: 11.2, Plt: 245',
    units: 'multiple',
    referenceRange: 'See panel',
    flag: 'Abnormal',
    received: '2024-01-12T07:15:00',
    reviewed: false,
    resultType: 'lab',
  },
  {
    id: 'RES-003',
    patient: 'John Smith',
    patientId: 'P-003',
    test: 'Chest X-Ray',
    result: 'Bilateral infiltrates noted. Possible pneumonia.',
    units: '',
    referenceRange: '',
    flag: 'Abnormal',
    received: '2024-01-11T14:20:00',
    reviewed: false,
    resultType: 'imaging',
  },
  {
    id: 'RES-004',
    patient: 'Sarah Davis',
    patientId: 'P-004',
    test: 'Urinalysis',
    result: 'Within normal limits',
    units: '',
    referenceRange: '',
    flag: 'Normal',
    received: '2024-01-11T10:45:00',
    reviewed: true,
    reviewedDate: '2024-01-11T16:00:00',
    resultType: 'lab',
  },
  {
    id: 'RES-005',
    patient: 'James Brown',
    patientId: 'P-005',
    test: 'HbA1c',
    result: '8.9',
    units: '%',
    referenceRange: '< 5.7',
    flag: 'Abnormal',
    received: '2024-01-10T16:30:00',
    reviewed: true,
    reviewedDate: '2024-01-11T09:00:00',
    resultType: 'lab',
  },
  {
    id: 'RES-006',
    patient: 'Patricia Clark',
    patientId: 'P-006',
    test: 'TSH',
    result: '0.12',
    units: 'mIU/L',
    referenceRange: '0.4-4.0',
    flag: 'Abnormal',
    received: '2024-01-10T11:00:00',
    reviewed: true,
    reviewedDate: '2024-01-10T15:30:00',
    resultType: 'lab',
  },
  {
    id: 'RES-007',
    patient: 'Michael Wilson',
    patientId: 'P-007',
    test: 'Lipid Panel',
    result: 'TC: 188, LDL: 105, HDL: 52, TG: 155',
    units: 'mg/dL',
    referenceRange: 'See panel',
    flag: 'Normal',
    received: '2024-01-09T09:15:00',
    reviewed: true,
    reviewedDate: '2024-01-09T14:00:00',
    resultType: 'lab',
  },
  {
    id: 'RES-008',
    patient: 'Robert Williams',
    patientId: 'P-001',
    test: 'Troponin I',
    result: '< 0.01',
    units: 'ng/mL',
    referenceRange: '< 0.04',
    flag: 'Normal',
    received: '2024-01-12T09:00:00',
    reviewed: false,
    resultType: 'lab',
  },
];

const flagColors: Record<string, string> = {
  Normal: '',
  Abnormal:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  Critical:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function ResultsInboxPage() {
  const [results, setResults] = useState<LabResult[]>(mockResults);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const activePatient = usePatientContext((s) => s.activePatient);
  usePatientContextFromUrl();
  const [searchQuery, setSearchQuery] = useState(() =>
    // Pre-filter by active patient name if context is set
    activePatient ? `${activePatient.firstName} ${activePatient.lastName}` : ''
  );
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAbnormal, setFilterAbnormal] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [detailResult, setDetailResult] = useState<LabResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyResult, setNotifyResult] = useState<LabResult | null>(null);
  const [notifyMethod, setNotifyMethod] = useState('phone');
  const [notifyNotes, setNotifyNotes] = useState('');
  const [notifying, setNotifying] = useState(false);
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());

  const unreviewedResults = useMemo(
    () => results.filter((r) => !r.reviewed),
    [results],
  );
  const reviewedResults = useMemo(
    () => results.filter((r) => r.reviewed),
    [results],
  );
  const criticalCount = useMemo(
    () => unreviewedResults.filter((r) => r.flag === 'Critical').length,
    [unreviewedResults],
  );

  const applyFilters = useCallback(
    (list: LabResult[]) => {
      return list.filter((r) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (
            !r.patient.toLowerCase().includes(q) &&
            !r.test.toLowerCase().includes(q) &&
            !r.result.toLowerCase().includes(q)
          )
            return false;
        }
        if (filterType !== 'all' && r.resultType !== filterType) return false;
        if (filterAbnormal && r.flag === 'Normal') return false;
        if (dateFrom) {
          const rDate = new Date(r.received);
          const fDate = new Date(dateFrom);
          if (rDate < fDate) return false;
        }
        if (dateTo) {
          const rDate = new Date(r.received);
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

  const toggleSelectAll = (list: LabResult[]) => {
    const unreviewedInList = list.filter((r) => !r.reviewed);
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
      setResults((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                reviewed: true,
                reviewedDate: new Date().toISOString(),
              }
            : r,
        ),
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [],
  );

  const bulkMarkReviewed = useCallback(() => {
    setResults((prev) =>
      prev.map((r) =>
        selectedIds.has(r.id)
          ? {
              ...r,
              reviewed: true,
              reviewedDate: new Date().toISOString(),
            }
          : r,
      ),
    );
    setSelectedIds(new Set());
  }, [selectedIds]);

  const openDetail = (result: LabResult) => {
    setDetailResult(result);
    setDetailOpen(true);
  };

  const openNotifyDialog = (result: LabResult) => {
    setNotifyResult(result);
    setNotifyMethod('phone');
    setNotifyNotes('');
    setNotifyOpen(true);
  };

  const handleNotifyPatient = useCallback(async () => {
    if (!notifyResult) return;
    setNotifying(true);
    try {
      await api.post(`/api/v1/results-inbox/${notifyResult.id}/notify-patient`, {
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
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search patient, test, result..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
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
          <SelectItem value="pathology">Pathology</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-[140px]"
        />
        <span className="text-muted-foreground">to</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-[140px]"
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="filterAbnormal"
          checked={filterAbnormal}
          onCheckedChange={(checked) => setFilterAbnormal(checked === true)}
        />
        <Label htmlFor="filterAbnormal" className="cursor-pointer text-sm">
          Abnormal only
        </Label>
      </div>
    </div>
  );

  const renderResultRow = (
    result: LabResult,
    showCheckbox: boolean,
    showActions: boolean,
  ) => (
    <TableRow
      key={result.id}
      className={`${
        result.flag === 'Critical' && !result.reviewed
          ? 'bg-destructive/5'
          : !result.reviewed
            ? 'bg-primary/5'
            : ''
      }`}
    >
      {showCheckbox && (
        <TableCell>
          {!result.reviewed && (
            <Checkbox
              checked={selectedIds.has(result.id)}
              onCheckedChange={() => toggleSelect(result.id)}
            />
          )}
        </TableCell>
      )}
      <TableCell className="font-medium">{result.patient}</TableCell>
      <TableCell>{result.test}</TableCell>
      <TableCell>
        <span
          className={
            result.flag !== 'Normal' ? 'font-semibold' : ''
          }
        >
          {result.result}
        </span>
      </TableCell>
      <TableCell>
        {result.flag !== 'Normal' ? (
          <Badge
            variant={result.flag === 'Critical' ? 'destructive' : 'outline'}
            className={flagColors[result.flag] || ''}
          >
            {result.flag}
          </Badge>
        ) : (
          <Badge variant="outline">Normal</Badge>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {new Date(result.received).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </TableCell>
      <TableCell>
        {result.reviewed ? (
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
            {!result.reviewed && (
              <Button
                size="sm"
                onClick={() => markAsReviewed(result.id)}
              >
                Sign
              </Button>
            )}
            {result.reviewed && (
              notifiedIds.has(result.id) ? (
                <Badge variant="outline" className="bg-green-100 text-green-800">
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
              )
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );

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
                  <Button className="gap-1" onClick={bulkMarkReviewed}>
                    <CheckCircle2 className="h-4 w-4" />
                    Sign Selected ({selectedIds.size})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {renderFilterBar()}
              <Table>
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
              <Table>
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
                  {filteredReviewed.map((result) => (
                    <TableRow
                      key={result.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(result)}
                    >
                      <TableCell className="font-medium">
                        {result.patient}
                      </TableCell>
                      <TableCell>{result.test}</TableCell>
                      <TableCell>{result.result}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            result.flag === 'Critical'
                              ? 'destructive'
                              : result.flag === 'Abnormal'
                                ? 'outline'
                                : 'outline'
                          }
                          className={flagColors[result.flag] || ''}
                        >
                          {result.flag}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(result.received).toLocaleDateString(
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
                  ))}
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
              <Table>
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
                  {filteredAll.map((result) => (
                    <TableRow
                      key={result.id}
                      className={`cursor-pointer ${
                        result.flag === 'Critical' && !result.reviewed
                          ? 'bg-destructive/5'
                          : !result.reviewed
                            ? 'bg-primary/5'
                            : ''
                      }`}
                      onClick={() => openDetail(result)}
                    >
                      <TableCell className="font-medium">
                        {result.patient}
                      </TableCell>
                      <TableCell>{result.test}</TableCell>
                      <TableCell>
                        <span
                          className={
                            result.flag !== 'Normal' ? 'font-semibold' : ''
                          }
                        >
                          {result.result}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            result.flag === 'Critical'
                              ? 'destructive'
                              : 'outline'
                          }
                          className={flagColors[result.flag] || ''}
                        >
                          {result.flag}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(result.received).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          },
                        )}
                      </TableCell>
                      <TableCell>
                        {result.reviewed ? (
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
                        {!result.reviewed && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsReviewed(result.id);
                            }}
                          >
                            Sign
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
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
              Record how the patient was notified of: {notifyResult?.test}
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
            <DialogTitle>{detailResult?.test}</DialogTitle>
            <DialogDescription>
              Patient: {detailResult?.patient}
            </DialogDescription>
          </DialogHeader>
          {detailResult && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 text-center">
                <span
                  className={`text-2xl font-bold ${
                    detailResult.flag === 'Critical'
                      ? 'text-destructive'
                      : detailResult.flag === 'Abnormal'
                        ? 'text-amber-700 dark:text-amber-400'
                        : ''
                  }`}
                >
                  {detailResult.result}
                </span>
                {detailResult.units && (
                  <span className="ml-2 text-lg text-muted-foreground">
                    {detailResult.units}
                  </span>
                )}
                {detailResult.flag !== 'Normal' && (
                  <Badge
                    variant={
                      detailResult.flag === 'Critical'
                        ? 'destructive'
                        : 'outline'
                    }
                    className={`ml-3 ${flagColors[detailResult.flag] || ''}`}
                  >
                    {detailResult.flag}
                  </Badge>
                )}
              </div>

              <div className="space-y-2 text-sm">
                {detailResult.referenceRange && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Reference Range
                    </span>
                    <span>{detailResult.referenceRange}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Result Type</span>
                  <Badge variant="outline" className="capitalize">
                    {detailResult.resultType}
                  </Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Received</span>
                  <span>
                    {new Date(detailResult.received).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {detailResult.reviewedDate && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Reviewed
                      </span>
                      <span>
                        {new Date(
                          detailResult.reviewedDate,
                        ).toLocaleString('en-US', {
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
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
            {detailResult && !detailResult.reviewed && (
              <Button
                className="gap-1"
                onClick={() => {
                  markAsReviewed(detailResult.id);
                  setDetailOpen(false);
                }}
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
