import { randomUUID } from 'node:crypto';
import { createConnection, Connection } from 'mysql2/promise';
import { acquireAdvisoryLock, releaseAdvisoryLock } from './advisory-lock';
import { loadMigrationCatalog, MigrationCatalogError } from './migration-catalog';
import { SchemaMigrationsRepository } from './schema-migrations.repository';
import { executeSqlFile, SqlExecutionError } from './sql-executor';
import {
  MigrationDirection,
  MigrationFilePair,
  MigrationHistoryRow,
  MigrationPlanEntry,
  MigrationRunnerConfig,
} from './types';

export class MigrationRunnerError extends Error {
  constructor(
    message: string,
    readonly errorCode: string,
  ) {
    super(message);
    this.name = 'MigrationRunnerError';
  }
}

export interface StatusReport {
  migrations: MigrationPlanEntry[];
  blocking: MigrationHistoryRow[];
  historyAvailable: boolean;
}

export interface PreviewReport {
  direction: 'up' | 'down';
  entries: MigrationPlanEntry[];
}

function toPlanEntry(
  migration: MigrationFilePair,
  direction: MigrationDirection,
  status: MigrationPlanEntry['status'],
): MigrationPlanEntry {
  return {
    version: migration.version,
    name: migration.name,
    direction,
    upChecksum: migration.upChecksum,
    downChecksum: migration.downChecksum,
    status,
  };
}

function buildPlan(
  catalog: MigrationFilePair[],
  history: MigrationHistoryRow[],
): MigrationPlanEntry[] {
  const historyByVersion = new Map(history.map((row) => [row.version, row]));

  return catalog.map((migration) => {
    const row = historyByVersion.get(migration.version);
    if (!row) {
      return toPlanEntry(migration, 'up', 'pending');
    }

    return toPlanEntry(migration, row.direction, row.state);
  });
}

function assertNoBlocking(blocking: MigrationHistoryRow[]): void {
  if (blocking.length === 0) {
    return;
  }

  const summary = blocking.map((row) => `${row.version}:${row.state}`).join(', ');
  throw new MigrationRunnerError(
    `Migration history is blocked by ${summary}`,
    'migration_history_blocked',
  );
}

function assertChecksumMatch(
  migration: MigrationFilePair,
  historyRow: MigrationHistoryRow | undefined,
): void {
  if (!historyRow || historyRow.state !== 'applied') {
    return;
  }

  if (
    historyRow.upChecksum !== migration.upChecksum ||
    historyRow.downChecksum !== migration.downChecksum
  ) {
    throw new MigrationRunnerError(
      `Checksum drift detected for migration ${migration.version}`,
      'migration_checksum_drift',
    );
  }
}

function assertTargetVersionExists(catalog: MigrationFilePair[], targetVersion: number): void {
  if (!catalog.some((migration) => migration.version === targetVersion)) {
    throw new MigrationRunnerError(
      `Target migration version ${targetVersion} does not exist`,
      'migration_target_not_found',
    );
  }
}

function selectPendingUpMigrations(
  catalog: MigrationFilePair[],
  history: MigrationHistoryRow[],
  targetVersion?: number,
): MigrationFilePair[] {
  const appliedVersions = new Set(
    history.filter((row) => row.state === 'applied').map((row) => row.version),
  );
  const pending = catalog.filter((migration) => !appliedVersions.has(migration.version));
  const selected =
    targetVersion === undefined
      ? pending
      : pending.filter((migration) => migration.version <= targetVersion);

  if (targetVersion !== undefined) {
    assertTargetVersionExists(catalog, targetVersion);
  }

  return selected;
}

function resolveDownMigration(
  catalog: MigrationFilePair[],
  applied: MigrationHistoryRow[],
  targetVersion: number,
): { migration: MigrationFilePair; appliedRow: MigrationHistoryRow } {
  const appliedRow = applied.at(-1);
  if (!appliedRow) {
    throw new MigrationRunnerError(
      'No applied migration to roll back',
      'migration_nothing_to_down',
    );
  }

  if (targetVersion !== appliedRow.version) {
    throw new MigrationRunnerError(
      `Down is only allowed for the highest applied version ${appliedRow.version}`,
      'migration_down_not_highest',
    );
  }

  const migration = catalog.find((item) => item.version === targetVersion);
  if (!migration) {
    throw new MigrationRunnerError(
      `Target migration version ${targetVersion} does not exist`,
      'migration_target_not_found',
    );
  }

  return { migration, appliedRow };
}

async function runWithFailureTracking(
  repository: SchemaMigrationsRepository,
  version: number,
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    const errorCode =
      error instanceof SqlExecutionError ? error.errorCode : 'migration_runner_failed';
    await repository.markFailed(version, new Date(), errorCode);
    throw error;
  }
}

