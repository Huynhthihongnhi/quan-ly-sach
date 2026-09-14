import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import { createConnection, type RowDataPacket } from 'mysql2/promise';
import { DataSource } from 'typeorm';
import { AppConfigModule } from '../../src/config/app-config.module';
import { BootstrapModule } from '../../src/modules/bootstrap/bootstrap.module';
import { BootstrapService } from '../../src/modules/bootstrap/bootstrap.service';
import { CatalogModule } from '../../src/modules/catalog/catalog.module';
import { CatalogRepository } from '../../src/modules/catalog/catalog.repository';
import { Book } from '../../src/modules/catalog/entities/book.entity';
import { IdentityModule } from '../../src/modules/identity/identity.module';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { migrateDown, migrateUp } from '../../src/tools/migration-runner/runner';
import { DatabaseModule } from '../../src/platform/database/database.module';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';
import { createMigrationRunnerConfig } from '../support/migration-runner/create-runner-config';

const integrationEnabled = process.env.INTEGRATION_TESTS === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('TST-S3-01 catalog schema on MySQL test database', () => {
  let dataSource: DataSource;
  let catalogRepository: CatalogRepository;
  let userRepository: UserRepository;
  let bootstrapService: BootstrapService;
  let creatorUserId: string;

  beforeAll(async () => {
    await applyIdentityMigrations();

    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, DatabaseModule, IdentityModule, BootstrapModule, CatalogModule],
    }).compile();

    dataSource = moduleRef.get(DataSource);
    catalogRepository = moduleRef.get(CatalogRepository);
    userRepository = moduleRef.get(UserRepository);
    bootstrapService = moduleRef.get(BootstrapService);
  }, 120_000);

  beforeEach(async () => {
    await resetIdentityState();
    await bootstrapService.seedRegistryOnly();
    await bootstrapService.bootstrapAdmin({
      email: 'catalog.admin@test.local',
      password: 'AdminPass123!',
      displayName: 'Catalog Admin',
      requestId: 'catalog-schema-seed',
    });
    const admin = await userRepository.findByEmail('catalog.admin@test.local');
    if (!admin) {
      throw new Error('Missing catalog admin user');
    }
    creatorUserId = admin.id;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('stores a multi-author book with topics, nullable ISBN, and physical copies', async () => {
    const seeded = await dataSource.transaction(async (manager) => {
      const category = await catalogRepository.createCategory(manager, {
        code: 'magazine',
        name: 'Magazine',
      });
      const authorOne = await catalogRepository.createAuthor(manager, { name: 'Author One' });
      const authorTwo = await catalogRepository.createAuthor(manager, { name: 'Author Two' });
      const topicOne = await catalogRepository.createTopic(manager, { name: 'Science' });
      const topicTwo = await catalogRepository.createTopic(manager, { name: 'Education' });
      const book = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'School Science Monthly',
        createdBy: creatorUserId,
        isbn: null,
        publicationYear: 2024,
        state: 'published',
      });
      await catalogRepository.linkAuthors(manager, {
        bookId: book.id,
        authors: [
          { authorId: authorOne.id, authorOrder: 1 },
          { authorId: authorTwo.id, authorOrder: 2 },
        ],
      });
      await catalogRepository.linkTopics(manager, {
        bookId: book.id,
        topicIds: [topicOne.id, topicTwo.id],
      });
      await catalogRepository.createCopy(manager, {
        bookId: book.id,
        barcode: 'COPY-001',
      });
      await catalogRepository.createCopy(manager, {
        bookId: book.id,
        barcode: 'COPY-002',
      });
      return book.id;
    });

    expect(await catalogRepository.countCopiesForBook(seeded)).toBe(2);
    const saved = await dataSource.getRepository(Book).findOne({ where: { id: seeded } });
    expect(saved?.isbn).toBeNull();
  });

  it('rejects duplicate junction rows and duplicate copy barcodes', async () => {
    const bookId = await seedMinimalBook();
    const authorId = await dataSource.transaction((manager) =>
      catalogRepository
        .createAuthor(manager, { name: 'Duplicate Author' })
        .then((author) => author.id),
    );

    await dataSource.transaction((manager) =>
      catalogRepository.linkAuthors(manager, {
        bookId,
        authors: [{ authorId, authorOrder: 1 }],
      }),
    );

    await expect(
      dataSource.query(
        `INSERT INTO book_authors (book_id, author_id, author_order) VALUES (?, ?, 2)`,
        [bookId, authorId],
      ),
    ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });

    await dataSource.transaction((manager) =>
      catalogRepository.createCopy(manager, { bookId, barcode: 'UNIQUE-001' }),
    );

    await expect(
      dataSource.query(`INSERT INTO book_copies (book_id, barcode) VALUES (?, 'UNIQUE-001')`, [
        bookId,
      ]),
    ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });

  it('rejects publication years outside the stored range', async () => {
    const categoryId = await seedCategoryOnly();

    await expect(
      dataSource.transaction((manager) =>
        catalogRepository.createBook(manager, {
          categoryId,
          title: 'Invalid Year Book',
          createdBy: creatorUserId,
          publicationYear: 999,
        }),
      ),
    ).rejects.toMatchObject({ code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
  });

  it('keeps copy history when a book is archived', async () => {
    const bookId = await seedMinimalBook();

    await dataSource.transaction((manager) =>
      catalogRepository.updateBookState(manager, { bookId, state: 'archived' }),
    );

    const book = await dataSource.getRepository(Book).findOne({ where: { id: bookId } });
    expect(book?.state).toBe('archived');
    expect(await catalogRepository.countCopiesForBook(bookId)).toBe(1);
  });

  it('does not store a manual stock count on books', async () => {
    const connection = await createConnection({
      host: process.env.DATABASE_HOST ?? '127.0.0.1',
      port: Number(process.env.DATABASE_PORT ?? 3306),
      user: process.env.DATABASE_MIGRATION_USERNAME ?? 'migration',
      password: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
      database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
    });

    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT COLUMN_NAME AS column_name
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ?
           AND TABLE_NAME = 'books'
           AND COLUMN_NAME IN ('stock_count', 'copy_count', 'available_count', 'quantity')`,
        [process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test'],
      );
      expect(rows).toHaveLength(0);
    } finally {
      await connection.end();
    }
  });

  it('applies and rolls back catalog migration 000006', async () => {
    const config = createMigrationRunnerConfig(resolve(__dirname, '../../migrations'));
    await migrateDown(config, 6, true);
    expect(await tableExists('books')).toBe(false);

    await migrateUp(config, 6);
    expect(await tableExists('books')).toBe(true);
    expect(await tableExists('book_copies')).toBe(true);
  });

  async function seedCategoryOnly(): Promise<string> {
    const category = await dataSource.transaction((manager) =>
      catalogRepository.createCategory(manager, {
        code: 'book',
        name: 'Book',
      }),
    );
    return category.id;
  }

  async function seedMinimalBook(): Promise<string> {
    return dataSource.transaction(async (manager) => {
      const category = await catalogRepository.createCategory(manager, {
        code: 'general',
        name: 'General',
      });
      const book = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Minimal Book',
        createdBy: creatorUserId,
      });
      await catalogRepository.createCopy(manager, {
        bookId: book.id,
        barcode: `BAR-${Date.now()}`,
      });
      return book.id;
    });
  }
});

async function tableExists(tableName: string): Promise<boolean> {
  const connection = await createConnection({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_MIGRATION_USERNAME ?? 'migration',
    password: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
    database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
  });

  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test', tableName],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  } finally {
    await connection.end();
  }
}
