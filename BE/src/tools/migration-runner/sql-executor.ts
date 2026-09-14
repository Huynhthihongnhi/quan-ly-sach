import { readFileSync } from 'node:fs';
import { Connection } from 'mysql2/promise';

export class SqlExecutionError extends Error {
  constructor(
    message: string,
    readonly errorCode: string,
  ) {
    super(message);
    this.name = 'SqlExecutionError';
  }
}

export async function executeSqlFile(connection: Connection, filePath: string): Promise<void> {
  const sql = readFileSync(filePath, 'utf8');
  const statements = splitSqlStatements(sql);

  for (const statement of statements) {
    try {
      await connection.query(statement);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SqlExecutionError(message, 'migration_sql_failed');
    }
  }
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith('--'));
}
