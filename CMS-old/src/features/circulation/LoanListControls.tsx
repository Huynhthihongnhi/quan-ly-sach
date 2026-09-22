import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export interface LoanFilters {
  state: string;
  overdue: boolean;
  page: number;
}

export function LoanListControls({ filters, total, pageSize, loading, onChange }: {
  filters: LoanFilters;
  total: number;
  pageSize: number;
  loading: boolean;
  onChange: (filters: LoanFilters) => void;
}): React.JSX.Element {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="loan-state-filter">Loan status</Label>
        <select id="loan-state-filter" value={filters.state}
          className="block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          onChange={(event) => onChange({ ...filters, state: event.target.value,
            overdue: event.target.value === 'borrowed' && filters.overdue, page: 1 })}>
          <option value="">All statuses</option>
          <option value="reserved">Reserved</option>
          <option value="borrowed">Borrowed</option>
          <option value="returned">Returned</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
          <option value="lost">Lost</option>
        </select>
      </div>
      <label className="flex items-center gap-2 py-2 text-sm">
        <input type="checkbox" checked={filters.overdue}
          onChange={(event) => onChange({ ...filters, overdue: event.target.checked,
            state: event.target.checked ? 'borrowed' : filters.state, page: 1 })} />
        Overdue only
      </label>
      <nav aria-label="Loan pages" className="flex items-center gap-2">
        <Button type="button" variant="outline" disabled={loading || filters.page <= 1}
          onClick={() => onChange({ ...filters, page: filters.page - 1 })}>Previous</Button>
        <span className="text-sm" aria-live="polite">Page {filters.page} of {pages}</span>
        <Button type="button" variant="outline" disabled={loading || filters.page >= pages}
          onClick={() => onChange({ ...filters, page: filters.page + 1 })}>Next</Button>
      </nav>
    </div>
  );
}
