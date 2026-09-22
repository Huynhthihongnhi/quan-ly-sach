import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listPublicCategories, listPublicTopics } from '@/lib/api/catalog-public';
import { usePublicCatalogQuery } from '@/lib/catalog/use-public-catalog-query';

export function PublicCatalogPage(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [topics, setTopics] = useState<Array<{ id: string; name: string }>>([]);

  const filters = useMemo(
    () => ({
      q: searchParams.get('q') ?? '',
      categoryId: searchParams.get('categoryId') ?? '',
      topicId: searchParams.get('topicId') ?? '',
      year: searchParams.get('year') ?? '',
      page: Number(searchParams.get('page') ?? '1') || 1,
    }),
    [searchParams],
  );

  const { books, meta, loading, error } = usePublicCatalogQuery(filters);

  useEffect(() => {
    void Promise.all([listPublicCategories(), listPublicTopics()]).then(([categoryResponse, topicResponse]) => {
      setCategories(categoryResponse.data);
      setTopics(topicResponse.data);
    });
  }, []);

  function updateParams(next: Partial<typeof filters>): void {
    const params = new URLSearchParams(searchParams);
    const merged = { ...filters, ...next };
    if (merged.q) {
      params.set('q', merged.q);
    } else {
      params.delete('q');
    }
    if (merged.categoryId) {
      params.set('categoryId', merged.categoryId);
    } else {
      params.delete('categoryId');
    }
    if (merged.topicId) {
      params.set('topicId', merged.topicId);
    } else {
      params.delete('topicId');
    }
    if (merged.year) {
      params.set('year', merged.year);
    } else {
      params.delete('year');
    }
    params.set('page', String(merged.page || 1));
    setSearchParams(params, { replace: false });
  }

  function resetFilters(): void {
    setSearchParams(new URLSearchParams(), { replace: false });
  }

  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Browse published books</h1>
        <p className="text-sm text-slate-600">Search and filter without signing in.</p>
      </div>

      <form
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          updateParams({ page: 1 });
        }}
      >
        <div className="space-y-1 lg:col-span-2">
          <Label htmlFor="catalog-q">Search</Label>
          <Input
            id="catalog-q"
            name="q"
            value={filters.q}
            onChange={(event) => updateParams({ q: event.target.value, page: 1 })}
            placeholder="Title, author, or topic"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="catalog-category">Category</Label>
          <select
            id="catalog-category"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={filters.categoryId}
            onChange={(event) => updateParams({ categoryId: event.target.value, page: 1 })}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="catalog-topic">Topic</Label>
          <select
            id="catalog-topic"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={filters.topicId}
            onChange={(event) => updateParams({ topicId: event.target.value, page: 1 })}
          >
            <option value="">All topics</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="catalog-year">Publication year</Label>
          <Input
            id="catalog-year"
            inputMode="numeric"
            value={filters.year}
            onChange={(event) => updateParams({ year: event.target.value, page: 1 })}
            placeholder="e.g. 2020"
          />
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit">Apply filters</Button>
          <Button type="button" variant="outline" onClick={resetFilters}>
            Reset filters
          </Button>
        </div>
      </form>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {loading ? <p className="text-sm text-slate-600">Loading catalog...</p> : null}

      {!loading && books.length === 0 ? (
        <p className="text-sm text-slate-600">No published books match your filters.</p>
      ) : null}

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {books.map((book) => (
          <li key={book.id} className="px-4 py-3">
            <Link
              to={`/catalog/view/${book.id}`}
              className="font-medium text-blue-700 hover:underline"
            >
              {book.title}
            </Link>
            <p className="text-sm text-slate-600">
              {book.categoryName}
              {book.publicationYear ? ` · ${book.publicationYear}` : ''}
            </p>
          </li>
        ))}
      </ul>

      <nav aria-label="Catalog pagination" className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={filters.page <= 1 || loading}
          onClick={() => updateParams({ page: Math.max(1, filters.page - 1) })}
        >
          Previous page
        </Button>
        <span className="text-sm text-slate-700">
          Page {filters.page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || filters.page >= totalPages}
          onClick={() => updateParams({ page: filters.page + 1 })}
        >
          Next page
        </Button>
      </nav>
    </div>
  );
}
