import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  MessageSquare,
  Pill,
  TestTube2,
  Clock,
  ArrowRight,
  BookOpen,
  AlertCircle,
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
import { useAuthStore } from '@/stores/auth-store';
import api from '@/lib/api';

interface PortalDashboardData {
  upcomingAppointments: Array<{
    id: string;
    date: string;
    time: string;
    provider: string;
    type: string;
    location: string;
  }>;
  unreadMessages: number;
  recentResults: Array<{
    id: string;
    testName: string;
    date: string;
    status: string;
    isNew: boolean;
  }>;
  medicationReminders: Array<{
    id: string;
    name: string;
    refillDate: string;
    needsRefill: boolean;
  }>;
}

const healthResources = [
  { title: 'Healthy Eating Guide', category: 'Nutrition' },
  { title: 'Managing Diabetes', category: 'Chronic Care' },
  { title: 'Seasonal Immunizations', category: 'Prevention' },
  { title: 'Mental Health Resources', category: 'Wellness' },
];

export function PatientPortalDashboard() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['portal', 'dashboard'],
    queryFn: async () => {
      const response = await api.get<PortalDashboardData>('/api/v1/portal/me/dashboard');
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const patientName = user ? user.firstName : 'there';

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="status" aria-label="Loading dashboard">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">Loading your health portal...</p>
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
              <p className="font-semibold">Unable to load your dashboard</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Please try refreshing the page. If the problem continues, contact support.
              </p>
            </div>
            <Button onClick={() => window.location.reload()}>Refresh Page</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dashboard = data;
  const appointments = dashboard?.upcomingAppointments ?? [];
  const unreadCount = dashboard?.unreadMessages ?? 0;
  const results = dashboard?.recentResults ?? [];
  const medications = dashboard?.medicationReminders ?? [];

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
          Hello, {patientName}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here is a summary of your health information.
        </p>
      </div>

      {/* Quick action buttons */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Button
          variant="outline"
          className="h-auto flex-col gap-2 p-4"
          onClick={() => navigate('/portal/messages')}
          aria-label="Send a message to your provider"
        >
          <MessageSquare className="h-6 w-6 text-primary" aria-hidden="true" />
          <span className="font-medium">Message Provider</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto flex-col gap-2 p-4"
          onClick={() => navigate('/portal/appointments')}
          aria-label="Request a new appointment"
        >
          <Calendar className="h-6 w-6 text-primary" aria-hidden="true" />
          <span className="font-medium">Request Appointment</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto flex-col gap-2 p-4"
          onClick={() => navigate('/portal/medications')}
          aria-label="Request a medication refill"
        >
          <Pill className="h-6 w-6 text-primary" aria-hidden="true" />
          <span className="font-medium">Request Refill</span>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming appointments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
              <CardDescription>Your next scheduled visits</CardDescription>
            </div>
            <Calendar className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No upcoming appointments scheduled.
              </p>
            ) : (
              <ul className="space-y-3" role="list" aria-label="Upcoming appointments">
                {appointments.slice(0, 3).map((appt) => (
                  <li
                    key={appt.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{appt.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {appt.provider}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(appt.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                        })}{' '}
                        at {appt.time}
                      </p>
                      {appt.location && (
                        <p className="text-xs text-muted-foreground">
                          {appt.location}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="link"
              className="mt-2 h-auto p-0"
              onClick={() => navigate('/portal/appointments')}
            >
              View all appointments <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>

        {/* Unread messages */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-lg">Messages</CardTitle>
              <CardDescription>Secure messages from your care team</CardDescription>
            </div>
            <div className="relative">
              <MessageSquare className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              {unreadCount > 0 && (
                <span
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white"
                  aria-label={`${unreadCount} unread messages`}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {unreadCount === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                You have no unread messages.
              </p>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <MessageSquare className="h-8 w-8 text-primary" aria-hidden="true" />
                </div>
                <p className="text-center font-medium">
                  You have{' '}
                  <span className="text-primary">{unreadCount}</span>{' '}
                  unread {unreadCount === 1 ? 'message' : 'messages'}
                </p>
              </div>
            )}
            <Button
              variant="link"
              className="mt-2 h-auto p-0"
              onClick={() => navigate('/portal/messages')}
            >
              Go to messages <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>

        {/* Recent test results */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-lg">Recent Test Results</CardTitle>
              <CardDescription>Latest lab and test results</CardDescription>
            </div>
            <TestTube2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No recent test results available.
              </p>
            ) : (
              <ul className="space-y-2" role="list" aria-label="Recent test results">
                {results.slice(0, 4).map((result) => (
                  <li
                    key={result.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{result.testName}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(result.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.isNew && (
                        <Badge variant="default">New</Badge>
                      )}
                      <Badge
                        variant={
                          result.status === 'final'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {result.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="link"
              className="mt-2 h-auto p-0"
              onClick={() => navigate('/portal/results')}
            >
              View all results <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>

        {/* Medication refill reminders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-lg">Medication Reminders</CardTitle>
              <CardDescription>Refill and medication reminders</CardDescription>
            </div>
            <Pill className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            {medications.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No medication reminders at this time.
              </p>
            ) : (
              <ul className="space-y-2" role="list" aria-label="Medication reminders">
                {medications.slice(0, 4).map((med) => (
                  <li
                    key={med.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{med.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Refill by: {new Date(med.refillDate).toLocaleDateString()}
                      </p>
                    </div>
                    {med.needsRefill && (
                      <Badge variant="destructive">Refill Needed</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="link"
              className="mt-2 h-auto p-0"
              onClick={() => navigate('/portal/medications')}
            >
              View medications <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Health education resources */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
            <CardTitle className="text-lg">Health Education Resources</CardTitle>
          </div>
          <CardDescription>
            Learn more about managing your health
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {healthResources.map((resource) => (
              <button
                key={resource.title}
                className="rounded-lg border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={`Read about ${resource.title}`}
              >
                <Badge variant="outline" className="mb-2">
                  {resource.category}
                </Badge>
                <p className="font-medium">{resource.title}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
