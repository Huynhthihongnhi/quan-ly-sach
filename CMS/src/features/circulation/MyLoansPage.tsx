import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { fetchOwnLoans, type LoanRecord } from '@/lib/api/loans';
import { ApiClientError } from '@/lib/api/types';

export function MyLoansPage(): React.JSX.Element {
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchOwnLoans()
      .then((response) => {
        setLoans(response.data);
        setError(null);
      })
      .catch((caught) => {
        setLoans([]);
        setError(caught instanceof ApiClientError ? caught.message : 'Failed to load loans.');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading your loans…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">My loans</h1>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {loans.length === 0 ? (
        <p className="text-sm text-slate-600">You have no loan reservations yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {loans.map((loan) => (
            <li key={loan.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">Loan #{loan.id}</p>
                <p className="text-slate-600">
                  Book {loan.bookId} · {loan.state}
                  {loan.dueAt ? ` · due ${new Date(loan.dueAt).toLocaleDateString()}` : ''}
                </p>
              </div>
              <Link
                to={`/me/loans/${loan.id}`}
                className="font-medium text-blue-700 hover:underline"
              >
                Receipt
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
