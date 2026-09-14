import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createConnection, type Connection, type RowDataPacket } from 'mysql2/promise';
import { DataSource } from 'typeorm';
import {
  loadMigrationCatalog,
  MigrationCatalogError,
} from '../../src/tools/migration-runner/migration-catalog';
import {
  getStatus,
  migrateDown,
  migrateUp,
  previewUp,
} from '../../src/tools/migration-runner/runner';
import { AdvisoryLockError } from '../../src/tools/migration-runner/advisory-lock';
import {
  createMigrationRunnerConfig,
  fixtureMigrationsDir,
} from '../support/migration-runner/create-runner-config';
import { resetRunnerState } from '../support/migration-runner/reset-runner-state';

const integrationEnabled = process.env.INTEGRATION_TESTS === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('TST-S0-06 migration runner on MySQL test database', () => {
  let rawConnection: Connection;

  beforeAll(async () => {
    rawConnection = await createConnection({
      host: process.env.DATABASE_HOST ?? '127.0.0.1',
      port: Number(process.env.DATABASE_PORT ?? 3306),
      user: process.env.DATABASE_MIGRATION_USERNAME ?? 'migration',
      password: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
      database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
    });
  }, 60_000);

  beforeEach(async () => {
    await resetRunnerState();
  });

  afterAll(async () => {
    await resetRunnerState();
    await rawConnection.end();
  });

  it('reports absent history on status without creating schema_migrations', async () => {
    const config = createMigrationRunnerConfig(fixtureMigrationsDir('valid'));
    const status = await getStatus(config);

    expect(status.historyAvailable).toBe(false);
    expect(status.migrations.every((entry) => entry.status === 'pending')).toBe(true);

    const [tables] = await rawConnection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'schema_migrations'`,
      [config.database],
    );
    expect(tables).toHaveLength(0);
  });

  it('does not write history or tables on preview', async () => {
    const config = createMigrationRunnerConfig(fixtureMigrationsDir('valid'));
    const preview = await previewUp(config, 2);

    expect(preview.entries).toHaveLength(2);

    const [tables] = await rawConnection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('schema_migrations', 'runner_probe_alpha', 'runner_probe_beta')`,
      [config.database],
    );
    expect(tables).toHaveLength(0);
  });

  it('applies up migrations once with version and checksum history, then skips repeats', async () => {
    const config = createMigrationRunnerConfig(fixtureMigrationsDir('valid'));

    const firstRun = await migrateUp(config, 2);
    expect(firstRun.entries.map((entry) => entry.version)).toEqual([1, 2]);

    const [historyRows] = await rawConnection.query<RowDataPacket[]>(
      `SELECT version, state, CHAR_LENGTH(up_checksum) AS checksum_length
       FROM schema_migrations
       ORDER BY version ASC`,
    );
    expect(historyRows).toHaveLength(2);
    expect(historyRows[0]?.state).toBe('applied');
    expect(historyRows[1]?.state).toBe('applied');
    expect(Number(historyRows[0]?.checksum_length)).toBe(64);

    const secondRun = await migrateUp(config, 2);
    expect(secondRun.entries).toHaveLength(0);
  });

  it('rejects missing down pairs and invalid targets', async () => {
    expect(() => loadMigrationCatalog(fixtureMigrationsDir('missing-down'))).toThrow(
      MigrationCatalogError,
    );

    const config = createMigrationRunnerConfig(fixtureMigrationsDir('valid'));
    await expect(previewUp(config, 999)).rejects.toMatchObject({
      errorCode: 'migration_target_not_found',
    });
  });

  it('blocks when checksum drift is detected for an applied migration', async () => {
    const config = createMigrationRunnerConfig(fixtureMigrationsDir('valid'));
    await migrateUp(config, 1);

    const upFile = join(fixtureMigrationsDir('valid'), '000001_runner_probe_alpha.up.sql');
    const original = readFileSync(upFile, 'utf8');
    writeFileSync(upFile, `${original}\n-- drift`);

    try {
      await expect(migrateUp(config, 2)).rejects.toMatchObject({
        errorCode: 'migration_checksum_drift',
      });
    } finally {
      writeFileSync(upFile, original);
    }
  });

  it('marks failed migration after partial DDL and blocks later versions', async () => {
    const config = createMigrationRunnerConfig(fixtureMigrationsDir('broken-second-statement'));

    await expect(migrateUp(config, 2)).rejects.toBeTruthy();

    const [historyRows] = await rawConnection.query<RowDataPacket[]>(
      `SELECT version, state FROM schema_migrations ORDER BY version ASC`,
    );
    expect(historyRows).toEqual([
      { version: 1, state: 'applied' },
      { version: 2, state: 'failed' },
    ]);

    const [betaTables] = await rawConnection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'runner_probe_beta'`,
      [config.database],
    );
    expect(betaTables).toHaveLength(1);

    await expect(migrateUp(config, 2)).rejects.toMatchObject({
      errorCode: 'migration_history_blocked',
    });
  });

  it('requires confirmation before down and only rolls back the highest applied version', async () => {
    const config = createMigrationRunnerConfig(fixtureMigrationsDir('valid'));
    await migrateUp(config, 2);

    await expect(migrateDown(config, 2, false)).rejects.toMatchObject({
      errorCode: 'migration_down_requires_confirm',
    });

    await expect(migrateDown(config, 1, true)).rejects.toMatchObject({
      errorCode: 'migration_down_not_highest',
    });

    const downReport = await migrateDown(config, 2, true);
    expect(downReport.entries[0]?.status).toBe('rolled_back');

    const [historyRows] = await rawConnection.query<RowDataPacket[]>(
      `SELECT version, state FROM schema_migrations ORDER BY version ASC`,
    );
    expect(historyRows).toEqual([
      { version: 1, state: 'applied' },
      { version: 2, state: 'rolled_back' },
    ]);
  });

  it('allows only one concurrent runner to acquire the migration lock', async () => {
    const config = {
      ...createMigrationRunnerConfig(fixtureMigrationsDir('valid')),
      lockName: 'quan-ly-sach-migration-concurrency-test',
      lockTimeoutSeconds: 1,
    };

    const lockHolder = await createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
    });

    try {
      await lockHolder.query(`SELECT GET_LOCK(?, 5)`, [config.lockName]);
      await expect(migrateUp(config, 1)).rejects.toBeInstanceOf(AdvisoryLockError);
    } finally {
      await lockHolder.query(`SELECT RELEASE_LOCK(?)`, [config.lockName]);
      await lockHolder.end();
    }
  });

  it('does not mutate schema or history when ORM starts after migration', async () => {
    const config = createMigrationRunnerConfig(fixtureMigrationsDir('valid'));
    await migrateUp(config, 1);

    const [historyBefore] = await rawConnection.query<RowDataPacket[]>(
      `SELECT version, state FROM schema_migrations ORDER BY version ASC`,
    );

    const dataSource = new DataSource({
      type: 'mysql',
      host: config.host,
      port: config.port,
      username: process.env.DATABASE_USERNAME ?? 'app',
      password: process.env.DATABASE_PASSWORD ?? 'local-app-change-me',
      database: config.database,
      synchronize: false,
      migrationsRun: false,
      entities: [],
    });

    await dataSource.initialize();
    await dataSource.destroy();

    const [historyAfter] = await rawConnection.query<RowDataPacket[]>(
      `SELECT version, state FROM schema_migrations ORDER BY version ASC`,
    );
    expect(historyAfter).toEqual(historyBefore);
  });
});
