/**
 * CDS Hooks React Query hooks
 * Provides discovery, invocation, override recording, and feedback for CDS.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  CDSResponse,
  CDSOverridePayload,
  CDSOverrideRecord,
  CDSFeedbackPayload,
} from '@/types/cds';

// ---- Query Keys ----

export const cdsQueryKeys = {
  discovery: ['cds', 'discovery'] as const,
  overrides: (patientId: string) => ['cds', 'overrides', patientId] as const,
};

// ---- Discovery ----

export function useCdsDiscovery() {
  return useQuery({
    queryKey: cdsQueryKeys.discovery,
    queryFn: async () => {
      const response = await api.get<{ services: Array<{ id: string; hook: string; title: string; description: string }> }>(
        '/cds-services',
      );
      return response.data;
    },
    staleTime: 30 * 60 * 1000,
  });
}

// ---- Invocation ----

export function useCdsInvoke() {
  return useMutation({
    mutationFn: async ({
      hook,
      context,
      prefetch,
    }: {
      hook: string;
      context: Record<string, unknown>;
      prefetch?: Record<string, unknown>;
    }) => {
      const hookInstance = crypto.randomUUID();
      const response = await api.post<CDSResponse>(`/cds-services/${hook}`, {
        hook,
        hookInstance,
        fhirServer: '',
        context,
        prefetch,
      });
      return { ...response.data, hookInstance };
    },
  });
}

// ---- Override ----

export function useCdsOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CDSOverridePayload) => {
      const response = await api.post<CDSOverrideRecord>(
        '/cds-services/overrides',
        payload,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: cdsQueryKeys.overrides(variables.patientId),
      });
    },
  });
}

// ---- Feedback ----

export function useCdsFeedback() {
  return useMutation({
    mutationFn: async (payload: CDSFeedbackPayload) => {
      const response = await api.post('/cds-services/feedback', payload);
      return response.data;
    },
  });
}

// ---- Patient Overrides ----

export function useCdsOverrides(patientId: string) {
  return useQuery({
    queryKey: cdsQueryKeys.overrides(patientId),
    queryFn: async () => {
      const response = await api.get<CDSOverrideRecord[]>(
        `/cds-services/overrides/${patientId}`,
      );
      return response.data;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  });
}
