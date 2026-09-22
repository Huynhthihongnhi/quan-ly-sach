import { http, HttpResponse } from 'msw';

const API_BASE = '/api/v1';

export function reportsHandlers(activeSession: () => 'admin' | 'reader' | 'librarian' | null) {
  function requireReportsRead(): Response | null {
    const session = activeSession();
    if (session !== 'admin' && session !== 'librarian') {
      return HttpResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Forbidden.' } },
        { status: 403 },
      );
    }
    return null;
  }

  return [
    http.get(`${API_BASE}/reports/circulation`, ({ request }) => {
      const denied = requireReportsRead();
      if (denied) return denied;
      const url = new URL(request.url);
      const from = url.searchParams.get('from') ?? '';
      const to = url.searchParams.get('to') ?? '';
      if (url.searchParams.get('format') === 'csv') {
        return new HttpResponse('from,to,checkouts\r\n' + `${from},${to},4\r\n`, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="circulation-report.csv"',
          },
        });
      }
      return HttpResponse.json({
        data: {
          range: { from, to, timezone: 'Asia/Ho_Chi_Minh' },
          period: { checkouts: 4, returns: 2, lost: 0 },
          asOf: { generatedAt: new Date().toISOString(), currentlyBorrowed: 3, currentlyOverdue: 1 },
        },
      });
    }),

    http.get(`${API_BASE}/reports/inventory`, () => {
      const denied = requireReportsRead();
      if (denied) return denied;
      return HttpResponse.json({
        data: {
          asOf: new Date().toISOString(),
          titles: 12,
          physicalCopies: 20,
          available: 10,
          reservedActive: 2,
          borrowed: 6,
          repair: 1,
          lost: 1,
          retired: 0,
        },
      });
    }),

    http.get(`${API_BASE}/reports/purchases`, ({ request }) => {
      const denied = requireReportsRead();
      if (denied) return denied;
      const url = new URL(request.url);
      const from = url.searchParams.get('from') ?? '';
      const to = url.searchParams.get('to') ?? '';
      return HttpResponse.json({
        data: {
          range: { from, to },
          submitted: 5,
          approved: 2,
          rejected: 1,
          pendingNow: 2,
        },
      });
    }),
  ];
}
