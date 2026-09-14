import { apiRequest } from './client';
import type { PageMeta, UserRecord } from './types';

interface UsersListResponse {
  data: UserRecord[];
  meta: PageMeta;
}

interface UserResponse {
  data: UserRecord;
}

export async function listUsers(page = 1, pageSize = 20): Promise<UsersListResponse> {
  return apiRequest<UsersListResponse>(`/users?page=${page}&pageSize=${pageSize}`);
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
