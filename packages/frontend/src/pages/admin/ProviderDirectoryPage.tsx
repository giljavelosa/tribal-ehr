import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stethoscope,
  Plus,
  Search,
  Loader2,
  AlertCircle,
  Edit,
  Calendar,
  MapPin,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import api from '@/lib/api';

interface Provider {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  npi: string;
  dea?: string;
  specialty: string;
  location: string;
  status: 'active' | 'inactive';
  email: string;
  phone?: string;
  scheduleTemplate?: string;
}

interface Location {
  id: string;
  name: string;
}

interface ProviderFormData {
  userId: string;
  firstName: string;
  lastName: string;
  npi: string;
  dea: string;
  specialty: string;
  locationId: string;
  email: string;
  phone: string;
  scheduleTemplate: string;
}

const defaultFormData: ProviderFormData = {
  userId: '',
  firstName: '',
  lastName: '',
  npi: '',
  dea: '',
  specialty: '',
  locationId: '',
  email: '',
  phone: '',
  scheduleTemplate: '',
};

const specialties = [
  'Family Medicine',
  'Internal Medicine',
  'Pediatrics',
  'Obstetrics/Gynecology',
  'Behavioral Health',
  'Dental',
  'Emergency Medicine',
  'General Practice',
  'Nurse Practitioner',
  'Physician Assistant',
  'Other',
];

export function ProviderDirectoryPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [formData, setFormData] = useState<ProviderFormData>(defaultFormData);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  const { data: providers, isLoading, error } = useQuery({
    queryKey: ['admin', 'providers', searchQuery],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;
      const response = await api.get<Provider[]>('/api/v1/admin/providers', { params });
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: locations } = useQuery({
    queryKey: ['admin', 'locations-list'],
    queryFn: async () => {
      const response = await api.get<Location[]>('/api/v1/admin/locations');
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; formData: ProviderFormData }) => {
      if (data.id) {
        const response = await api.put(`/api/v1/admin/providers/${data.id}`, data.formData);
        return response.data;
      }
      const response = await api.post('/api/v1/admin/providers', data.formData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
      toast({ title: editingProvider ? 'Provider updated' : 'Provider created' });
      setDialogOpen(false);
      setEditingProvider(null);
      setFormData(defaultFormData);
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to save provider', description: err.message, variant: 'destructive' });
    },
  });

  const handleOpenCreate = () => {
    setEditingProvider(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (provider: Provider) => {
    setEditingProvider(provider);
    setFormData({
      userId: provider.userId || '',
      firstName: provider.firstName,
      lastName: provider.lastName,
      npi: provider.npi,
      dea: provider.dea || '',
      specialty: provider.specialty,
      locationId: '',
      email: provider.email,
      phone: provider.phone || '',
      scheduleTemplate: provider.scheduleTemplate || '',
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.firstName || !formData.lastName || !formData.npi || !formData.specialty) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    saveMutation.mutate({ id: editingProvider?.id, formData });
  };

  const providerList = providers ?? [];
  const locationList = locations ?? [];

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="status">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading providers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="alert">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div className="text-center">
              <p className="font-semibold">Unable to load providers</p>
              <p className="mt-1 text-sm text-muted-foreground">Please try again later.</p>
            </div>
            <Button onClick={() => window.location.reload()}>Refresh</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Provider Directory</h1>
          <p className="text-muted-foreground">Manage providers, schedules, and assignments</p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Provider
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, NPI, or specialty..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Providers table */}
      <Card>
        <CardContent className="p-0">
          {providerList.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Stethoscope className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No providers found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>NPI</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providerList.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {provider.firstName} {provider.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{provider.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{provider.npi}</TableCell>
                    <TableCell>{provider.specialty}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {provider.location}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={provider.status === 'active' ? 'default' : 'secondary'}>
                        {provider.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(provider)}
                          className="gap-1"
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedProvider(provider);
                            setScheduleDialogOpen(true);
                          }}
                          className="gap-1"
                        >
                          <Calendar className="h-3 w-3" />
                          Schedule
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Provider dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProvider ? 'Edit Provider' : 'Add Provider'}</DialogTitle>
            <DialogDescription>
              {editingProvider
                ? 'Update provider information and settings.'
                : 'Add a new provider to the system.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prov-first">First Name *</Label>
                <Input
                  id="prov-first"
                  value={formData.firstName}
                  onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-last">Last Name *</Label>
                <Input
                  id="prov-last"
                  value={formData.lastName}
                  onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prov-npi">NPI *</Label>
                <Input
                  id="prov-npi"
                  value={formData.npi}
                  onChange={(e) => setFormData((p) => ({ ...p, npi: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-dea">DEA Number</Label>
                <Input
                  id="prov-dea"
                  value={formData.dea}
                  onChange={(e) => setFormData((p) => ({ ...p, dea: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Specialty *</Label>
              <Select
                value={formData.specialty}
                onValueChange={(v) => setFormData((p) => ({ ...p, specialty: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select specialty" />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select
                value={formData.locationId}
                onValueChange={(v) => setFormData((p) => ({ ...p, locationId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locationList.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prov-email">Email</Label>
                <Input
                  id="prov-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-phone">Phone</Label>
                <Input
                  id="prov-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prov-user">Linked User Account (User ID)</Label>
              <Input
                id="prov-user"
                placeholder="User ID to link this provider to"
                value={formData.userId}
                onChange={(e) => setFormData((p) => ({ ...p, userId: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingProvider ? 'Save Changes' : 'Add Provider'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule template dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Template</DialogTitle>
            <DialogDescription>
              Manage schedule template for {selectedProvider?.firstName} {selectedProvider?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-template">Schedule Template (JSON)</Label>
              <Textarea
                id="schedule-template"
                rows={10}
                placeholder='{"monday": {"start": "08:00", "end": "17:00"}, ...}'
                defaultValue={selectedProvider?.scheduleTemplate || ''}
              />
              <p className="text-xs text-muted-foreground">
                Define the provider's default weekly availability. This template is used by the scheduling system.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Close</Button>
            <Button onClick={() => {
              toast({ title: 'Schedule template saved' });
              setScheduleDialogOpen(false);
            }}>
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
