import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Download,
  Loader2,
  AlertCircle,
  Users,
  Stethoscope,
  Heart,
  Syringe,
  TrendingUp,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import api from '@/lib/api';

interface PatientCensus {
  totalActive: number;
  totalInactive: number;
  byGender: Array<{ gender: string; count: number }>;
  byAgeGroup: Array<{ ageGroup: string; count: number }>;
  byRace: Array<{ race: string; count: number }>;
  byLanguage: Array<{ language: string; count: number }>;
}

interface EncounterVolume {
  total: number;
  byType: Array<{ type: string; count: number }>;
  byProvider: Array<{ provider: string; count: number }>;
  byLocation: Array<{ location: string; count: number }>;
  byMonth: Array<{ month: string; count: number }>;
}

interface QualityMeasure {
  id: string;
  name: string;
  description: string;
  numerator: number;
  denominator: number;
  rate: number;
  target: number;
  met: boolean;
}

interface ImmunizationRate {
  vaccine: string;
  eligible: number;
  immunized: number;
  rate: number;
}

interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  providerId: string;
  locationId: string;
}

export function ReportsPage() {
  const [activeReport, setActiveReport] = useState('census');
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: '',
    dateTo: '',
    providerId: 'all',
    locationId: 'all',
  });

  const buildParams = () => {
    const params: Record<string, string> = {};
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.providerId !== 'all') params.providerId = filters.providerId;
    if (filters.locationId !== 'all') params.locationId = filters.locationId;
    return params;
  };

  const { data: census, isLoading: censusLoading } = useQuery({
    queryKey: ['admin', 'reports', 'census', filters],
    queryFn: async () => {
      const response = await api.get<PatientCensus>('/api/v1/admin/reports/census', { params: buildParams() });
      return response.data;
    },
    enabled: activeReport === 'census',
    staleTime: 5 * 60 * 1000,
  });

  const { data: encounters, isLoading: encountersLoading } = useQuery({
    queryKey: ['admin', 'reports', 'encounters', filters],
    queryFn: async () => {
      const response = await api.get<EncounterVolume>('/api/v1/admin/reports/encounters', { params: buildParams() });
      return response.data;
    },
    enabled: activeReport === 'encounters',
    staleTime: 5 * 60 * 1000,
  });

  const { data: qualityMeasures, isLoading: qualityLoading } = useQuery({
    queryKey: ['admin', 'reports', 'quality', filters],
    queryFn: async () => {
      const response = await api.get<QualityMeasure[]>('/api/v1/admin/reports/quality-measures', { params: buildParams() });
      return response.data;
    },
    enabled: activeReport === 'quality',
    staleTime: 5 * 60 * 1000,
  });

  const { data: immunizationRates, isLoading: immunizationLoading } = useQuery({
    queryKey: ['admin', 'reports', 'immunizations', filters],
    queryFn: async () => {
      const response = await api.get<ImmunizationRate[]>('/api/v1/admin/reports/immunization-rates', { params: buildParams() });
      return response.data;
    },
    enabled: activeReport === 'immunizations',
    staleTime: 5 * 60 * 1000,
  });

  const handleExportCSV = async (reportType: string) => {
    try {
      const response = await api.get(`/api/v1/admin/reports/${reportType}/export`, {
        params: { ...buildParams(), format: 'csv' },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}-report.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: 'Report exported' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  const renderProgressBar = (value: number, target: number) => {
    const pct = Math.min(100, Math.round((value / target) * 100));
    const met = value >= target;
    return (
      <div className="flex items-center gap-3">
        <div className="h-3 w-full max-w-[200px] rounded-full bg-muted">
          <div
            className={`h-3 rounded-full transition-all ${met ? 'bg-green-500' : 'bg-yellow-500'}`}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <span className="text-sm font-medium">{value.toFixed(1)}%</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Clinical quality measures and operational reports
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="report-date-from">Date From</Label>
              <Input
                id="report-date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-date-to">Date To</Label>
              <Input
                id="report-date-to"
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={filters.providerId}
                onValueChange={(v) => setFilters((p) => ({ ...p, providerId: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select
                value={filters.locationId}
                onValueChange={(v) => setFilters((p) => ({ ...p, locationId: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeReport} onValueChange={setActiveReport} className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="census" className="gap-2">
            <Users className="h-4 w-4" />
            Patient Census
          </TabsTrigger>
          <TabsTrigger value="encounters" className="gap-2">
            <Stethoscope className="h-4 w-4" />
            Encounter Volume
          </TabsTrigger>
          <TabsTrigger value="quality" className="gap-2">
            <Heart className="h-4 w-4" />
            Quality Measures
          </TabsTrigger>
          <TabsTrigger value="immunizations" className="gap-2">
            <Syringe className="h-4 w-4" />
            Immunization Rates
          </TabsTrigger>
        </TabsList>

        {/* Patient Census */}
        <TabsContent value="census">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => handleExportCSV('census')} className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>

            {censusLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Active Patients</CardDescription>
                      <CardTitle className="text-3xl">{census?.totalActive ?? 0}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Inactive Patients</CardDescription>
                      <CardTitle className="text-3xl">{census?.totalInactive ?? 0}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">By Gender</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(census?.byGender ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No data available.</p>
                      ) : (
                        <div className="space-y-2">
                          {(census?.byGender ?? []).map((item) => (
                            <div key={item.gender} className="flex items-center justify-between">
                              <span className="text-sm">{item.gender}</span>
                              <Badge variant="outline">{item.count}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">By Age Group</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(census?.byAgeGroup ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No data available.</p>
                      ) : (
                        <div className="space-y-2">
                          {(census?.byAgeGroup ?? []).map((item) => (
                            <div key={item.ageGroup} className="flex items-center justify-between">
                              <span className="text-sm">{item.ageGroup}</span>
                              <Badge variant="outline">{item.count}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">By Race/Ethnicity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(census?.byRace ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No data available.</p>
                      ) : (
                        <div className="space-y-2">
                          {(census?.byRace ?? []).map((item) => (
                            <div key={item.race} className="flex items-center justify-between">
                              <span className="text-sm">{item.race}</span>
                              <Badge variant="outline">{item.count}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">By Preferred Language</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(census?.byLanguage ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No data available.</p>
                      ) : (
                        <div className="space-y-2">
                          {(census?.byLanguage ?? []).map((item) => (
                            <div key={item.language} className="flex items-center justify-between">
                              <span className="text-sm">{item.language}</span>
                              <Badge variant="outline">{item.count}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Encounter Volume */}
        <TabsContent value="encounters">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Total Encounters: {encounters?.total ?? 0}
                </h2>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleExportCSV('encounters')} className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>

            {encountersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">By Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(encounters?.byType ?? []).map((item) => (
                          <TableRow key={item.type}>
                            <TableCell>{item.type}</TableCell>
                            <TableCell className="text-right font-medium">{item.count}</TableCell>
                          </TableRow>
                        ))}
                        {(encounters?.byType ?? []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground">
                              No data available.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">By Provider</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Provider</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(encounters?.byProvider ?? []).map((item) => (
                          <TableRow key={item.provider}>
                            <TableCell>{item.provider}</TableCell>
                            <TableCell className="text-right font-medium">{item.count}</TableCell>
                          </TableRow>
                        ))}
                        {(encounters?.byProvider ?? []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground">
                              No data available.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">By Location</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Location</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(encounters?.byLocation ?? []).map((item) => (
                          <TableRow key={item.location}>
                            <TableCell>{item.location}</TableCell>
                            <TableCell className="text-right font-medium">{item.count}</TableCell>
                          </TableRow>
                        ))}
                        {(encounters?.byLocation ?? []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground">
                              No data available.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="h-5 w-5" />
                      Monthly Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(encounters?.byMonth ?? []).map((item) => {
                        const maxCount = Math.max(...(encounters?.byMonth ?? []).map((m) => m.count), 1);
                        const barWidth = Math.max(5, (item.count / maxCount) * 100);
                        return (
                          <div key={item.month} className="flex items-center gap-3">
                            <span className="w-20 flex-shrink-0 text-xs text-muted-foreground">
                              {item.month}
                            </span>
                            <div className="flex-1">
                              <div
                                className="h-5 rounded bg-primary/60"
                                style={{ width: `${barWidth}%` }}
                                role="img"
                                aria-label={`${item.count} encounters`}
                              />
                            </div>
                            <span className="w-10 text-right text-sm font-medium">{item.count}</span>
                          </div>
                        );
                      })}
                      {(encounters?.byMonth ?? []).length === 0 && (
                        <p className="text-sm text-muted-foreground">No data available.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Quality Measures */}
        <TabsContent value="quality">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => handleExportCSV('quality-measures')} className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>

            {qualityLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {(qualityMeasures ?? []).length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12">
                      <Heart className="h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">No quality measures data available.</p>
                    </CardContent>
                  </Card>
                ) : (
                  (qualityMeasures ?? []).map((measure) => (
                    <Card key={measure.id}>
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{measure.name}</h3>
                              <Badge variant={measure.met ? 'default' : 'destructive'}>
                                {measure.met ? 'Met' : 'Not Met'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{measure.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {measure.numerator} / {measure.denominator} patients | Target: {measure.target}%
                            </p>
                          </div>
                          <div className="min-w-[250px]">
                            {renderProgressBar(measure.rate, measure.target)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Immunization Rates */}
        <TabsContent value="immunizations">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => handleExportCSV('immunization-rates')} className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>

            {immunizationLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  {(immunizationRates ?? []).length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <Syringe className="h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">No immunization data available.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vaccine</TableHead>
                          <TableHead>Eligible Patients</TableHead>
                          <TableHead>Immunized</TableHead>
                          <TableHead>Compliance Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(immunizationRates ?? []).map((rate) => (
                          <TableRow key={rate.vaccine}>
                            <TableCell className="font-medium">{rate.vaccine}</TableCell>
                            <TableCell>{rate.eligible}</TableCell>
                            <TableCell>{rate.immunized}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 rounded-full bg-muted">
                                  <div
                                    className={`h-2 rounded-full ${rate.rate >= 90 ? 'bg-green-500' : rate.rate >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${rate.rate}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium">{rate.rate.toFixed(1)}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
