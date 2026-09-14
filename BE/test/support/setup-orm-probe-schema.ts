import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createConnection, type Connection } from 'mysql2/promise';
import { getDatabaseTestConfig } from './database-test-config';

const sqlDir = resolve(__dirname, 'sql');

function readSql(fileName: string): string {
  return readFileSync(resolve(sqlDir, fileName), 'utf8');
}

export async function withMigrationConnection<T>(
  run: (connection: Connection) => Promise<T>,
): Promise<T> {
  const config = getDatabaseTestConfig();
  const connection = await createConnection({
    host: config.host,
    port: config.port,
    user: config.migrationUsername,
    password: config.migrationPassword,
    database: config.database,
    multipleStatements: true,
  });

  try {
    return await run(connection);
  } finally {
    await connection.end();
  }
}

export async function applyOrmProbeSchema(): Promise<void> {
  const sql = readSql('orm-probe-up.sql');
  await withMigrationConnection(async (connection) => {
    await connection.query(sql);
  });
}

export async function dropOrmProbeSchema(): Promise<void> {
  const sql = readSql('orm-probe-down.sql');
  await withMigrationConnection(async (connection) => {
    await connection.query(sql);
  });
}

export async function truncateOrmProbeTables(connection: Connection): Promise<void> {
  await connection.query('DELETE FROM orm_probe_events');
  await connection.query('DELETE FROM orm_probe_records');
}
