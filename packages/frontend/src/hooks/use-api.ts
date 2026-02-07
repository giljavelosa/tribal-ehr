import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

// ---- Types ----

export interface PatientSearchParams {
  name?: string;
  mrn?: string;
  dob?: string;
  phone?: string;
  page?: number;
  limit?: number;
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dob: string;
  gender: string;
  genderIdentity?: { coding?: Array<{ code: string; display: string; system?: string }>; text?: string };
  sex: string;
  sexualOrientation?: { coding?: Array<{ code: string; display: string; system?: string }>; text?: string };
  race?: Array<{ code: string; display: string; system?: string }>;
  ethnicity?: { coding?: Array<{ code: string; display: string; system?: string }>; text?: string };
  preferredLanguage?: string;
  maritalStatus?: string;
  phone?: string;
  email?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
  emergencyContacts?: EmergencyContact[];
  insurance?: InsuranceInfo;
  photo?: string;
  status: 'active' | 'inactive' | 'deceased';
  lastVisit?: string;
  pcp?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface InsuranceInfo {
  plan: string;
  memberId: string;
  groupNumber?: string;
  subscriberName?: string;
  subscriberDob?: string;
  subscriberRelation?: string;
}

export interface Condition {
  id: string;
  code: string;
  codeSystem?: string;
  display: string;
  clinicalStatus: 'active' | 'recurrence' | 'relapse' | 'inactive' | 'remission' | 'resolved';
  verificationStatus: 'unconfirmed' | 'provisional' | 'differential' | 'confirmed' | 'refuted' | 'entered-in-error';
  category: 'problem-list-item' | 'encounter-diagnosis' | 'health-concern';
  severity?: 'mild' | 'moderate' | 'severe';
  onsetDate?: string;
  abatementDate?: string;
  recordedDate?: string;
  note?: string;
}

export interface Observation {
  id: string;
  code: string;
  display: string;
  category: string;
  value?: string | number;
  unit?: string;
  referenceRange?: { low?: number; high?: number; text?: string };
  interpretation?: string;
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled';
  effectiveDateTime: string;
  issued?: string;
  flag?: 'N' | 'L' | 'H' | 'LL' | 'HH' | 'C';
}

export interface AllergyIntolerance {
  id: string;
  allergen: string;
  type: 'allergy' | 'intolerance';
  category: 'food' | 'medication' | 'environment' | 'biologic';
  criticality: 'low' | 'high' | 'unable-to-assess';
  clinicalStatus: 'active' | 'inactive' | 'resolved';
  verificationStatus: 'unconfirmed' | 'confirmed' | 'refuted' | 'entered-in-error';
  reactions: AllergyReaction[];
  onsetDate?: string;
  recordedDate?: string;
  note?: string;
}

export interface AllergyReaction {
  manifestation: string;
  severity: 'mild' | 'moderate' | 'severe';
}

export interface MedicationRequest {
  id: string;
  medication: string;
  dose: string;
  route: string;
  frequency: string;
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'stopped' | 'draft';
  intent: string;
  prescriber?: string;
  startDate?: string;
  endDate?: string;
  note?: string;
}

export interface Encounter {
  id: string;
  type: string;
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled';
  class: string;
  period: { start: string; end?: string };
  reasonCode?: string;
  provider?: string;
  location?: string;
  diagnosis?: string[];
}

export interface Immunization {
  id: string;
  vaccineCode: string;
  vaccineDisplay: string;
  status: 'completed' | 'entered-in-error' | 'not-done';
  occurrenceDateTime: string;
  lotNumber?: string;
  site?: string;
  route?: string;
  doseQuantity?: string;
  performer?: string;
  note?: string;
  expirationDate?: string;
  visDate?: string;
}

export interface VitalSigns {
  id: string;
  date: string;
  systolicBP?: number;
  diastolicBP?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  temperatureUnit?: 'F' | 'C';
  spO2?: number;
  height?: number;
  heightUnit?: 'in' | 'cm';
  weight?: number;
  weightUnit?: 'lbs' | 'kg';
  bmi?: number;
  position?: string;
  recorder?: string;
}

export interface Order {
  id: string;
  type: 'medication' | 'laboratory' | 'imaging' | 'referral' | 'procedure';
  description: string;
  status: 'draft' | 'active' | 'on-hold' | 'completed' | 'cancelled' | 'entered-in-error';
  priority: 'routine' | 'urgent' | 'asap' | 'stat';
  orderDate: string;
  orderingProvider: string;
  note?: string;
}

export interface ClinicalNote {
  id: string;
  type: 'soap' | 'hp' | 'progress' | 'procedure' | 'discharge';
  title: string;
  status: 'draft' | 'signed' | 'amended' | 'addended';
  author: string;
  date: string;
  content: string;
  cosigner?: string;
  signedDate?: string;
}

export interface CarePlan {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'on-hold' | 'completed' | 'cancelled';
  intent: string;
  category: string;
  period?: { start: string; end?: string };
  goals: CarePlanGoal[];
  activities: CarePlanActivity[];
  careTeam: CareTeamMember[];
}

export interface CarePlanGoal {
  id: string;
  description: string;
  status: 'proposed' | 'planned' | 'accepted' | 'active' | 'on-hold' | 'completed' | 'cancelled';
  target?: string;
  dueDate?: string;
  progress?: number;
}

export interface CarePlanActivity {
  id: string;
  description: string;
  status: 'not-started' | 'scheduled' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled';
  scheduledDate?: string;
}

export interface CareTeamMember {
  id: string;
  name: string;
  role: string;
  specialty?: string;
  phone?: string;
}

export interface DocumentReference {
  id: string;
  type: string;
  description: string;
  status: 'current' | 'superseded' | 'entered-in-error';
  date: string;
  author: string;
  contentType?: string;
  url?: string;
  size?: number;
}

export interface ImplantableDevice {
  id: string;
  udi?: string;
  deviceType: string;
  manufacturer: string;
  model?: string;
  serialNumber?: string;
  lotNumber?: string;
  expirationDate?: string;
  status: 'active' | 'inactive' | 'entered-in-error';
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName?: string;
  providerId: string;
  providerName?: string;
  type: string;
  status: 'booked' | 'arrived' | 'checked-in' | 'in-progress' | 'completed' | 'cancelled' | 'noshow';
  start: string;
  end: string;
  duration: number;
  reason?: string;
  location?: string;
  note?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---- Query Keys ----

export const queryKeys = {
  patients: (params?: PatientSearchParams) => ['patients', params] as const,
  patient: (id: string) => ['patients', id] as const,
  conditions: (patientId: string) => ['patients', patientId, 'conditions'] as const,
  observations: (patientId: string, category?: string) =>
    ['patients', patientId, 'observations', category] as const,
  allergies: (patientId: string) => ['patients', patientId, 'allergies'] as const,
  medications: (patientId: string) => ['patients', patientId, 'medications'] as const,
  encounters: (patientId: string) => ['patients', patientId, 'encounters'] as const,
  immunizations: (patientId: string) => ['patients', patientId, 'immunizations'] as const,
  vitals: (patientId: string) => ['patients', patientId, 'vitals'] as const,
  orders: (patientId: string) => ['patients', patientId, 'orders'] as const,
  notes: (patientId: string) => ['patients', patientId, 'notes'] as const,
  carePlans: (patientId: string) => ['patients', patientId, 'care-plans'] as const,
  documents: (patientId: string) => ['patients', patientId, 'documents'] as const,
  devices: (patientId: string) => ['patients', patientId, 'devices'] as const,
  appointments: (params?: Record<string, string>) => ['appointments', params] as const,
  schedule: (date: string, providerId?: string) => ['schedule', date, providerId] as const,
};

// ---- Patient Hooks ----

export function usePatients(params?: PatientSearchParams) {
  return useQuery({
    queryKey: queryKeys.patients(params),
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Patient>>('/patients', {
        params,
      });
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: queryKeys.patient(id),
    queryFn: async () => {
      const response = await api.get<Patient & { dateOfBirth?: string; sex?: string }>(`/patients/${id}`);
      const data = response.data;
      return {
        ...data,
        dob: data.dob || data.dateOfBirth || '',
        gender: data.gender || data.sex || '',
      } as Patient;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Patient>) => {
      const response = await api.post<Patient>('/patients', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Patient> }) => {
      const response = await api.put<Patient>(`/patients/${id}`, data);
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patient(variables.id) });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

// ---- Conditions ----

export function useConditions(patientId: string) {
  return useQuery({
    queryKey: queryKeys.conditions(patientId),
    queryFn: async () => {
      const response = await api.get<Condition[]>(
        `/patients/${patientId}/conditions`,
      );
      return response.data;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCondition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      data,
    }: {
      patientId: string;
      data: Partial<Condition>;
    }) => {
      const response = await api.post<Condition>(
        `/patients/${patientId}/conditions`,
        data,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conditions(variables.patientId),
      });
    },
  });
}

export function useUpdateCondition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      conditionId,
      data,
    }: {
      patientId: string;
      conditionId: string;
      data: Partial<Condition>;
    }) => {
      const response = await api.put<Condition>(
        `/patients/${patientId}/conditions/${conditionId}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conditions(variables.patientId),
      });
    },
  });
}

// ---- Observations ----

export function useObservations(patientId: string, category?: string) {
  return useQuery({
    queryKey: queryKeys.observations(patientId, category),
    queryFn: async () => {
      const response = await api.get<Observation[]>(
        `/patients/${patientId}/observations`,
        { params: category ? { category } : undefined },
      );
      return response.data;
    },
    enabled: !!patientId,
    staleTime: 3 * 60 * 1000,
  });
}

// ---- Allergies ----

export function useAllergies(patientId: string) {
  return useQuery({
    queryKey: queryKeys.allergies(patientId),
    queryFn: async () => {
      const response = await api.get<AllergyIntolerance[]>(
        `/patients/${patientId}/allergies`,
      );
      return response.data;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAllergy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      data,
    }: {
      patientId: string;
      data: Partial<AllergyIntolerance>;
    }) => {
      const response = await api.post<AllergyIntolerance>(
        `/patients/${patientId}/allergies`,
        data,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.allergies(variables.patientId),
      });
    },
  });
}

export function useUpdateAllergy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      allergyId,
      data,
    }: {
      patientId: string;
      allergyId: string;
      data: Partial<AllergyIntolerance>;
    }) => {
      const response = await api.put<AllergyIntolerance>(
        `/patients/${patientId}/allergies/${allergyId}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.allergies(variables.patientId),
      });
    },
  });
}

