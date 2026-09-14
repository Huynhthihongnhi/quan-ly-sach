import { Server } from 'node:http';
import request from 'supertest';

const ORIGIN = 'http://127.0.0.1:3000';

export function accessAgent(httpServer: Server, cookie: string, csrfToken?: string) {
  const withSession = (req: request.Test) => req.set('Cookie', cookie);

  const withMutation = (req: request.Test) => {
    let next = withSession(req).set('Origin', ORIGIN).set('X-Requested-With', 'library-web');
    if (csrfToken) {
      next = next.set('X-CSRF-Token', csrfToken);
    }
    return next;
  };

  return {
    listRoles: (query = '') => withSession(request(httpServer).get(`/api/v1/roles${query}`)),

    createRole: (body: Record<string, unknown>) =>
      withMutation(request(httpServer).post('/api/v1/roles')).send(body),

    updateRole: (id: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).patch(`/api/v1/roles/${id}`)).send(body),

    deleteRole: (id: string, version: string) =>
      withMutation(request(httpServer).delete(`/api/v1/roles/${id}`)).set('If-Match', version),

    replaceRolePermissions: (id: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).put(`/api/v1/roles/${id}/permissions`)).send(body),

    listPermissions: (query = '') =>
      withSession(request(httpServer).get(`/api/v1/permissions${query}`)),

    getUserRoles: (userId: string) =>
      withSession(request(httpServer).get(`/api/v1/users/${userId}/roles`)),

    replaceUserRoles: (userId: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).put(`/api/v1/users/${userId}/roles`)).send(body),
  };
}
