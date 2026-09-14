import { resolve } from 'node:path';
import { createConnection, type RowDataPacket } from 'mysql2/promise';
import { migrateDown, migrateUp } from '../../src/tools/migration-runner/runner';
import {
  applyIdentityMigrations,
  resetAppSchemaTables,
} from '../support/identity/reset-identity-state';
import { createMigrationRunnerConfig } from '../support/migration-runner/create-runner-config';
import { resetRunnerState } from '../support/migration-runner/reset-runner-state';

const acceptanceEnabled = process.env.ACCEPTANCE_TESTS === '1';
const describeAcceptance = acceptanceEnabled ? describe : describe.skip;

async function tableExists(tableName: string): Promise<boolean> {
  const connection = await createConnection({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_MIGRATION_USERNAME ?? 'migration',
    password: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
    database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
  });

  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test', tableName],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  } finally {
    await connection.end();
  }
}

describeAcceptance('TST-S1-07 IAM migration up/down/up roundtrip', () => {
  const config = createMigrationRunnerConfig(resolve(__dirname, '../../migrations'));

  beforeEach(async () => {
    await resetRunnerState();
    await resetAppSchemaTables();
    await migrateUp(config, 2);
  });

  afterAll(async () => {
    await applyIdentityMigrations();
  });

  it('applies identity and auth migrations, rolls them back, then reapplies', async () => {
    await migrateUp(config, 4);
    expect(await tableExists('users')).toBe(true);
    expect(await tableExists('auth_sessions')).toBe(true);

    await migrateDown(config, 4, true);
    expect(await tableExists('auth_sessions')).toBe(false);
    expect(await tableExists('users')).toBe(true);

    await migrateDown(config, 3, true);
    expect(await tableExists('users')).toBe(false);
    expect(await tableExists('roles')).toBe(false);

    await migrateUp(config, 4);
    expect(await tableExists('users')).toBe(true);
    expect(await tableExists('auth_sessions')).toBe(true);
    expect(await tableExists('audit_events')).toBe(true);
  });
});
