import React, { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardList,
  FlaskConical,
  MessageSquare,
  Settings,
  Shield,
  X,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { usePatientContext } from '@/stores/patient-context-store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Patients',
    href: '/patients',
    icon: Users,
  },
  {
    label: 'Scheduling',
    href: '/scheduling',
    icon: Calendar,
  },
  {
    label: 'Orders',
    href: '/orders',
    icon: ClipboardList,
  },
  {
    label: 'Results',
    href: '/results',
    icon: FlaskConical,
  },
  {
    label: 'Messages',
    href: '/messages',
    icon: MessageSquare,
  },
];

const adminItems: NavItem[] = [
  {
    label: 'Administration',
    href: '/admin',
    icon: Shield,
    roles: ['admin'],
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    roles: ['admin'],
  },
];

const PATIENT_CONTEXT_PAGES = ['/scheduling', '/orders', '/results', '/messages'];

export function Sidebar({ open, onClose }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const activePatient = usePatientContext((s) => s.activePatient);
  const clearPatientContext = usePatientContext((s) => s.clearPatientContext);

  // When a patient is active, append ?patientId to context-aware pages
  const contextualNavItems = useMemo(() => {
    if (!activePatient) return navItems;

    const patientParam = `?patientId=${activePatient.id}`;
    return navItems.map((item) => {
      if (PATIENT_CONTEXT_PAGES.includes(item.href)) {
        return { ...item, href: `${item.href}${patientParam}` };
      }
      return item;
    });
  }, [activePatient]);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-border/60 bg-card transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-tight">Tribal EHR</h1>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Active Patient Indicator */}
        {activePatient && (
          <div className="border-b border-border/60 px-3 py-2.5 bg-primary/5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight">
                    {activePatient.lastName}, {activePatient.firstName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    MRN: {activePatient.mrn}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
                onClick={clearPatientContext}
                aria-label="Close patient chart"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="flex flex-col gap-1" aria-label="Main navigation">
            {contextualNavItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.href}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )
                }
              >
                <item.icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}

            {isAdmin && (
              <>
                <Separator className="my-3" />
                <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Admin
                </p>
                {adminItems.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )
                    }
                  >
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                    {item.label}
                  </NavLink>
                ))}
              </>
            )}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground">
            Tribal EHR v1.0.0
          </p>
        </div>
      </aside>
    </>
  );
}
