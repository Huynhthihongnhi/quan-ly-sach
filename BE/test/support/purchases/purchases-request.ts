import { Server } from 'node:http';
import request from 'supertest';

const ORIGIN = 'http://127.0.0.1:3000';

export function purchasesAgent(httpServer: Server, cookie: string, csrfToken?: string) {
  const withSession = (req: request.Test) => req.set('Cookie', cookie);

  const withMutation = (req: request.Test) => {
    let next = withSession(req).set('Origin', ORIGIN).set('X-Requested-With', 'library-web');
    if (csrfToken) {
      next = next.set('X-CSRF-Token', csrfToken);
    }
    return next;
  };

  return {
    create: (body: Record<string, unknown>, idempotencyKey: string) =>
      withMutation(request(httpServer).post('/api/v1/purchase-requests'))
        .set('Idempotency-Key', idempotencyKey)
        .send(body),

    get: (id: string) => withMutation(request(httpServer).get(`/api/v1/purchase-requests/${id}`)),

    listOwn: (query = '') =>
      withMutation(request(httpServer).get(`/api/v1/me/purchase-requests${query}`)),

    listAdmin: (query = '') =>
      withMutation(request(httpServer).get(`/api/v1/admin/purchase-requests${query}`)),

    review: (
      id: string,
      body: { decision: 'approved' | 'rejected'; version: string; reason?: string },
    ) =>
      withMutation(request(httpServer).post(`/api/v1/admin/purchase-requests/${id}/review`)).send(
        body,
      ),
  };
}
