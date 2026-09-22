import { Server } from 'node:http';
import request from 'supertest';

export function reportsAgent(httpServer: Server, cookie: string) {
  const withSession = (req: request.Test) => req.set('Cookie', cookie);

  return {
    circulation: (query = '') =>
      withSession(request(httpServer).get(`/api/v1/reports/circulation${query}`)),

    inventory: (query = '') =>
      withSession(request(httpServer).get(`/api/v1/reports/inventory${query}`)),

    purchases: (query = '') =>
      withSession(request(httpServer).get(`/api/v1/reports/purchases${query}`)),
  };
}
