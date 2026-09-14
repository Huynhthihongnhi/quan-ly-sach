import { resolve } from 'node:path';
import { MigrationRunnerConfig } from '../../../src/tools/migration-runner/types';

export function createMigrationRunnerConfig(migrationsDir: string): MigrationRunnerConfig {
  return {
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    username: process.env.DATABASE_MIGRATION_USERNAME ?? 'migration',
    password: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
    database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
    migrationsDir: resolve(migrationsDir),
    lockName: `quan-ly-sach-migration-test-${process.pid}`,
    lockTimeoutSeconds: 5,
  };
}

export function fixtureMigrationsDir(name: string): string {
  return resolve(__dirname, '../../fixtures/migration-runner', name);
}
