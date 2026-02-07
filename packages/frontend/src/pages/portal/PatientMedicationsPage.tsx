import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pill,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface PatientMedication {
  id: string;
  medication: string;
  dose: string;
  frequency: string;
  route: string;
  prescriber: string;
  status: string;
  startDate?: string;
  endDate?: string;
  note?: string;
}

interface RefillRequest {
  id: string;
  medicationId: string;
  medicationName: string;
  requestDate: string;
  status: 'pending' | 'approved' | 'denied' | 'completed';
  pharmacyPreference?: string;
  notes?: string;
  responseNotes?: string;
}

export function PatientMedicationsPage() {
  const queryClient = useQueryClient();
  const [refillDialogOpen, setRefillDialogOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<PatientMedication | null>(null);
  const [refillForm, setRefillForm] = useState({
    pharmacyPreference: '',
    notes: '',
  });

  const { data: medications, isLoading, error } = useQuery({
    queryKey: ['portal', 'medications'],
    queryFn: async () => {
      const response = await api.get<PatientMedication[]>('/api/v1/portal/me/medications');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: refillHistory } = useQuery({
    queryKey: ['portal', 'refill-requests'],
    queryFn: async () => {
      const response = await api.get<RefillRequest[]>('/api/v1/portal/me/refill-requests');
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const refillMutation = useMutation({
    mutationFn: async (data: { medicationId: string; pharmacyPreference: string; notes: string }) => {
      const response = await api.post('/api/v1/portal/me/refill-requests', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'refill-requests'] });
      toast({ title: 'Refill requested', description: 'Your refill request has been submitted.' });
      setRefillDialogOpen(false);
      setSelectedMedication(null);
      setRefillForm({ pharmacyPreference: '', notes: '' });
    },
    onError: () => {
      toast({ title: 'Request failed', description: 'Unable to submit refill request.', variant: 'destructive' });
    },
  });

  const handleRequestRefill = (med: PatientMedication) => {
    setSelectedMedication(med);
    setRefillDialogOpen(true);
  };

  const handleSubmitRefill = () => {
    if (!selectedMedication) return;
    refillMutation.mutate({
      medicationId: selectedMedication.id,
      pharmacyPreference: refillForm.pharmacyPreference,
      notes: refillForm.notes,
    });
  };

  const refillStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" aria-hidden="true" />;
      case 'approved':
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />;
      case 'denied':
        return <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />;
      default:
        return null;
    }
  };

  const refillStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'outline' as const;
      case 'approved':
      case 'completed':
        return 'default' as const;
      case 'denied':
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
          <p className="text-muted-foreground">Loading medications...</p>
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
              <p className="font-semibold">Unable to load medications</p>
              <p className="mt-1 text-sm text-muted-foreground">Please try again later.</p>
            </div>
            <Button onClick={() => window.location.reload()}>Refresh</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeMeds = (medications ?? []).filter((m) => m.status === 'active');
  const inactiveMeds = (medications ?? []).filter((m) => m.status !== 'active');
  const refills = refillHistory ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Medications</h1>
        <p className="mt-1 text-muted-foreground">
          View your medications and request refills
        </p>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active ({activeMeds.length})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({inactiveMeds.length})</TabsTrigger>
          <TabsTrigger value="refills">Refill History ({refills.length})</TabsTrigger>
        </TabsList>

        {/* Active medications */}
        <TabsContent value="active">
          {activeMeds.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <Pill className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
                <p className="text-muted-foreground">No active medications on record.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeMeds.map((med) => (
                <Card key={med.id}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold">{med.medication}</h3>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span>
                            <span className="font-medium text-foreground">Dose:</span> {med.dose}
                          </span>
                          <span>
                            <span className="font-medium text-foreground">Frequency:</span> {med.frequency}
                          </span>
                          {med.route && (
                            <span>
                              <span className="font-medium text-foreground">Route:</span> {med.route}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Prescriber:</span> {med.prescriber}
                        </p>
                        {med.startDate && (
                          <p className="text-sm text-muted-foreground">
                            Started: {new Date(med.startDate).toLocaleDateString()}
                          </p>
                        )}
                        {med.note && (
                          <p className="mt-1 text-sm italic text-muted-foreground">{med.note}</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleRequestRefill(med)}
                      >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Request Refill
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Inactive medications */}
        <TabsContent value="inactive">
          {inactiveMeds.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <Pill className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
                <p className="text-muted-foreground">No inactive medications.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medication</TableHead>
                      <TableHead>Dose</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Prescriber</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inactiveMeds.map((med) => (
                      <TableRow key={med.id}>
                        <TableCell className="font-medium">{med.medication}</TableCell>
                        <TableCell>{med.dose}</TableCell>
                        <TableCell>{med.frequency}</TableCell>
                        <TableCell>{med.prescriber}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{med.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Refill history */}
        <TabsContent value="refills">
          {refills.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <RefreshCw className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
                <p className="text-muted-foreground">No refill requests on record.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medication</TableHead>
                      <TableHead>Request Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pharmacy</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refills.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.medicationName}</TableCell>
                        <TableCell>{new Date(req.requestDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {refillStatusIcon(req.status)}
                            <Badge variant={refillStatusBadgeVariant(req.status)}>{req.status}</Badge>
                          </div>
                        </TableCell>
                        <TableCell>{req.pharmacyPreference || '--'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {req.responseNotes || req.notes || '--'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Refill request dialog */}
      <Dialog open={refillDialogOpen} onOpenChange={setRefillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Medication Refill</DialogTitle>
            <DialogDescription>
              {selectedMedication && (
                <>
                  Requesting refill for <span className="font-semibold">{selectedMedication.medication}</span>{' '}
                  ({selectedMedication.dose}, {selectedMedication.frequency})
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pharmacy-pref">Pharmacy Preference</Label>
              <Select
                value={refillForm.pharmacyPreference}
                onValueChange={(value) => setRefillForm((prev) => ({ ...prev, pharmacyPreference: value }))}
              >
                <SelectTrigger id="pharmacy-pref">
                  <SelectValue placeholder="Select pharmacy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on-site">On-site Pharmacy</SelectItem>
                  <SelectItem value="mail-order">Mail Order</SelectItem>
                  <SelectItem value="external">External Pharmacy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refill-notes">Additional Notes (optional)</Label>
              <Textarea
                id="refill-notes"
                placeholder="Any special instructions or notes..."
                rows={3}
                value={refillForm.notes}
                onChange={(e) => setRefillForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefillDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRefill}
              disabled={refillMutation.isPending}
              className="gap-2"
            >
              {refillMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
