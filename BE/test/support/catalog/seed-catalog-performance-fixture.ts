import { DataSource } from 'typeorm';

export interface CatalogPerformanceFixture {
  categoryId: string;
  creatorUserId: string;
  manyAuthorsBookIds: string[];
  fewAuthorsBookIds: string[];
  totalPublishedBooks: number;
}

const PERF_CATEGORY_CODE = 'perf-catalog';
const BATCH_SIZE = 500;

export function resolvePerformanceBookTarget(): number {
  const parsed = Number(process.env.CATALOG_PERF_BOOKS ?? 10_000);
  if (!Number.isFinite(parsed) || parsed < 10_000) {
    return 10_000;
  }
  return Math.floor(parsed);
}

export async function seedCatalogPerformanceFixture(
  dataSource: DataSource,
  creatorUserId: string,
): Promise<CatalogPerformanceFixture> {
  const targetBooks = resolvePerformanceBookTarget();

  await dataSource.query(
    `INSERT INTO categories (code, name) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [PERF_CATEGORY_CODE, 'Performance Catalog'],
  );
  const categoryRows = await dataSource.query<Array<{ id: number }>>(
    `SELECT id FROM categories WHERE code = ? LIMIT 1`,
    [PERF_CATEGORY_CODE],
  );
  const resolvedCategoryId = String(categoryRows[0]?.id ?? '');
  if (!resolvedCategoryId) {
    throw new Error('Failed to seed performance category.');
  }

  const authorIds: string[] = [];
  for (let index = 0; index < 8; index += 1) {
    const result = await dataSource.query<{ insertId: number }>(
      `INSERT INTO authors (name) VALUES (?)`,
      [`Perf Author ${index + 1}`],
    );
    authorIds.push(String(result.insertId));
  }

  const countRow = await dataSource.query<Array<{ count: number }>>(
    `SELECT COUNT(*) AS count FROM books WHERE category_id = ? AND state = 'published'`,
    [resolvedCategoryId],
  );
  let existingCount = Number(countRow[0]?.count ?? 0);

  while (existingCount < targetBooks) {
    const batchCount = Math.min(BATCH_SIZE, targetBooks - existingCount);
    const values: string[] = [];
    const params: Array<string | number> = [];
    for (let index = 0; index < batchCount; index += 1) {
      const bookNumber = existingCount + index + 1;
      values.push('(?, ?, ?, ?, ?)');
      params.push(
        resolvedCategoryId,
        `Perf Catalog ${bookNumber}`,
        'published',
        creatorUserId,
        2020 + (bookNumber % 5),
      );
    }
    await dataSource.query(
      `INSERT INTO books (category_id, title, state, created_by, publication_year) VALUES ${values.join(',')}`,
      params,
    );
    existingCount += batchCount;
  }

  const manyAuthorsBookIds = await ensureAuthorPatternBooks(
    dataSource,
    resolvedCategoryId,
    creatorUserId,
    'Perf Many Authors',
    24,
    authorIds,
    5,
  );
  const fewAuthorsBookIds = await ensureAuthorPatternBooks(
    dataSource,
    resolvedCategoryId,
    creatorUserId,
    'Perf Few Authors',
    24,
    authorIds,
    1,
  );

  const totalRow = await dataSource.query<Array<{ count: number }>>(
    `SELECT COUNT(*) AS count FROM books WHERE state = 'published'`,
  );

  return {
    categoryId: resolvedCategoryId,
    creatorUserId,
    manyAuthorsBookIds,
    fewAuthorsBookIds,
    totalPublishedBooks: Number(totalRow[0]?.count ?? 0),
  };
}

async function ensureAuthorPatternBooks(
  dataSource: DataSource,
  categoryId: string,
  creatorUserId: string,
  titlePrefix: string,
  count: number,
  authorIds: string[],
  authorsPerBook: number,
): Promise<string[]> {
  const bookIds: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const title = `${titlePrefix} ${index + 1}`;
    const existing = await dataSource.query<Array<{ id: number }>>(
      `SELECT id FROM books WHERE title = ? LIMIT 1`,
      [title],
    );
    let bookId = existing[0]?.id ? String(existing[0].id) : null;
    if (!bookId) {
      const insert = await dataSource.query<{ insertId: number }>(
        `INSERT INTO books (category_id, title, state, created_by, publication_year)
         VALUES (?, ?, 'published', ?, 2024)`,
        [categoryId, title, creatorUserId],
      );
      bookId = String(insert.insertId);
    }
    bookIds.push(bookId);
    await dataSource.query(`DELETE FROM book_authors WHERE book_id = ?`, [bookId]);
    for (let authorIndex = 0; authorIndex < authorsPerBook; authorIndex += 1) {
      await dataSource.query(
        `INSERT INTO book_authors (book_id, author_id, author_order) VALUES (?, ?, ?)`,
        [bookId, authorIds[authorIndex % authorIds.length], authorIndex + 1],
      );
    }
  }
  return bookIds;
}
