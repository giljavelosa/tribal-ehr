import React from 'react';
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
import {
  useQADashboard,
  useUnreviewedOverrides,
  useReviewOverride,
  useEscalationEvents,
} from '@/hooks/use-api';

export function QADashboardPage() {
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useQADashboard();
  const { data: unreviewedOverrides, isLoading: overridesLoading } = useUnreviewedOverrides();
  const { data: escalationEvents, isLoading: escalationLoading } = useEscalationEvents();
  const reviewOverrideMutation = useReviewOverride();

  const isLoading = dashboardLoading || overridesLoading || escalationLoading;

  const handleReview = (overrideId: string, wasAppropriate: boolean) => {
    reviewOverrideMutation.mutate({ id: overrideId, wasAppropriate });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (dashboardError && !dashboardData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="alert">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <div className="text-center">
              <p className="font-semibold">Unable to load QA dashboard</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {dashboardError instanceof Error ? dashboardError.message : 'Please try again later.'}
              </p>
            </div>
            <Button onClick={() => window.location.reload()}>Refresh</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const analytics = dashboardData?.cdsOverrides;
  const totalOverrides = analytics?.totalOverrides ?? 0;
  const overridesByType = analytics?.overridesByType ?? [];
  const appropriateOverrides = analytics?.appropriateOverrides ?? 0;
  const inappropriateOverrides = analytics?.inappropriateOverrides ?? 0;
  const unreviewedCount = analytics?.unreviewedOverrides ?? 0;

  // Calculate percentages
  const reviewed = appropriateOverrides + inappropriateOverrides;
  const appropriatePercent = reviewed > 0 ? Math.round((appropriateOverrides / reviewed) * 100) : 0;
  const inappropriatePercent = reviewed > 0 ? Math.round((inappropriateOverrides / reviewed) * 100) : 0;

  const maxOverrideCount = Math.max(...overridesByType.map((o) => o.count), 1);

  const overridesList = unreviewedOverrides ?? [];
  const events = escalationEvents ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quality Assurance Dashboard</h1>
          <p className="text-muted-foreground">
            CDS override monitoring and escalation tracking
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total CDS Overrides</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOverrides}</div>
            <p className="text-xs text-muted-foreground">All time override count</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Appropriate %</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{appropriatePercent}%</div>
            <p className="text-xs text-muted-foreground">Reviewed and deemed appropriate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inappropriate %</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{inappropriatePercent}%</div>
            <p className="text-xs text-muted-foreground">Reviewed and deemed inappropriate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unreviewed</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{unreviewedCount}</div>
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
          {overridesByType.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No override data available yet.
            </div>
          ) : (
            <div className="space-y-3">
              {overridesByType.map((item) => (
                <div key={item.alertType} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 text-sm">{item.alertType}</span>
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
          )}
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
                <TableHead className="w-[180px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overridesList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                      <p className="text-sm text-muted-foreground">All overrides have been reviewed</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                overridesList.map((override) => (
                  <TableRow key={override.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{override.cardSummary || 'CDS Override'}</span>
                        <span className="text-xs text-muted-foreground">{override.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>{override.userId}</TableCell>
                    <TableCell>{override.patientId}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(override.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => handleReview(override.id, true)}
                          disabled={reviewOverrideMutation.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          OK
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-destructive"
                          onClick={() => handleReview(override.id, false)}
                          disabled={reviewOverrideMutation.isPending}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Flag
                        </Button>
                      </div>
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
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No escalation events found.
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
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
                      {new Date(event.createdAt).toLocaleString('en-US', {
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
