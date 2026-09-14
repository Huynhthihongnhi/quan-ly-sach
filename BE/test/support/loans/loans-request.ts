import { Server } from 'node:http';
import request from 'supertest';

const ORIGIN = 'http://127.0.0.1:3000';

export function loansAgent(httpServer: Server, cookie: string, csrfToken?: string) {
  const withMutation = (req: request.Test) => {
    let next = req
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .set('X-Requested-With', 'library-web');
    if (csrfToken) {
      next = next.set('X-CSRF-Token', csrfToken);
    }
    return next;
  };

  return {
    create: (body: Record<string, unknown>, idempotencyKey: string) =>
      withMutation(request(httpServer).post('/api/v1/loans'))
        .set('Idempotency-Key', idempotencyKey)
        .send(body),

    cancel: (loanId: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).post(`/api/v1/loans/${loanId}/cancel`)).send(body),
  };
}

export function adminLoansAgent(httpServer: Server, cookie: string, csrfToken?: string) {
  const withMutation = (req: request.Test) => {
    let next = req
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .set('X-Requested-With', 'library-web');
    if (csrfToken) {
      next = next.set('X-CSRF-Token', csrfToken);
    }
    return next;
  };

  return {
    checkout: (loanId: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).post(`/api/v1/admin/loans/${loanId}/checkout`)).send(body),

    return: (loanId: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).post(`/api/v1/admin/loans/${loanId}/return`)).send(body),

    markLost: (loanId: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).post(`/api/v1/admin/loans/${loanId}/lost`)).send(body),
  };
}
