import type { InternalAxiosRequestConfig } from 'axios';

import axios from 'axios';

import { normalizeApiError } from './http';
import { getCsrfToken } from './csrf-store';

// ----------------------------------------------------------------------
// Session-cookie transport for the BE.
// - baseURL is the relative versioned API; the Vite dev proxy forwards /api to the BE, and
//   in production the reverse proxy serves it same-origin. Keep it relative so the session
//   cookie stays same-site (do not point it at the template's external demo server).
// - withCredentials sends the HttpOnly session cookie the BE sets on login.
// - write requests carry the CSRF token in the x-csrf-token header the BE expects.
// - every request carries x-requested-with: library-web, which the BE MutationOriginGuard
//   requires on state-changing calls (together with an allowed Origin the browser sets).
// ----------------------------------------------------------------------

const WRITE_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const REQUESTED_WITH = 'library-web';

const axiosInstance = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

axiosInstance.defaults.headers.common['x-requested-with'] = REQUESTED_WITH;

axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (WRITE_METHODS.has(method)) {
    const token = getCsrfToken();
    if (token) {
      config.headers.set('x-csrf-token', token);
    }
  }
  return config;
});

let unauthorizedHandler: (() => void) | null = null;

/** The auth layer registers here so a 401 can reset the session and clear cached data. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

axiosInstance.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(normalizeApiError(error));
  }
);

export default axiosInstance;

// ----------------------------------------------------------------------

export const endpoints = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    me: '/auth/me',
    csrf: '/auth/csrf',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    activate: '/auth/activate',
  },
};
