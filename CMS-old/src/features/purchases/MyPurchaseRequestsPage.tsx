import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { fetchOwnPurchaseRequests, type PurchaseRequestRecord } from '@/lib/api/purchases';
import { ApiClientError } from '@/lib/api/types';
import {
  PurchaseRequestListControls,
  type PurchaseRequestFilters,
} from './PurchaseRequestListControls';

export function MyPurchaseRequestsPage(): React.JSX.Element {
  const [requests, setRequests] = useState<PurchaseRequestRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<PurchaseRequestFilters>({ state: '', page: 1 });
  const [meta, setMeta] = useState({ total: 0, pageSize: 20 });

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchOwnPurchaseRequests({ page: filters.page, state: filters.state || undefined })
      .then((response) => {
        if (!active) return;
        setRequests(response.data);
        setMeta(response.meta);
        setError(null);
      })
      .catch((caught) => {
        if (!active) return;
        setRequests([]);
        setError(
          caught instanceof ApiClientError ? caught.message : 'Failed to load your requests.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">My purchase requests</h1>
        <Link
          to="/purchase-requests/new"
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          Request a book
        </Link>
      </div>
      <PurchaseRequestListControls
        filters={filters}
        total={meta.total}
        pageSize={meta.pageSize}
        loading={loading}
        onChange={setFilters}
      />
      {loading ? <p role="status">Loading your requests...</p> : null}
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {loading ? null : requests.length === 0 ? (
        <p className="text-sm text-slate-600">You have not requested any books yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {requests.map((item) => (
            <li key={item.id} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900">{item.title}</p>
                <span className="text-xs font-medium uppercase text-slate-500">{item.state}</span>
              </div>
              <p className="text-slate-600">
                {item.authorText} · {item.publicationYear}
              </p>
              {item.state === 'rejected' && item.reviewReason ? (
                <p className="text-red-700">Reason: {item.reviewReason}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
