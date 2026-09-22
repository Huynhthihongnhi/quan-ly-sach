import { MessagingConfigService } from '../../src/modules/messaging/messaging-config.service';

const REAL_KEY_BASE64 = Buffer.alloc(32, 7).toString('base64');
const RELEVANT_KEYS = ['NODE_ENV', 'OUTBOX_ENCRYPTION_KEY'] as const;

function withEnv(
  overrides: Partial<Record<(typeof RELEVANT_KEYS)[number], string>>,
  run: () => void,
): void {
  const previous: Record<string, string | undefined> = {};
  for (const key of RELEVANT_KEYS) {
    previous[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }
  try {
    run();
  } finally {
    for (const key of RELEVANT_KEYS) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

describe('MessagingConfigService', () => {
  it('refuses to boot under NODE_ENV=production without an explicit OUTBOX_ENCRYPTION_KEY', () => {
    withEnv({ NODE_ENV: 'production' }, () => {
      expect(() => new MessagingConfigService()).toThrow(/OUTBOX_ENCRYPTION_KEY/);
    });
  });

  it('boots under NODE_ENV=production when OUTBOX_ENCRYPTION_KEY is set explicitly', () => {
    withEnv({ NODE_ENV: 'production', OUTBOX_ENCRYPTION_KEY: REAL_KEY_BASE64 }, () => {
      expect(() => new MessagingConfigService()).not.toThrow();
    });
  });

  it('keeps the development fallback key outside production', () => {
    withEnv({ NODE_ENV: 'test' }, () => {
      const config = new MessagingConfigService();
      expect(config.outboxEncryptionKey.length).toBe(32);
    });
  });

  it('also refuses the fallback key under NODE_ENV=staging, not just NODE_ENV=production', () => {
    withEnv({ NODE_ENV: 'staging' }, () => {
      expect(() => new MessagingConfigService()).toThrow(/OUTBOX_ENCRYPTION_KEY/);
    });
  });

  it('allows the fallback key under NODE_ENV=development', () => {
    withEnv({ NODE_ENV: 'development' }, () => {
      expect(() => new MessagingConfigService()).not.toThrow();
    });
  });
});