// ---- Medications ----

export function useMedications(patientId: string) {
  return useQuery({
    queryKey: queryKeys.medications(patientId),
    queryFn: async () => {
      const response = await api.get<MedicationRequest[]>(
        `/patients/${patientId}/medications`,
      );
      return response.data;
    },
    enabled: !!patientId,
    staleTime: 3 * 60 * 1000,
  });
}

export function useCreateMedication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      data,
    }: {
      patientId: string;
      data: Partial<MedicationRequest>;
    }) => {
      const response = await api.post<MedicationRequest>(
        `/patients/${patientId}/medications`,
        data,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.medications(variables.patientId),
      });
    },
  });
}

// ---- Encounters ----

export function useEncounters(patientId: string) {
  return useQuery({
    queryKey: queryKeys.encounters(patientId),
    queryFn: async () => {
      const response = await api.get<Encounter[]>(
        `/patients/${patientId}/encounters`,
      );
      return response.data;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}

// ---- Immunizations ----

export function useImmunizations(patientId: string) {
  return useQuery({
    queryKey: queryKeys.immunizations(patientId),
    queryFn: async () => {
      const response = await api.get<Immunization[]>(
        `/patients/${patientId}/immunizations`,
      );
      return response.data;
    },
    enabled: !!patientId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateImmunization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      data,
    }: {
      patientId: string;
      data: Partial<Immunization>;
    }) => {
      const response = await api.post<Immunization>(
        `/patients/${patientId}/immunizations`,
        data,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.immunizations(variables.patientId),
      });
    },
  });
}

