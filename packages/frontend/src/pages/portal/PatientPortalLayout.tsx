import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageSquare,
  Calendar,
  Pill,
  TestTube2,
  FileText,
  UserCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Accessibility,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

const portalNavItems = [
  { to: '/portal/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/portal/health', icon: Heart, label: 'My Health' },
  { to: '/portal/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/portal/appointments', icon: Calendar, label: 'Appointments' },
  { to: '/portal/medications', icon: Pill, label: 'Medications' },
  { to: '/portal/results', icon: TestTube2, label: 'Test Results' },
  { to: '/portal/documents', icon: FileText, label: 'Documents' },
  { to: '/portal/profile', icon: UserCircle, label: 'Profile' },
];

export function PatientPortalLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [largeText, setLargeText] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const patientName = user
    ? `${user.firstName} ${user.lastName}`
    : 'Patient';

  return (
    <div className={cn('flex h-screen overflow-hidden bg-gray-50', largeText && 'text-lg')}>
      {/* Sidebar - Desktop */}
      <aside
        className="hidden w-64 flex-shrink-0 border-r bg-white lg:flex lg:flex-col"
        role="navigation"
        aria-label="Patient portal navigation"
      >
        <div className="flex h-16 items-center gap-3 border-b px-6">
          <Heart className="h-6 w-6 text-primary" aria-hidden="true" />
          <span className="text-lg font-bold text-primary">My Health Portal</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1" role="list">
            {portalNavItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
                      'hover:bg-primary/10 hover:text-primary',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-700',
                    )
                  }
                  aria-current="page"
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t p-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-gray-600"
            onClick={() => setLargeText(!largeText)}
            aria-label={largeText ? 'Use standard text size' : 'Use larger text size'}
          >
            <Accessibility className="h-4 w-4" aria-hidden="true" />
            {largeText ? 'Standard Text' : 'Larger Text'}
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform bg-white transition-transform duration-200 lg:hidden',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        role="navigation"
        aria-label="Patient portal mobile navigation"
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="font-bold text-primary">My Health Portal</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1" role="list">
            {portalNavItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
                      'hover:bg-primary/10 hover:text-primary',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-700',
                    )
                  }
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-4 lg:px-6" role="banner">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">Welcome back,</p>
              <p className="font-semibold">{patientName}</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
            aria-label="Sign out of patient portal"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto p-4 lg:p-6"
          role="main"
          aria-label="Patient portal content"
        >
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t bg-white px-4 py-3 text-center text-xs text-muted-foreground" role="contentinfo">
          <p>
            Tribal EHR Patient Portal — If you have a medical emergency, call 911.
          </p>
        </footer>
      </div>
    </div>
  );
}
