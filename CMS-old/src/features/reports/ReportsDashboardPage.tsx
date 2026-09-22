import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  buildDateRangeReportCsvHref,
  buildInventoryReportCsvHref,
  fetchCirculationReport,
  fetchInventoryReport,
  fetchPurchasesReport,
  type CirculationReport,
  type InventoryReport,
  type PurchasesReport,
} from '@/lib/api/reports';
import { ApiClientError } from '@/lib/api/types';

const LIBRARY_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const libraryDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LIBRARY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// The report range is a library-local (Asia/Ho_Chi_Minh) calendar date, not the
// viewer's own timezone, so "today" must be computed in that zone explicitly.
function libraryLocalIsoDate(date: Date): string {
  return libraryDateFormatter.format(date);
}

function defaultFrom(): string {
  const date = new Date();
  date.setDate(date.getDate() - 13);
  return libraryLocalIsoDate(date);
}

function defaultTo(): string {
  return libraryLocalIsoDate(new Date());
}

export function ReportsDashboardPage(): React.JSX.Element {
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [circulation, setCirculation] = useState<CirculationReport | null>(null);
  const [inventory, setInventory] = useState<InventoryReport | null>(null);
  const [purchases, setPurchases] = useState<PurchasesReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (from > to) {
      setError('The start date must not be after the end date.');
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    setError(null);
    Promise.all([
      fetchCirculationReport(from, to),
      fetchInventoryReport(),
      fetchPurchasesReport(from, to),
    ])
      .then(([circulationReport, inventoryReport, purchasesReport]) => {
        if (!active) return;
        setCirculation(circulationReport);
        setInventory(inventoryReport);
        setPurchases(purchasesReport);
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof ApiClientError ? caught.message : 'Failed to load reports.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [from, to]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => event.preventDefault()}>
        <div className="space-y-1">
          <Label htmlFor="report-from">From</Label>
          <Input
            id="report-from"
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="report-to">To</Label>
          <Input
            id="report-to"
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </form>
      {loading ? <p role="status">Loading reports...</p> : null}
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {loading ? null : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Circulation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Checkouts: {circulation?.period.checkouts ?? 0}</p>
              <p>Returns: {circulation?.period.returns ?? 0}</p>
              <p>Lost: {circulation?.period.lost ?? 0}</p>
              <p>Currently borrowed: {circulation?.asOf.currentlyBorrowed ?? 0}</p>
              <p>Currently overdue: {circulation?.asOf.currentlyOverdue ?? 0}</p>
              <a
                className="inline-block font-medium text-blue-700 hover:underline"
                href={buildDateRangeReportCsvHref('circulation', from, to)}
              >
                Export CSV
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Titles: {inventory?.titles ?? 0}</p>
              <p>Physical copies: {inventory?.physicalCopies ?? 0}</p>
              <p>Available: {inventory?.available ?? 0}</p>
              <p>Reserved: {inventory?.reservedActive ?? 0}</p>
              <p>Borrowed: {inventory?.borrowed ?? 0}</p>
              <p>
                Repair / lost / retired: {inventory?.repair ?? 0} / {inventory?.lost ?? 0} /{' '}
                {inventory?.retired ?? 0}
              </p>
              <a
                className="inline-block font-medium text-blue-700 hover:underline"
                href={buildInventoryReportCsvHref()}
              >
                Export CSV
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Purchase requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Submitted: {purchases?.submitted ?? 0}</p>
              <p>Approved: {purchases?.approved ?? 0}</p>
              <p>Rejected: {purchases?.rejected ?? 0}</p>
              <p>Pending now: {purchases?.pendingNow ?? 0}</p>
              <a
                className="inline-block font-medium text-blue-700 hover:underline"
                href={buildDateRangeReportCsvHref('purchases', from, to)}
              >
                Export CSV
              </a>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