// ---- Vitals ----

export function useVitals(patientId: string) {
  return useQuery({
    queryKey: queryKeys.vitals(patientId),
    queryFn: async () => {
      const response = await api.get<VitalSigns[]>(
        `/patients/${patientId}/vitals`,
      );
      return response.data;
    },
    enabled: !!patientId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateVitals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      data,
    }: {
      patientId: string;
      data: Partial<VitalSigns>;
    }) => {
      const response = await api.post<VitalSigns>(
        `/patients/${patientId}/vitals`,
        data,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.vitals(variables.patientId),
      });
    },
  });
}

// ---- Orders ----

export function useOrders(patientId: string) {
  return useQuery({
    queryKey: queryKeys.orders(patientId),
    queryFn: async () => {
      const response = await api.get<Order[]>(
        `/patients/${patientId}/orders`,
      );
      return response.data;
    },
    enabled: !!patientId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      data,
    }: {
      patientId: string;
      data: Partial<Order>;
    }) => {
      const response = await api.post<Order>(
        `/patients/${patientId}/orders`,
        data,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders(variables.patientId),
      });
    },
  });
}

// ---- Clinical Notes ----

export function useNotes(patientId: string) {
  return useQuery({
    queryKey: queryKeys.notes(patientId),
    queryFn: async () => {
      const response = await api.get<ClinicalNote[]>(
        `/patients/${patientId}/notes`,
      );
      return response.data;
    },
    enabled: !!patientId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      data,
    }: {
      patientId: string;
      data: Partial<ClinicalNote>;
    }) => {
      const response = await api.post<ClinicalNote>(
        `/patients/${patientId}/notes`,
        data,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes(variables.patientId),
      });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      noteId,
      data,
    }: {
      patientId: string;
      noteId: string;
      data: Partial<ClinicalNote>;
    }) => {
      const response = await api.put<ClinicalNote>(
        `/patients/${patientId}/notes/${noteId}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes(variables.patientId),
      });
    },
  });
}

// ---- Care Plans ----

export function useCarePlans(patientId: string) {
  return useQuery({
    queryKey: queryKeys.carePlans(patientId),
    queryFn: async () => {
      const response = await api.get<CarePlan[]>(
        `/patients/${patientId}/care-plans`,
      );
      return response.data;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCarePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      data,
    }: {
      patientId: string;
      data: Partial<CarePlan>;
    }) => {
      const response = await api.post<CarePlan>(
        `/patients/${patientId}/care-plans`,
        data,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.carePlans(variables.patientId),
      });
    },
  });
}

// ---- Documents ----

export function useDocuments(patientId: string) {
  return useQuery({
    queryKey: queryKeys.documents(patientId),
    queryFn: async () => {
      const response = await api.get<DocumentReference[]>(
        `/patients/${patientId}/documents`,
      );
      return response.data;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      formData,
    }: {
      patientId: string;
      formData: FormData;
    }) => {
      const response = await api.post<DocumentReference>(
        `/patients/${patientId}/documents`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.documents(variables.patientId),
      });
    },
  });
}

// ---- Devices (§170.315(a)(14)) ----

export function useDevices(patientId: string) {
  return useQuery({
    queryKey: queryKeys.devices(patientId),
    queryFn: async () => {
      const response = await api.get<ImplantableDevice[]>(
        `/patients/${patientId}/devices`,
      );
      return response.data;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      data,
    }: {
      patientId: string;
      data: Partial<ImplantableDevice>;
    }) => {
      const response = await api.post<ImplantableDevice>(
        `/patients/${patientId}/devices`,
        data,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.devices(variables.patientId),
      });
    },
  });
}

// ---- Appointments / Scheduling ----

export function useAppointments(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.appointments(params),
    queryFn: async () => {
      const response = await api.get<Appointment[]>('/appointments', { params });
      return response.data;
    },
    staleTime: 1 * 60 * 1000,
  });
}

export function useSchedule(date: string, providerId?: string) {
  return useQuery({
    queryKey: queryKeys.schedule(date, providerId),
    queryFn: async () => {
      const response = await api.get<Appointment[]>('/appointments', {
        params: { date, providerId },
      });
      return response.data;
    },
    staleTime: 1 * 60 * 1000,
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Appointment>) => {
      const response = await api.post<Appointment>('/appointments', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Appointment>;
    }) => {
      const response = await api.put<Appointment>(`/appointments/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
}
