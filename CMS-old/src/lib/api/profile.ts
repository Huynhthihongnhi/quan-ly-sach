import { apiRequest } from './client';

export interface ProfileRecord {
  userId: string;
  displayName: string;
  phone: string | null;
  version: string;
}

interface ProfileResponse {
  data: ProfileRecord;
}

export async function fetchOwnProfile(): Promise<ProfileRecord> {
  const response = await apiRequest<ProfileResponse>('/me/profile');
  return response.data;
}

export async function updateOwnProfile(input: {
  displayName?: string;
  phone?: string | null;
  version: string;
}): Promise<ProfileRecord> {
  const response = await apiRequest<ProfileResponse>('/me/profile', {
    method: 'PATCH',
    body: input,
  });
  return response.data;
}
