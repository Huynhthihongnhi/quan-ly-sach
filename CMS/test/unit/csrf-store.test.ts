import { afterEach, describe, expect, it } from 'vitest';

import { getCsrfToken, setCsrfToken, clearCsrfToken, resetCsrfStore } from 'src/lib/csrf-store';

afterEach(() => resetCsrfStore());

describe('csrf-store', () => {
  it('stores and returns a token', () => {
    setCsrfToken('abc');
    expect(getCsrfToken()).toBe('abc');
  });

  it('treats an empty string as no token', () => {
    setCsrfToken('');
    expect(getCsrfToken()).toBeNull();
  });

  it('clears the token', () => {
    setCsrfToken('abc');
    clearCsrfToken();
    expect(getCsrfToken()).toBeNull();
  });
});
