import { Connection, RowDataPacket } from 'mysql2/promise';
import { MigrationDirection, MigrationHistoryRow, MigrationState } from './types';

interface HistoryRowPacket extends RowDataPacket {
  version: number;
  name: string;
  up_checksum: string;
  down_checksum: string;
  state: MigrationState;
  direction: MigrationDirection;
  runner_id: string;
  started_at: Date;
  finished_at: Date | null;
  error_code: string | null;
}

const HISTORY_COLUMNS =
  'version, name, up_checksum, down_checksum, state, direction, runner_id, started_at, finished_at, error_code';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version BIGINT UNSIGNED NOT NULL,
  name VARCHAR(191) NOT NULL,
  up_checksum CHAR(64) NOT NULL,
  down_checksum CHAR(64) NOT NULL,
  state ENUM('running', 'applied', 'failed', 'rolled_back') NOT NULL,
  direction ENUM('up', 'down') NOT NULL,
  runner_id CHAR(36) NOT NULL,
  started_at DATETIME(6) NOT NULL,
  finished_at DATETIME(6) NULL,
  error_code VARCHAR(64) NULL,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

function mapRow(row: HistoryRowPacket): MigrationHistoryRow {
  return {
    version: Number(row.version),
    name: row.name,
    upChecksum: row.up_checksum,
    downChecksum: row.down_checksum,
    state: row.state,
    direction: row.direction,
    runnerId: row.runner_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    errorCode: row.error_code,
  };
}

export class SchemaMigrationsRepository {
  constructor(private readonly connection: Connection) {}

  async ensureTableExists(): Promise<void> {
    await this.connection.query(CREATE_TABLE_SQL);
  }

  async findAll(): Promise<MigrationHistoryRow[]> {
    const [rows] = await this.connection.query<HistoryRowPacket[]>(
      `SELECT ${HISTORY_COLUMNS} FROM schema_migrations ORDER BY version ASC`,
    );
    return rows.map(mapRow);
  }

  async findByVersion(version: number): Promise<MigrationHistoryRow | null> {
    const [rows] = await this.connection.query<HistoryRowPacket[]>(
      `SELECT ${HISTORY_COLUMNS} FROM schema_migrations WHERE version = ?`,
      [version],
    );
    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  async findApplied(): Promise<MigrationHistoryRow[]> {
    const [rows] = await this.connection.query<HistoryRowPacket[]>(
      `SELECT ${HISTORY_COLUMNS} FROM schema_migrations WHERE state = 'applied' ORDER BY version ASC`,
    );
    return rows.map(mapRow);
  }

  async findBlocking(): Promise<MigrationHistoryRow[]> {
    const [rows] = await this.connection.query<HistoryRowPacket[]>(
      `SELECT ${HISTORY_COLUMNS} FROM schema_migrations WHERE state IN ('running', 'failed') ORDER BY version ASC`,
    );
    return rows.map(mapRow);
  }

  async beginAttempt(params: {
    version: number;
    name: string;
    upChecksum: string;
    downChecksum: string;
    direction: MigrationDirection;
    runnerId: string;
    startedAt: Date;
  }): Promise<void> {
    const existing = await this.findByVersion(params.version);

    if (!existing) {
      await this.connection.query(
        `INSERT INTO schema_migrations
          (version, name, up_checksum, down_checksum, state, direction, runner_id, started_at, finished_at, error_code)
         VALUES (?, ?, ?, ?, 'running', ?, ?, ?, NULL, NULL)`,
        [
          params.version,
          params.name,
          params.upChecksum,
          params.downChecksum,
          params.direction,
          params.runnerId,
          params.startedAt,
        ],
      );
      return;
    }

    if (existing.state === 'rolled_back' && params.direction === 'up') {
      await this.deleteVersion(params.version);
      await this.beginAttempt(params);
      return;
    }

    if (existing.state === 'applied' && params.direction === 'down') {
      await this.connection.query(
        `UPDATE schema_migrations
         SET state = 'running',
             direction = ?,
             runner_id = ?,
             started_at = ?,
             finished_at = NULL,
             error_code = NULL,
             up_checksum = ?,
             down_checksum = ?
         WHERE version = ?`,
        [
          params.direction,
          params.runnerId,
          params.startedAt,
          params.upChecksum,
          params.downChecksum,
          params.version,
        ],
      );
      return;
    }

    throw new Error(
      `Migration ${params.version} cannot start from state ${existing.state} for direction ${params.direction}`,
    );
  }

  async markApplied(version: number, finishedAt: Date): Promise<void> {
    await this.connection.query(
      `UPDATE schema_migrations
       SET state = 'applied', finished_at = ?, error_code = NULL
       WHERE version = ?`,
      [finishedAt, version],
    );
  }

  async markFailed(version: number, finishedAt: Date, errorCode: string): Promise<void> {
    await this.connection.query(
      `UPDATE schema_migrations
       SET state = 'failed', finished_at = ?, error_code = ?
       WHERE version = ?`,
      [finishedAt, errorCode, version],
    );
  }

  async markRolledBack(version: number, finishedAt: Date): Promise<void> {
    await this.connection.query(
      `UPDATE schema_migrations
       SET state = 'rolled_back', finished_at = ?, error_code = NULL
       WHERE version = ?`,
      [finishedAt, version],
    );
  }

  async deleteVersion(version: number): Promise<void> {
    await this.connection.query(`DELETE FROM schema_migrations WHERE version = ?`, [version]);
  }
}
