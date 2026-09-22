import { http, HttpResponse, delay } from 'msw';
import { catalogHandlers, setCatalogAdminSession, setCatalogNetworkFail } from './catalog-handlers';
import {
  circulationHandlers,
  getLoanCreateCount,
  resetCirculationMocks,
  setBook106AvailableCopies,
} from './circulation-handlers';

export { getLoanCreateCount, setBook106AvailableCopies };
import { digitalHandlers, resetDigitalMocks } from './digital-handlers';
import { getPurchaseCreateCount, purchasesHandlers, resetPurchasesMocks } from './purchases-handlers';
import { reportsHandlers } from './reports-handlers';

export { getPurchaseCreateCount };

const API_BASE = '/api/v1';

export const adminPermissions = [
  'users.read',
  'users.write',
  'roles.read',
  'roles.write',
  'permissions.read',
  'catalog.read',
  'catalog.write',
  'loans.read.any',
  'loans.manage',
  'purchases.read.any',
  'purchases.review',
  'reports.read',
];

export const librarianPermissions = [
  'catalog.read',
  'catalog.write',
  'copies.write',
  'loans.read.any',
  'loans.manage',
  'purchases.read.any',
  'purchases.review',
  'reports.read',
];

export const readerPermissions = [
  'digital.download.own',
  'loans.create.own',
  'loans.read.own',
  'loans.cancel.own',
  'purchases.create.own',
  'purchases.read.own',
];

export const FORGOT_PASSWORD_ACCEPTED_MESSAGE =
  'If an account exists for that email, password reset instructions will be sent shortly.';

let resetSubmitCount = 0;
let profileVersion = '1';

let activeSession: 'admin' | 'reader' | 'librarian' | null = null;

export function resetMockSession(): void {
  activeSession = null;
  resetSubmitCount = 0;
  profileVersion = '1';
  setCatalogNetworkFail(false);
  setCatalogAdminSession(false);
  resetDigitalMocks();
  resetCirculationMocks();
  resetPurchasesMocks();
}

export function setMockSession(session: 'admin' | 'reader' | 'librarian' | null): void {
  activeSession = session;
  setCatalogAdminSession(session === 'admin' || session === 'librarian');
}

