const SENSITIVE_KEY_PATTERN =
  /(?:password|passwd|secret|token|session|csrf|cookie|credential|reset|hash|api[_-]?key)/i;

export function isSensitiveAuditKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

export function sanitizeAuditDetails(
  details: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (details === null) {
    return null;
  }

  return sanitizeValue(details) as Record<string, unknown>;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveAuditKey(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }
      sanitized[key] = sanitizeValue(nested);
    }
    return sanitized;
  }

  return value;
}
