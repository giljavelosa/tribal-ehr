import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  Bell,
  Eye,
  Loader2,
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

interface OverrideByType {
  type: string;
  count: number;
}

interface CDSOverride {
  id: string;
  cardSummary: string;
  provider: string;
  patient: string;
  date: string;
  reason?: string;
  reviewed: boolean;
  appropriate?: boolean;
}

interface EscalationEvent {
  id: string;
  sourceType: string;
  sourceId: string;
  escalatedTo: string;
  acknowledged: boolean;
  date: string;
}

interface QADashboardData {
  totalOverrides: number;
  appropriatePercent: number;
  inappropriatePercent: number;
  unreviewedCount: number;
  overridesByType: OverrideByType[];
  recentUnreviewed: CDSOverride[];
  escalationEvents: EscalationEvent[];
}

const mockDashboardData: QADashboardData = {
  totalOverrides: 142,
  appropriatePercent: 68,
  inappropriatePercent: 12,
  unreviewedCount: 28,
  overridesByType: [
    { type: 'Drug-Drug Interaction', count: 45 },
    { type: 'Duplicate Order', count: 32 },
    { type: 'Allergy Alert', count: 24 },
    { type: 'Dose Range', count: 18 },
    { type: 'Renal Adjustment', count: 13 },
    { type: 'Age Contraindication', count: 10 },
  ],
  recentUnreviewed: [
    {
      id: 'OVR-001',
      cardSummary: 'Drug-Drug Interaction: Warfarin + Aspirin',
      provider: 'Dr. Wilson',
      patient: 'John Smith',
      date: '2024-01-12T14:30:00Z',
      reviewed: false,
    },
    {
      id: 'OVR-002',
      cardSummary: 'Duplicate Order: CBC with Differential',
      provider: 'Dr. Chen',
      patient: 'Mary Johnson',
      date: '2024-01-12T11:15:00Z',
      reviewed: false,
    },
    {
      id: 'OVR-003',
      cardSummary: 'Dose Range Alert: Metformin 2500mg',
      provider: 'Dr. Wilson',
      patient: 'Robert Williams',
      date: '2024-01-11T16:45:00Z',
      reviewed: false,
    },
    {
      id: 'OVR-004',
      cardSummary: 'Allergy Alert: Penicillin class',
      provider: 'Dr. Patel',
      patient: 'Sarah Davis',
      date: '2024-01-11T09:20:00Z',
      reviewed: false,
    },
    {
      id: 'OVR-005',
      cardSummary: 'Renal Dose Adjustment: Gabapentin',
      provider: 'Dr. Chen',
      patient: 'James Brown',
      date: '2024-01-10T15:00:00Z',
      reviewed: false,
    },
  ],
  escalationEvents: [
    {
      id: 'ESC-001',
      sourceType: 'CDS Override',
      sourceId: 'OVR-001',
      escalatedTo: 'Chief Medical Officer',
      acknowledged: false,
      date: '2024-01-12T14:35:00Z',
    },
    {
      id: 'ESC-002',
      sourceType: 'Medication Error',
      sourceId: 'MED-042',
      escalatedTo: 'Pharmacy Director',
      acknowledged: true,
      date: '2024-01-11T10:00:00Z',
    },
    {
      id: 'ESC-003',
      sourceType: 'CDS Override',
      sourceId: 'OVR-003',
      escalatedTo: 'Department Head',
      acknowledged: false,
      date: '2024-01-11T17:00:00Z',
    },
    {
      id: 'ESC-004',
      sourceType: 'Lab Critical Value',
      sourceId: 'LAB-189',
      escalatedTo: 'Attending Physician',
      acknowledged: true,
      date: '2024-01-10T08:30:00Z',
    },
    {
      id: 'ESC-005',
      sourceType: 'CDS Override',
      sourceId: 'OVR-004',
      escalatedTo: 'Chief Medical Officer',
      acknowledged: false,
      date: '2024-01-11T09:25:00Z',
    },
  ],
};

