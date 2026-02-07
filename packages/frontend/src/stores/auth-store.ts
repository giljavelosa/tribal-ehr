import { create } from 'zustand';
import api from '@/lib/api';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'provider' | 'nurse' | 'staff' | 'patient';
  facilities?: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionTimeoutId: ReturnType<typeof setTimeout> | null;
  lastActivity: number;

  login: (username: string, password: string, mfaCode?: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  checkSession: () => Promise<void>;
  resetSessionTimer: () => void;
}

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('tribal-ehr-token'),
  isAuthenticated: !!localStorage.getItem('tribal-ehr-token'),
  isLoading: false,
  sessionTimeoutId: null,
  lastActivity: Date.now(),

  login: async (usernameOrEmail: string, password: string, mfaCode?: string) => {
    set({ isLoading: true });
    try {
      // Detect if input is an email or username
      const isEmail = usernameOrEmail.includes('@');
      const response = await api.post('/auth/login', {
        ...(isEmail ? { email: usernameOrEmail } : { username: usernameOrEmail }),
        password,
        mfaCode,
      });

      const { token, refreshToken, user } = response.data;

      localStorage.setItem('tribal-ehr-token', token);
      localStorage.setItem('tribal-ehr-refresh-token', refreshToken);

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        lastActivity: Date.now(),
      });

      // Start session timeout tracking
      get().resetSessionTimer();
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    const { sessionTimeoutId } = get();
    if (sessionTimeoutId) {
      clearTimeout(sessionTimeoutId);
    }

    localStorage.removeItem('tribal-ehr-token');
    localStorage.removeItem('tribal-ehr-refresh-token');
    sessionStorage.removeItem('tribal-ehr-patient-context');

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      sessionTimeoutId: null,
    });
  },

  refreshToken: async () => {
    const refreshTokenValue = localStorage.getItem('tribal-ehr-refresh-token');
    if (!refreshTokenValue) {
      get().logout();
      return;
    }

    try {
      const response = await api.post('/auth/refresh', {
        refreshToken: refreshTokenValue,
      });

      const { token, user } = response.data;
      localStorage.setItem('tribal-ehr-token', token);

      set({ token, user, isAuthenticated: true });
    } catch {
      get().logout();
    }
  },

  checkSession: async () => {
    const token = localStorage.getItem('tribal-ehr-token');
    if (!token) {
      set({ isAuthenticated: false, user: null, token: null });
      return;
    }

    set({ isLoading: true });
    try {
      const response = await api.get('/auth/me');
      set({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
      get().resetSessionTimer();
    } catch {
      get().logout();
      set({ isLoading: false });
    }
  },

  resetSessionTimer: () => {
    const { sessionTimeoutId } = get();
    if (sessionTimeoutId) {
      clearTimeout(sessionTimeoutId);
    }

    const newTimeoutId = setTimeout(() => {
      sessionStorage.removeItem('tribal-ehr-patient-context');
      get().logout();
      window.location.href = '/login?reason=session_timeout';
    }, SESSION_TIMEOUT_MS);

    set({
      sessionTimeoutId: newTimeoutId,
      lastActivity: Date.now(),
    });
  },
}));

// Set up activity listeners to reset session timer
if (typeof window !== 'undefined') {
  const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  activityEvents.forEach((event) => {
    window.addEventListener(event, () => {
      const { isAuthenticated, resetSessionTimer } = useAuthStore.getState();
      if (isAuthenticated) {
        resetSessionTimer();
      }
    });
  });
}
