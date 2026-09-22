const RELEVANT_KEYS = [
  'NODE_ENV',
  'DATABASE_HOST',
  'DATABASE_MIGRATION_HOST',
  'DATABASE_MIGRATION_USERNAME',
  'DATABASE_MIGRATION_PASSWORD',
  'DATABASE_MIGRATION_NAME',
] as const;

async function withEnv(
  overrides: Partial<Record<(typeof RELEVANT_KEYS)[number], string>>,
  run: () => Promise<void>,
): Promise<void> {
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
    await run();
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

async function loadConfig() {
  jest.resetModules();
  const { loadMigrationRunnerConfig } = await import('../../src/tools/migration-runner/config');
  return loadMigrationRunnerConfig;
}

describe('loadMigrationRunnerConfig', () => {
  it('refuses the built-in fallback migration password outside development/test', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        DATABASE_HOST: '127.0.0.1',
        DATABASE_MIGRATION_USERNAME: 'migration',
      },
      async () => {
        const loadMigrationRunnerConfig = await loadConfig();
        expect(() => loadMigrationRunnerConfig()).toThrow(/DATABASE_MIGRATION_PASSWORD/);
      },
    );
  });

  it('allows the built-in fallback migration password under NODE_ENV=test, matching local/CI runs', async () => {
    await withEnv(
      { NODE_ENV: 'test', DATABASE_HOST: '127.0.0.1', DATABASE_MIGRATION_USERNAME: 'migration' },
      async () => {
        const loadMigrationRunnerConfig = await loadConfig();
        expect(() => loadMigrationRunnerConfig()).not.toThrow();
      },
    );
  });

  it('accepts an explicit DATABASE_MIGRATION_PASSWORD under NODE_ENV=production', async () => {
    await withEnv(
      {
        NODE_ENV: 'production',
        DATABASE_HOST: '127.0.0.1',
        DATABASE_MIGRATION_USERNAME: 'migration',
        DATABASE_MIGRATION_PASSWORD: 'a-real-migration-password',
      },
      async () => {
        const loadMigrationRunnerConfig = await loadConfig();
        expect(() => loadMigrationRunnerConfig()).not.toThrow();
      },
    );
  });
});
