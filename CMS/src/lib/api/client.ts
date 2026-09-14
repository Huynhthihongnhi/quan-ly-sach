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

export function isGuestCatalogPath(pathname: string): boolean {
  return pathname === '/catalog' || pathname.startsWith('/catalog/view/');
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
