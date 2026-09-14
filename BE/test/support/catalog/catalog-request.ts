import { Server } from 'node:http';
import request from 'supertest';

const ORIGIN = 'http://127.0.0.1:3000';

export function catalogAgent(httpServer: Server, cookie: string, csrfToken?: string) {
  const withSession = (req: request.Test) => req.set('Cookie', cookie);

  const withMutation = (req: request.Test) => {
    let next = withSession(req).set('Origin', ORIGIN).set('X-Requested-With', 'library-web');
    if (csrfToken) {
      next = next.set('X-CSRF-Token', csrfToken);
    }
    return next;
  };

  return {
    createCategory: (body: Record<string, unknown>) =>
      withMutation(request(httpServer).post('/api/v1/admin/categories')).send(body),

    createAuthor: (body: Record<string, unknown>) =>
      withMutation(request(httpServer).post('/api/v1/admin/authors')).send(body),

    createTopic: (body: Record<string, unknown>) =>
      withMutation(request(httpServer).post('/api/v1/admin/topics')).send(body),

    createBook: (body: Record<string, unknown>) =>
      withMutation(request(httpServer).post('/api/v1/admin/books')).send(body),

    getBook: (id: string) => withSession(request(httpServer).get(`/api/v1/admin/books/${id}`)),

    patchBook: (id: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).patch(`/api/v1/admin/books/${id}`)).send(body),

    patchBookState: (id: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).patch(`/api/v1/admin/books/${id}/state`)).send(body),

    createCopy: (bookId: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).post(`/api/v1/admin/books/${bookId}/copies`)).send(body),

    patchCopy: (copyId: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).patch(`/api/v1/admin/copies/${copyId}`)).send(body),
  };
}
