import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Plus,
  Loader2,
  AlertCircle,
  X,
  CheckCircle,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/toast';
import api from '@/lib/api';

interface PortalAppointment {
  id: string;
  date: string;
  time: string;
  endTime: string;
  provider: string;
  providerId: string;
  type: string;
  status: string;
  location: string;
  reason?: string;
  note?: string;
}

interface CareTeamProvider {
  id: string;
  name: string;
  role: string;
}

export function PatientAppointmentsPage() {
  const queryClient = useQueryClient();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<string | null>(null);
  const [requestData, setRequestData] = useState({
    providerId: '',
    reason: '',
    preferredDateFrom: '',
    preferredDateTo: '',
    preferredTime: '',
    notes: '',
  });

  const { data: appointments, isLoading, error } = useQuery({
    queryKey: ['portal', 'appointments'],
    queryFn: async () => {
      const response = await api.get<PortalAppointment[]>('/api/v1/portal/me/appointments');
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: careTeam } = useQuery({
    queryKey: ['portal', 'care-team'],
    queryFn: async () => {
      const response = await api.get<CareTeamProvider[]>('/api/v1/portal/me/care-team');
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const requestAppointmentMutation = useMutation({
    mutationFn: async (data: typeof requestData) => {
      const response = await api.post('/api/v1/portal/me/appointment-requests', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'appointments'] });
      toast({ title: 'Appointment requested', description: 'Your request has been submitted. You will be contacted to confirm.' });
      setShowRequestForm(false);
      setRequestData({ providerId: '', reason: '', preferredDateFrom: '', preferredDateTo: '', preferredTime: '', notes: '' });
    },
    onError: () => {
      toast({ title: 'Request failed', description: 'Unable to submit your appointment request.', variant: 'destructive' });
    },
  });

  const cancelAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await api.post(`/api/v1/portal/me/appointments/${appointmentId}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'appointments'] });
      toast({ title: 'Appointment cancelled', description: 'Your appointment has been cancelled.' });
      setCancelDialogOpen(false);
      setAppointmentToCancel(null);
    },
    onError: () => {
      toast({ title: 'Cancellation failed', description: 'Unable to cancel the appointment.', variant: 'destructive' });
    },
  });

  const handleSubmitRequest = () => {
    if (!requestData.reason.trim()) return;
    requestAppointmentMutation.mutate(requestData);
  };

  const handleCancelClick = (appointmentId: string) => {
    setAppointmentToCancel(appointmentId);
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = () => {
    if (appointmentToCancel) {
      cancelAppointmentMutation.mutate(appointmentToCancel);
    }
  };

  const now = new Date();
  const upcoming = (appointments ?? []).filter(
    (a) => new Date(a.date) >= now && a.status !== 'cancelled',
  );
  const past = (appointments ?? []).filter(
    (a) => new Date(a.date) < now || a.status === 'completed',
  );

  const providers = careTeam ?? [];

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case 'booked':
      case 'checked-in':
        return 'default' as const;
      case 'completed':
        return 'secondary' as const;
      case 'cancelled':
      case 'noshow':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center" role="status">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">Loading appointments...</p>
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
              <p className="font-semibold">Unable to load appointments</p>
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
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Appointments</h1>
          <p className="mt-1 text-muted-foreground">Manage your visits and request new appointments</p>
        </div>
        <Button onClick={() => setShowRequestForm(true)} className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Request Appointment
        </Button>
      </div>

      {/* Request appointment form */}
      {showRequestForm && (
        <Card>
          <CardHeader>
            <CardTitle>Request New Appointment</CardTitle>
            <CardDescription>Submit a request and we will contact you to confirm the details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pref-provider">Preferred Provider (optional)</Label>
                <Select
                  value={requestData.providerId}
                  onValueChange={(value) => setRequestData((prev) => ({ ...prev, providerId: value }))}
                >
                  <SelectTrigger id="pref-provider">
                    <SelectValue placeholder="Any available provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pref-time">Preferred Time of Day</Label>
                <Select
                  value={requestData.preferredTime}
                  onValueChange={(value) => setRequestData((prev) => ({ ...prev, preferredTime: value }))}
                >
                  <SelectTrigger id="pref-time">
                    <SelectValue placeholder="No preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning (8am - 12pm)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (12pm - 5pm)</SelectItem>
                    <SelectItem value="any">No preference</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date-from">Preferred Date (From)</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={requestData.preferredDateFrom}
                  onChange={(e) => setRequestData((prev) => ({ ...prev, preferredDateFrom: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date-to">Preferred Date (To)</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={requestData.preferredDateTo}
                  onChange={(e) => setRequestData((prev) => ({ ...prev, preferredDateTo: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visit-reason">Reason for Visit *</Label>
              <Input
                id="visit-reason"
                placeholder="Brief description of your reason for visiting"
                value={requestData.reason}
                onChange={(e) => setRequestData((prev) => ({ ...prev, reason: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="visit-notes">Additional Notes</Label>
              <Textarea
                id="visit-notes"
                placeholder="Any additional information for the scheduling team..."
                rows={3}
                value={requestData.notes}
                onChange={(e) => setRequestData((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRequestForm(false)}>Cancel</Button>
              <Button
                onClick={handleSubmitRequest}
                disabled={requestAppointmentMutation.isPending || !requestData.reason.trim()}
                className="gap-2"
              >
                {requestAppointmentMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Submit Request
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Past ({past.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          {upcoming.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <Calendar className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
                <p className="text-muted-foreground">No upcoming appointments scheduled.</p>
                <Button variant="outline" onClick={() => setShowRequestForm(true)}>
                  Request an Appointment
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcoming.map((appt) => (
                <Card key={appt.id}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{appt.type}</h3>
                          <Badge variant={statusBadgeVariant(appt.status)}>{appt.status}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" aria-hidden="true" />
                            {new Date(appt.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" aria-hidden="true" />
                            {appt.time} - {appt.endTime}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" aria-hidden="true" />
                            {appt.provider}
                          </span>
                          {appt.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" aria-hidden="true" />
                              {appt.location}
                            </span>
                          )}
                        </div>
                        {appt.reason && (
                          <p className="text-sm">
                            <span className="font-medium">Reason:</span> {appt.reason}
                          </p>
                        )}
                      </div>
                      {appt.status === 'booked' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-destructive hover:text-destructive"
                          onClick={() => handleCancelClick(appt.id)}
                        >
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past">
          {past.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <Calendar className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
                <p className="text-muted-foreground">No past appointments.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {past.map((appt) => (
                <Card key={appt.id} className="opacity-80">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{appt.type}</h3>
                          <Badge variant={statusBadgeVariant(appt.status)}>{appt.status}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span>
                            {new Date(appt.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span>{appt.provider}</span>
                          {appt.location && <span>{appt.location}</span>}
                        </div>
                      </div>
                      {appt.status === 'completed' && (
                        <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" aria-label="Completed" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this appointment? You will need to request a new appointment if you change your mind.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Appointment
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelAppointmentMutation.isPending}
              className="gap-2"
            >
              {cancelAppointmentMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Yes, Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
