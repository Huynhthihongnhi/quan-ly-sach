import type { AxiosResponse } from 'axios';

import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';

import { unwrap, normalizeApiError } from 'src/lib/http';

function axiosErrorWith(status: number, code: string, message = 'msg') {
  return new AxiosError('failed', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
    data: { error: { code, message, fields: [] } },
  } as AxiosResponse);
}

describe('unwrap', () => {
  it('returns the inner data of a { data } envelope', () => {
    const response = { data: { data: { id: '1' } } } as AxiosResponse<{ data: { id: string } }>;
    expect(unwrap(response)).toEqual({ id: '1' });
  });
});

describe('normalizeApiError', () => {
  it('keeps the status and BE error code from an axios error', () => {
    const normalized = normalizeApiError(
      axiosErrorWith(403, 'FORBIDDEN', 'CSRF token is required.')
    );
    expect(normalized.status).toBe(403);
    expect(normalized.code).toBe('FORBIDDEN');
    expect(normalized.message).toBe('CSRF token is required.');
  });

  it('distinguishes 401 from 403', () => {
    expect(normalizeApiError(axiosErrorWith(401, 'AUTHENTICATION_REQUIRED')).status).toBe(401);
    expect(normalizeApiError(axiosErrorWith(403, 'FORBIDDEN')).status).toBe(403);
  });

  it('falls back for a non-axios error', () => {
    const normalized = normalizeApiError(new Error('boom'));
    expect(normalized.status).toBe(0);
    expect(normalized.message).toBe('boom');
  });
});
