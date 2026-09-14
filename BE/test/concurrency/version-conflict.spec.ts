import { DataSource } from 'typeorm';
import { createOrmProbeDataSource } from '../support/orm-probe/create-orm-probe-data-source';
import { OrmProbeRepository } from '../support/orm-probe/orm-probe.repository';
import {
  applyOrmProbeSchema,
  dropOrmProbeSchema,
  truncateOrmProbeTables,
} from '../support/setup-orm-probe-schema';
import { createRuntimeConnection } from '../support/dual-connection';

const concurrencyEnabled = process.env.CONCURRENCY_TESTS === '1';
const TAG_BYTES = Buffer.alloc(32, 0xcd);

const describeConcurrency = concurrencyEnabled ? describe : describe.skip;

describeConcurrency('TST-S0-04 version conflict with dual connections', () => {
  let primary: DataSource;
  let secondary: DataSource;

  beforeAll(async () => {
    await applyOrmProbeSchema();
    primary = createOrmProbeDataSource();
    secondary = createOrmProbeDataSource();
    await Promise.all([primary.initialize(), secondary.initialize()]);
  }, 60_000);

  beforeEach(async () => {
    const connection = await createRuntimeConnection();
    try {
      await truncateOrmProbeTables(connection);
    } finally {
      await connection.end();
    }
  });

  afterAll(async () => {
    await Promise.all([
      primary.isInitialized ? primary.destroy() : Promise.resolve(),
      secondary.isInitialized ? secondary.destroy() : Promise.resolve(),
    ]);
    await dropOrmProbeSchema();
  });

  it('commits only one concurrent update for the same expected version', async () => {
    const seedRepository = new OrmProbeRepository(primary.manager);
    const inserted = await seedRepository.insertRecord({
      externalId: '9200',
      tag: TAG_BYTES,
      observedAt: new Date('2026-09-11T08:00:00.000Z'),
      label: 'dual-connection-probe',
      version: 0,
    });

    const firstRepository = new OrmProbeRepository(primary.manager);
    const secondRepository = new OrmProbeRepository(secondary.manager);

    const [firstResult, secondResult] = await Promise.all([
      firstRepository.updateLabelWithVersion(inserted.id, 0, 'connection-one'),
      secondRepository.updateLabelWithVersion(inserted.id, 0, 'connection-two'),
    ]);

    expect(firstResult + secondResult).toBe(1);

    const finalRecord = await seedRepository.findRecordById(inserted.id);
    expect(finalRecord?.version).toBe(1);
    expect(['connection-one', 'connection-two']).toContain(finalRecord?.label);
  });
});