export const handlers = [
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email === 'admin@test.local' && body.password === 'AdminPass123!') {
      activeSession = 'admin';
      return HttpResponse.json({
        data: {
          user: { id: '1', email: body.email, status: 'active' },
          csrfToken: 'csrf-admin-token',
        },
      });
    }
    if (body.email === 'reader@test.local' && body.password === 'ReaderPass123!') {
      activeSession = 'reader';
      return HttpResponse.json({
        data: {
          user: { id: '2', email: body.email, status: 'active' },
          csrfToken: 'csrf-reader-token',
        },
      });
    }
    return HttpResponse.json(
      {
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Invalid email or password.',
        },
      },
      { status: 401 },
    );
  }),

  http.get(`${API_BASE}/auth/me`, () => {
    if (activeSession === 'admin') {
      return HttpResponse.json({
        data: { userId: '1', permissionCodes: adminPermissions },
      });
    }
    if (activeSession === 'reader') {
      return HttpResponse.json({
        data: { userId: '2', permissionCodes: readerPermissions },
      });
    }
    if (activeSession === 'librarian') {
      return HttpResponse.json({
        data: { userId: '3', permissionCodes: librarianPermissions },
      });
    }
    return HttpResponse.json(
      {
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Session expired.',
        },
      },
      { status: 401 },
    );
  }),

  http.post(`${API_BASE}/auth/logout`, () => {
    activeSession = null;
    return HttpResponse.text('', { status: 204 });
  }),

  http.post(`${API_BASE}/auth/forgot-password`, async () =>
    HttpResponse.json(
      { data: { message: FORGOT_PASSWORD_ACCEPTED_MESSAGE } },
      { status: 202 },
    ),
  ),

  http.post(`${API_BASE}/auth/reset-password`, async ({ request }) => {
    resetSubmitCount += 1;
    const body = (await request.json()) as { token: string; newPassword: string };
    if (body.token === 'expired-token') {
      return HttpResponse.json(
        {
          error: {
            code: 'CHALLENGE_INVALID',
            message: 'The link is invalid or has expired.',
          },
        },
        { status: 409 },
      );
    }
    if (body.newPassword.length < 12) {
      return HttpResponse.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Password does not meet policy requirements.',
            fields: [{ field: 'newPassword', code: 'TOO_SHORT' }],
          },
        },
        { status: 422 },
      );
    }
    if (body.token !== 'valid-reset-token') {
      return HttpResponse.json(
        {
          error: {
            code: 'CHALLENGE_INVALID',
            message: 'The link is invalid or has expired.',
          },
        },
        { status: 409 },
      );
    }
    return HttpResponse.text('', { status: 204 });
  }),

  http.post(`${API_BASE}/auth/activate`, async ({ request }) => {
    const body = (await request.json()) as { token: string; newPassword: string };
    if (body.token !== 'valid-activate-token' || body.newPassword.length < 12) {
      return HttpResponse.json(
        {
          error: {
            code: 'CHALLENGE_INVALID',
            message: 'The link is invalid or has expired.',
          },
        },
        { status: 409 },
      );
    }
    return HttpResponse.text('', { status: 204 });
  }),

  http.get(`${API_BASE}/me/library-cards`, ({ request }) => {
    if (!activeSession) {
      return HttpResponse.json(
        { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Session expired.' } },
        { status: 401 },
      );
    }
    const url = new URL(request.url);
    if (activeSession === 'reader') {
      return HttpResponse.json({
        data: [
          {
            id: '501',
            userId: '2',
            cardNumber: 'CARD-READER-MSW',
            state: 'active',
            issuedAt: '2026-09-01T00:00:00.000Z',
            expiresAt: '2027-09-01T00:00:00.000Z',
            issuedBy: '1',
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1 },
      });
    }
    return HttpResponse.json({
      data: [],
      meta: { page: Number(url.searchParams.get('page') ?? '1'), pageSize: 20, total: 0 },
    });
  }),

  http.get(`${API_BASE}/me/profile`, () => {
    if (!activeSession) {
      return HttpResponse.json(
        { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Session expired.' } },
        { status: 401 },
      );
    }
    return HttpResponse.json({
      data: {
        userId: activeSession === 'admin' ? '1' : '2',
        displayName: activeSession === 'admin' ? 'Admin' : 'Reader',
        phone: null,
        version: profileVersion,
      },
    });
  }),

  http.patch(`${API_BASE}/me/profile`, async ({ request }) => {
    if (!activeSession) {
      return HttpResponse.json(
        { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Session expired.' } },
        { status: 401 },
      );
    }
    const body = (await request.json()) as {
      displayName?: string;
      phone?: string | null;
      version: string;
    };
    if (body.version !== profileVersion) {
      return HttpResponse.json(
        {
          error: {
            code: 'VERSION_CONFLICT',
            message: 'Profile version is stale.',
          },
        },
        { status: 409 },
      );
    }
    profileVersion = String(Number(profileVersion) + 1);
    return HttpResponse.json({
      data: {
        userId: activeSession === 'admin' ? '1' : '2',
        displayName: body.displayName ?? 'Updated',
        phone: body.phone ?? null,
        version: profileVersion,
      },
    });
  }),

  http.get(`${API_BASE}/users`, ({ request }) => {
    if (activeSession !== 'admin') {
      return HttpResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Forbidden.' } },
        { status: 403 },
      );
    }
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const status = url.searchParams.get('status') ?? '';
    let data = [
      {
        id: '1',
        email: 'admin@test.local',
        status: 'active',
        version: '1',
        createdAt: '2026-09-11T08:00:00.000Z',
      },
      {
        id: '2',
        email: 'invitee@test.local',
        status: 'invited',
        version: '1',
        createdAt: '2026-09-11T08:00:00.000Z',
      },
    ];
    if (status) {
      data = data.filter((user) => user.status === status);
    }
    if (q) {
      data = data.filter((user) => user.email.toLowerCase().includes(q));
    }
    return HttpResponse.json({
      data,
      meta: { page: 1, pageSize: 20, total: data.length },
    });
  }),

  http.get(`${API_BASE}/roles`, () => {
    if (activeSession !== 'admin') {
      return HttpResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Forbidden.' } },
        { status: 403 },
      );
    }
    return HttpResponse.json({
      data: [
        {
          id: '10',
          code: 'custom',
          name: 'Custom Role',
          description: null,
          isSystem: false,
          version: '3',
          createdAt: '2026-09-11T08:00:00.000Z',
          permissionCodes: ['demo.read'],
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1 },
    });
  }),

  http.post(`${API_BASE}/roles`, async ({ request }) => {
    if (activeSession !== 'admin') {
      return HttpResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Forbidden.' } },
        { status: 403 },
      );
    }
    const body = (await request.json()) as { code: string; name: string; description?: string };
    return HttpResponse.json(
      {
        data: {
          id: '99',
          code: body.code,
          name: body.name,
          description: body.description ?? null,
          isSystem: false,
          version: '1',
          createdAt: '2026-09-16T08:00:00.000Z',
          permissionCodes: [],
        },
      },
      { status: 201 },
    );
  }),

  http.get(`${API_BASE}/permissions`, () =>
    HttpResponse.json({
      data: [
        { id: '1', code: 'demo.read', description: 'Demo read' },
        { id: '2', code: 'users.read', description: 'Read users' },
      ],
      meta: { page: 1, pageSize: 100, total: 2 },
    }),
  ),

  http.put(`${API_BASE}/roles/:id/permissions`, async ({ params, request }) => {
    const body = (await request.json()) as { version: string; permissionCodes: string[] };
    if (body.permissionCodes.includes('users.read') && body.version === '3') {
      return HttpResponse.json(
        {
          error: {
            code: 'VERSION_CONFLICT',
            message: 'Role version is stale.',
          },
        },
        { status: 409 },
      );
    }
    return HttpResponse.json({
      data: {
        id: String(params.id),
        code: 'custom',
        name: 'Custom Role',
        description: null,
        isSystem: false,
        version: '4',
        createdAt: '2026-09-11T08:00:00.000Z',
        permissionCodes: body.permissionCodes,
      },
    });
  }),
  ...catalogHandlers,
  ...digitalHandlers,
  ...circulationHandlers(() => activeSession),
  ...purchasesHandlers(() => activeSession),
  ...reportsHandlers(() => activeSession),
];

export const slowLoginHandler = http.post(`${API_BASE}/auth/login`, async () => {
  await delay(100);
  return HttpResponse.error();
});
