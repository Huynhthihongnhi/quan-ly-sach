import { DataSource } from 'typeorm';
import { getDatabaseTestConfig } from '../database-test-config';
import { OrmProbeEvent } from './entities/orm-probe-event.entity';
import { OrmProbeRecord } from './entities/orm-probe-record.entity';

export function createOrmProbeDataSource(): DataSource {
  const config = getDatabaseTestConfig();

  return new DataSource({
    type: 'mysql',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    entities: [OrmProbeRecord, OrmProbeEvent],
    synchronize: false,
    migrationsRun: false,
    logging: false,
    timezone: 'Z',
  });
}
