import React, { useState, useMemo } from 'react';
import { FlaskConical, Search, AlertTriangle, Filter } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useObservations, type Observation } from '@/hooks/use-api';

interface LabResultsTabProps {
  patientId: string;
}

const flagColors: Record<string, string> = {
  H: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  L: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  HH: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  LL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  C: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 font-bold',
  N: '',
};

const flagLabels: Record<string, string> = {
  H: 'High',
  L: 'Low',
  HH: 'Critical High',
  LL: 'Critical Low',
  C: 'Critical',
  N: 'Normal',
};

// Simple inline mini trend sparkline for a lab value
function MiniTrendLine({ data }: { data: Array<{ value: number }> }) {
  if (!data || data.length < 2) return null;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const h = 20;
  const w = 60;
  const points = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`,
    )
    .join(' ');

  return (
    <svg width={w} height={h} className="inline-block ml-2">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-blue-500"
      />
    </svg>
  );
}

export function LabResultsTab({ patientId }: LabResultsTabProps) {
  const {
    data: observations,
    isLoading,
    error,
  } = useObservations(patientId, 'laboratory');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterAbnormalOnly, setFilterAbnormalOnly] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedResult, setSelectedResult] = useState<Observation | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);

  const filteredResults = useMemo(() => {
    if (!observations) return [];
    return observations.filter((obs) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !obs.display.toLowerCase().includes(q) &&
          !obs.code.toLowerCase().includes(q)
        )
          return false;
      }
      if (filterAbnormalOnly) {
        if (!obs.flag || obs.flag === 'N') return false;
      }
      if (filterStatus !== 'all' && obs.status !== filterStatus) return false;
      return true;
    });
  }, [observations, searchQuery, filterAbnormalOnly, filterStatus]);

  const pendingResults = useMemo(
    () =>
      (observations || []).filter(
        (o) => o.status === 'registered' || o.status === 'preliminary',
      ),
    [observations],
  );

  const openDetail = (obs: Observation) => {
    setSelectedResult(obs);
    setDetailOpen(true);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">
            Failed to load lab results. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending Results */}
      {pendingResults.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Pending Results ({pendingResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingResults.map((obs) => (
                <div
                  key={obs.id}
                  className="flex items-center justify-between rounded-lg border border-amber-200 p-2 text-sm dark:border-amber-800"
                >
                  <div>
                    <span className="font-medium">{obs.display}</span>
                    <span className="ml-2 text-muted-foreground">
                      ({obs.code})
                    </span>
                  </div>
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30">
                    {obs.status === 'registered' ? 'Ordered' : 'Preliminary'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lab Results</CardTitle>
          <CardDescription>
            Laboratory test results and diagnostic data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="final">Final</SelectItem>
                <SelectItem value="preliminary">Preliminary</SelectItem>
                <SelectItem value="amended">Amended</SelectItem>
                <SelectItem value="corrected">Corrected</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Checkbox
                id="abnormalOnly"
                checked={filterAbnormalOnly}
                onCheckedChange={(checked) =>
                  setFilterAbnormalOnly(checked === true)
                }
              />
              <Label htmlFor="abnormalOnly" className="text-sm cursor-pointer">
                Abnormal only
              </Label>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Reference Range</TableHead>
                  <TableHead>Flag</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((obs) => (
                  <TableRow
                    key={obs.id}
                    className={`cursor-pointer ${
                      obs.flag === 'C' || obs.flag === 'HH' || obs.flag === 'LL'
                        ? 'bg-red-50/50 dark:bg-red-950/10'
                        : obs.flag === 'H' || obs.flag === 'L'
                          ? 'bg-amber-50/30 dark:bg-amber-950/5'
                          : ''
                    }`}
                    onClick={() => openDetail(obs)}
                  >
                    <TableCell className="font-medium">
                      {obs.display}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          obs.flag && obs.flag !== 'N'
                            ? 'font-semibold'
                            : ''
                        }
                      >
                        {obs.value ?? '--'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {obs.unit || '--'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {obs.referenceRange?.text ||
                        (obs.referenceRange?.low != null &&
                        obs.referenceRange?.high != null
                          ? `${obs.referenceRange.low} - ${obs.referenceRange.high}`
                          : '--')}
                    </TableCell>
                    <TableCell>
                      {obs.flag && obs.flag !== 'N' ? (
                        <Badge
                          variant="outline"
                          className={flagColors[obs.flag] || ''}
                        >
                          {obs.flag}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(obs.effectiveDateTime).toLocaleDateString(
                        'en-US',
                        {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        },
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={
                            obs.status === 'final' ? 'secondary' : 'outline'
                          }
                          className="text-xs"
                        >
                          {obs.status}
                        </Badge>
                        {(obs.status === 'amended' || obs.status === 'corrected') && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                          >
                            Amended
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredResults.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      {observations && observations.length > 0
                        ? 'No results match the current filters.'
                        : 'No lab results on file for this patient.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Result Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedResult?.display || 'Result Detail'}
            </DialogTitle>
            <DialogDescription>
              {selectedResult?.code
                ? `Code: ${selectedResult.code}`
                : 'Lab result details'}
            </DialogDescription>
          </DialogHeader>
          {selectedResult && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="text-center">
                  <span
                    className={`text-3xl font-bold ${
                      selectedResult.flag &&
                      selectedResult.flag !== 'N'
                        ? selectedResult.flag === 'C' ||
                          selectedResult.flag === 'HH' ||
                          selectedResult.flag === 'LL'
                          ? 'text-destructive'
                          : 'text-amber-700 dark:text-amber-400'
                        : ''
                    }`}
                  >
                    {selectedResult.value}
                  </span>
                  <span className="ml-2 text-lg text-muted-foreground">
                    {selectedResult.unit}
                  </span>
                  {selectedResult.flag && selectedResult.flag !== 'N' && (
                    <Badge
                      variant="outline"
                      className={`ml-3 ${flagColors[selectedResult.flag] || ''}`}
                    >
                      {flagLabels[selectedResult.flag] || selectedResult.flag}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference Range</span>
                  <span>
                    {selectedResult.referenceRange?.text ||
                      (selectedResult.referenceRange?.low != null &&
                      selectedResult.referenceRange?.high != null
                        ? `${selectedResult.referenceRange.low} - ${selectedResult.referenceRange.high} ${selectedResult.unit || ''}`
                        : 'Not specified')}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Collected</span>
                  <span>
                    {new Date(
                      selectedResult.effectiveDateTime,
                    ).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {selectedResult.issued && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reported</span>
                      <span>
                        {new Date(selectedResult.issued).toLocaleString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          },
                        )}
                      </span>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className="text-xs">
                    {selectedResult.status}
                  </Badge>
                </div>
                {selectedResult.interpretation && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Interpretation
                      </span>
                      <span>{selectedResult.interpretation}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
