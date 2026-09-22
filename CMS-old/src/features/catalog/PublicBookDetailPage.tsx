import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getPublicBook, type PublicBookDetail } from '@/lib/api/catalog-public';
import { downloadPolicyHint } from '@/features/digital/digital-content-messages';
import { BorrowBookPanel } from '@/features/circulation/BorrowBookPanel';
import { ApiClientError } from '@/lib/api/types';

export function PublicBookDetailPage(): React.JSX.Element {
  const { id } = useParams();
  const [book, setBook] = useState<PublicBookDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setError('Book id is missing.');
      setLoading(false);
      return;
    }

    void getPublicBook(id)
      .then((detail) => {
        setBook(detail);
        setError(null);
      })
      .catch((caught) => {
        setBook(null);
        setError(caught instanceof ApiClientError ? caught.message : 'Failed to load book.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading book...</p>;
  }

  if (error || !book) {
    return (
      <div className="space-y-3">
        <Alert variant="destructive">{error ?? 'Book was not found.'}</Alert>
        <Link to="/catalog" className="text-sm font-medium text-blue-700 hover:underline">
          Back to catalog
        </Link>
      </div>
    );
  }

  return (
    <article className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <Link to="/catalog" className="text-sm font-medium text-blue-700 hover:underline">
        Back to catalog
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">{book.title}</h1>
      <p className="text-sm text-slate-600">
        {book.categoryName}
        {book.publicationYear ? ` · ${book.publicationYear}` : ''}
      </p>
      {book.authors.length > 0 ? (
        <p className="text-sm text-slate-700">
          Authors: {book.authors.map((author) => author.name).join(', ')}
        </p>
      ) : null}
      {book.description ? <p className="text-sm text-slate-800">{book.description}</p> : null}
      <BorrowBookPanel
        bookId={book.id}
        bookTitle={book.title}
        availableCopies={book.availableCopies}
        onAvailabilityChange={(copies) => setBook({ ...book, availableCopies: copies })}
      />

      {book.digitalAssets.length > 0 ? (
        <section className="space-y-3 border-t border-slate-200 pt-4">
          <h2 className="text-sm font-semibold text-slate-900">Digital documents</h2>
          <ul className="space-y-3">
            {book.digitalAssets.map((asset) => (
              <li
                key={asset.id}
                className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">PDF · {asset.byteSize} bytes</p>
                  <p className="text-xs text-slate-600">{asset.rightsNote}</p>
                  <p className="text-xs text-slate-500">{downloadPolicyHint(asset.downloadRequiresCard)}</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link
                    to={`/catalog/view/${book.id}/documents/${asset.id}`}
                    state={{ asset, bookTitle: book.title }}
                  >
                    Read online
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
