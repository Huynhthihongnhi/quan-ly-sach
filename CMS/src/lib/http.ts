import type { AxiosResponse } from 'axios';

import { isAxiosError } from 'axios';

// ----------------------------------------------------------------------
// Small helpers over the BE HTTP contract.
// Success bodies are wrapped as { data: T }. Error bodies are { error: { code, message, fields } }.
// ----------------------------------------------------------------------

export type ApiFieldError = { field: string; code: string };

export type ApiError = {
  status: number;
  code: string;
  message: string;
  fields: ApiFieldError[];
};

/** Pull the inner value out of a { data: T } envelope. */
export function unwrap<T>(response: AxiosResponse<{ data: T }>): T {
  return response.data.data;
}

/** Turn any thrown value into a typed ApiError that keeps the HTTP status and BE error code. */
export function normalizeApiError(error: unknown): ApiError {
  if (isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const body = error.response?.data as
      | { error?: { code?: string; message?: string; fields?: ApiFieldError[] } }
      | undefined;
    const inner = body?.error;
    return {
      status,
      code: inner?.code ?? 'NETWORK_ERROR',
      message: inner?.message ?? 'Không thể kết nối tới máy chủ.',
      fields: inner?.fields ?? [],
    };
  }
  if (error instanceof Error) {
    return { status: 0, code: 'UNKNOWN', message: error.message, fields: [] };
  }
  return { status: 0, code: 'UNKNOWN', message: 'Đã xảy ra lỗi không xác định.', fields: [] };
}
