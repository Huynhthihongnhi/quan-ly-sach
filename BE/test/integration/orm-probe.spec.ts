import {
  createConnection,
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise';
import { DataSource } from 'typeorm';
import { createOrmProbeDataSource } from '../support/orm-probe/create-orm-probe-data-source';
import { OrmProbeRepository } from '../support/orm-probe/orm-probe.repository';
import {
  applyOrmProbeSchema,
  dropOrmProbeSchema,
  truncateOrmProbeTables,
} from '../support/setup-orm-probe-schema';

const integrationEnabled = process.env.INTEGRATION_TESTS === '1';
const LARGE_EXTERNAL_ID = '9223372036854775807';
const TAG_BYTES = Buffer.alloc(32, 0xab);

const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('TST-S0-04 ORM probe on isolated MySQL test database', () => {
  let dataSource: DataSource;
  let rawConnection: Connection;

  beforeAll(async () => {
    await applyOrmProbeSchema();
    dataSource = createOrmProbeDataSource();
    await dataSource.initialize();
    rawConnection = await createConnection({
      host: process.env.DATABASE_HOST ?? '127.0.0.1',
      port: Number(process.env.DATABASE_PORT ?? 3306),
      user: process.env.DATABASE_USERNAME ?? 'app',
      password: process.env.DATABASE_PASSWORD ?? 'local-app-change-me',
      database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
    });
    await rawConnection.query("SET time_zone = '+00:00'");
  }, 60_000);

  beforeEach(async () => {
    await truncateOrmProbeTables(rawConnection);
  });

  afterAll(async () => {
    await rawConnection.end();
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    await dropOrmProbeSchema();
  });

  it('preserves large BIGINT through insert result, raw query, and entity hydration', async () => {
    const observedAt = new Date('2026-09-11T08:15:30.123456Z');
    const repository = new OrmProbeRepository(dataSource.manager);

    const inserted = await repository.insertRecord({
      externalId: LARGE_EXTERNAL_ID,
      tag: TAG_BYTES,
      observedAt,
      label: 'bigint-probe',
      version: 0,
    });

    expect(inserted.id).toEqual(expect.any(String));
    expect(inserted.externalId).toBe(LARGE_EXTERNAL_ID);

    const [rawRows] = await rawConnection.query<RowDataPacket[]>(
      'SELECT CAST(external_id AS CHAR) AS external_id FROM orm_probe_records WHERE id = ?',
      [inserted.id],
    );
    expect(String(rawRows[0]?.external_id)).toBe(LARGE_EXTERNAL_ID);

    const hydrated = await repository.findRecordById(inserted.id);
    expect(hydrated?.externalId).toBe(LARGE_EXTERNAL_ID);
  });

  it('preserves DATETIME(6) microsecond precision', async () => {
    const [insertResult] = await rawConnection.query<ResultSetHeader>(
      'INSERT INTO orm_probe_records (external_id, tag, observed_at, label) VALUES (?, ?, ?, ?)',
      ['42', TAG_BYTES, '2026-09-11 08:15:30.123456', 'datetime-probe'],
    );
    const insertedId = String(insertResult.insertId);

    const [rawRows] = await rawConnection.query<RowDataPacket[]>(
      'SELECT DATE_FORMAT(observed_at, "%Y-%m-%dT%H:%i:%s.%fZ") AS observed_at FROM orm_probe_records WHERE id = ?',
      [insertedId],
    );
    expect(String(rawRows[0]?.observed_at)).toBe('2026-09-11T08:15:30.123456Z');

    const repository = new OrmProbeRepository(dataSource.manager);
    const hydrated = await repository.findRecordById(insertedId);
    expect(hydrated?.observedAt.getUTCHours()).toBe(8);
    expect(hydrated?.observedAt.getUTCMinutes()).toBe(15);
    expect(hydrated?.observedAt.getUTCSeconds()).toBe(30);
    expect(hydrated?.observedAt.getUTCMilliseconds()).toBe(123);
  });

  it('round-trips BINARY(32) values', async () => {
    const repository = new OrmProbeRepository(dataSource.manager);
    const inserted = await repository.insertRecord({
      externalId: '43',
      tag: TAG_BYTES,
      observedAt: new Date('2026-09-11T08:00:00.000Z'),
      label: 'binary-probe',
      version: 0,
    });

    const [rawRows] = await rawConnection.query<RowDataPacket[]>(
      'SELECT tag FROM orm_probe_records WHERE id = ?',
      [inserted.id],
    );
    expect(Buffer.from(rawRows[0]?.tag as Buffer)).toEqual(TAG_BYTES);

    const hydrated = await repository.findRecordById(inserted.id);
    expect(Buffer.from(hydrated?.tag ?? Buffer.alloc(0))).toEqual(TAG_BYTES);
  });

  it('rejects writes to generated columns', async () => {
    await expect(
      rawConnection.query(
        'INSERT INTO orm_probe_records (external_id, tag, observed_at, label, label_hash) VALUES (?, ?, ?, ?, ?)',
        ['44', TAG_BYTES, new Date(), 'generated-probe', Buffer.alloc(32, 1)],
      ),
    ).rejects.toMatchObject({ code: 'ER_NON_DEFAULT_VALUE_FOR_GENERATED_COLUMN' });
  });

  it('rolls back all writes in a shared transaction manager when a later write fails', async () => {
    const marker = `tx-probe-${Date.now()}`;

    await expect(
      dataSource.transaction(async (manager) => {
        const repository = new OrmProbeRepository(manager);
        const record = await repository.insertRecord({
          externalId: '9001',
          tag: TAG_BYTES,
          observedAt: new Date('2026-09-11T08:00:00.000Z'),
          label: marker,
          version: 0,
        });
        await repository.insertEvent({
          recordId: record.id,
          eventType: 'created',
        });
        await repository.insertRecord({
          externalId: '9001',
          tag: TAG_BYTES,
          observedAt: new Date('2026-09-11T08:00:00.000Z'),
          label: 'duplicate-external-id',
          version: 0,
        });
      }),
    ).rejects.toBeDefined();

    const [rows] = await rawConnection.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM orm_probe_records WHERE label = ?',
      [marker],
    );
    expect(Number(rows[0]?.total)).toBe(0);

    const [eventRows] = await rawConnection.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM orm_probe_events',
    );
    expect(Number(eventRows[0]?.total)).toBe(0);
  });

  it('allows only one optimistic update for the same expected version', async () => {
    const repository = new OrmProbeRepository(dataSource.manager);
    const inserted = await repository.insertRecord({
      externalId: '9100',
      tag: TAG_BYTES,
      observedAt: new Date('2026-09-11T08:00:00.000Z'),
      label: 'version-probe',
      version: 0,
    });

    const first = await repository.updateLabelWithVersion(inserted.id, 0, 'first-winner');
    const second = await repository.updateLabelWithVersion(inserted.id, 0, 'second-loser');

    expect(first).toBe(1);
    expect(second).toBe(0);

    const hydrated = await repository.findRecordById(inserted.id);
    expect(hydrated?.label).toBe('first-winner');
    expect(hydrated?.version).toBe(1);
  });
});
