import {
  normalizeEmail,
  EmailNormalizationError,
} from '../../src/modules/identity/email-normalizer';

describe('email normalizer', () => {
  it('trims and lowercases email addresses', () => {
    expect(normalizeEmail('  Admin@Test.Local  ')).toBe('admin@test.local');
  });

  it('rejects invalid email formats', () => {
    expect(() => normalizeEmail('not-an-email')).toThrow(EmailNormalizationError);
  });
});
