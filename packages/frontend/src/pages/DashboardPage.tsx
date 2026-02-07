import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  FlaskConical,
  MessageSquare,
  Users,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Stethoscope,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth-store';
import {
  useSchedule,
  useResultsInbox,
  useEscalationEvents,
  useQualityMeasuresDashboard,
} from '@/hooks/use-api';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffHours < 48) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const appointmentStatusColors: Record<string, string> = {
  booked:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  arrived:
    'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  'checked-in':
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  'in-progress':
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed:
    'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  cancelled:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  noshow:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  // Current year period for quality measures
  const qualityPeriod = useMemo(() => {
    const year = new Date().getFullYear();
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }, []);

  const { data: todaySchedule, isLoading: scheduleLoading } =
    useSchedule(todayStr);

  // Fetch pending results for Tasks & Alerts
  const { data: pendingResults, isLoading: resultsLoading } = useResultsInbox({
    status: 'pending',
  });

  // Fetch unacknowledged escalation events for alerts
  const { data: escalationAlerts, isLoading: alertsLoading } = useEscalationEvents({
    acknowledged: 'false',
  });

  // Fetch recent results for Recent Results section
  const { data: recentResults, isLoading: recentResultsLoading } = useResultsInbox();

  // Fetch quality measures dashboard
  const { data: qualityData, isLoading: qualityLoading } = useQualityMeasuresDashboard(qualityPeriod);

  // Derive schedule stats
  const scheduleStats = useMemo(() => {
    if (!todaySchedule) {
      return { total: 0, completed: 0, remaining: 0, inProgress: 0 };
    }
    const completed = todaySchedule.filter(
      (a) => a.status === 'completed',
    ).length;
    const inProgress = todaySchedule.filter(
      (a) => a.status === 'in-progress',
    ).length;
    const remaining = todaySchedule.filter(
      (a) => a.status === 'booked' || a.status === 'checked-in' || a.status === 'arrived',
    ).length;
    return {
      total: todaySchedule.length,
      completed,
      remaining,
      inProgress,
    };
  }, [todaySchedule]);

  // Upcoming appointments (not yet completed)
  const upcomingAppointments = useMemo(() => {
    if (!todaySchedule) return [];
    return todaySchedule
      .filter(
        (a) =>
          a.status !== 'completed' &&
          a.status !== 'cancelled' &&
          a.status !== 'noshow',
      )
      .sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
      )
      .slice(0, 8);
  }, [todaySchedule]);

  // Recent completed for "recently seen" section
  const recentlySeen = useMemo(() => {
    if (!todaySchedule) return [];
    return todaySchedule
      .filter((a) => a.status === 'completed')
      .sort(
        (a, b) => new Date(b.end).getTime() - new Date(a.end).getTime(),
      )
      .slice(0, 5);
  }, [todaySchedule]);

  // Build tasks list from pending results + escalation alerts
  const tasks = useMemo(() => {
    const taskItems: Array<{
      title: string;
      subtitle: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
      icon: typeof FlaskConical;
    }> = [];

    // Add pending results as tasks
    if (pendingResults) {
      for (const result of pendingResults.slice(0, 3)) {
        taskItems.push({
          title: result.codeDisplay || `${result.orderType} Result`,
          subtitle: `Patient ${result.patientId}`,
          priority: result.priority === 'stat' ? 'critical' : result.priority === 'urgent' ? 'high' : 'medium',
          icon: FlaskConical,
        });
      }
    }

    // Add unacknowledged escalation alerts as tasks
    if (escalationAlerts) {
      for (const alert of escalationAlerts.slice(0, 2)) {
        taskItems.push({
          title: `Escalation: ${alert.sourceType}`,
          subtitle: `Escalated to ${alert.escalatedTo}`,
          priority: 'high',
          icon: AlertTriangle,
        });
      }
    }

    return taskItems.slice(0, 5);
  }, [pendingResults, escalationAlerts]);

  // Summary counts for stat cards
  const pendingTaskCount = (pendingResults?.length ?? 0) + (escalationAlerts?.length ?? 0);
  const highPriorityCount = useMemo(() => {
    const highResults = pendingResults?.filter((r) => r.priority === 'stat' || r.priority === 'urgent').length ?? 0;
    const unackAlerts = escalationAlerts?.length ?? 0;
    return highResults + unackAlerts;
  }, [pendingResults, escalationAlerts]);
  const unsignedResultCount = pendingResults?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {getGreeting()}, {user?.firstName || 'Doctor'}
        </h1>
        <p className="text-muted-foreground">
          Here is your overview for today,{' '}
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Appointments
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {scheduleLoading ? '--' : scheduleStats.total}
            </div>
            <p className="text-xs text-muted-foreground">
              {scheduleStats.remaining} remaining
              {scheduleStats.inProgress > 0 &&
                `, ${scheduleStats.inProgress} in progress`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Tasks
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {resultsLoading || alertsLoading ? '--' : pendingTaskCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {resultsLoading || alertsLoading
                ? 'Loading...'
                : highPriorityCount > 0
                  ? `${highPriorityCount} high priority item${highPriorityCount !== 1 ? 's' : ''}`
                  : 'No high priority items'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Unread Messages
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alertsLoading ? '--' : (escalationAlerts?.length ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {alertsLoading ? 'Loading...' : 'Unacknowledged escalations'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Unsigned Results
            </CardTitle>
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {resultsLoading ? '--' : unsignedResultCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {resultsLoading ? 'Loading...' : 'Pending acknowledgment'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main 3-column grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Column 1: Today's Schedule */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Today's Schedule
                </CardTitle>
                <CardDescription>
                  Your upcoming appointments for today
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => navigate('/scheduling')}
              >
                View Full Schedule
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {scheduleLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded bg-muted"
                  />
                ))}
              </div>
            ) : upcomingAppointments.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Calendar className="mx-auto mb-3 h-10 w-10" />
                <p className="font-medium">No upcoming appointments</p>
                <p className="text-sm">
                  Your schedule for today is clear.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingAppointments.map((appt, i) => (
                  <div key={appt.id}>
                    <div
                      className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                      onClick={() => {
                        if (appt.patientId) {
                          navigate(`/patients/${appt.patientId}`);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (
                          (e.key === 'Enter' || e.key === ' ') &&
                          appt.patientId
                        ) {
                          navigate(`/patients/${appt.patientId}`);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-20 text-sm font-medium text-muted-foreground">
                          {formatTime(appt.start)}
                        </span>
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {appt.patientName
                              ? appt.patientName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 2)
                              : '??'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {appt.patientName || 'Unknown Patient'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {appt.type}
                            {appt.duration && ` (${appt.duration} min)`}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          appointmentStatusColors[appt.status] || ''
                        }
                      >
                        {appt.status === 'checked-in'
                          ? 'Checked In'
                          : appt.status === 'in-progress'
                            ? 'In Progress'
                            : appt.status}
                      </Badge>
                    </div>
                    {i < upcomingAppointments.length - 1 && (
                      <Separator className="my-1" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Column 2: Tasks & Follow-ups */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Tasks & Alerts
            </CardTitle>
            <CardDescription>
              Items requiring your attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resultsLoading || alertsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle2 className="mx-auto mb-3 h-10 w-10" />
                <p className="font-medium">All caught up</p>
                <p className="text-sm">No pending tasks or alerts.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <task.icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.subtitle}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          task.priority === 'critical' ||
                          task.priority === 'high'
                            ? 'destructive'
                            : 'outline'
                        }
                        className={
                          task.priority === 'critical'
                            ? 'animate-pulse'
                            : undefined
                        }
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    {i < tasks.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              className="mt-4 w-full gap-1"
              onClick={() => navigate('/orders')}
            >
              View All Tasks
              <ArrowRight className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Recent results + Recent patients + Quality */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Results */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="h-4 w-4" />
                Recent Results
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => navigate('/results')}
              >
                View All
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentResultsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !recentResults || recentResults.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <FlaskConical className="mx-auto mb-2 h-8 w-8" />
                <p>No recent results to display.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentResults.slice(0, 5).map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {result.codeDisplay || result.orderType}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {result.orderType} - {result.patientId}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          result.priority === 'stat'
                            ? 'destructive'
                            : result.priority === 'urgent'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {result.status}
                      </Badge>
                      {result.orderedAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatRelativeDate(result.orderedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently Seen Patients */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Stethoscope className="h-4 w-4" />
                Recently Seen
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => navigate('/patients')}
              >
                All Patients
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentlySeen.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No patients seen today yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentlySeen.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                    onClick={() => navigate(`/patients/${appt.patientId}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        navigate(`/patients/${appt.patientId}`);
                      }
                    }}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {appt.patientName
                          ? appt.patientName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                          : '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {appt.patientName || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {appt.type} - {formatTime(appt.end)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Completed
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quality Measures */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Quality Measures
            </CardTitle>
            <CardDescription>Panel performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {qualityLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !qualityData || qualityData.measures.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <TrendingUp className="mx-auto mb-2 h-8 w-8" />
                <p>No quality measures data available.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {qualityData.measures.slice(0, 4).map((metric) => {
                  const target = 70; // threshold from the service
                  const value = Math.round(metric.rate);
                  return (
                    <div key={metric.measureId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{metric.measureName}</span>
                        <span
                          className={`font-semibold ${
                            value >= target
                              ? 'text-green-600 dark:text-green-400'
                              : value >= target - 10
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {value}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-muted">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              value >= target
                                ? 'bg-green-500'
                                : value >= target - 10
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(value, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          /{target}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
