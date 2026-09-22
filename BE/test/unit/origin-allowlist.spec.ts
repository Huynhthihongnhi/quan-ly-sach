import { isOriginAllowed } from '../../src/modules/auth/origin-allowlist';

describe('isOriginAllowed', () => {
  const allowed = [
    'http://localhost:8081',
    'https://*.trycloudflare.com',
  ] as const;

  it('accepts exact origins', () => {
    expect(isOriginAllowed('http://localhost:8081', allowed)).toBe(true);
  });

  it('accepts https trycloudflare quick tunnel hosts', () => {
    expect(
      isOriginAllowed('https://recordings-weekends-lady-karaoke.trycloudflare.com', allowed),
    ).toBe(true);
  });

  it('rejects unknown origins', () => {
    expect(isOriginAllowed('https://evil.example.com', allowed)).toBe(false);
  });

  it('rejects bare host wildcard over http', () => {
    expect(isOriginAllowed('http://foo.trycloudflare.com', ['*.trycloudflare.com'])).toBe(false);
  });

  it('accepts bare host wildcard over https', () => {
    expect(isOriginAllowed('https://foo.trycloudflare.com', ['*.trycloudflare.com'])).toBe(true);
  });
});
