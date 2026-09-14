import { Server } from 'node:http';
import request from 'supertest';

const ORIGIN = 'http://127.0.0.1:3000';

export function authAgent(httpServer: Server) {
  return {
    login: (email: string, password: string) =>
      request(httpServer)
        .post('/api/v1/auth/login')
        .set('Origin', ORIGIN)
        .set('X-Requested-With', 'library-web')
        .send({ email, password }),

    me: (cookie: string) => request(httpServer).get('/api/v1/auth/me').set('Cookie', cookie),

    csrf: (cookie: string) => request(httpServer).get('/api/v1/auth/csrf').set('Cookie', cookie),

    logout: (cookie: string, csrfToken: string) =>
      request(httpServer)
        .post('/api/v1/auth/logout')
        .set('Origin', ORIGIN)
        .set('X-Requested-With', 'library-web')
        .set('Cookie', cookie)
        .set('X-CSRF-Token', csrfToken),

    forgotPassword: (email: string, hostHeader?: string) => {
      const req = request(httpServer)
        .post('/api/v1/auth/forgot-password')
        .set('Origin', ORIGIN)
        .set('X-Requested-With', 'library-web')
        .send({ email });
      if (hostHeader) {
        req.set('Host', hostHeader);
      }
      return req;
    },

    resetPassword: (token: string, newPassword: string) =>
      request(httpServer)
        .post('/api/v1/auth/reset-password')
        .set('Origin', ORIGIN)
        .set('X-Requested-With', 'library-web')
        .send({ token, newPassword }),

    activate: (token: string, newPassword: string) =>
      request(httpServer)
        .post('/api/v1/auth/activate')
        .set('Origin', ORIGIN)
        .set('X-Requested-With', 'library-web')
        .send({ token, newPassword }),
  };
}

export function extractSessionCookie(setCookieHeader: string[] | string | undefined): string {
  const headerValue = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  if (!headerValue) {
    throw new Error('Missing Set-Cookie header');
  }
  return headerValue.split(';')[0] ?? '';
}
