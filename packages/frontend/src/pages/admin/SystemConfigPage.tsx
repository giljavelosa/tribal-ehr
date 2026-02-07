import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Save,
  Loader2,
  AlertCircle,
  Clock,
  Lock,
  ShieldCheck,
  Database,
  RefreshCw,
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface SystemConfig {
  sessionTimeout: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  passwordExpirationDays: number;
  mfaRequired: boolean;
  auditRetentionDays: number;
}

interface ServiceHealth {
  name: string;
  status: 'connected' | 'disconnected' | 'degraded';
  latency?: number;
  version?: string;
  details?: string;
}

export function SystemConfigPage() {
  const queryClient = useQueryClient();
  const [configForm, setConfigForm] = useState<SystemConfig>({
    sessionTimeout: 15,
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true,
    passwordExpirationDays: 90,
    mfaRequired: false,
    auditRetentionDays: 365,
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['admin', 'system-config'],
    queryFn: async () => {
      const response = await api.get<SystemConfig>('/api/v1/admin/system/config');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['admin', 'service-health'],
    queryFn: async () => {
      const response = await api.get<ServiceHealth[]>('/api/v1/admin/system/health/services');
      return response.data;
    },
    staleTime: 30 * 1000,
  });

  const { data: fhirStatus } = useQuery({
    queryKey: ['admin', 'fhir-status'],
    queryFn: async () => {
      const response = await api.get<{ connected: boolean; serverUrl: string; version: string }>(
        '/api/v1/admin/system/health/fhir'
      );
      return response.data;
    },
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (config) {
      setConfigForm(config);
    }
  }, [config]);

  const updateConfigMutation = useMutation({
    mutationFn: async (data: SystemConfig) => {
      const response = await api.put('/api/v1/admin/system/config', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'system-config'] });
      toast({ title: 'Configuration saved', description: 'System configuration has been updated.' });
    },
    onError: () => {
      toast({ title: 'Failed to save configuration', variant: 'destructive' });
    },
  });

  const handleSaveConfig = () => {
    updateConfigMutation.mutate(configForm);
  };

  const serviceStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const serviceStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800">Connected</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-100 text-yellow-800">Degraded</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">Disconnected</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const services: ServiceHealth[] = health ?? [
    { name: 'API Server', status: 'connected' },
    { name: 'Database (PostgreSQL)', status: 'connected' },
    { name: 'Redis Cache', status: 'connected' },
    { name: 'RabbitMQ', status: 'connected' },
    { name: 'FHIR Server', status: fhirStatus?.connected ? 'connected' : 'disconnected' },
  ];

  if (configLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="status">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Configuration</h1>
        <p className="text-muted-foreground">
          Manage system settings, security policies, and service health
        </p>
      </div>

      {/* Service health dashboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" />
                Service Health Dashboard
              </CardTitle>
              <CardDescription>Current status of all system services</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchHealth()}
              disabled={healthLoading}
              className="gap-2"
            >
              <RefreshCw className={cn('h-4 w-4', healthLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {services.map((service) => (
              <div key={service.name} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-3 w-3 rounded-full', serviceStatusColor(service.status))} />
                    <p className="text-sm font-medium">{service.name}</p>
                  </div>
                </div>
                <div className="mt-2">
                  {serviceStatusBadge(service.status)}
                  {service.latency != null && (
                    <p className="mt-1 text-xs text-muted-foreground">{service.latency}ms latency</p>
                  )}
                  {service.version && (
                    <p className="text-xs text-muted-foreground">v{service.version}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FHIR server status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">FHIR Server Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={cn(
              'h-4 w-4 rounded-full',
              fhirStatus?.connected ? 'bg-green-500' : 'bg-red-500',
            )} />
            <div>
              <p className="font-medium">
                {fhirStatus?.connected ? 'Connected' : 'Disconnected'}
              </p>
              {fhirStatus?.serverUrl && (
                <p className="text-sm text-muted-foreground">URL: {fhirStatus.serverUrl}</p>
              )}
              {fhirStatus?.version && (
                <p className="text-sm text-muted-foreground">Version: {fhirStatus.version}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Session Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm space-y-2">
            <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
            <Input
              id="session-timeout"
              type="number"
              min={5}
              max={120}
              value={configForm.sessionTimeout}
              onChange={(e) =>
                setConfigForm((prev) => ({
                  ...prev,
                  sessionTimeout: parseInt(e.target.value) || 15,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Users will be automatically logged out after this period of inactivity.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Password policy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5" />
            Password Policy
          </CardTitle>
          <CardDescription>Configure password requirements for all users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pw-min-length">Minimum Password Length</Label>
              <Input
                id="pw-min-length"
                type="number"
                min={6}
                max={32}
                value={configForm.passwordMinLength}
                onChange={(e) =>
                  setConfigForm((prev) => ({
                    ...prev,
                    passwordMinLength: parseInt(e.target.value) || 8,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-expiration">Password Expiration (days)</Label>
              <Input
                id="pw-expiration"
                type="number"
                min={0}
                max={365}
                value={configForm.passwordExpirationDays}
                onChange={(e) =>
                  setConfigForm((prev) => ({
                    ...prev,
                    passwordExpirationDays: parseInt(e.target.value) || 90,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">Set to 0 for no expiration.</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Complexity Requirements</h4>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="pw-upper" className="cursor-pointer">Require uppercase letters (A-Z)</Label>
              <Switch
                id="pw-upper"
                checked={configForm.passwordRequireUppercase}
                onCheckedChange={(checked) =>
                  setConfigForm((prev) => ({ ...prev, passwordRequireUppercase: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="pw-lower" className="cursor-pointer">Require lowercase letters (a-z)</Label>
              <Switch
                id="pw-lower"
                checked={configForm.passwordRequireLowercase}
                onCheckedChange={(checked) =>
                  setConfigForm((prev) => ({ ...prev, passwordRequireLowercase: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="pw-numbers" className="cursor-pointer">Require numbers (0-9)</Label>
              <Switch
                id="pw-numbers"
                checked={configForm.passwordRequireNumbers}
                onCheckedChange={(checked) =>
                  setConfigForm((prev) => ({ ...prev, passwordRequireNumbers: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="pw-special" className="cursor-pointer">Require special characters (!@#$...)</Label>
              <Switch
                id="pw-special"
                checked={configForm.passwordRequireSpecialChars}
                onCheckedChange={(checked) =>
                  setConfigForm((prev) => ({ ...prev, passwordRequireSpecialChars: checked }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MFA settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5" />
            Multi-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="mfa-required" className="text-base">Require MFA for all users</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, all users must set up multi-factor authentication before accessing the system.
              </p>
            </div>
            <Switch
              id="mfa-required"
              checked={configForm.mfaRequired}
              onCheckedChange={(checked) =>
                setConfigForm((prev) => ({ ...prev, mfaRequired: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Audit retention */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Audit Log Retention</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="audit-retention">Retention Period (days)</Label>
            <Input
              id="audit-retention"
              type="number"
              min={30}
              max={3650}
              value={configForm.auditRetentionDays}
              onChange={(e) =>
                setConfigForm((prev) => ({
                  ...prev,
                  auditRetentionDays: parseInt(e.target.value) || 365,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              HIPAA requires a minimum retention of 6 years (2190 days) for audit logs.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveConfig}
          disabled={updateConfigMutation.isPending}
          size="lg"
          className="gap-2"
        >
          {updateConfigMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save All Settings
        </Button>
      </div>
    </div>
  );
}
