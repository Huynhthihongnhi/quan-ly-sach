import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listAdminBooks, type AdminBookRecord } from '@/lib/api/catalog-admin';
import { ApiClientError } from '@/lib/api/types';

export function CatalogAdminBooksPage(): React.JSX.Element {
  const [books, setBooks] = useState<AdminBookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listAdminBooks();
      setBooks(response.data);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Failed to load catalog admin list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Catalog metadata</h1>
        <p className="text-sm text-slate-600">Draft, published, and archived titles for staff.</p>
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
    </div>
  );
}
