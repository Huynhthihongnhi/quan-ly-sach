import {
  isSensitiveAuditKey,
  sanitizeAuditDetails,
} from '../../src/modules/audit/sanitize-audit-details';

describe('sanitizeAuditDetails', () => {
  it('redacts sensitive keys recursively', () => {
    const sanitized = sanitizeAuditDetails({
      email: 'admin@test.local',
      password: 'secret-value',
      nested: {
        sessionToken: 'abc',
        reason: 'invalid',
      },
      items: [{ resetToken: 'token-1' }],
    });

    expect(sanitized).toEqual({
      email: 'admin@test.local',
      password: '[REDACTED]',
      nested: {
        sessionToken: '[REDACTED]',
        reason: 'invalid',
      },
      items: [{ resetToken: '[REDACTED]' }],
    });
  });

  it('returns null for null details', () => {
    expect(sanitizeAuditDetails(null)).toBeNull();
  });

  it('detects common sensitive key names', () => {
    expect(isSensitiveAuditKey('passwordHash')).toBe(true);
    expect(isSensitiveAuditKey('csrfToken')).toBe(true);
    expect(isSensitiveAuditKey('email')).toBe(false);
  });
});
