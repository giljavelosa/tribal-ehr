import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Building2,
  Shield,
  Settings,
  Activity,
  BarChart3,
  MapPin,
  Stethoscope,
  Loader2,
  AlertCircle,
  GraduationCap,
  AlertTriangle,
  ClipboardCheck,
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
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface SystemHealth {
  status: string;
  services: {
    db: string;
    redis: string;
    rabbitmq: string;
    fhir: string;
  };
  activeUsers: number;
  todaysEncounters: number;
}

interface RecentEvent {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resourceType: string;
  description: string;
}

const adminNavItems = [
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/providers', icon: Stethoscope, label: 'Providers' },
  { to: '/admin/locations', icon: MapPin, label: 'Locations' },
  { to: '/admin/audit', icon: Shield, label: 'Audit Log' },
  { to: '/admin/config', icon: Settings, label: 'Configuration' },
  { to: '/admin/reports', icon: BarChart3, label: 'Reports' },
  { to: '/admin/training', icon: GraduationCap, label: 'Training' },
  { to: '/admin/safety-incidents', icon: AlertTriangle, label: 'Safety' },
  { to: '/admin/safer-assessment', icon: ClipboardCheck, label: 'SAFER' },
];

function AdminDashboard() {
  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: async () => {
      const response = await api.get<SystemHealth>('/api/v1/admin/system/health');
      return response.data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: events } = useQuery({
    queryKey: ['admin', 'recent-events'],
    queryFn: async () => {
      const response = await api.get<RecentEvent[]>('/api/v1/audit', {
        params: { limit: 5, sort: 'desc' },
      });
      return response.data;
    },
    staleTime: 60 * 1000,
  });

  const serviceStatus = (status: string) => {
    if (status === 'connected' || status === 'healthy') {
      return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
    }
    return <Badge variant="destructive">Down</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Administration</h1>
        <p className="text-muted-foreground">
          System administration and configuration dashboard
        </p>
      </div>

      {/* System status cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>System Status</CardDescription>
            <CardTitle className="text-2xl">
              {healthLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Badge className={cn(
                  'text-lg',
                  health?.status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800',
                )}>
                  {health?.status === 'ok' ? 'All Systems Go' : 'Degraded'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Users</CardDescription>
            <CardTitle className="text-2xl">
              {healthLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                health?.activeUsers ?? '--'
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Today's Encounters</CardDescription>
            <CardTitle className="text-2xl">
              {healthLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                health?.todaysEncounters ?? '--'
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Services</CardDescription>
            <CardTitle className="text-sm">
              {healthLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {health?.services &&
                    Object.entries(health.services).map(([name, status]) => (
                      <div key={name} className="flex items-center gap-1">
                        <span className={cn(
                          'h-2 w-2 rounded-full',
                          status === 'connected' ? 'bg-green-500' : 'bg-red-500',
                        )} />
                        <span className="text-xs uppercase">{name}</span>
                      </div>
                    ))}
                </div>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {adminNavItems.map((item) => (
          <NavLink key={item.to} to={item.to}>
            <Card className="cursor-pointer transition-colors hover:bg-accent">
              <CardContent className="flex flex-col items-center gap-2 p-4">
                <item.icon className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium">{item.label}</span>
              </CardContent>
            </Card>
          </NavLink>
        ))}
      </div>

      {/* Recent system events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent System Events</CardTitle>
          <CardDescription>Latest audit trail events</CardDescription>
        </CardHeader>
        <CardContent>
          {!events || events.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No recent events.
            </p>
          ) : (
            <div className="space-y-3">
              {(Array.isArray(events) ? events : []).slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <Activity className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{event.user}</span>{' '}
                      {event.action.toLowerCase()} {event.resourceType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button
            variant="link"
            className="mt-2 h-auto p-0"
            asChild
          >
            <NavLink to="/admin/audit">View full audit log</NavLink>
          </Button>
        </CardContent>
      </Card>

      {/* Service health detail */}
      {health?.services && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Service Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(health.services).map(([name, status]) => (
                <div key={name} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'h-3 w-3 rounded-full',
                      status === 'connected' ? 'bg-green-500' : 'bg-red-500',
                    )} />
                    <span className="font-medium uppercase">{name}</span>
                  </div>
                  {serviceStatus(status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function AdminPage() {
  const location = useLocation();
  const isRoot =
    location.pathname === '/admin' || location.pathname === '/admin/';

  if (isRoot) {
    return <AdminDashboard />;
  }

  return <Outlet />;
}
