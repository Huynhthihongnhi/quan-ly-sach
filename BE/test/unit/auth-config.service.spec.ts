import { AuthConfigService } from '../../src/modules/auth/auth-config.service';

function buildConfigGetter(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = { NODE_ENV: 'test', ...overrides };
  return { get: (key: string) => values[key] } as never;
}

describe('AuthConfigService', () => {
  it('refuses to boot under NODE_ENV=production without an explicit CSRF_HMAC_SECRET', () => {
    expect(() => new AuthConfigService(buildConfigGetter({ NODE_ENV: 'production' }))).toThrow(
      /CSRF_HMAC_SECRET/,
    );
  });

  it('refuses to boot under NODE_ENV=production without an explicit RATE_LIMIT_HMAC_SECRET', () => {
    expect(
      () =>
        new AuthConfigService(
          buildConfigGetter({ NODE_ENV: 'production', CSRF_HMAC_SECRET: 'real-csrf-secret' }),
        ),
    ).toThrow(/RATE_LIMIT_HMAC_SECRET/);
  });

  it('boots under NODE_ENV=production when both secrets are set explicitly', () => {
    expect(
      () =>
        new AuthConfigService(
          buildConfigGetter({
            NODE_ENV: 'production',
            CSRF_HMAC_SECRET: 'real-csrf-secret',
            RATE_LIMIT_HMAC_SECRET: 'real-rate-limit-secret',
          }),
        ),
    ).not.toThrow();
  });

  it('keeps the development fallback secrets outside production', () => {
    const config = new AuthConfigService(buildConfigGetter());
    expect(config.csrfHmacSecret).toBe('local-dev-csrf-secret');
    expect(config.rateLimitHmacSecret).toBe('local-dev-rate-limit-secret');
  });

  it('also refuses the fallback secrets under NODE_ENV=staging, not just NODE_ENV=production', () => {
    expect(() => new AuthConfigService(buildConfigGetter({ NODE_ENV: 'staging' }))).toThrow(
      /CSRF_HMAC_SECRET/,
    );
  });

  it('allows the fallback secrets under NODE_ENV=development', () => {
    const config = new AuthConfigService(buildConfigGetter({ NODE_ENV: 'development' }));
    expect(config.csrfHmacSecret).toBe('local-dev-csrf-secret');
  });
});