async function withMigrationLock<T>(
  connection: Connection,
  config: MigrationRunnerConfig,
  repository: SchemaMigrationsRepository,
  handler: () => Promise<T>,
): Promise<T> {
  await acquireAdvisoryLock(connection, config.lockName, config.lockTimeoutSeconds);

  try {
    await repository.ensureTableExists();
    assertNoBlocking(await repository.findBlocking());
    return await handler();
  } finally {
    await releaseAdvisoryLock(connection, config.lockName);
  }
}

async function withConnection<T>(
  config: MigrationRunnerConfig,
  handler: (connection: Connection, repository: SchemaMigrationsRepository) => Promise<T>,
): Promise<T> {
  const connection = await createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    multipleStatements: false,
    timezone: 'Z',
  });

  try {
    const repository = new SchemaMigrationsRepository(connection);
    return await handler(connection, repository);
  } finally {
    await connection.end();
  }
}

export async function getStatus(config: MigrationRunnerConfig): Promise<StatusReport> {
  const catalog = loadMigrationCatalog(config.migrationsDir);

  return withConnection(config, async (_connection, repository) => {
    let history: MigrationHistoryRow[] = [];
    let blocking: MigrationHistoryRow[] = [];
    let historyAvailable = false;

    try {
      history = await repository.findAll();
      blocking = await repository.findBlocking();
      historyAvailable = true;
    } catch {
      historyAvailable = false;
    }

    return {
      migrations: buildPlan(catalog, history),
      blocking,
      historyAvailable,
    };
  });
}

export async function previewUp(
  config: MigrationRunnerConfig,
  targetVersion?: number,
): Promise<PreviewReport> {
  const catalog = loadMigrationCatalog(config.migrationsDir);

  return withConnection(config, async (_connection, repository) => {
    const history = await repository.findAll().catch(() => [] as MigrationHistoryRow[]);
    const selected = selectPendingUpMigrations(catalog, history, targetVersion);

    return {
      direction: 'up',
      entries: selected.map((migration) => toPlanEntry(migration, 'up', 'pending')),
    };
  });
}

export async function previewDown(
  config: MigrationRunnerConfig,
  targetVersion: number,
): Promise<PreviewReport> {
  const catalog = loadMigrationCatalog(config.migrationsDir);

  return withConnection(config, async (_connection, repository) => {
    const applied = await repository.findApplied();
    const { migration } = resolveDownMigration(catalog, applied, targetVersion);

    return {
      direction: 'down',
      entries: [toPlanEntry(migration, 'down', 'applied')],
    };
  });
}

export async function migrateUp(
  config: MigrationRunnerConfig,
  targetVersion?: number,
): Promise<PreviewReport> {
  const catalog = loadMigrationCatalog(config.migrationsDir);

  return withConnection(config, async (connection, repository) =>
    withMigrationLock(connection, config, repository, async () => {
      const history = await repository.findAll();
      const historyByVersion = new Map(history.map((row) => [row.version, row]));

      for (const migration of catalog) {
        assertChecksumMatch(migration, historyByVersion.get(migration.version));
      }

      const selected = selectPendingUpMigrations(catalog, history, targetVersion);
      const runnerId = randomUUID();

      for (const migration of selected) {
        const startedAt = new Date();
        await repository.beginAttempt({
          version: migration.version,
          name: migration.name,
          upChecksum: migration.upChecksum,
          downChecksum: migration.downChecksum,
          direction: 'up',
          runnerId,
          startedAt,
        });

        await runWithFailureTracking(repository, migration.version, async () => {
          await executeSqlFile(connection, migration.upPath);
          await repository.markApplied(migration.version, new Date());
        });
      }

      return {
        direction: 'up',
        entries: selected.map((migration) => toPlanEntry(migration, 'up', 'applied')),
      };
    }),
  );
}

export async function migrateDown(
  config: MigrationRunnerConfig,
  targetVersion: number,
  confirmDataLoss: boolean,
): Promise<PreviewReport> {
  if (!confirmDataLoss) {
    throw new MigrationRunnerError(
      'Down requires explicit confirmation because it may destroy data',
      'migration_down_requires_confirm',
    );
  }

  const catalog = loadMigrationCatalog(config.migrationsDir);

  return withConnection(config, async (connection, repository) =>
    withMigrationLock(connection, config, repository, async () => {
      const applied = await repository.findApplied();
      const { migration, appliedRow } = resolveDownMigration(catalog, applied, targetVersion);

      assertChecksumMatch(migration, appliedRow);

      const runnerId = randomUUID();
      const startedAt = new Date();
      await repository.beginAttempt({
        version: migration.version,
        name: migration.name,
        upChecksum: migration.upChecksum,
        downChecksum: migration.downChecksum,
        direction: 'down',
        runnerId,
        startedAt,
      });

      await runWithFailureTracking(repository, migration.version, async () => {
        await executeSqlFile(connection, migration.downPath);
        await repository.markRolledBack(migration.version, new Date());
      });

      return {
        direction: 'down',
        entries: [toPlanEntry(migration, 'down', 'rolled_back')],
      };
    }),
  );
}

export { MigrationCatalogError };
