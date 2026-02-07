import React, { useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { PatientBanner } from '@/components/patient/PatientBanner';
import { usePatientContext } from '@/stores/patient-context-store';
import { usePatient, useAllergies } from '@/hooks/use-api';

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const activePatientId = usePatientContext((s) => s.activePatientId);
  const activePatient = usePatientContext((s) => s.activePatient);
  const activeAllergies = usePatientContext((s) => s.activeAllergies);
  const setPatientContext = usePatientContext((s) => s.setPatientContext);
  const clearPatientContext = usePatientContext((s) => s.clearPatientContext);

  // Keep store in sync with fresh API data when patient context is active
  const { data: freshPatient } = usePatient(activePatientId || '');
  const { data: freshAllergies } = useAllergies(activePatientId || '');

  React.useEffect(() => {
    if (freshPatient && activePatientId) {
      setPatientContext(freshPatient, freshAllergies || []);
    }
  }, [freshPatient, freshAllergies, activePatientId, setPatientContext]);

  const handleNewNote = useCallback(() => {
    if (activePatientId) {
      navigate(`/patients/${activePatientId}?tab=notes`);
    }
  }, [activePatientId, navigate]);

  const handleNewOrder = useCallback(() => {
    if (activePatientId) {
      navigate(`/patients/${activePatientId}?tab=orders`);
    }
  }, [activePatientId, navigate]);

  const handleMessage = useCallback(() => {
    if (activePatientId) {
      navigate(`/messages?patientId=${activePatientId}`);
    }
  }, [activePatientId, navigate]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {activePatient && (
          <PatientBanner
            patient={activePatient}
            allergies={activeAllergies}
            onClose={clearPatientContext}
            onNewNote={handleNewNote}
            onNewOrder={handleNewOrder}
            onMessage={handleMessage}
          />
        )}

        <main className="flex-1 overflow-y-auto scroll-smooth-clinical bg-background p-4 lg:p-6">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
