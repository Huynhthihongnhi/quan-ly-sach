import { ApiClientError, type ApiErrorBody } from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

let csrfToken: string | null = null;
let onUnauthorized: ((path: string) => void) | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function setUnauthorizedHandler(handler: (path: string) => void): void {
  onUnauthorized = handler;
}

export function isSafeInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://');
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuthRedirect?: boolean;
  signal?: AbortSignal;
}

function normalizeAppPathname(pathname: string): string {
  if (pathname.startsWith('/cms/')) {
    return pathname.slice('/cms'.length);
  }
  if (pathname === '/cms') {
    return '/';
  }
  return pathname;
}

export function isGuestCatalogPath(pathname: string): boolean {
  const path = normalizeAppPathname(pathname);
  return path === '/catalog' || path.startsWith('/catalog/view/');
}

/** Routes that must stay reachable without a session (challenge links, sign-in). */
export function isPublicAuthRecoveryPath(pathname: string): boolean {
  const path = normalizeAppPathname(pathname.split('?')[0] ?? pathname);
  return (
    path === '/login' ||
    path === '/forgot-password' ||
    path === '/reset-password' ||
    path === '/activate' ||
    isGuestCatalogPath(path)
  );
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  const method = (options.method ?? 'GET').toUpperCase();
  const isMutation = method !== 'GET' && method !== 'HEAD';

  if (isMutation) {
    headers.set('Content-Type', 'application/json');
    headers.set('X-Requested-With', 'library-web');
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      headers,
      credentials: 'include',
      signal: options.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Network request failed.');
  }

  if (response.status === 401 && !options.skipAuthRedirect && onUnauthorized) {
    onUnauthorized(window.location.pathname + window.location.search);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as T | ApiErrorBody;

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody;
    throw new ApiClientError(
      response.status,
      errorBody.error?.code ?? 'UNKNOWN_ERROR',
      errorBody.error?.message ?? 'Request failed.',
      errorBody.error?.fields,
    );
  }

  return payload as T;
}
