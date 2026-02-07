import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

/**
 * Custom error class for 403 responses that require break-glass override.
 * The frontend can check `instanceof BreakGlassRequiredError` to trigger
 * the break-glass dialog flow.
 */
export class BreakGlassRequiredError extends Error {
  public readonly patientId: string;
  public readonly originalUrl: string;

  constructor(message: string, patientId: string, originalUrl: string) {
    super(message);
    this.name = 'BreakGlassRequiredError';
    this.patientId = patientId;
    this.originalUrl = originalUrl;
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor: attach JWT token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('tribal-ehr-token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor: handle 401, token refresh, error transformation
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('tribal-ehr-refresh-token');

      if (refreshToken) {
        try {
          const response = await axios.post(
            `${import.meta.env.VITE_API_URL || ''}/auth/refresh`,
            { refreshToken },
          );

          const { token: newToken } = response.data;
          localStorage.setItem('tribal-ehr-token', newToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }

          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          localStorage.removeItem('tribal-ehr-token');
          localStorage.removeItem('tribal-ehr-refresh-token');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token, redirect to login
        localStorage.removeItem('tribal-ehr-token');
        window.location.href = '/login';
      }
    }

    // Handle 403 with break-glass required
    if (error.response?.status === 403) {
      const responseData = error.response?.data as {
        error?: string;
        message?: string;
        requiresBreakGlass?: boolean;
      } | undefined;

      if (responseData?.requiresBreakGlass) {
        // Extract patient ID from the URL (patterns like /patients/:id/...)
        const urlMatch = originalRequest.url?.match(/\/patients\/([^/]+)/);
        const patientId = urlMatch?.[1] || '';

        return Promise.reject(
          new BreakGlassRequiredError(
            responseData.message || 'Emergency access override required',
            patientId,
            originalRequest.url || '',
          ),
        );
      }
    }

    // Transform error for consistent handling
    // API returns errors as { error: { code, message } }
    const responseData = error.response?.data as { error?: { message?: string }; message?: string } | undefined;
    const message =
      responseData?.error?.message ||
      responseData?.message ||
      error.message ||
      'An unexpected error occurred';

    return Promise.reject(new Error(message));
  },
);

export default api;
