import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export interface PurchaseRequestFilters {
  state: string;
  page: number;
}

export function PurchaseRequestListControls({
  filters,
  total,
  pageSize,
  loading,
  onChange,
}: {
  filters: PurchaseRequestFilters;
  total: number;
  pageSize: number;
  loading: boolean;
  onChange: (filters: PurchaseRequestFilters) => void;
}): React.JSX.Element {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="purchase-state-filter">Status</Label>
        <select
          id="purchase-state-filter"
          value={filters.state}
          className="block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          onChange={(event) => onChange({ ...filters, state: event.target.value, page: 1 })}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <nav aria-label="Purchase request pages" className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={loading || filters.page <= 1}
          onClick={() => onChange({ ...filters, page: filters.page - 1 })}
        >
          Previous
        </Button>
        <span className="text-sm" aria-live="polite">
          Page {filters.page} of {pages}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={loading || filters.page >= pages}
          onClick={() => onChange({ ...filters, page: filters.page + 1 })}
        >
          Next
        </Button>
      </nav>
    </div>
  );
}
