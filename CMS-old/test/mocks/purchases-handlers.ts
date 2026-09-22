import { http, HttpResponse } from 'msw';

const API_BASE = '/api/v1';

export interface MockPurchaseRequestRow {
  id: string;
  requesterId: string;
  title: string;
  authorText: string;
  publicationYear: number;
  note: string | null;
  state: string;
  reviewedBy: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  version: string;
  createdAt: string;
}

let createCount = 0;
const idempotencyStore = new Map<string, MockPurchaseRequestRow>();
const requestsById: Record<string, MockPurchaseRequestRow> = {
  '801': {
    id: '801',
    requesterId: '2',
    title: 'Already Reviewed Elsewhere',
    authorText: 'Someone',
    publicationYear: 2020,
    note: null,
    state: 'pending',
    reviewedBy: null,
    reviewReason: null,
    reviewedAt: null,
    version: '1',
    createdAt: '2026-09-10T08:00:00.000Z',
  },
};

export function resetPurchasesMocks(): void {
  createCount = 0;
  idempotencyStore.clear();
  requestsById['801'] = {
    id: '801',
    requesterId: '2',
    title: 'Already Reviewed Elsewhere',
    authorText: 'Someone',
    publicationYear: 2020,
    note: null,
    state: 'pending',
    reviewedBy: null,
    reviewReason: null,
    reviewedAt: null,
    version: '1',
    createdAt: '2026-09-10T08:00:00.000Z',
  };
}

export function getPurchaseCreateCount(): number {
  return createCount;
}

export function purchasesHandlers(activeSession: () => 'admin' | 'reader' | 'librarian' | null) {
  return [
    http.post(`${API_BASE}/purchase-requests`, async ({ request }) => {
      const session = activeSession();
      if (session !== 'reader') {
        return HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Forbidden.' } },
          { status: 403 },
        );
      }
      const idempotencyKey = request.headers.get('Idempotency-Key') ?? '';
      const replay = idempotencyStore.get(idempotencyKey);
      if (replay) {
        return HttpResponse.json({ data: replay }, { status: 200 });
      }
      const body = (await request.json()) as {
        title: string;
        authorText: string;
        publicationYear: number;
        note?: string;
      };
      createCount += 1;
      const created: MockPurchaseRequestRow = {
        id: String(700 + createCount),
        requesterId: '2',
        title: body.title,
        authorText: body.authorText,
        publicationYear: body.publicationYear,
        note: body.note ?? null,
        state: 'pending',
        reviewedBy: null,
        reviewReason: null,
        reviewedAt: null,
        version: '1',
        createdAt: new Date().toISOString(),
      };
      requestsById[created.id] = created;
      idempotencyStore.set(idempotencyKey, created);
      return HttpResponse.json({ data: created }, { status: 201 });
    }),

    http.get(`${API_BASE}/me/purchase-requests`, ({ request }) => {
      const session = activeSession();
      if (!session) {
        return HttpResponse.json(
          { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Session expired.' } },
          { status: 401 },
        );
      }
      const url = new URL(request.url);
      const state = url.searchParams.get('state');
      const data = Object.values(requestsById)
        .filter((row) => row.requesterId === '2')
        .filter((row) => !state || row.state === state);
      return HttpResponse.json({
        data,
        meta: { page: 1, pageSize: 20, total: data.length },
      });
    }),

    http.get(`${API_BASE}/admin/purchase-requests`, ({ request }) => {
      const session = activeSession();
      if (session !== 'admin' && session !== 'librarian') {
        return HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Forbidden.' } },
          { status: 403 },
        );
      }
      const url = new URL(request.url);
      const state = url.searchParams.get('state');
      const data = Object.values(requestsById).filter((row) => !state || row.state === state);
      return HttpResponse.json({
        data,
        meta: { page: 1, pageSize: 50, total: data.length },
      });
    }),

    http.post(`${API_BASE}/admin/purchase-requests/:id/review`, async ({ params, request }) => {
      const session = activeSession();
      if (session !== 'admin' && session !== 'librarian') {
        return HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Forbidden.' } },
          { status: 403 },
        );
      }
      const row = requestsById[String(params.id)];
      if (!row) {
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Purchase request was not found.' } },
          { status: 404 },
        );
      }
      const body = (await request.json()) as {
        decision: 'approved' | 'rejected';
        version: string;
        reason?: string;
      };
      if (row.state !== 'pending' || body.version !== row.version) {
        return HttpResponse.json(
          {
            error: {
              code: row.state !== 'pending' ? 'INVALID_TRANSITION' : 'VERSION_CONFLICT',
              message: 'Purchase request version is stale.',
            },
          },
          { status: 409 },
        );
      }
      row.state = body.decision;
      row.reviewedBy = session === 'admin' ? '1' : '3';
      row.reviewReason = body.reason ?? null;
      row.reviewedAt = new Date().toISOString();
      row.version = String(Number(row.version) + 1);
      return HttpResponse.json({ data: row });
    }),
  ];
}
