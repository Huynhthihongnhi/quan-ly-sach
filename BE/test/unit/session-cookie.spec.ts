import { buildSessionCookie } from '../../src/modules/auth/cookie.util';

describe('session cookie builder', () => {
  it('includes Secure attribute in production mode', () => {
    const cookie = buildSessionCookie('__Host-library-session', Buffer.from('abc'), 3600000, true);
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });
});
