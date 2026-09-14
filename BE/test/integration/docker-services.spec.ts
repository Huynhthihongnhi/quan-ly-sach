import { createConnection, type Connection, type RowDataPacket } from 'mysql2/promise';
import net from 'node:net';

const integrationEnabled = process.env.INTEGRATION_TESTS === '1';

const databaseConfig = {
  host: process.env.DATABASE_HOST ?? '127.0.0.1',
  port: Number(process.env.DATABASE_PORT ?? 3306),
  user: process.env.DATABASE_USERNAME ?? 'app',
  password: process.env.DATABASE_PASSWORD ?? 'local-app-change-me',
  database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
};

const mailHost = process.env.MAIL_HOST ?? '127.0.0.1';
const mailPort = Number(process.env.MAIL_PORT ?? 1025);

const probeTcp = (host: string, port: number, timeoutMs = 3000): Promise<void> =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`TCP probe timed out for ${host}:${port}`));
    }, timeoutMs);

    socket.once('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve();
    });

    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('TST-S0-03 docker local services', () => {
  let connection: Connection;

  beforeAll(async () => {
    connection = await createConnection(databaseConfig);
  }, 30_000);

  afterAll(async () => {
    await connection.end();
  });

  it('connects to MySQL with the app runtime user', async () => {
    const [rows] = await connection.query('SELECT 1 AS ok');
    expect(rows).toEqual([{ ok: 1 }]);
  });

  it('uses UTC as the session time zone', async () => {
    const [rows] = await connection.query<RowDataPacket[]>('SELECT @@session.time_zone AS tz');
    expect(String(rows[0]?.tz)).toBe('+00:00');
  });

  it('rejects DDL for the app runtime user', async () => {
    await expect(
      connection.query('CREATE TABLE s0_03_app_ddl_probe (id INT PRIMARY KEY)'),
    ).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
  });

  it('persists data across reconnect (volume-backed database)', async () => {
    const markerTable = 's0_03_volume_probe';
    const markerValue = `probe-${Date.now()}`;

    const migrationConnection = await createConnection({
      ...databaseConfig,
      user: process.env.DATABASE_MIGRATION_USERNAME ?? 'migration',
      password: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
    });

    try {
      await migrationConnection.query(`DROP TABLE IF EXISTS ${markerTable}`);
      await migrationConnection.query(
        `CREATE TABLE ${markerTable} (marker VARCHAR(64) PRIMARY KEY)`,
      );
      await migrationConnection.query(`INSERT INTO ${markerTable} (marker) VALUES (?)`, [
        markerValue,
      ]);
    } finally {
      await migrationConnection.end();
    }

    const reread = await createConnection(databaseConfig);
    try {
      const [rows] = await reread.query<RowDataPacket[]>(`SELECT marker FROM ${markerTable}`);
      expect(String(rows[0]?.marker)).toBe(markerValue);
    } finally {
      await reread.end();
    }

    const cleanup = await createConnection({
      ...databaseConfig,
      user: process.env.DATABASE_MIGRATION_USERNAME ?? 'migration',
      password: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
    });
    try {
      await cleanup.query(`DROP TABLE IF EXISTS ${markerTable}`);
    } finally {
      await cleanup.end();
    }
  });

  it('exposes the mail sandbox SMTP port locally', async () => {
    await expect(probeTcp(mailHost, mailPort)).resolves.toBeUndefined();
  });
});
