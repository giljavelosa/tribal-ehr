import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Patient, AllergyIntolerance } from '@/hooks/use-api';

interface PatientContextState {
  /** Currently active patient ID */
  activePatientId: string | null;
  /** Full patient object for banner display */
  activePatient: Patient | null;
  /** Active allergies for banner allergy bar */
  activeAllergies: AllergyIntolerance[];
  /** Timestamp when context was set */
  contextSetAt: number | null;

  /** Set the active patient context (called when opening a patient chart) */
  setPatientContext: (
    patient: Patient,
    allergies?: AllergyIntolerance[],
  ) => void;
  /** Update allergies without changing the patient */
  updateAllergies: (allergies: AllergyIntolerance[]) => void;
  /** Clear patient context (called when closing chart, logging out, etc.) */
  clearPatientContext: () => void;
}

export const usePatientContext = create<PatientContextState>()(
  persist(
    (set) => ({
      activePatientId: null,
      activePatient: null,
      activeAllergies: [],
      contextSetAt: null,

      setPatientContext: (patient, allergies = []) => {
        set({
          activePatientId: patient.id,
          activePatient: patient,
          activeAllergies: allergies,
          contextSetAt: Date.now(),
        });
      },

      updateAllergies: (allergies) => {
        set({ activeAllergies: allergies });
      },

      clearPatientContext: () => {
        set({
          activePatientId: null,
          activePatient: null,
          activeAllergies: [],
          contextSetAt: null,
        });
      },
    }),
    {
      name: 'tribal-ehr-patient-context',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        activePatientId: state.activePatientId,
        activePatient: state.activePatient,
        activeAllergies: state.activeAllergies,
        contextSetAt: state.contextSetAt,
      }),
    },
  ),
);
