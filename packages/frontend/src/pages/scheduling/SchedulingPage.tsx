import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  List,
  LayoutGrid,
  Clock,
  User,
  MapPin,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  useSchedule,
  useCreateAppointment,
  useUpdateAppointment,
  type Appointment,
  type Patient,
} from '@/hooks/use-api';
import { PatientSearch } from '@/components/ui/patient-search';
import { usePatientContext } from '@/stores/patient-context-store';
import { usePatientContextFromUrl } from '@/hooks/use-patient-context-url';

type ViewMode = 'day' | 'week';

const statusColors: Record<string, string> = {
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

const statusLabels: Record<string, string> = {
  booked: 'Booked',
  arrived: 'Arrived',
  'checked-in': 'Checked In',
  'in-progress': 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  noshow: 'No Show',
};

const appointmentTypes = [
  'Follow-up',
  'Annual Wellness',
  'New Patient',
  'Sick Visit',
  'Procedure',
  'Telehealth',
  'Urgent Visit',
  'Lab Review',
  'Pre-op',
  'Post-op',
];

const durations = [15, 20, 30, 45, 60, 90];

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getWeekDays(date: Date): Date[] {
  const day = date.getDay();
  const monday = addDays(date, -day + (day === 0 ? -6 : 1));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const emptyAppointmentForm = {
  patientName: '',
  patientId: '',
  type: 'Follow-up',
  date: '',
  time: '09:00',
  duration: 30,
  reason: '',
  location: 'Main Clinic',
  note: '',
};

export function SchedulingPage() {
  const [view, setView] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [formData, setFormData] = useState(emptyAppointmentForm);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const activePatient = usePatientContext((s) => s.activePatient);
  usePatientContextFromUrl();

  const dateStr = useMemo(
    () => currentDate.toISOString().slice(0, 10),
    [currentDate],
  );

  const { data: scheduleData, isLoading } = useSchedule(dateStr);
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment();

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const navigateDate = useCallback(
    (direction: number) => {
      if (view === 'day') {
        setCurrentDate((d) => addDays(d, direction));
      } else {
        setCurrentDate((d) => addDays(d, direction * 7));
      }
    },
    [view],
  );

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleOpenNew = useCallback(() => {
    setFormData({
      ...emptyAppointmentForm,
      date: dateStr,
      ...(activePatient ? {
        patientId: activePatient.id,
        patientName: `${activePatient.lastName}, ${activePatient.firstName}`,
      } : {}),
    });
    if (activePatient) {
      setSelectedPatient(activePatient);
    }
    setNewDialogOpen(true);
  }, [dateStr, activePatient]);

  const handleViewDetail = useCallback((appt: Appointment) => {
    setSelectedAppointment(appt);
    setDetailDialogOpen(true);
  }, []);

  const handleCreateAppointment = useCallback(async () => {
    const startDateTime = new Date(
      `${formData.date}T${formData.time}`,
    );
    const endDateTime = new Date(
      startDateTime.getTime() + formData.duration * 60000,
    );

    await createAppointment.mutateAsync({
      patientId: formData.patientId || 'pending',
      patientName: formData.patientName,
      providerId: 'current-provider',
      type: formData.type,
      status: 'booked',
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString(),
      duration: formData.duration,
      reason: formData.reason || undefined,
      location: formData.location || undefined,
      note: formData.note || undefined,
    });

    setNewDialogOpen(false);
    setFormData(emptyAppointmentForm);
    setSelectedPatient(null);
  }, [formData, createAppointment]);

  const handleStatusChange = useCallback(
    async (apptId: string, newStatus: Appointment['status']) => {
      await updateAppointment.mutateAsync({
        id: apptId,
        data: { status: newStatus },
      });
      setDetailDialogOpen(false);
    },
    [updateAppointment],
  );

  // Sort appointments by start time
  const sortedSchedule = useMemo(() => {
    if (!scheduleData) return [];
    return [...scheduleData].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
  }, [scheduleData]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scheduling</h1>
          <p className="text-muted-foreground">
            Manage appointments and provider schedules
          </p>
        </div>
        <Button className="gap-1" onClick={handleOpenNew}>
          <Plus className="h-4 w-4" />
          New Appointment
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateDate(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {view === 'day'
                  ? formatDate(currentDate)
                  : `Week of ${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </CardTitle>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateDate(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToToday}
                className="ml-2"
              >
                Today
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={view === 'day' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('day')}
                className="gap-1"
              >
                <List className="h-4 w-4" />
                Day
              </Button>
              <Button
                variant={view === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('week')}
                className="gap-1"
              >
                <LayoutGrid className="h-4 w-4" />
                Week
              </Button>
            </div>
          </div>
          <CardDescription>
            Provider: Dr. {/* user name would go here */}Jane Wilson | Location:
            Main Clinic
          </CardDescription>
        </CardHeader>
        <CardContent>
          {view === 'day' ? (
            /* Day View */
            isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-lg bg-muted"
                  />
                ))}
              </div>
            ) : sortedSchedule.length === 0 ? (
              <div className="py-12 text-center">
                <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">No appointments scheduled</p>
                <p className="text-sm text-muted-foreground">
                  This day has no appointments. Click "New Appointment" to add
                  one.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedSchedule.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex cursor-pointer items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-accent"
                    onClick={() => handleViewDetail(appt)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleViewDetail(appt);
                      }
                    }}
                  >
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
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {appt.patientName || 'Unknown Patient'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {appt.type} ({appt.duration} min)
                        {appt.reason && ` - ${appt.reason}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {appt.location && (
                        <span className="hidden text-xs text-muted-foreground md:flex md:items-center md:gap-1">
                          <MapPin className="h-3 w-3" />
                          {appt.location}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={statusColors[appt.status] || ''}
                      >
                        {statusLabels[appt.status] || appt.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Week View */
            <div className="overflow-x-auto">
              <div className="grid min-w-[700px] grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const dayStr = day.toISOString().slice(0, 10);
                  const isToday =
                    dayStr === new Date().toISOString().slice(0, 10);
                  return (
                    <div key={dayStr} className="min-w-[100px]">
                      <div
                        className={`mb-2 rounded-lg p-2 text-center text-sm ${
                          isToday
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="font-medium">
                          {day.toLocaleDateString('en-US', {
                            weekday: 'short',
                          })}
                        </p>
                        <p className="text-xs">
                          {day.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="space-y-1">
                        {/* Show placeholder slot count */}
                        <div
                          className={`cursor-pointer rounded border border-dashed p-2 text-center text-xs text-muted-foreground transition-colors hover:bg-accent ${
                            isToday && scheduleData
                              ? ''
                              : ''
                          }`}
                          onClick={() => {
                            setCurrentDate(day);
                            setView('day');
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              setCurrentDate(day);
                              setView('day');
                            }
                          }}
                        >
                          {isToday && scheduleData
                            ? `${scheduleData.length} appt${scheduleData.length !== 1 ? 's' : ''}`
                            : 'View day'}
                        </div>
                        {isToday &&
                          scheduleData &&
                          scheduleData.slice(0, 4).map((appt) => (
                            <div
                              key={appt.id}
                              className="cursor-pointer rounded border p-1.5 text-xs transition-colors hover:bg-accent"
                              onClick={() => handleViewDetail(appt)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  handleViewDetail(appt);
                                }
                              }}
                            >
                              <p className="font-medium">
                                {formatTime(appt.start)}
                              </p>
                              <p className="truncate text-muted-foreground">
                                {appt.patientName}
                              </p>
                              <Badge
                                variant="outline"
                                className={`mt-0.5 text-[10px] ${statusColors[appt.status] || ''}`}
                              >
                                {statusLabels[appt.status] || appt.status}
                              </Badge>
                            </div>
                          ))}
                        {isToday &&
                          scheduleData &&
                          scheduleData.length > 4 && (
                            <p className="text-center text-xs text-muted-foreground">
                              +{scheduleData.length - 4} more
                            </p>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Appointment Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={(open) => {
        setNewDialogOpen(open);
        if (!open) {
          setFormData(emptyAppointmentForm);
          setSelectedPatient(null);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Appointment</DialogTitle>
            <DialogDescription>
              Schedule a new appointment for a patient.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Patient</Label>
              <PatientSearch
                value={selectedPatient}
                onSelect={(patient) => {
                  setSelectedPatient(patient);
                  if (patient) {
                    setFormData((prev) => ({
                      ...prev,
                      patientId: patient.id,
                      patientName: `${patient.lastName}, ${patient.firstName}`,
                    }));
                  } else {
                    setFormData((prev) => ({
                      ...prev,
                      patientId: '',
                      patientName: '',
                    }));
                  }
                }}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Appointment Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, type: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {appointmentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select
                  value={formData.duration.toString()}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      duration: Number(v),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {durations.map((d) => (
                      <SelectItem key={d} value={d.toString()}>
                        {d} minutes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="apptDate">Date</Label>
                <Input
                  id="apptDate"
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apptTime">Time</Label>
                <Input
                  id="apptTime"
                  type="time"
                  value={formData.time}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, time: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apptLocation">Location</Label>
              <Select
                value={formData.location}
                onValueChange={(v) =>
                  setFormData((prev) => ({ ...prev, location: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Main Clinic">Main Clinic</SelectItem>
                  <SelectItem value="Satellite Office">
                    Satellite Office
                  </SelectItem>
                  <SelectItem value="Telehealth">Telehealth</SelectItem>
                  <SelectItem value="Home Visit">Home Visit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apptReason">Reason for Visit</Label>
              <Input
                id="apptReason"
                placeholder="e.g., Diabetes follow-up, annual physical..."
                value={formData.reason}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, reason: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apptNote">Notes</Label>
              <Textarea
                id="apptNote"
                placeholder="Additional notes for the appointment..."
                value={formData.note}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, note: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAppointment}
              disabled={
                !selectedPatient ||
                !formData.date ||
                !formData.time ||
                createAppointment.isPending
              }
            >
              {createAppointment.isPending
                ? 'Scheduling...'
                : 'Schedule Appointment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
            <DialogDescription>
              {selectedAppointment?.patientName} -{' '}
              {selectedAppointment?.type}
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient</span>
                  <span className="font-medium">
                    {selectedAppointment.patientName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span>{selectedAppointment.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge
                    variant="outline"
                    className={
                      statusColors[selectedAppointment.status] || ''
                    }
                  >
                    {statusLabels[selectedAppointment.status] ||
                      selectedAppointment.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date & Time</span>
                  <span>
                    {new Date(selectedAppointment.start).toLocaleString(
                      'en-US',
                      {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      },
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span>{selectedAppointment.duration} minutes</span>
                </div>
                {selectedAppointment.location && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location</span>
                    <span>{selectedAppointment.location}</span>
                  </div>
                )}
                {selectedAppointment.reason && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reason</span>
                    <span>{selectedAppointment.reason}</span>
                  </div>
                )}
                {selectedAppointment.note && (
                  <div className="rounded-lg border p-3">
                    <span className="font-medium">Notes: </span>
                    <span className="text-muted-foreground">
                      {selectedAppointment.note}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Status actions */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {selectedAppointment.status === 'booked' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleStatusChange(
                            selectedAppointment.id,
                            'checked-in',
                          )
                        }
                        disabled={updateAppointment.isPending}
                      >
                        Check In
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() =>
                          handleStatusChange(
                            selectedAppointment.id,
                            'cancelled',
                          )
                        }
                        disabled={updateAppointment.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() =>
                          handleStatusChange(
                            selectedAppointment.id,
                            'noshow',
                          )
                        }
                        disabled={updateAppointment.isPending}
                      >
                        No Show
                      </Button>
                    </>
                  )}
                  {(selectedAppointment.status === 'checked-in' ||
                    selectedAppointment.status === 'arrived') && (
                    <Button
                      size="sm"
                      onClick={() =>
                        handleStatusChange(
                          selectedAppointment.id,
                          'in-progress',
                        )
                      }
                      disabled={updateAppointment.isPending}
                    >
                      Start Visit
                    </Button>
                  )}
                  {selectedAppointment.status === 'in-progress' && (
                    <Button
                      size="sm"
                      onClick={() =>
                        handleStatusChange(
                          selectedAppointment.id,
                          'completed',
                        )
                      }
                      disabled={updateAppointment.isPending}
                    >
                      Complete Visit
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
