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

export interface ProviderOrder {
  id: string;
  patientId: string;
  encounterId?: string;
  orderType: 'medication' | 'laboratory' | 'imaging';
  status: 'draft' | 'active' | 'completed' | 'cancelled' | 'on-hold' | 'entered-in-error';
  priority: 'routine' | 'urgent' | 'stat' | 'asap';
  code?: string;
  codeSystem?: string;
  codeDisplay?: string;
  orderDetails: Record<string, unknown>;
  cdsAlerts: Array<{ severity: string; summary: string; detail: string; source: string; overridable: boolean }>;
  orderedBy: string;
  orderedAt: string;
  signedBy?: string;
  signedAt?: string;
  clinicalIndication?: string;
  notes?: string;
  fhirId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderSetItem {
  id: string;
  name: string;
  category?: string;
  description?: string;
  diagnosisCodes: string[];
  orders: unknown[];
  approved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  version: number;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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

export interface FamilyHistory {
  id: string;
  patientId: string;
  relationship: string;
  relativeName?: string;
  conditionCode?: string;
  conditionDisplay: string;
  conditionSystem?: string;
  onsetAge?: number;
  onsetRangeLow?: number;
  onsetRangeHigh?: number;
  deceased: boolean;
  deceasedAge?: number;
  causeOfDeath?: string;
  note?: string;
  status: string;
  recordedDate?: string;
  recordedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

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
  providerOrders: (params?: Record<string, string>) => ['provider-orders', params] as const,
  orderSets: (params?: Record<string, string>) => ['order-sets', params] as const,
  notes: (patientId: string) => ['patients', patientId, 'notes'] as const,
  carePlans: (patientId: string) => ['patients', patientId, 'care-plans'] as const,
  documents: (patientId: string) => ['patients', patientId, 'documents'] as const,
  devices: (patientId: string) => ['patients', patientId, 'devices'] as const,
  familyHistory: (patientId: string) => ['patients', patientId, 'family-history'] as const,
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

// ---- Provider Orders (CPOE) ----

export function useProviderOrders(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.providerOrders(params),
    queryFn: async () => {
      const response = await api.get<{ data: ProviderOrder[]; pagination?: unknown }>('/orders', { params });
      return response.data.data;
    },
    staleTime: 1 * 60 * 1000,
  });
}

export function usePendingOrders() {
  return useQuery({
    queryKey: ['pending-orders'],
    queryFn: async () => {
      const response = await api.get<{ data: ProviderOrder[] }>('/orders/pending');
      return response.data.data;
    },
    staleTime: 1 * 60 * 1000,
  });
}

export function useSignOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await api.post<{ data: ProviderOrder }>(`/orders/${orderId}/sign`);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useCreateMedicationOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      encounterId?: string;
      priority?: string;
      medication: {
        rxnormCode: string;
        displayName: string;
        dosage: string;
        route: string;
        frequency: string;
        duration?: string;
        quantity?: number;
        refills?: number;
        instructions?: string;
        prn?: boolean;
        prnReason?: string;
      };
    }) => {
      const response = await api.post<{ data: ProviderOrder }>('/orders/medications', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useCreateLabOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      encounterId?: string;
      priority?: string;
      lab: {
        loincCode: string;
        displayName: string;
        panelCode?: string;
        specimenType?: string;
        collectionInstructions?: string;
        clinicalNotes?: string;
        fastingRequired?: boolean;
      };
    }) => {
      const response = await api.post<{ data: ProviderOrder }>('/orders/laboratory', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useCreateImagingOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      patientId: string;
      encounterId?: string;
      priority?: string;
      imaging: {
        procedureCode: string;
        displayName: string;
        clinicalIndication: string;
        bodyPart?: string;
        laterality?: string;
      };
    }) => {
      const response = await api.post<{ data: ProviderOrder }>('/orders/imaging', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

// ---- Order Sets ----

export function useOrderSets(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.orderSets(params),
    queryFn: async () => {
      const response = await api.get<{ data: OrderSetItem[] }>('/order-sets', { params });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateOrderSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      category?: string;
      description?: string;
      diagnosisCodes?: string[];
      orders: unknown[];
    }) => {
      const response = await api.post<{ data: OrderSetItem }>('/order-sets', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-sets'] });
    },
  });
}

