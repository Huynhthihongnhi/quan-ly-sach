import { createConnection, type Connection } from 'mysql2/promise';
import { getDatabaseTestConfig } from './database-test-config';

export async function createRuntimeConnection(): Promise<Connection> {
  const config = getDatabaseTestConfig();
  return createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
  });
}

export async function withDualRuntimeConnections<T>(
  run: (first: Connection, second: Connection) => Promise<T>,
): Promise<T> {
  const first = await createRuntimeConnection();
  const second = await createRuntimeConnection();

  try {
    return await run(first, second);
  } finally {
    await Promise.all([first.end(), second.end()]);
  }
}
