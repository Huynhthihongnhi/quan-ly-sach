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
  fetchAdminPurchaseRequests,
  reviewPurchaseRequest,
  type PurchaseRequestRecord,
} from '@/lib/api/purchases';
import { ApiClientError } from '@/lib/api/types';
import {
  PurchaseRequestListControls,
  type PurchaseRequestFilters,
} from './PurchaseRequestListControls';

function isStaleReviewError(code: string): boolean {
  return code === 'VERSION_CONFLICT' || code === 'INVALID_TRANSITION';
}

export function AdminPurchaseQueuePage(): React.JSX.Element {
  const [requests, setRequests] = useState<PurchaseRequestRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filters, setFilters] = useState<PurchaseRequestFilters>({ state: 'pending', page: 1 });
  const [meta, setMeta] = useState({ total: 0, pageSize: 50 });
  const [revision, setRevision] = useState(0);
  const [rejectTarget, setRejectTarget] = useState<PurchaseRequestRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAdminPurchaseRequests({
        page: filters.page,
        state: filters.state || undefined,
      });
      setRequests(response.data);
      setMeta(response.meta);
      setError(null);
    } catch (caught) {
      setRequests([]);
      setError(
        caught instanceof ApiClientError ? caught.message : 'Failed to load purchase requests.',
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load, revision]);

  function refreshAfterConflict(): void {
    // The just-conflicted row may no longer match the current status filter (e.g. it
    // was showing under "Pending" and just moved to "Approved"/"Rejected"). Clear the
    // filter so the reviewer actually sees the row's real new state, not just a gap.
    setNotice('This request was already reviewed elsewhere. The list now shows its current state.');
    setFilters((current) => (current.state ? { ...current, state: '', page: 1 } : current));
    setRevision((value) => value + 1);
  }

  async function handleApprove(request: PurchaseRequestRecord): Promise<void> {
    setBusyId(request.id);
    setNotice(null);
    try {
      await reviewPurchaseRequest(request.id, { decision: 'approved', version: request.version });
      setRevision((value) => value + 1);
    } catch (caught) {
      if (caught instanceof ApiClientError && isStaleReviewError(caught.code)) {
        refreshAfterConflict();
      } else {
        setError(caught instanceof ApiClientError ? caught.message : 'Approval failed.');
      }
    } finally {
      setBusyId(null);
    }
  }

  function openReject(request: PurchaseRequestRecord): void {
    setRejectTarget(request);
    setRejectReason('');
    setRejectError(null);
    setNotice(null);
  }

  async function handleReject(): Promise<void> {
    if (!rejectTarget || rejectSubmitting) {
      return;
    }
    if (!rejectReason.trim()) {
      setRejectError('A reason is required to reject a request.');
      return;
    }
    setRejectSubmitting(true);
    setRejectError(null);
    try {
      await reviewPurchaseRequest(rejectTarget.id, {
        decision: 'rejected',
        version: rejectTarget.version,
        reason: rejectReason.trim(),
      });
      setRejectTarget(null);
      setRevision((value) => value + 1);
    } catch (caught) {
      if (caught instanceof ApiClientError && isStaleReviewError(caught.code)) {
        setRejectTarget(null);
        refreshAfterConflict();
      } else {
        setRejectError(caught instanceof ApiClientError ? caught.message : 'Rejection failed.');
      }
    } finally {
      setRejectSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Purchase requests</h1>
      <p className="text-sm text-slate-600">
        Review pending requests to add new titles to the catalog.
      </p>
      <PurchaseRequestListControls
        filters={filters}
        total={meta.total}
        pageSize={meta.pageSize}
        loading={loading}
        onChange={setFilters}
      />
      {loading ? <p role="status">Loading purchase requests...</p> : null}
      {notice ? <Alert aria-live="polite">{notice}</Alert> : null}
      {error ? (
        <Alert variant="destructive" aria-live="assertive">
          {error}
        </Alert>
      ) : null}
      {loading ? null : requests.length === 0 ? (
        <p className="text-sm text-slate-600">No purchase requests match this filter.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>{request.title}</TableCell>
                <TableCell>{request.authorText}</TableCell>
                <TableCell>{request.publicationYear}</TableCell>
                <TableCell>{request.state}</TableCell>
                <TableCell>{request.reviewReason ?? 'None'}</TableCell>
                <TableCell className="space-x-2">
                  {request.state === 'pending' ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyId === request.id}
                        onClick={() => void handleApprove(request)}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === request.id}
                        onClick={() => openReject(request)}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent aria-describedby="reject-purchase-description">
          <DialogHeader>
            <DialogTitle>Reject purchase request</DialogTitle>
            <DialogDescription id="reject-purchase-description">
              Give a reason for rejecting {rejectTarget?.title ?? 'this request'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="reject-reason">Reason</Label>
            <input
              id="reject-reason"
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              maxLength={1000}
            />
          </div>
          {rejectError ? (
            <Alert variant="destructive" aria-live="assertive">
              {rejectError}
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" disabled={rejectSubmitting} onClick={() => void handleReject()}>
              {rejectSubmitting ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
