import { Server } from 'node:http';
import request from 'supertest';

const ORIGIN = 'http://127.0.0.1:3000';

export function usersAgent(httpServer: Server, cookie: string, csrfToken?: string) {
  const withSession = (req: request.Test) => req.set('Cookie', cookie);

  const withMutation = (req: request.Test) => {
    let next = withSession(req).set('Origin', ORIGIN).set('X-Requested-With', 'library-web');
    if (csrfToken) {
      next = next.set('X-CSRF-Token', csrfToken);
    }
    return next;
  };

  return {
    list: (query = '') => withSession(request(httpServer).get(`/api/v1/users${query}`)),

    create: (body: Record<string, unknown>) =>
      withMutation(request(httpServer).post('/api/v1/users')).send(body),

    get: (id: string) => withSession(request(httpServer).get(`/api/v1/users/${id}`)),

    updateStatus: (id: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).patch(`/api/v1/users/${id}/status`)).send(body),

    getProfile: (id: string) => withSession(request(httpServer).get(`/api/v1/users/${id}/profile`)),

    getOwnProfile: () => withSession(request(httpServer).get('/api/v1/me/profile')),

    patchProfile: (id: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).patch(`/api/v1/users/${id}/profile`)).send(body),

    patchOwnProfile: (body: Record<string, unknown>) =>
      withMutation(request(httpServer).patch('/api/v1/me/profile')).send(body),

    sendActivationEmail: (id: string) =>
      withMutation(request(httpServer).post(`/api/v1/users/${id}/activation-email`)),
  };
}
