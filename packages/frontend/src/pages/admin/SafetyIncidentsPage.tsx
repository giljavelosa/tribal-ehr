import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Plus,
  Loader2,
  Search,
  BarChart3,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Dialog,
  DialogContent,
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
import { Checkbox } from '@/components/ui/checkbox';
import api from '@/lib/api';

interface SafetyIncident {
  id: string;
  incidentNumber: string;
  type: string;
  severity: string;
  status: string;
  description: string;
  reporterId: string;
  patientId?: string;
  incidentDate: string;
  assignedTo?: string;
  ehrRelated: boolean;
  ehrModule?: string;
  createdAt: string;
}

interface IncidentAnalytics {
  total: number;
  byStatus: { status: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  byType: { type: string; count: number }[];
  ehrRelatedCount: number;
  avgResolutionDays: number;
}

const severityColors: Record<string, string> = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

const statusColors: Record<string, string> = {
  reported: 'bg-blue-100 text-blue-800',
  investigating: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

export function SafetyIncidentsPage() {
  const queryClient = useQueryClient();
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [newIncident, setNewIncident] = useState({
    type: 'near-miss',
    severity: 'low',
    description: '',
    incidentDate: new Date().toISOString().slice(0, 10),
    ehrRelated: false,
    ehrModule: '',
  });

  const { data: incidentsResult, isLoading } = useQuery({
    queryKey: ['safety-incidents', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/api/v1/safety-incidents', { params });
      return res.data as { data: SafetyIncident[]; pagination: Record<string, unknown> };
    },
  });

  const { data: analytics } = useQuery({
    queryKey: ['safety-incidents', 'analytics'],
    queryFn: async () => {
      const res = await api.get('/api/v1/safety-incidents/analytics');
      return (res.data as { data: IncidentAnalytics }).data;
    },
  });

  const incidents = incidentsResult?.data || [];

  const createIncidentMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('/api/v1/safety-incidents', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safety-incidents'] });
      setShowReportDialog(false);
      setNewIncident({
        type: 'near-miss', severity: 'low', description: '',
        incidentDate: new Date().toISOString().slice(0, 10),
        ehrRelated: false, ehrModule: '',
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Safety Incidents</h1>
          <p className="text-muted-foreground">
            SAFER Guide 5 - Report and track safety incidents and near misses
          </p>
        </div>
        <Button onClick={() => setShowReportDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Report Incident
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Incidents</CardDescription>
            <CardTitle className="text-2xl">{analytics?.total ?? '--'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>EHR-Related</CardDescription>
            <CardTitle className="text-2xl">{analytics?.ehrRelatedCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Resolution</CardDescription>
            <CardTitle className="text-2xl">{analytics?.avgResolutionDays ?? '--'} days</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl">
              {analytics?.byStatus?.filter((s) => s.status !== 'resolved' && s.status !== 'closed')
                .reduce((sum, s) => sum + s.count, 0) ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Active Incidents
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="resolved">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Resolved
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Incidents</CardTitle>
                  <CardDescription>Reported and under investigation</CardDescription>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="reported">Reported</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Incident #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>EHR Related</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incidents.map((incident) => (
                      <TableRow key={incident.id}>
                        <TableCell className="font-medium">{incident.incidentNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{incident.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={severityColors[incident.severity] || ''}>
                            {incident.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[incident.status] || ''}>
                            {incident.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(incident.incidentDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {incident.ehrRelated ? (
                            <Badge variant="outline" className="bg-purple-100 text-purple-800">
                              {incident.ehrModule || 'Yes'}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {incident.description}
                        </TableCell>
                      </TableRow>
                    ))}
                    {incidents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          No incidents found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By Severity</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics?.bySeverity?.map((item) => (
                  <div key={item.severity} className="mb-2 flex items-center justify-between">
                    <Badge className={severityColors[item.severity] || ''}>{item.severity}</Badge>
                    <span className="font-medium">{item.count}</span>
                  </div>
                )) || <p className="text-muted-foreground">No data</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>By Type</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics?.byType?.map((item) => (
                  <div key={item.type} className="mb-2 flex items-center justify-between">
                    <Badge variant="outline">{item.type}</Badge>
                    <span className="font-medium">{item.count}</span>
                  </div>
                )) || <p className="text-muted-foreground">No data</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="resolved">
          <Card>
            <CardHeader>
              <CardTitle>Resolved Incidents</CardTitle>
              <CardDescription>Incidents that have been resolved or closed</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="py-8 text-center text-muted-foreground">
                Filter by "Resolved" or "Closed" status in the Active tab to view resolved incidents.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Report Incident Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Safety Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={newIncident.type}
                  onValueChange={(v) => setNewIncident({ ...newIncident, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="near-miss">Near Miss</SelectItem>
                    <SelectItem value="adverse-event">Adverse Event</SelectItem>
                    <SelectItem value="hazard">Hazard</SelectItem>
                    <SelectItem value="complaint">Complaint</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity *</Label>
                <Select
                  value={newIncident.severity}
                  onValueChange={(v) => setNewIncident({ ...newIncident, severity: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Incident Date *</Label>
              <Input
                type="date"
                value={newIncident.incidentDate}
                onChange={(e) => setNewIncident({ ...newIncident, incidentDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                rows={4}
                placeholder="Describe the incident..."
                value={newIncident.description}
                onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={newIncident.ehrRelated}
                onCheckedChange={(checked) =>
                  setNewIncident({ ...newIncident, ehrRelated: checked === true })
                }
              />
              <Label>EHR-related incident</Label>
            </div>
            {newIncident.ehrRelated && (
              <div className="space-y-2">
                <Label>EHR Module</Label>
                <Input
                  placeholder="e.g., CPOE, CDS, Lab Results"
                  value={newIncident.ehrModule}
                  onChange={(e) => setNewIncident({ ...newIncident, ehrModule: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newIncident.description}
              onClick={() =>
                createIncidentMutation.mutate({
                  type: newIncident.type,
                  severity: newIncident.severity,
                  description: newIncident.description,
                  incidentDate: newIncident.incidentDate,
                  ehrRelated: newIncident.ehrRelated,
                  ehrModule: newIncident.ehrModule || undefined,
                })
              }
            >
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
