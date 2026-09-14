import { Server } from 'node:http';
import request from 'supertest';

const ORIGIN = 'http://127.0.0.1:3000';

export function cardsAgent(httpServer: Server, cookie: string, csrfToken?: string) {
  const withSession = (req: request.Test) => req.set('Cookie', cookie);

  const withMutation = (req: request.Test) => {
    let next = withSession(req).set('Origin', ORIGIN).set('X-Requested-With', 'library-web');
    if (csrfToken) {
      next = next.set('X-CSRF-Token', csrfToken);
    }
    return next;
  };

  return {
    issueCard: (body: Record<string, unknown>) =>
      withMutation(request(httpServer).post('/api/v1/admin/library-cards')).send(body),

    listAdmin: (query = '') =>
      withSession(request(httpServer).get(`/api/v1/admin/library-cards${query}`)),

    patchState: (id: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).patch(`/api/v1/admin/library-cards/${id}/state`)).send(body),

    listOwn: (query = '') =>
      withSession(request(httpServer).get(`/api/v1/me/library-cards${query}`)),
  };
}
