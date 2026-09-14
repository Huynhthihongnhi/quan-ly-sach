import { Server } from 'node:http';
import request from 'supertest';

const ORIGIN = 'http://127.0.0.1:3000';

export function auditAgent(httpServer: Server, cookie: string) {
  const withSession = (req: request.Test) => req.set('Cookie', cookie);

  return {
    list: (query = '') => withSession(request(httpServer).get(`/api/v1/audit-events${query}`)),
  };
}

export function auditMutationAgent(httpServer: Server, cookie: string, csrfToken: string) {
  const withMutation = (req: request.Test) =>
    req
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .set('X-Requested-With', 'library-web')
      .set('X-CSRF-Token', csrfToken);

  return {
    post: () => withMutation(request(httpServer).post('/api/v1/audit-events')),
    patch: (id: string) => withMutation(request(httpServer).patch(`/api/v1/audit-events/${id}`)),
    delete: (id: string) => withMutation(request(httpServer).delete(`/api/v1/audit-events/${id}`)),
  };
}
