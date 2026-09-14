import { http, HttpResponse } from 'msw';

const API_BASE = '/api/v1';

export interface MockLoanRow {
  id: string;
  userId: string;
  bookId: string;
  copyId: string;
  state: string;
  requestedDays: number;
  reservedAt: string;
  reservationExpiresAt: string;
  checkedOutAt: string | null;
  dueAt: string | null;
  version: string;
}

let book106Copies = 2;
let loanCreateCount = 0;
let simulateNoCopyOnReserve = false;
const idempotencyStore = new Map<string, MockLoanRow>();

const loansById: Record<string, MockLoanRow> = {
  '910': {
    id: '910',
    userId: '2',
    bookId: '106',
    copyId: '501',
    state: 'reserved',
    requestedDays: 15,
    reservedAt: '2026-09-11T08:00:00.000Z',
    reservationExpiresAt: '2026-09-12T08:00:00.000Z',
    checkedOutAt: null,
    dueAt: null,
    version: '1',
  },
  '911': {
    id: '911',
    userId: '3',
    bookId: '106',
    copyId: '502',
    state: 'borrowed',
    requestedDays: 10,
    reservedAt: '2026-09-01T08:00:00.000Z',
    reservationExpiresAt: '2026-09-02T08:00:00.000Z',
    checkedOutAt: '2026-09-02T09:00:00.000Z',
    dueAt: '2026-09-12T09:00:00.000Z',
    version: '2',
  },
};

export function resetCirculationMocks(): void {
  book106Copies = 2;
  loanCreateCount = 0;
  simulateNoCopyOnReserve = false;
  idempotencyStore.clear();
}

export function setSimulateNoCopyOnReserve(value: boolean): void {
  simulateNoCopyOnReserve = value;
}

export function setBook106AvailableCopies(count: number): void {
  book106Copies = count;
}

export function getBook106AvailableCopies(): number {
  return book106Copies;
}

export function getLoanCreateCount(): number {
  return loanCreateCount;
}

export function circulationHandlers(activeSession: () => 'admin' | 'reader' | 'librarian' | null) {
  return [
    http.get(`${API_BASE}/me/loans`, () => {
      const session = activeSession();
      if (!session) {
        return HttpResponse.json(
          { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Session expired.' } },
          { status: 401 },
        );
      }
      const userId = session === 'reader' ? '2' : '1';
      const data = Object.values(loansById).filter((loan) => loan.userId === userId);
      return HttpResponse.json({
        data,
        meta: { page: 1, pageSize: 20, total: data.length },
      });
    }),

    http.get(`${API_BASE}/loans/:id`, ({ params }) => {
      const session = activeSession();
      if (!session) {
        return HttpResponse.json(
          { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Session expired.' } },
          { status: 401 },
        );
      }
      const loan = loansById[String(params.id)];
      if (!loan) {
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Loan was not found.' } },
          { status: 404 },
        );
      }
      const userId = session === 'reader' ? '2' : session === 'librarian' ? '3' : '1';
      const canAny = session === 'admin' || session === 'librarian';
      if (!canAny && loan.userId !== userId) {
        return HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Loan does not belong to the signed-in user.' } },
          { status: 403 },
        );
      }
      return HttpResponse.json({
        data: {
          ...loan,
          events: [
            {
              id: '1',
              fromState: null,
              toState: loan.state === 'borrowed' ? 'borrowed' : 'reserved',
              reason: null,
              createdAt: loan.reservedAt,
            },
          ],
        },
      });
    }),

    http.post(`${API_BASE}/loans`, async ({ request }) => {
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
      if (simulateNoCopyOnReserve || book106Copies <= 0) {
        book106Copies = 0;
        simulateNoCopyOnReserve = false;
        return HttpResponse.json(
          { error: { code: 'NO_COPY_AVAILABLE', message: 'No copy is available to reserve.' } },
          { status: 409 },
        );
      }
      loanCreateCount += 1;
      book106Copies -= 1;
      const created: MockLoanRow = {
        id: String(900 + loanCreateCount),
        userId: '2',
        bookId: '106',
        copyId: '503',
        state: 'reserved',
        requestedDays: 15,
        reservedAt: new Date().toISOString(),
        reservationExpiresAt: new Date(Date.now() + 86400000).toISOString(),
        checkedOutAt: null,
        dueAt: null,
        version: '1',
      };
      loansById[created.id] = created;
      idempotencyStore.set(idempotencyKey, created);
      return HttpResponse.json({ data: created }, { status: 201 });
    }),

    http.get(`${API_BASE}/admin/loans`, () => {
      const session = activeSession();
      if (session !== 'admin' && session !== 'librarian') {
        return HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Forbidden.' } },
          { status: 403 },
        );
      }
      const data = Object.values(loansById).map((loan) => ({ ...loan, userId: loan.userId }));
      return HttpResponse.json({
        data,
        meta: { page: 1, pageSize: 50, total: data.length },
      });
    }),

    http.post(`${API_BASE}/admin/loans/:id/checkout`, ({ params }) => {
      const loan = loansById[String(params.id)];
      if (!loan || loan.state !== 'reserved') {
        return HttpResponse.json(
          { error: { code: 'INVALID_TRANSITION', message: 'Loan state transition is not allowed.' } },
          { status: 409 },
        );
      }
      loan.state = 'borrowed';
      loan.checkedOutAt = new Date().toISOString();
      loan.dueAt = new Date(Date.now() + loan.requestedDays * 86400000).toISOString();
      loan.version = String(Number(loan.version) + 1);
      return HttpResponse.json({ data: loan });
    }),

    http.post(`${API_BASE}/admin/loans/:id/return`, ({ params }) => {
      const loan = loansById[String(params.id)];
      if (!loan || loan.state !== 'borrowed') {
        return HttpResponse.json(
          { error: { code: 'INVALID_TRANSITION', message: 'Loan state transition is not allowed.' } },
          { status: 409 },
        );
      }
      loan.state = 'returned';
      loan.version = String(Number(loan.version) + 1);
      book106Copies += 1;
      return HttpResponse.json({ data: loan });
    }),
  ];
}
