import { useEffect, useMemo, useRef, useState } from 'react';
import { listPublicBooks, type PublicBookSummary } from '@/lib/api/catalog-public';
import { ApiClientError, type PageMeta } from '@/lib/api/types';

const DEBOUNCE_MS = 300;

export interface CatalogQueryState {
  q: string;
  categoryId: string;
  topicId: string;
  year: string;
  page: number;
}

interface CatalogQueryResult {
  books: PublicBookSummary[];
  meta: PageMeta | null;
  loading: boolean;
  error: string | null;
  debouncedQ: string;
}

export function usePublicCatalogQuery(filters: CatalogQueryState): CatalogQueryResult {
  const [debouncedQ, setDebouncedQ] = useState(filters.q);
  const [books, setBooks] = useState<PublicBookSummary[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQ(filters.q);
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [filters.q]);

  const queryKey = useMemo(
    () =>
      JSON.stringify({
        q: debouncedQ,
        categoryId: filters.categoryId,
        topicId: filters.topicId,
        year: filters.year,
        page: filters.page,
      }),
    [debouncedQ, filters.categoryId, filters.topicId, filters.year, filters.page],
  );

  useEffect(() => {
    const controller = new AbortController();
    const seq = ++requestSeq.current;
    setLoading(true);

    void listPublicBooks(
      {
        q: debouncedQ || undefined,
        categoryId: filters.categoryId || undefined,
        topicId: filters.topicId || undefined,
        year: filters.year || undefined,
        page: filters.page,
        pageSize: 12,
      },
      { signal: controller.signal },
    )
      .then((response) => {
        if (seq !== requestSeq.current) {
          return;
        }
        setBooks(response.data);
        setMeta(response.meta);
        setError(null);
      })
      .catch((caught) => {
        if (controller.signal.aborted || seq !== requestSeq.current) {
          return;
        }
        setError(caught instanceof ApiClientError ? caught.message : 'Failed to load catalog.');
      })
      .finally(() => {
        if (seq === requestSeq.current) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [queryKey, debouncedQ, filters.categoryId, filters.topicId, filters.year, filters.page]);

  return { books, meta, loading, error, debouncedQ };
}
