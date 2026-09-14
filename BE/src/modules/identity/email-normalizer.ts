const EMAIL_MAX_LENGTH = 254;

export class EmailNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailNormalizationError';
  }
}

export function normalizeEmail(rawEmail: string): string {
  const trimmed = rawEmail.trim();
  if (!trimmed) {
    throw new EmailNormalizationError('Email is required');
  }

  const normalized = trimmed.toLowerCase();
  if (normalized.length > EMAIL_MAX_LENGTH) {
    throw new EmailNormalizationError('Email exceeds maximum length');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new EmailNormalizationError('Email format is invalid');
  }

  return normalized;
}