export function useApplyOrderSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderSetId,
      patientId,
      encounterId,
    }: {
      orderSetId: string;
      patientId: string;
      encounterId?: string;
    }) => {
      const response = await api.post<{ data: { ordersCreated: number } }>(
        `/order-sets/${orderSetId}/apply`,
        { patientId, encounterId },
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-sets'] });
      queryClient.invalidateQueries({ queryKey: ['provider-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
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

// ---- Co-sign Notes ----

export function useCosignNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      noteId,
    }: {
      noteId: string;
      patientId: string;
    }) => {
      const response = await api.post<ClinicalNote>(
        `/clinical-notes/${noteId}/cosign`,
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

// ---- Update Medication ----

export function useUpdateMedication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      medicationId,
      data,
    }: {
      patientId: string;
      medicationId: string;
      data: Partial<MedicationRequest>;
    }) => {
      const response = await api.put<MedicationRequest>(
        `/medications/${medicationId}`,
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

// ---- Forgot Password ----

export function useForgotPassword() {
  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const response = await api.post('/auth/forgot-password', { email });
      return response.data;
    },
  });
}

// ---- Care Plans ----

export function useUpdateCarePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      patientId,
      carePlanId,
      data,
    }: {
      patientId: string;
      carePlanId: string;
      data: Partial<CarePlan>;
    }) => {
      const response = await api.put<CarePlan>(
        `/patients/${patientId}/care-plans/${carePlanId}`,
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

// ---- Family Health History (§170.315(a)(12)) ----

export function useFamilyHistory(patientId: string) {
  return useQuery({
    queryKey: queryKeys.familyHistory(patientId),
    queryFn: async () => {
      const response = await api.get<{ data: FamilyHistory[] }>(
        '/family-history',
        { params: { patientId } },
      );
      return response.data.data;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateFamilyHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<FamilyHistory>) => {
      const response = await api.post<{ data: FamilyHistory }>(
        '/family-history',
        data,
      );
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      if (variables.patientId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.familyHistory(variables.patientId),
        });
      }
    },
  });
}

export function useUpdateFamilyHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patientId,
      data,
    }: {
      id: string;
      patientId: string;
      data: Partial<FamilyHistory>;
    }) => {
      const response = await api.put<{ data: FamilyHistory }>(
        `/family-history/${id}`,
        data,
      );
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.familyHistory(variables.patientId),
      });
    },
  });
}

export function useDeleteFamilyHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patientId,
    }: {
      id: string;
      patientId: string;
    }) => {
      const response = await api.delete<{ data: FamilyHistory }>(
        `/family-history/${id}`,
      );
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.familyHistory(variables.patientId),
      });
    },
  });
}

// ---- Secure Messaging ----

export interface ApiMessage {
  id: string;
  senderId: string;
  senderName?: string;
  recipientId: string;
  recipientName?: string;
  patientId?: string;
  patientName?: string;
  subject: string;
  body: string;
  priority: 'normal' | 'high' | 'urgent';
  readAt?: string;
  parentId?: string;
  threadId: string;
  createdAt: string;
  flagged?: boolean;
  followUpDate?: string;
  escalated?: boolean;
}

