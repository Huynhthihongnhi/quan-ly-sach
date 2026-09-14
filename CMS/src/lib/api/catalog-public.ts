import { apiRequest } from './client';
import type { PageMeta } from './types';

export interface CatalogNamedRef {
  id: string;
  name: string;
}

export interface PublicDigitalAsset {
  id: string;
  mimeType: string;
  byteSize: number;
  readAccess: 'public' | 'authenticated' | 'card';
  downloadRequiresCard: boolean;
  rightsNote: string;
}

export interface PublicBookSummary {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  isbn: string | null;
  publicationYear: number | null;
  authors: CatalogNamedRef[];
  topics: CatalogNamedRef[];
}

export interface PublicBookDetail extends PublicBookSummary {
  publisherName: string | null;
  description: string | null;
  availableCopies: null;
  digitalAssets: PublicDigitalAsset[];
}

export interface PublicBookListParams {
  q?: string;
  title?: string;
  author?: string;
  categoryId?: string;
  topicId?: string;
  year?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

interface ListResponse<T> {
  data: T[];
  meta: PageMeta;
}

interface DetailResponse<T> {
  data: T;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query.length > 0 ? `?${query}` : '';
}

export async function listPublicBooks(
  params: PublicBookListParams,
  options?: { signal?: AbortSignal },
): Promise<ListResponse<PublicBookSummary>> {
  return apiRequest<ListResponse<PublicBookSummary>>(
    `/books${buildQuery({
      q: params.q,
      title: params.title,
      author: params.author,
      categoryId: params.categoryId,
      topicId: params.topicId,
      year: params.year,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 12,
      sort: params.sort,
    })}`,
    { skipAuthRedirect: true, signal: options?.signal },
  );
}

export async function getPublicBook(bookId: string): Promise<PublicBookDetail> {
  const response = await apiRequest<DetailResponse<PublicBookDetail>>(`/books/${bookId}`, {
    skipAuthRedirect: true,
  });
  return response.data;
}

export async function listPublicCategories(): Promise<ListResponse<CatalogNamedRef & { code?: string }>> {
  return apiRequest(`/categories?page=1&pageSize=100`, { skipAuthRedirect: true });
}

export async function listPublicTopics(): Promise<ListResponse<CatalogNamedRef>> {
  return apiRequest(`/topics?page=1&pageSize=100`, { skipAuthRedirect: true });
}
