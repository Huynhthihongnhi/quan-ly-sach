import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/setup-app';

const mockRepository = {
  find: () => Promise.resolve([]),
  findOne: () => Promise.resolve(null),
  save: (value: unknown) => Promise.resolve(value),
  create: (value: unknown) => value,
  count: () => Promise.resolve(0),
  delete: () => Promise.resolve({ affected: 0 }),
};

const mockDataSource = {
  isInitialized: true,
  entityMetadatas: [],
  options: { type: 'mysql', entities: [] },
  query: <T>() => Promise.resolve([{ '1': 1 }] as T),
  destroy: () => Promise.resolve(),
  getRepository: () => mockRepository,
  getTreeRepository: () => mockRepository,
  getMongoRepository: () => mockRepository,
  transaction: <T>(handler: (manager: typeof mockRepository) => Promise<T>) =>
    handler(mockRepository),
  createQueryBuilder: () => ({
    setLock: () => ({
      where: () => ({
        getOne: () => Promise.resolve(null),
      }),
    }),
    innerJoin: () => ({
      where: () => ({
        andWhere: () => ({
          getCount: () => Promise.resolve(0),
        }),
        getCount: () => Promise.resolve(0),
      }),
    }),
  }),
} as unknown as DataSource;

export async function createContractTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(DataSource)
    .useValue(mockDataSource)
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}
