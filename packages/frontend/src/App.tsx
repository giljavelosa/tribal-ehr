import React, { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toast';
import { useAuthStore } from '@/stores/auth-store';
import { MainLayout } from '@/components/layout/MainLayout';

// Pages
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PatientListPage } from '@/pages/patients/PatientListPage';
import { PatientChartPage } from '@/pages/patients/PatientChartPage';
import { PatientRegistrationPage } from '@/pages/patients/PatientRegistrationPage';
import { SchedulingPage } from '@/pages/scheduling/SchedulingPage';
import { OrdersPage } from '@/pages/orders/OrdersPage';
import { ResultsInboxPage } from '@/pages/results/ResultsInboxPage';
import { MessagesPage } from '@/pages/messages/MessagesPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Admin pages
import { AdminPage } from '@/pages/admin/AdminPage';
import { UserManagementPage } from '@/pages/admin/UserManagementPage';
import { AuditLogPage } from '@/pages/admin/AuditLogPage';
import { SystemConfigPage } from '@/pages/admin/SystemConfigPage';
import { ProviderDirectoryPage } from '@/pages/admin/ProviderDirectoryPage';
import { ReportsPage } from '@/pages/admin/ReportsPage';
import { LocationManagementPage } from '@/pages/admin/LocationManagementPage';

// Patient portal pages
import { PatientPortalLayout } from '@/pages/portal/PatientPortalLayout';
import { PatientPortalDashboard } from '@/pages/portal/PatientPortalDashboard';
import { MyHealthPage } from '@/pages/portal/MyHealthPage';
import { PatientMessagesPage } from '@/pages/portal/PatientMessagesPage';
import { PatientAppointmentsPage } from '@/pages/portal/PatientAppointmentsPage';
import { PatientMedicationsPage } from '@/pages/portal/PatientMedicationsPage';
import { PatientResultsPage } from '@/pages/portal/PatientResultsPage';
import { PatientDocumentsPage } from '@/pages/portal/PatientDocumentsPage';
import { PatientProfilePage } from '@/pages/portal/PatientProfilePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const checkSession = useAuthStore((s) => s.checkSession);

  useEffect(() => {
    if (isAuthenticated) {
      checkSession();
    }
  }, [isAuthenticated, checkSession]);

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        }
      />

      {/* Protected routes with provider layout */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/patients" element={<PatientListPage />} />
        <Route path="/patients/new" element={<PatientRegistrationPage />} />
        <Route path="/patients/:id" element={<PatientChartPage />} />
        <Route path="/scheduling" element={<SchedulingPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/results" element={<ResultsInboxPage />} />
        <Route path="/messages" element={<MessagesPage />} />

        {/* Admin routes - nested under MainLayout */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminPage />
            </ProtectedRoute>
          }
        >
          <Route path="users" element={<UserManagementPage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="config" element={<SystemConfigPage />} />
          <Route path="providers" element={<ProviderDirectoryPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="locations" element={<LocationManagementPage />} />
        </Route>
      </Route>

      {/* Patient portal routes - separate layout */}
      <Route
        path="/portal"
        element={
          <ProtectedRoute requiredRole="patient">
            <PatientPortalLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/portal/dashboard" replace />} />
        <Route path="dashboard" element={<PatientPortalDashboard />} />
        <Route path="health" element={<MyHealthPage />} />
        <Route path="messages" element={<PatientMessagesPage />} />
        <Route path="appointments" element={<PatientAppointmentsPage />} />
        <Route path="medications" element={<PatientMedicationsPage />} />
        <Route path="results" element={<PatientResultsPage />} />
        <Route path="documents" element={<PatientDocumentsPage />} />
        <Route path="profile" element={<PatientProfilePage />} />
      </Route>

      {/* Redirects and fallbacks */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