export interface MessageFilters {
  unreadOnly?: boolean;
  patientId?: string;
  priority?: 'normal' | 'high' | 'urgent';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export function useMessagesInbox(filters?: MessageFilters) {
  return useQuery({
    queryKey: ['messages', 'inbox', filters] as const,
    queryFn: async () => {
      const response = await api.get<{ data: ApiMessage[]; pagination?: { total: number; page: number; limit: number; pages: number } }>(
        '/messages/inbox',
        { params: filters },
      );
      return response.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useMessagesSent(filters?: MessageFilters) {
  return useQuery({
    queryKey: ['messages', 'sent', filters] as const,
    queryFn: async () => {
      const response = await api.get<{ data: ApiMessage[]; pagination?: { total: number; page: number; limit: number; pages: number } }>(
        '/messages/sent',
        { params: filters },
      );
      return response.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useMessagesFlagged() {
  return useQuery({
    queryKey: ['messages', 'flagged'] as const,
    queryFn: async () => {
      const response = await api.get<{ data: ApiMessage[] }>('/messages/flagged');
      return response.data.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useMessagesUnreadCount() {
  return useQuery({
    queryKey: ['messages', 'unread-count'] as const,
    queryFn: async () => {
      const response = await api.get<{ data: { count: number } }>('/messages/unread-count');
      return response.data.data.count;
    },
    staleTime: 30 * 1000,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      recipientId: string;
      subject: string;
      body: string;
      patientId?: string;
      priority?: 'normal' | 'high' | 'urgent';
    }) => {
      const response = await api.post<{ data: ApiMessage }>('/messages', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useReplyToMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const response = await api.post<{ data: ApiMessage }>(`/messages/${id}/reply`, { body });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useMarkMessageRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/messages/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useFlagMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, flagged }: { id: string; flagged: boolean }) => {
      if (flagged) {
        await api.post(`/messages/${id}/flag`);
      } else {
        await api.delete(`/messages/${id}/flag`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useForwardMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, recipientId, note }: { id: string; recipientId: string; note?: string }) => {
      const response = await api.post<{ data: ApiMessage }>(`/messages/${id}/forward`, { recipientId, note });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useSetMessageFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, followUpDate }: { id: string; followUpDate: string }) => {
      await api.put(`/messages/${id}/follow-up`, { followUpDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useEscalateMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, escalateTo }: { id: string; escalateTo: string }) => {
      await api.post(`/messages/${id}/escalate`, { escalateTo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

// ---- Results Inbox ----

export interface ResultsInboxItem {
  id: string;
  patientId: string;
  patientName?: string;
  orderType: 'medication' | 'laboratory' | 'imaging';
  description?: string;
  status: string;
  priority: string;
  resultDate?: string;
  acknowledged: boolean;
  code?: string;
  codeSystem?: string;
  codeDisplay?: string;
  orderDetails: Record<string, unknown>;
  cdsAlerts: Array<{ severity: string; summary: string; detail: string; source: string; overridable: boolean }>;
  orderedBy: string;
  orderedAt: string;
  signedBy?: string;
  signedAt?: string;
  clinicalIndication?: string;
  notes?: string;
  fhirId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResultsInboxFilters {
  status?: string;
  orderType?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
}

export function useResultsInbox(filters?: ResultsInboxFilters) {
  return useQuery({
    queryKey: ['results-inbox', filters] as const,
    queryFn: async () => {
      const response = await api.get<{ data: ResultsInboxItem[] }>(
        '/results-inbox',
        { params: filters },
      );
      return response.data.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useAcknowledgeResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<{ data: ResultsInboxItem }>(`/results-inbox/${id}/acknowledge`);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results-inbox'] });
    },
  });
}

export function useBulkAcknowledgeResults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderIds: string[]) => {
      const response = await api.post<{ data: { acknowledged: number } }>('/results-inbox/bulk-acknowledge', { orderIds });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results-inbox'] });
    },
  });
}

// ---- Escalation Events ----

export interface EscalationEventItem {
  id: string;
  ruleId?: string;
  sourceType: string;
  sourceId: string;
  originalRecipient: string;
  escalatedTo: string;
  reason?: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  createdAt: string;
}

export function useEscalationEvents(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['escalation-events', params],
    queryFn: async () => {
      const response = await api.get<{ data: EscalationEventItem[] }>('/admin/escalation-events', { params });
      return response.data.data;
    },
    staleTime: 1 * 60 * 1000,
  });
}

// ---- Quality Measures Dashboard ----

export interface QualityMeasureResult {
  measureId: string;
  measureName: string;
  description: string;
  numerator: number;
  denominator: number;
  exclusions: number;
  exceptions: number;
  rate: number;
  period: { start: string; end: string };
}

export interface QualityDashboard {
  measures: QualityMeasureResult[];
  summary: {
    totalMeasures: number;
    averageRate: number;
    measuresAboveThreshold: number;
    measuresBelowThreshold: number;
  };
}

export function useQualityMeasuresDashboard(period?: { start: string; end: string }) {
  return useQuery({
    queryKey: ['quality-measures', 'dashboard', period],
    queryFn: async () => {
      const response = await api.get<{ data: QualityDashboard }>('/quality-measures/dashboard', {
        params: period,
      });
      return response.data.data;
    },
    enabled: !!period?.start && !!period?.end,
    staleTime: 5 * 60 * 1000,
  });
}

// ---- Patient Lists ----

export interface PatientListItem {
  id: string;
  userId: string;
  name: string;
  description?: string;
  listType: string;
  isDefault: boolean;
  patientCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PatientListMember {
  id: string;
  listId: string;
  patientId: string;
  patientName?: string;
  patientMrn?: string;
  addedAt: string;
  addedBy?: string;
  notes?: string;
}

export interface PatientListDetail extends PatientListItem {
  members: PatientListMember[];
}

export function usePatientLists() {
  return useQuery({
    queryKey: ['patient-lists'],
    queryFn: async () => {
      const response = await api.get<{ data: PatientListItem[] }>('/patients/lists');
      return response.data.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function usePatientListDetail(listId: string) {
  return useQuery({
    queryKey: ['patient-lists', listId],
    queryFn: async () => {
      const response = await api.get<{ data: PatientListDetail }>(`/patients/lists/${listId}`);
      return response.data.data;
    },
    enabled: !!listId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreatePatientList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; listType?: string }) => {
      const response = await api.post<{ data: PatientListItem }>('/patients/lists', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-lists'] });
    },
  });
}

export function useAddPatientToList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, patientId, notes }: { listId: string; patientId: string; notes?: string }) => {
      const response = await api.post<{ data: PatientListMember }>(`/patients/lists/${listId}/patients`, {
        patientId,
        notes,
      });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-lists'] });
    },
  });
}

export function useRemovePatientFromList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, patientId }: { listId: string; patientId: string }) => {
      await api.delete(`/patients/lists/${listId}/patients/${patientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-lists'] });
    },
  });
}

// ---- QA Dashboard ----

export interface CDSOverrideAnalytics {
  totalOverrides: number;
  overridesByType: Array<{ alertType: string; count: number }>;
  overridesBySeverity: Array<{ severity: string; count: number }>;
  overridesByProvider: Array<{ userId: string; count: number }>;
  appropriateOverrides: number;
  inappropriateOverrides: number;
  unreviewedOverrides: number;
}

export interface CDSOverrideRecord {
  id: string;
  cardId?: string;
  userId: string;
  patientId: string;
  hookInstance?: string;
  reasonCode?: string;
  reasonText?: string;
  cardSummary?: string;
  createdAt: string;
}

export function useQADashboard(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['qa-dashboard', params],
    queryFn: async () => {
      const response = await api.get<{ data: { cdsOverrides: CDSOverrideAnalytics } }>('/admin/qa/dashboard', { params });
      return response.data.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useUnreviewedOverrides() {
  return useQuery({
    queryKey: ['qa-overrides', 'unreviewed'],
    queryFn: async () => {
      const response = await api.get<{ data: CDSOverrideRecord[] }>('/admin/qa/overrides/unreviewed');
      return response.data.data;
    },
    staleTime: 1 * 60 * 1000,
  });
}

export function useReviewOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, wasAppropriate }: { id: string; wasAppropriate: boolean }) => {
      await api.post(`/admin/qa/overrides/${id}/review`, { wasAppropriate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qa-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['qa-overrides'] });
    },
  });
}
