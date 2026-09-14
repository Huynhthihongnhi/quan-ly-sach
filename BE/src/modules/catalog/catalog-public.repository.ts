import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { buildContainsLikePattern } from './catalog-like.util';
import { Author } from './entities/author.entity';
import { BookAuthor } from './entities/book-author.entity';
import { BookTopic } from './entities/book-topic.entity';
import { Book } from './entities/book.entity';
import { Category } from './entities/category.entity';
import { Topic } from './entities/topic.entity';

export interface PublicBookFilter {
  q?: string;
  title?: string;
  author?: string;
  categoryId?: string;
  topicId?: string;
  year?: number;
}

export interface PublicBookSort {
  field: 'id' | 'title' | 'publicationYear';
  direction: 'asc' | 'desc';
}

@Injectable()
export class CatalogPublicRepository {
  constructor(
    @InjectRepository(Book)
    private readonly books: Repository<Book>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Author)
    private readonly authors: Repository<Author>,
    @InjectRepository(Topic)
    private readonly topics: Repository<Topic>,
    @InjectRepository(BookAuthor)
    private readonly bookAuthors: Repository<BookAuthor>,
    @InjectRepository(BookTopic)
    private readonly bookTopics: Repository<BookTopic>,
  ) {}

  async listPublishedBooks(params: {
    filters: PublicBookFilter;
    page: number;
    pageSize: number;
    sort: PublicBookSort;
  }): Promise<{ items: Book[]; total: number }> {
    const qb = this.books
      .createQueryBuilder('book')
      .where('book.state = :state', { state: 'published' });

    this.applyPublicFilters(qb, params.filters);

    const total = await qb.getCount();

    const sortColumn =
      params.sort.field === 'title'
        ? 'book.title'
        : params.sort.field === 'publicationYear'
          ? 'book.publication_year'
          : 'book.id';
    const sortDirection = params.sort.direction.toUpperCase() as 'ASC' | 'DESC';

    const items = await qb
      .orderBy(sortColumn, sortDirection)
      .addOrderBy('book.id', 'ASC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();

    return { items, total };
  }

  findPublishedBookById(bookId: string): Promise<Book | null> {
    return this.books.findOne({ where: { id: bookId, state: 'published' } });
  }

  findCategoryById(categoryId: string): Promise<Category | null> {
    return this.categories.findOne({ where: { id: categoryId } });
  }

  async findCategoriesByIds(categoryIds: string[]): Promise<Map<string, Category>> {
    const uniqueIds = [...new Set(categoryIds)];
    if (uniqueIds.length === 0) {
      return new Map();
    }
    const items = await this.categories.find({ where: { id: In(uniqueIds) } });
    return new Map(items.map((category) => [category.id, category]));
  }

  async listAuthorsByBookIds(bookIds: string[]): Promise<Map<string, Author[]>> {
    const grouped = new Map<string, Author[]>();
    for (const bookId of bookIds) {
      grouped.set(bookId, []);
    }
    if (bookIds.length === 0) {
      return grouped;
    }

    const rows = await this.authors
      .createQueryBuilder('author')
      .innerJoin(BookAuthor, 'bookAuthor', 'bookAuthor.author_id = author.id')
      .addSelect('bookAuthor.book_id', 'bookId')
      .addSelect('bookAuthor.author_order', 'authorOrder')
      .where('bookAuthor.book_id IN (:...bookIds)', { bookIds })
      .orderBy('bookAuthor.author_order', 'ASC')
      .addOrderBy('author.id', 'ASC')
      .getRawAndEntities();

    for (let index = 0; index < rows.entities.length; index += 1) {
      const rawRow = rows.raw[index] as { bookId?: string | number } | undefined;
      const bookId = String(rawRow?.bookId ?? '');
      if (!bookId) {
        continue;
      }
      const entity = rows.entities[index];
      const authors = grouped.get(bookId);
      if (authors && entity) {
        authors.push(entity);
      }
    }

    return grouped;
  }

  async listTopicsByBookIds(bookIds: string[]): Promise<Map<string, Topic[]>> {
    const grouped = new Map<string, Topic[]>();
    for (const bookId of bookIds) {
      grouped.set(bookId, []);
    }
    if (bookIds.length === 0) {
      return grouped;
    }

    const rows = await this.topics
      .createQueryBuilder('topic')
      .innerJoin(BookTopic, 'bookTopic', 'bookTopic.topic_id = topic.id')
      .addSelect('bookTopic.book_id', 'bookId')
      .where('bookTopic.book_id IN (:...bookIds)', { bookIds })
      .orderBy('topic.name', 'ASC')
      .addOrderBy('topic.id', 'ASC')
      .getRawAndEntities();

    for (let index = 0; index < rows.entities.length; index += 1) {
      const rawRow = rows.raw[index] as { bookId?: string | number } | undefined;
      const bookId = String(rawRow?.bookId ?? '');
      if (!bookId) {
        continue;
      }
      const entity = rows.entities[index];
      const topics = grouped.get(bookId);
      if (topics && entity) {
        topics.push(entity);
      }
    }

    return grouped;
  }

  async listAuthorsForBook(bookId: string): Promise<Author[]> {
    return this.authors
      .createQueryBuilder('author')
      .innerJoin(BookAuthor, 'bookAuthor', 'bookAuthor.author_id = author.id')
      .where('bookAuthor.book_id = :bookId', { bookId })
      .orderBy('bookAuthor.author_order', 'ASC')
      .addOrderBy('author.id', 'ASC')
      .getMany();
  }

  async listTopicsForBook(bookId: string): Promise<Topic[]> {
    return this.topics
      .createQueryBuilder('topic')
      .innerJoin(BookTopic, 'bookTopic', 'bookTopic.topic_id = topic.id')
      .where('bookTopic.book_id = :bookId', { bookId })
      .orderBy('topic.name', 'ASC')
      .addOrderBy('topic.id', 'ASC')
      .getMany();
  }

  async listPublicCategories(params: {
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: Category[]; total: number }> {
    const qb = this.categories
      .createQueryBuilder('category')
      .innerJoin(Book, 'book', 'book.category_id = category.id AND book.state = :state', {
        state: 'published',
      })
      .groupBy('category.id');

    if (params.q) {
      qb.andWhere("category.name LIKE :namePattern ESCAPE '\\\\'", {
        namePattern: buildContainsLikePattern(params.q),
      });
    }

    const total = await this.countDistinctGrouped(qb, 'category.id');
    const items = await qb
      .orderBy('category.name', 'ASC')
      .addOrderBy('category.id', 'ASC')
      .offset((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .getMany();

    return { items, total };
  }

  async listPublicAuthors(params: {
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: Author[]; total: number }> {
    const qb = this.authors
      .createQueryBuilder('author')
      .innerJoin(BookAuthor, 'bookAuthor', 'bookAuthor.author_id = author.id')
      .innerJoin(Book, 'book', 'book.id = bookAuthor.book_id AND book.state = :state', {
        state: 'published',
      })
      .groupBy('author.id');

    if (params.q) {
      qb.andWhere("author.name LIKE :namePattern ESCAPE '\\\\'", {
        namePattern: buildContainsLikePattern(params.q),
      });
    }

    const total = await this.countDistinctGrouped(qb, 'author.id');
    const items = await qb
      .orderBy('author.name', 'ASC')
      .addOrderBy('author.id', 'ASC')
      .offset((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .getMany();

    return { items, total };
  }

  async listPublicTopics(params: {
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: Topic[]; total: number }> {
    const qb = this.topics
      .createQueryBuilder('topic')
      .innerJoin(BookTopic, 'bookTopic', 'bookTopic.topic_id = topic.id')
      .innerJoin(Book, 'book', 'book.id = bookTopic.book_id AND book.state = :state', {
        state: 'published',
      })
      .groupBy('topic.id');

    if (params.q) {
      qb.andWhere("topic.name LIKE :namePattern ESCAPE '\\\\'", {
        namePattern: buildContainsLikePattern(params.q),
      });
    }

    const total = await this.countDistinctGrouped(qb, 'topic.id');
    const items = await qb
      .orderBy('topic.name', 'ASC')
      .addOrderBy('topic.id', 'ASC')
      .offset((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .getMany();

    return { items, total };
  }

  private async countDistinctGrouped(
    qb: SelectQueryBuilder<ObjectLiteral>,
    aliasColumn: string,
  ): Promise<number> {
    const row = await qb
      .clone()
      .select(`COUNT(DISTINCT ${aliasColumn})`, 'count')
      .orderBy()
      .groupBy()
      .offset(undefined)
      .limit(undefined)
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  private applyPublicFilters(
    qb: ReturnType<Repository<Book>['createQueryBuilder']>,
    filters: PublicBookFilter,
  ): void {
    if (filters.categoryId) {
      qb.andWhere('book.category_id = :categoryId', { categoryId: filters.categoryId });
    }
    if (filters.year !== undefined) {
      qb.andWhere('book.publication_year = :year', { year: filters.year });
    }
    if (filters.title) {
      qb.andWhere("book.title LIKE :titlePattern ESCAPE '\\\\'", {
        titlePattern: buildContainsLikePattern(filters.title),
      });
    }
    if (filters.author) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM book_authors ba
          INNER JOIN authors a ON a.id = ba.author_id
          WHERE ba.book_id = book.id AND a.name LIKE :authorPattern ESCAPE '\\\\'
        )`,
        { authorPattern: buildContainsLikePattern(filters.author) },
      );
    }
    if (filters.topicId) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM book_topics bt
          WHERE bt.book_id = book.id AND bt.topic_id = :topicId
        )`,
        { topicId: filters.topicId },
      );
    }
    if (filters.q) {
      const qPattern = buildContainsLikePattern(filters.q);
      qb.andWhere(
        `(
          book.title LIKE :qPattern ESCAPE '\\\\'
          OR EXISTS (
            SELECT 1 FROM book_authors ba
            INNER JOIN authors a ON a.id = ba.author_id
            WHERE ba.book_id = book.id AND a.name LIKE :qPattern ESCAPE '\\\\'
          )
          OR EXISTS (
            SELECT 1 FROM book_topics bt
            INNER JOIN topics t ON t.id = bt.topic_id
            WHERE bt.book_id = book.id AND t.name LIKE :qPattern ESCAPE '\\\\'
          )
        )`,
        { qPattern },
      );
    }
  }
}
