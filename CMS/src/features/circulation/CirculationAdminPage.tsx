import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  checkoutLoan,
  fetchAdminLoans,
  returnLoan,
  type AdminLoanRecord,
} from '@/lib/api/loans';
import { ApiClientError } from '@/lib/api/types';

export function CirculationAdminPage(): React.JSX.Element {
  const [loans, setLoans] = useState<AdminLoanRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAdminLoans();
      setLoans(response.data);
      setError(null);
    } catch (caught) {
      setLoans([]);
      setError(caught instanceof ApiClientError ? caught.message : 'Failed to load loans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCheckout(loan: AdminLoanRecord): Promise<void> {
    setBusyId(loan.id);
    try {
      await checkoutLoan(loan.id, loan.version);
      await reload();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Checkout failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReturn(loan: AdminLoanRecord): Promise<void> {
    setBusyId(loan.id);
    try {
      await returnLoan(loan.id, loan.version, 'serviceable');
      await reload();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Return failed.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading circulation queue…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Circulation</h1>
      <p className="text-sm text-slate-600">Active loans and reservations across readers.</p>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Loan</th>
              <th className="px-3 py-2 font-medium">Reader</th>
              <th className="px-3 py-2 font-medium">Book</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium">Due</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2">{loan.id}</td>
                <td className="px-3 py-2">{loan.userId}</td>
                <td className="px-3 py-2">{loan.bookId}</td>
                <td className="px-3 py-2">{loan.state}</td>
                <td className="px-3 py-2">
                  {loan.dueAt ? new Date(loan.dueAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-2 space-x-2">
                  {loan.state === 'reserved' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === loan.id}
                      onClick={() => void handleCheckout(loan)}
                    >
                      Check out
                    </Button>
                  ) : null}
                  {loan.state === 'borrowed' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === loan.id}
                      onClick={() => void handleReturn(loan)}
                    >
                      Return
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
