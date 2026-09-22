import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  checkoutLoan,
  fetchAdminLoans,
  returnLoan,
  type AdminLoanRecord,
} from '@/lib/api/loans';
import { ApiClientError } from '@/lib/api/types';
import { LoanListControls, type LoanFilters } from './LoanListControls';

export function CirculationAdminPage(): React.JSX.Element {
  const [loans, setLoans] = useState<AdminLoanRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filters, setFilters] = useState<LoanFilters>({ state: '', overdue: false, page: 1 });
  const [meta, setMeta] = useState({ total: 0, pageSize: 50 });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchAdminLoans({ page: filters.page, state: filters.state || undefined,
      overdue: filters.overdue || undefined }).then((response) => {
      if (!active) return;
      setLoans(response.data);
      setMeta(response.meta);
      setError(null);
    }).catch((caught) => {
      if (!active) return;
      setLoans([]);
      setError(caught instanceof ApiClientError ? caught.message : 'Failed to load loans.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, revision]);

  async function handleCheckout(loan: AdminLoanRecord): Promise<void> {
    setBusyId(loan.id);
    try {
      await checkoutLoan(loan.id, loan.version);
      setRevision((value) => value + 1);
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
      setRevision((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Return failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Circulation</h1>
      <p className="text-sm text-slate-600">Loans and reservations across readers.</p>
      <LoanListControls filters={filters} total={meta.total} pageSize={meta.pageSize}
        loading={loading} onChange={setFilters} />
      {loading ? <p role="status">Loading circulation queue...</p> : null}
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
            {!loading && loans.map((loan) => (
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
