import { apiRequest } from './client';
import type { PageMeta } from './types';

export interface LibraryCardRecord {
  id: string;
  cardNumber: string;
  state: 'active' | 'suspended' | 'revoked' | 'expired';
  issuedAt: string;
  expiresAt: string;
}

interface LibraryCardListResponse {
  data: LibraryCardRecord[];
  meta: PageMeta;
}

export async function fetchOwnLibraryCards(): Promise<LibraryCardRecord[]> {
  const response = await apiRequest<LibraryCardListResponse>('/me/library-cards?page=1&pageSize=20');
  return response.data;
}
