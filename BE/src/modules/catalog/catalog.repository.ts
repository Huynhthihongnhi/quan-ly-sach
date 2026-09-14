import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Author } from './entities/author.entity';
import { BookAuthor } from './entities/book-author.entity';
import { BookCopy } from './entities/book-copy.entity';
import { BookTopic } from './entities/book-topic.entity';
import { Book, type BookState } from './entities/book.entity';
import { Category } from './entities/category.entity';
import { Topic } from './entities/topic.entity';

export interface AdminBookListParams {
  state?: BookState;
  q?: string;
  page: number;
  pageSize: number;
}

export interface TaxonomyListParams {
  q?: string;
  page: number;
  pageSize: number;
}

@Injectable()
export class CatalogRepository {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Author)
    private readonly authors: Repository<Author>,
    @InjectRepository(Topic)
    private readonly topics: Repository<Topic>,
    @InjectRepository(Book)
    private readonly books: Repository<Book>,
    @InjectRepository(BookAuthor)
    private readonly bookAuthors: Repository<BookAuthor>,
    @InjectRepository(BookTopic)
    private readonly bookTopics: Repository<BookTopic>,
    @InjectRepository(BookCopy)
    private readonly bookCopies: Repository<BookCopy>,
  ) {}

  findCategoryById(id: string): Promise<Category | null> {
    return this.categories.findOne({ where: { id } });
  }

  findAuthorById(id: string): Promise<Author | null> {
    return this.authors.findOne({ where: { id } });
  }

  findTopicById(id: string): Promise<Topic | null> {
    return this.topics.findOne({ where: { id } });
  }

  async findCopyByIdForUpdate(manager: EntityManager, copyId: string): Promise<BookCopy | null> {
    return manager
      .getRepository(BookCopy)
      .createQueryBuilder('copy')
      .where('copy.id = :copyId', { copyId })
      .setLock('pessimistic_write')
      .getOne();
  }

  async findBookByIdForUpdate(manager: EntityManager, bookId: string): Promise<Book | null> {
    return manager
      .getRepository(Book)
      .createQueryBuilder('book')
      .where('book.id = :bookId', { bookId })
      .setLock('pessimistic_write')
      .getOne();
  }

  findBookById(id: string): Promise<Book | null> {
    return this.books.findOne({ where: { id } });
  }

  findCopyById(id: string): Promise<BookCopy | null> {
    return this.bookCopies.findOne({ where: { id } });
  }

  async listBooksAdmin(params: AdminBookListParams): Promise<{ items: Book[]; total: number }> {
    const qb = this.books.createQueryBuilder('book').orderBy('book.id', 'ASC');

    if (params.state) {
      qb.andWhere('book.state = :state', { state: params.state });
    }
    if (params.q) {
      qb.andWhere('book.title LIKE :q', { q: `%${params.q}%` });
    }

    const total = await qb.getCount();
    const items = await qb
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();

    return { items, total };
  }

  async listCategories(params: TaxonomyListParams): Promise<{ items: Category[]; total: number }> {
    const qb = this.categories.createQueryBuilder('category').orderBy('category.id', 'ASC');
    if (params.q) {
      qb.andWhere('category.name LIKE :q', { q: `%${params.q}%` });
    }
    const total = await qb.getCount();
    const items = await qb
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();
    return { items, total };
  }

  async listAuthors(params: TaxonomyListParams): Promise<{ items: Author[]; total: number }> {
    const qb = this.authors.createQueryBuilder('author').orderBy('author.id', 'ASC');
    if (params.q) {
      qb.andWhere('author.name LIKE :q', { q: `%${params.q}%` });
    }
    const total = await qb.getCount();
    const items = await qb
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();
    return { items, total };
  }

  async listTopics(params: TaxonomyListParams): Promise<{ items: Topic[]; total: number }> {
    const qb = this.topics.createQueryBuilder('topic').orderBy('topic.id', 'ASC');
    if (params.q) {
      qb.andWhere('topic.name LIKE :q', { q: `%${params.q}%` });
    }
    const total = await qb.getCount();
    const items = await qb
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();
    return { items, total };
  }

  async getAuthorIdsForBook(bookId: string): Promise<string[]> {
    const rows = await this.bookAuthors.find({
      where: { bookId },
      order: { authorOrder: 'ASC' },
    });
    return rows.map((row) => row.authorId);
  }

  async getTopicIdsForBook(bookId: string): Promise<string[]> {
    const rows = await this.bookTopics.find({ where: { bookId } });
    return rows.map((row) => row.topicId);
  }

  async countAuthorsByIds(manager: EntityManager, ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    return manager.count(Author, { where: { id: In(ids) } });
  }

  async countTopicsByIds(manager: EntityManager, ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    return manager.count(Topic, { where: { id: In(ids) } });
  }

  async countBooksForCategory(categoryId: string): Promise<number> {
    return this.books.count({ where: { categoryId } });
  }

  async countBooksForAuthor(authorId: string): Promise<number> {
    return this.bookAuthors.count({ where: { authorId } });
  }

  async countBooksForTopic(topicId: string): Promise<number> {
    return this.bookTopics.count({ where: { topicId } });
  }

  async createCategory(
    manager: EntityManager,
    input: { code: string; name: string },
  ): Promise<Category> {
    const entity = manager.create(Category, input);
    return manager.save(entity);
  }

  async createAuthor(manager: EntityManager, input: { name: string }): Promise<Author> {
    const entity = manager.create(Author, input);
    return manager.save(entity);
  }

  async createTopic(manager: EntityManager, input: { name: string }): Promise<Topic> {
    const entity = manager.create(Topic, input);
    return manager.save(entity);
  }

  async renameCategoryIfUnchanged(
    manager: EntityManager,
    input: { categoryId: string; expectedName: string; name: string },
  ): Promise<Category | null> {
    const result = await manager.update(
      Category,
      { id: input.categoryId, name: input.expectedName },
      { name: input.name },
    );
    if ((result.affected ?? 0) === 0) {
      return null;
    }
    return manager.findOne(Category, { where: { id: input.categoryId } });
  }

  async renameAuthorIfUnchanged(
    manager: EntityManager,
    input: { authorId: string; expectedName: string; name: string },
  ): Promise<Author | null> {
    const result = await manager.update(
      Author,
      { id: input.authorId, name: input.expectedName },
      { name: input.name },
    );
    if ((result.affected ?? 0) === 0) {
      return null;
    }
    return manager.findOne(Author, { where: { id: input.authorId } });
  }

  async renameTopicIfUnchanged(
    manager: EntityManager,
    input: { topicId: string; expectedName: string; name: string },
  ): Promise<Topic | null> {
    const result = await manager.update(
      Topic,
      { id: input.topicId, name: input.expectedName },
      { name: input.name },
    );
    if ((result.affected ?? 0) === 0) {
      return null;
    }
    return manager.findOne(Topic, { where: { id: input.topicId } });
  }

  async deleteCategory(manager: EntityManager, categoryId: string): Promise<boolean> {
    const result = await manager.delete(Category, { id: categoryId });
    return (result.affected ?? 0) > 0;
  }

  async deleteAuthor(manager: EntityManager, authorId: string): Promise<boolean> {
    const result = await manager.delete(Author, { id: authorId });
    return (result.affected ?? 0) > 0;
  }

  async deleteTopic(manager: EntityManager, topicId: string): Promise<boolean> {
    const result = await manager.delete(Topic, { id: topicId });
    return (result.affected ?? 0) > 0;
  }

  async createBook(
    manager: EntityManager,
    input: {
      categoryId: string;
      title: string;
      createdBy: string;
      isbn?: string | null;
      publicationYear?: number | null;
      publisherName?: string | null;
      description?: string | null;
      state?: BookState;
    },
  ): Promise<Book> {
    const entity = manager.create(Book, {
      categoryId: input.categoryId,
      title: input.title,
      createdBy: input.createdBy,
      isbn: input.isbn ?? null,
      publicationYear: input.publicationYear ?? null,
      publisherName: input.publisherName ?? null,
      description: input.description ?? null,
      state: input.state ?? 'draft',
    });
    return manager.save(entity);
  }

  async replaceAuthors(
    manager: EntityManager,
    input: { bookId: string; authorIds: string[] },
  ): Promise<void> {
    await manager.delete(BookAuthor, { bookId: input.bookId });
    await this.linkAuthors(manager, {
      bookId: input.bookId,
      authors: input.authorIds.map((authorId, index) => ({
        authorId,
        authorOrder: index + 1,
      })),
    });
  }

  async linkAuthors(
    manager: EntityManager,
    input: { bookId: string; authors: Array<{ authorId: string; authorOrder: number }> },
  ): Promise<void> {
    for (const author of input.authors) {
      const entity = manager.create(BookAuthor, {
        bookId: input.bookId,
        authorId: author.authorId,
        authorOrder: author.authorOrder,
      });
      await manager.save(entity);
    }
  }

  async replaceTopics(
    manager: EntityManager,
    input: { bookId: string; topicIds: string[] },
  ): Promise<void> {
    await manager.delete(BookTopic, { bookId: input.bookId });
    await this.linkTopics(manager, input);
  }

  async linkTopics(
    manager: EntityManager,
    input: { bookId: string; topicIds: string[] },
  ): Promise<void> {
    for (const topicId of input.topicIds) {
      const entity = manager.create(BookTopic, { bookId: input.bookId, topicId });
      await manager.save(entity);
    }
  }

  async updateBookWithVersion(
    manager: EntityManager,
    input: {
      bookId: string;
      expectedVersion: string;
      title?: string;
      categoryId?: string;
      isbn?: string | null;
      publicationYear?: number | null;
      publisherName?: string | null;
      description?: string | null;
    },
  ): Promise<Book | null> {
    const setValues: Partial<Book> = {};
    if (input.title !== undefined) {
      setValues.title = input.title;
    }
    if (input.categoryId !== undefined) {
      setValues.categoryId = input.categoryId;
    }
    if (input.isbn !== undefined) {
      setValues.isbn = input.isbn;
    }
    if (input.publicationYear !== undefined) {
      setValues.publicationYear = input.publicationYear;
    }
    if (input.publisherName !== undefined) {
      setValues.publisherName = input.publisherName;
    }
    if (input.description !== undefined) {
      setValues.description = input.description;
    }

    const result = await manager
      .createQueryBuilder()
      .update(Book)
      .set({
        ...setValues,
        version: () => 'version + 1',
      })
      .where('id = :bookId', { bookId: input.bookId })
      .andWhere('version = :expectedVersion', { expectedVersion: input.expectedVersion })
      .execute();

    if ((result.affected ?? 0) === 0) {
      return null;
    }

    return manager.findOne(Book, { where: { id: input.bookId } });
  }

  async updateBookStateWithVersion(
    manager: EntityManager,
    input: { bookId: string; expectedVersion: string; state: BookState },
  ): Promise<Book | null> {
    const result = await manager
      .createQueryBuilder()
      .update(Book)
      .set({
        state: input.state,
        version: () => 'version + 1',
      })
      .where('id = :bookId', { bookId: input.bookId })
      .andWhere('version = :expectedVersion', { expectedVersion: input.expectedVersion })
      .execute();

    if ((result.affected ?? 0) === 0) {
      return null;
    }

    return manager.findOne(Book, { where: { id: input.bookId } });
  }

  async updateBookState(
    manager: EntityManager,
    input: { bookId: string; state: BookState },
  ): Promise<void> {
    await manager.update(Book, { id: input.bookId }, { state: input.state });
  }

  async createCopy(
    manager: EntityManager,
    input: {
      bookId: string;
      barcode: string;
      shelfLocation?: string | null;
      conditionState?: BookCopy['conditionState'];
    },
  ): Promise<BookCopy> {
    const entity = manager.create(BookCopy, {
      bookId: input.bookId,
      barcode: input.barcode,
      shelfLocation: input.shelfLocation ?? null,
      conditionState: input.conditionState ?? 'serviceable',
    });
    return manager.save(entity);
  }

  async listCopiesForBook(
    bookId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: BookCopy[]; total: number }> {
    const [items, total] = await this.bookCopies.findAndCount({
      where: { bookId },
      order: { id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total };
  }

  async updateCopyWithVersion(
    manager: EntityManager,
    input: {
      copyId: string;
      expectedVersion: string;
      shelfLocation?: string | null;
      conditionState?: BookCopy['conditionState'];
    },
  ): Promise<BookCopy | null> {
    const setValues: Partial<BookCopy> = {};
    if (input.shelfLocation !== undefined) {
      setValues.shelfLocation = input.shelfLocation;
    }
    if (input.conditionState !== undefined) {
      setValues.conditionState = input.conditionState;
    }

    const result = await manager
      .createQueryBuilder()
      .update(BookCopy)
      .set({
        ...setValues,
        version: () => 'version + 1',
      })
      .where('id = :copyId', { copyId: input.copyId })
      .andWhere('version = :expectedVersion', { expectedVersion: input.expectedVersion })
      .execute();

    if ((result.affected ?? 0) === 0) {
      return null;
    }

    return manager.findOne(BookCopy, { where: { id: input.copyId } });
  }

  async countCopiesForBook(bookId: string, manager?: EntityManager): Promise<number> {
    const repo = manager ? manager.getRepository(BookCopy) : this.bookCopies;
    return repo.count({ where: { bookId } });
  }
}