export function QADashboardPage() {
  const [data, setData] = useState<QADashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/v1/admin/qa/dashboard');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = await response.json();
        setData(json);
      } catch (err) {
        console.warn('Failed to fetch QA dashboard data, using mock data:', err);
        setError('Using sample data - API unavailable');
        setData(mockDashboardData);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const handleReview = (overrideId: string) => {
    if (!data) return;
    setData({
      ...data,
      recentUnreviewed: data.recentUnreviewed.map((o) =>
        o.id === overrideId ? { ...o, reviewed: true } : o,
      ),
      unreviewedCount: Math.max(0, data.unreviewedCount - 1),
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="alert">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <div className="text-center">
              <p className="font-semibold">Unable to load QA dashboard</p>
              <p className="mt-1 text-sm text-muted-foreground">Please try again later.</p>
            </div>
            <Button onClick={() => window.location.reload()}>Refresh</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const maxOverrideCount = Math.max(...data.overridesByType.map((o) => o.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quality Assurance Dashboard</h1>
          <p className="text-muted-foreground">
            CDS override monitoring and escalation tracking
          </p>
        </div>
        {error && (
          <Badge variant="outline" className="gap-1 text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            {error}
          </Badge>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total CDS Overrides</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalOverrides}</div>
            <p className="text-xs text-muted-foreground">All time override count</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Appropriate %</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.appropriatePercent}%</div>
            <p className="text-xs text-muted-foreground">Reviewed and deemed appropriate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inappropriate %</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.inappropriatePercent}%</div>
            <p className="text-xs text-muted-foreground">Reviewed and deemed inappropriate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unreviewed</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{data.unreviewedCount}</div>
            <p className="text-xs text-muted-foreground">Pending QA review</p>
          </CardContent>
        </Card>
      </div>

      {/* CDS Override Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            CDS Override Analytics
          </CardTitle>
          <CardDescription>Override distribution by alert type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.overridesByType.map((item) => (
              <div key={item.type} className="flex items-center gap-3">
                <span className="w-44 shrink-0 text-sm">{item.type}</span>
                <div className="flex-1">
                  <div className="h-7 w-full rounded bg-muted">
                    <div
                      className="flex h-7 items-center justify-end rounded bg-primary px-2 text-xs font-medium text-primary-foreground transition-all"
                      style={{ width: `${(item.count / maxOverrideCount) * 100}%` }}
                    >
                      {item.count}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Unreviewed Overrides */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Recent Unreviewed Overrides
          </CardTitle>
          <CardDescription>CDS overrides awaiting quality review</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card Summary</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[100px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentUnreviewed.filter((o) => !o.reviewed).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                      <p className="text-sm text-muted-foreground">All overrides have been reviewed</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.recentUnreviewed
                  .filter((o) => !o.reviewed)
                  .map((override) => (
                    <TableRow key={override.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{override.cardSummary}</span>
                          <span className="text-xs text-muted-foreground">{override.id}</span>
                        </div>
                      </TableCell>
                      <TableCell>{override.provider}</TableCell>
                      <TableCell>{override.patient}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(override.date).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => handleReview(override.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Separator />

      {/* Escalation Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Escalation Events
          </CardTitle>
          <CardDescription>Recent quality and safety escalations</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source Type</TableHead>
                <TableHead>Source ID</TableHead>
                <TableHead>Escalated To</TableHead>
                <TableHead>Acknowledged</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.escalationEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No escalation events found.
                  </TableCell>
                </TableRow>
              ) : (
                data.escalationEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Badge variant="outline">{event.sourceType}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{event.sourceId}</TableCell>
                    <TableCell>{event.escalatedTo}</TableCell>
                    <TableCell>
                      {event.acknowledged ? (
                        <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <Clock className="h-3 w-3" />
                          No
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(event.date).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
