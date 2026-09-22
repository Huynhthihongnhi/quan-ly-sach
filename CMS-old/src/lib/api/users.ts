import { apiRequest } from './client';
import type { PageMeta, UserRecord } from './types';

interface UsersListResponse {
  data: UserRecord[];
  meta: PageMeta;
}

interface UserResponse {
  data: UserRecord;
}

export async function listUsers(params?: {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<UsersListResponse> {
  const search = new URLSearchParams();
  search.set('page', String(params?.page ?? 1));
  search.set('pageSize', String(params?.pageSize ?? 20));
  if (params?.q) {
    search.set('q', params.q);
  }
  if (params?.status) {
    search.set('status', params.status);
  }
  return apiRequest<UsersListResponse>(`/users?${search.toString()}`);
}

export async function createUser(input: {
  email: string;
  displayName: string;
  phone?: string;
}): Promise<UserRecord> {
  const response = await apiRequest<UserResponse>('/users', {
    method: 'POST',
    body: input,
  });
  return response.data;
}

export async function updateUserStatus(
  userId: string,
  input: { status: string; version: string },
): Promise<UserRecord> {
  const response = await apiRequest<UserResponse>(`/users/${userId}/status`, {
    method: 'PATCH',
    body: input,
  });
  return response.data;
}
