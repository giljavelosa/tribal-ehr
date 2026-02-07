import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TestTube2,
  Loader2,
  AlertCircle,
  TrendingUp,
  ArrowLeft,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
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
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface TestResult {
  id: string;
  testName: string;
  testCode: string;
  date: string;
  value: string | number;
  unit: string;
  referenceRange: string;
  flag: 'N' | 'L' | 'H' | 'LL' | 'HH' | 'C' | null;
  status: string;
  isNew: boolean;
  category: string;
  orderedBy?: string;
}

type ViewMode = 'list' | 'detail' | 'trend';

export function PatientResultsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);
  const [trendTest, setTrendTest] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const { data: results, isLoading, error } = useQuery({
    queryKey: ['portal', 'results'],
    queryFn: async () => {
      const response = await api.get<TestResult[]>('/api/v1/portal/me/results');
      return response.data;
    },
    staleTime: 3 * 60 * 1000,
  });

  // Group results by category
  const categorizedResults = useMemo(() => {
    if (!results) return new Map<string, TestResult[]>();
    const map = new Map<string, TestResult[]>();
    for (const result of results) {
      const cat = result.category || 'Other';
      const group = map.get(cat) ?? [];
      group.push(result);
      map.set(cat, group);
    }
    return map;
  }, [results]);

  // Find trending data for a specific test
  const trendData = useMemo(() => {
    if (!results || !trendTest) return [];
    return results
      .filter((r) => r.testCode === trendTest && typeof r.value === 'number')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [results, trendTest]);

  const newCount = results?.filter((r) => r.isNew).length ?? 0;

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const flagLabel = (flag: string | null) => {
    switch (flag) {
      case 'L':
        return 'Low';
      case 'H':
        return 'High';
      case 'LL':
        return 'Critical Low';
      case 'HH':
        return 'Critical High';
      case 'C':
        return 'Critical';
      default:
        return 'Normal';
    }
  };

  const flagBadgeVariant = (flag: string | null) => {
    switch (flag) {
      case 'L':
      case 'H':
        return 'outline' as const;
      case 'LL':
      case 'HH':
      case 'C':
        return 'destructive' as const;
      default:
        return 'secondary' as const;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="status">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">Loading test results...</p>
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
              <p className="font-semibold">Unable to load test results</p>
              <p className="mt-1 text-sm text-muted-foreground">Please try again later.</p>
            </div>
            <Button onClick={() => window.location.reload()}>Refresh</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Detail view
  if (viewMode === 'detail' && selectedResult) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setViewMode('list')} aria-label="Back to results list">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{selectedResult.testName}</h1>
            <p className="text-muted-foreground">
              Result from {new Date(selectedResult.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Result Value</p>
                  <p className={cn(
                    'mt-1 text-3xl font-bold',
                    selectedResult.flag && selectedResult.flag !== 'N' ? 'text-destructive' : 'text-foreground',
                  )}>
                    {selectedResult.value} {selectedResult.unit}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Reference Range</p>
                  <p className="mt-1 text-lg">{selectedResult.referenceRange}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Flag</p>
                  <Badge variant={flagBadgeVariant(selectedResult.flag)} className="mt-1">
                    {selectedResult.flag && selectedResult.flag !== 'N' && (
                      <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                    )}
                    {flagLabel(selectedResult.flag)}
                  </Badge>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Test Code</p>
                  <p className="mt-1">{selectedResult.testCode}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge variant="secondary" className="mt-1">{selectedResult.status}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Category</p>
                  <p className="mt-1">{selectedResult.category}</p>
                </div>
                {selectedResult.orderedBy && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Ordered By</p>
                    <p className="mt-1">{selectedResult.orderedBy}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setTrendTest(selectedResult.testCode);
                  setViewMode('trend');
                }}
              >
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                View Trend
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Trend view
  if (viewMode === 'trend' && trendTest) {
    const testName = trendData.length > 0 ? trendData[0].testName : trendTest;
    const unit = trendData.length > 0 ? trendData[0].unit : '';

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setViewMode('list')} aria-label="Back to results list">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{testName} - Trend</h1>
            <p className="text-muted-foreground">Historical results over time</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Result History</CardTitle>
            <CardDescription>
              {trendData.length} result{trendData.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Not enough data points to display a trend for this test.
              </p>
            ) : (
              <>
                {/* Simple text-based trend display */}
                <div className="space-y-3">
                  {trendData.map((point, idx) => {
                    const numericVal = typeof point.value === 'number' ? point.value : 0;
                    const maxVal = Math.max(...trendData.map((d) => typeof d.value === 'number' ? d.value : 0));
                    const barWidth = maxVal > 0 ? Math.max(5, (numericVal / maxVal) * 100) : 50;

                    return (
                      <div key={point.id} className="flex items-center gap-4">
                        <div className="w-24 flex-shrink-0 text-sm text-muted-foreground">
                          {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                'h-6 rounded transition-all',
                                point.flag && point.flag !== 'N'
                                  ? 'bg-destructive/60'
                                  : 'bg-primary/60',
                              )}
                              style={{ width: `${barWidth}%` }}
                              role="img"
                              aria-label={`${point.value} ${unit}`}
                            />
                            <span className={cn(
                              'text-sm font-medium',
                              point.flag && point.flag !== 'N' ? 'text-destructive' : '',
                            )}>
                              {point.value} {unit}
                            </span>
                          </div>
                        </div>
                        {point.flag && point.flag !== 'N' && (
                          <Badge variant={flagBadgeVariant(point.flag)} className="flex-shrink-0">
                            {flagLabel(point.flag)}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Trend table */}
                <div className="mt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Reference Range</TableHead>
                        <TableHead>Flag</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...trendData].reverse().map((point) => (
                        <TableRow key={point.id}>
                          <TableCell>{new Date(point.date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">
                            {point.value} {unit}
                          </TableCell>
                          <TableCell>{point.referenceRange}</TableCell>
                          <TableCell>
                            <Badge variant={flagBadgeVariant(point.flag)}>
                              {flagLabel(point.flag)}
                            </Badge>
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

  // List view
  const allResults = results ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Test Results</h1>
        <p className="mt-1 text-muted-foreground">
          View your laboratory and test results
          {newCount > 0 && (
            <span className="ml-2">
              <Badge>{newCount} new</Badge>
            </span>
          )}
        </p>
      </div>

      {allResults.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <TestTube2 className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <p className="text-muted-foreground">No test results available.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(categorizedResults.entries()).map(([category, categoryResults]) => {
            const isExpanded = expandedCategories.has(category);
            const hasAbnormal = categoryResults.some((r) => r.flag && r.flag !== 'N');
            const hasNew = categoryResults.some((r) => r.isNew);

            return (
              <Card key={category}>
                <button
                  className="flex w-full items-center justify-between p-4 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:p-6"
                  onClick={() => toggleCategory(category)}
                  aria-expanded={isExpanded}
                  aria-controls={`results-${category}`}
                >
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">{category}</h2>
                    <span className="text-sm text-muted-foreground">
                      ({categoryResults.length} result{categoryResults.length !== 1 ? 's' : ''})
                    </span>
                    {hasNew && <Badge>New</Badge>}
                    {hasAbnormal && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        Abnormal
                      </Badge>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  )}
                </button>

                {isExpanded && (
                  <CardContent className="p-0 pt-0" id={`results-${category}`}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Test Name</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Result</TableHead>
                          <TableHead>Reference Range</TableHead>
                          <TableHead>Flag</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryResults.map((result) => (
                          <TableRow
                            key={result.id}
                            className={cn(
                              result.flag && result.flag !== 'N' && 'bg-destructive/5',
                              result.isNew && 'font-semibold',
                            )}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {result.isNew && (
                                  <div className="h-2 w-2 rounded-full bg-primary" aria-label="New result" />
                                )}
                                {result.testName}
                              </div>
                            </TableCell>
                            <TableCell>{new Date(result.date).toLocaleDateString()}</TableCell>
                            <TableCell className="font-medium">
                              {result.value} {result.unit}
                            </TableCell>
                            <TableCell>{result.referenceRange}</TableCell>
                            <TableCell>
                              <Badge variant={flagBadgeVariant(result.flag)}>
                                {result.flag && result.flag !== 'N' && (
                                  <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                                )}
                                {flagLabel(result.flag)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedResult(result);
                                    setViewMode('detail');
                                  }}
                                  aria-label={`View details for ${result.testName}`}
                                >
                                  Details
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
