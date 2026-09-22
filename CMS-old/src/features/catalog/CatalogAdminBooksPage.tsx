import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createDraftBook,
  listAdminBooks,
  type AdminBookRecord,
} from '@/lib/api/catalog-admin';
import { listPublicCategories, type CatalogNamedRef } from '@/lib/api/catalog-public';
import { ApiClientError } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthProvider';

export function CatalogAdminBooksPage(): React.JSX.Element {
  const { can } = useAuth();
  const [books, setBooks] = useState<AdminBookRecord[]>([]);
  const [categories, setCategories] = useState<CatalogNamedRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isbn, setIsbn] = useState('');
  const [publisherName, setPublisherName] = useState('');
  const [publicationYear, setPublicationYear] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listAdminBooks({ q: q || undefined, state: state || undefined });
      setBooks(response.data);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Failed to load catalog admin list.');
    } finally {
      setLoading(false);
    }
  }, [q, state]);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    listPublicCategories()
      .then((response) => setCategories(response.data))
      .catch(() => setCategories([]));
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (createSubmitting) {
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);
    try {
      await createDraftBook({
        title,
        categoryId,
        isbn: isbn || undefined,
        publisherName: publisherName || undefined,
        publicationYear: publicationYear ? Number(publicationYear) : undefined,
      });
      setCreateOpen(false);
      setTitle('');
      setCategoryId('');
      setIsbn('');
      setPublisherName('');
      setPublicationYear('');
      await loadBooks();
    } catch (caught) {
      setCreateError(caught instanceof ApiClientError ? caught.message : 'Failed to create book.');
    } finally {
      setCreateSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Catalog metadata</h1>
          <p className="text-sm text-slate-600">Draft, published, and archived titles for staff.</p>
        </div>
        {can('catalog.write') ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Create book
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="books-search">Search</Label>
          <Input
            id="books-search"
            placeholder="Search by title"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="books-state-filter">State</Label>
          <select
            id="books-state-filter"
            value={state}
            className="block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            onChange={(event) => setState(event.target.value)}
          >
            <option value="">All states</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {loading ? <p className="text-sm text-slate-600">Loading books...</p> : null}
      {!loading ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Version</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {books.map((book) => (
              <TableRow key={book.id}>
                <TableCell>{book.title}</TableCell>
                <TableCell>{book.state}</TableCell>
                <TableCell>{book.version}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent aria-describedby="create-book-description">
          <DialogHeader>
            <DialogTitle>Create book</DialogTitle>
            <DialogDescription id="create-book-description">
              Add a new draft title. Authors and topics can be attached afterwards.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void handleCreate(event)}>
            <div className="space-y-2">
              <Label htmlFor="create-book-title">Title</Label>
              <Input
                id="create-book-title"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-book-category">Category</Label>
              <select
                id="create-book-category"
                required
                value={categoryId}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="" disabled>
                  Select a category
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-book-isbn">ISBN</Label>
              <Input
                id="create-book-isbn"
                value={isbn}
                onChange={(event) => setIsbn(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-book-publisher">Publisher</Label>
              <Input
                id="create-book-publisher"
                value={publisherName}
                onChange={(event) => setPublisherName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-book-year">Publication year</Label>
              <Input
                id="create-book-year"
                type="number"
                value={publicationYear}
                onChange={(event) => setPublicationYear(event.target.value)}
              />
            </div>
            {createError ? (
              <Alert variant="destructive" aria-live="assertive">
                {createError}
              </Alert>
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={createSubmitting} aria-busy={createSubmitting}>
                {createSubmitting ? 'Saving...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
