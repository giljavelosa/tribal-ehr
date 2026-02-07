import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePatientContext } from '@/stores/patient-context-store';
import { usePatient, useAllergies } from '@/hooks/use-api';

/**
 * Hook that restores patient context from URL search params.
 * Handles direct URL access (e.g., /scheduling?patientId=abc123)
 * when the Zustand store is empty (no prior session context).
 */
export function usePatientContextFromUrl() {
  const [searchParams] = useSearchParams();
  const patientIdFromUrl = searchParams.get('patientId');
  const activePatientId = usePatientContext((s) => s.activePatientId);
  const setPatientContext = usePatientContext((s) => s.setPatientContext);

  const shouldFetch = !!patientIdFromUrl && patientIdFromUrl !== activePatientId;
  const { data: patient } = usePatient(shouldFetch ? patientIdFromUrl : '');
  const { data: allergies } = useAllergies(shouldFetch ? patientIdFromUrl : '');

  useEffect(() => {
    if (shouldFetch && patient) {
      setPatientContext(patient, allergies || []);
    }
  }, [shouldFetch, patient, allergies, setPatientContext]);
}
