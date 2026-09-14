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
  state?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListResponse> {
  const search = new URLSearchParams();
  search.set('page', String(params?.page ?? 1));
  search.set('pageSize', String(params?.pageSize ?? 20));
  if (params?.state) {
    search.set('state', params.state);
  }
  return apiRequest<ListResponse>(`/admin/books?${search.toString()}`);
}
