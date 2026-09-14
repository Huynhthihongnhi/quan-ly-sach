import { resolve } from 'node:path';
import { MigrationRunnerConfig } from './types';
import { resolveMigrationsDir } from './migration-catalog';

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }
  return parsed;
}

export function loadMigrationRunnerConfig(workingDir = process.cwd()): MigrationRunnerConfig {
  const migrationsDir = resolveMigrationsDir(
    process.env.MIGRATIONS_DIR ?? 'migrations',
    workingDir,
  );

  return {
    host: process.env.DATABASE_MIGRATION_HOST ?? readRequired('DATABASE_HOST'),
    port: readNumber('DATABASE_MIGRATION_PORT', readNumber('DATABASE_PORT', 3306)),
    username:
      process.env.DATABASE_MIGRATION_USERNAME ?? process.env.DATABASE_MIGRATION_USER ?? 'migration',
    password: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
    database:
      process.env.DATABASE_MIGRATION_NAME ??
      process.env.DATABASE_TEST_NAME ??
      process.env.DATABASE_NAME ??
      'quan_ly_sach_test',
    migrationsDir,
    lockName: process.env.MIGRATION_LOCK_NAME ?? 'quan-ly-sach-migration',
    lockTimeoutSeconds: readNumber('MIGRATION_LOCK_TIMEOUT_SECONDS', 30),
  };
}

export function beWorkingDirectory(): string {
  return resolve(__dirname, '../../..');
}
