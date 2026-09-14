import { resolve } from 'node:path';
import { createConnection } from 'mysql2/promise';
import { migrateUp } from '../../../src/tools/migration-runner/runner';
import { createMigrationRunnerConfig } from '../migration-runner/create-runner-config';

export async function resetIdentityState(): Promise<void> {
  const connection = await createConnection({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_MIGRATION_USERNAME ?? 'migration',
    password: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
    database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
    multipleStatements: true,
  });

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('DELETE FROM notification_deliveries');
    await connection.query('DELETE FROM loan_events');
    await connection.query('DELETE FROM loans');
    await connection.query('DELETE FROM digital_assets');
    await connection.query('DELETE FROM library_cards');
    await connection.query('DELETE FROM book_copies');
    await connection.query('DELETE FROM book_topics');
    await connection.query('DELETE FROM book_authors');
    await connection.query('DELETE FROM books');
    await connection.query('DELETE FROM topics');
    await connection.query('DELETE FROM authors');
    await connection.query('DELETE FROM categories');
    await connection.query('DELETE FROM rate_limit_buckets');
    await connection.query('DELETE FROM email_outbox');
    await connection.query('DELETE FROM identity_challenges');
    await connection.query('DELETE FROM auth_sessions');
    await connection.query('DELETE FROM audit_events');
    await connection.query('DELETE FROM user_roles');
    await connection.query('DELETE FROM role_permissions');
    await connection.query('DELETE FROM profiles');
    await connection.query('DELETE FROM users');
    await connection.query('DELETE FROM permissions');
    await connection.query('DELETE FROM roles');
    await connection.query(
      'INSERT INTO iam_policy_locks (id, version) VALUES (1, 1) ON DUPLICATE KEY UPDATE version = 1',
    );
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await Promise.resolve(connection.end());
  }
}

export async function resetAppSchemaTables(): Promise<void> {
  const connection = await createConnection({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_MIGRATION_USERNAME ?? 'migration',
    password: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
    database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
    multipleStatements: true,
  });

  try {
    await dropAppAndProbeTables(connection);
  } finally {
    await Promise.resolve(connection.end());
  }
}

async function dropAppAndProbeTables(
  connection: Awaited<ReturnType<typeof createConnection>>,
): Promise<void> {
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  await connection.query(`
    DROP TABLE IF EXISTS notification_deliveries;
    DROP TABLE IF EXISTS loan_events;
    DROP TABLE IF EXISTS loans;
    DROP TABLE IF EXISTS digital_assets;
    DROP TABLE IF EXISTS library_cards;
    DROP TABLE IF EXISTS book_copies;
    DROP TABLE IF EXISTS book_topics;
    DROP TABLE IF EXISTS book_authors;
    DROP TABLE IF EXISTS books;
    DROP TABLE IF EXISTS topics;
    DROP TABLE IF EXISTS authors;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS email_outbox;
    DROP TABLE IF EXISTS identity_challenges;
    DROP TABLE IF EXISTS rate_limit_buckets;
    DROP TABLE IF EXISTS auth_sessions;
    DROP TABLE IF EXISTS audit_events;
    DROP TABLE IF EXISTS user_roles;
    DROP TABLE IF EXISTS role_permissions;
    DROP TABLE IF EXISTS profiles;
    DROP TABLE IF EXISTS iam_policy_locks;
    DROP TABLE IF EXISTS permissions;
    DROP TABLE IF EXISTS roles;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS this_statement_will_fail_because_table_already_exists;
    DROP TABLE IF EXISTS runner_probe_beta;
    DROP TABLE IF EXISTS runner_probe_alpha;
  `);
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function repairBlockingAppMigrations(): Promise<void> {
  const connection = await createConnection({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_MIGRATION_USERNAME ?? 'migration',
    password: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
    database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
    multipleStatements: true,
  });

  try {
    const [tables] = (await connection.query(
      `SELECT TABLE_NAME AS table_name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'schema_migrations'`,
      [process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test'],
    )) as [Array<{ table_name: string }>, unknown];

    if (tables.length === 0) {
      const usersExists = await tableExists(connection, 'users');
      const probeExists = await tableExists(connection, 'runner_probe_alpha');
      if (usersExists || probeExists) {
        await dropAppAndProbeTables(connection);
      }
      return;
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query(`DELETE FROM schema_migrations WHERE state IN ('failed', 'running')`);

    const [appliedRows] = (await connection.query(
      `SELECT version, state FROM schema_migrations WHERE version >= 3 ORDER BY version ASC`,
    )) as [Array<{ version: number; state: string }>, unknown];
    const appliedVersions = new Set(
      appliedRows.filter((row) => row.state === 'applied').map((row) => row.version),
    );
    const usersExists = await tableExists(connection, 'users');
    const outboxExists = await tableExists(connection, 'email_outbox');
    const booksExists = await tableExists(connection, 'books');
    const cardsExists = await tableExists(connection, 'library_cards');
    const digitalExists = await tableExists(connection, 'digital_assets');
    const loansExists = await tableExists(connection, 'loans');
    const appMigrationsApplied =
      appliedVersions.has(3) &&
      appliedVersions.has(4) &&
      appliedVersions.has(5) &&
      appliedVersions.has(6) &&
      appliedVersions.has(7) &&
      appliedVersions.has(8) &&
      appliedVersions.has(9);
    const needsAppSchemaReset =
      !appMigrationsApplied ||
      usersExists !== appliedVersions.has(3) ||
      outboxExists !== appliedVersions.has(5) ||
      booksExists !== appliedVersions.has(6) ||
      cardsExists !== appliedVersions.has(7) ||
      digitalExists !== appliedVersions.has(8) ||
      loansExists !== appliedVersions.has(9) ||
      (await tableExists(connection, 'this_statement_will_fail_because_table_already_exists'));

    if (needsAppSchemaReset) {
      await dropAppAndProbeTables(connection);
      await connection.query(`DELETE FROM schema_migrations WHERE version >= 3`);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await Promise.resolve(connection.end());
  }
}

async function tableExists(
  connection: Awaited<ReturnType<typeof createConnection>>,
  tableName: string,
): Promise<boolean> {
  const [rows] = (await connection.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test', tableName],
  )) as [Array<{ count: number }>, unknown];
  return Number(rows[0]?.count ?? 0) > 0;
}

export async function applyIdentityMigrations(): Promise<void> {
  await repairBlockingAppMigrations();
  const config = createMigrationRunnerConfig(resolve(__dirname, '../../../migrations'));
  await migrateUp(config, 9);
}
