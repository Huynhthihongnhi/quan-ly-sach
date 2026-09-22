import { apiRequest } from './client';
import type { PageMeta } from './types';

export interface AdminBookRecord {
  id: string;
  title: string;
  state: string;
  version: string;
  categoryId: string;
}

interface ListResponse {
  data: AdminBookRecord[];
  meta: PageMeta;
}

export async function listAdminBooks(params?: {
  q?: string;
  state?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListResponse> {
  const search = new URLSearchParams();
  search.set('page', String(params?.page ?? 1));
  search.set('pageSize', String(params?.pageSize ?? 20));
  if (params?.q) {
    search.set('q', params.q);
  }
  if (params?.state) {
    search.set('state', params.state);
  }
  return apiRequest<ListResponse>(`/admin/books?${search.toString()}`);
}

export async function createDraftBook(input: {
  title: string;
  categoryId: string;
  isbn?: string;
  publisherName?: string;
  publicationYear?: number;
  description?: string;
}): Promise<AdminBookRecord> {
  const response = await apiRequest<{ data: AdminBookRecord }>('/admin/books', {
    method: 'POST',
    body: input,
  });
  return response.data;
}
