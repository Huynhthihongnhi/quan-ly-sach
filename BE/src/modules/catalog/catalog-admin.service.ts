import { Inject, Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { DataSource } from 'typeorm';
import { ApiException } from '../../common/http/api.exception';
import { ErrorCode } from '../../common/http/error-code';
import { buildPageMeta } from '../../common/http/pagination/page-meta';
import { CLOCK, Clock } from '../../platform/clock/clock.interface';
import { AuditService } from '../audit/audit.service';
import { CirculationInventoryService } from '../circulation/circulation-inventory.service';
import { isAllowedBookStateTransition } from './catalog-book-state';
import { CatalogRepository } from './catalog.repository';
import { AdminBookListQueryDto } from './dto/admin-book-list-query.dto';
import { CreateBookDto } from './dto/create-book.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateCopyDto } from './dto/create-copy.dto';
import { CreateNamedTaxonomyDto } from './dto/create-named-taxonomy.dto';
import { PatchTaxonomyDto } from './dto/patch-taxonomy.dto';
import { TaxonomyListQueryDto } from './dto/taxonomy-list-query.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { UpdateBookStateDto } from './dto/update-book-state.dto';
import { UpdateCopyDto } from './dto/update-copy.dto';
import { Book } from './entities/book.entity';
import {
  AdminBookResponse,
  AdminCopyResponse,
  toAdminBookResponse,
  toAdminCopyResponse,
  toCategoryResponse,
  toNamedTaxonomyResponse,
} from './mappers/admin-book.mapper';

function normalizeIsbn(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function rethrowDuplicateEntry(
  error: unknown,
  context: 'isbn' | 'barcode' | 'code' | 'name',
): never {
  if (error instanceof QueryFailedError && (error as { code?: string }).code === 'ER_DUP_ENTRY') {
    const message =
      context === 'isbn'
        ? 'ISBN is already in use.'
        : context === 'barcode'
          ? 'Barcode is already in use.'
          : context === 'code'
            ? 'Category code is already in use.'
            : 'Name is already in use.';
    throw new ApiException(409, ErrorCode.VERSION_CONFLICT, message);
  }
  throw error;
}

@Injectable()
export class CatalogAdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly catalogRepository: CatalogRepository,
    private readonly auditService: AuditService,
    private readonly circulationInventoryService: CirculationInventoryService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async listBooks(query: AdminBookListQueryDto) {
    const { items, total } = await this.catalogRepository.listBooksAdmin({
      state: query.state,
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
    });

    const data = await Promise.all(items.map(async (book) => this.toBookResponse(book)));

    return { data, meta: buildPageMeta(query.page, query.pageSize, total) };
  }

  async getBook(bookId: string): Promise<AdminBookResponse> {
    const book = await this.catalogRepository.findBookById(bookId);
    if (!book) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Book was not found.');
    }
    return this.toBookResponse(book);
  }

  async createBook(
    body: CreateBookDto,
    actorUserId: string,
    requestId: string,
  ): Promise<AdminBookResponse> {
    await this.assertCategoryExists(body.categoryId);
    await this.assertAuthorIdsExist(body.authorIds ?? []);
    await this.assertTopicIdsExist(body.topicIds ?? []);
    this.assertPublicationYearAllowed(body.publicationYear ?? null);

    try {
      const book = await this.dataSource.transaction(async (manager) => {
        const created = await this.catalogRepository.createBook(manager, {
          categoryId: body.categoryId,
          title: body.title.trim(),
          createdBy: actorUserId,
          isbn: normalizeIsbn(body.isbn),
          publicationYear: body.publicationYear ?? null,
          publisherName: body.publisherName ?? null,
          description: body.description ?? null,
        });

        if (body.authorIds?.length) {
          await this.catalogRepository.replaceAuthors(manager, {
            bookId: created.id,
            authorIds: body.authorIds,
          });
        }
        if (body.topicIds?.length) {
          await this.catalogRepository.replaceTopics(manager, {
            bookId: created.id,
            topicIds: body.topicIds,
          });
        }

        await this.auditService.append(manager, {
          actorUserId,
          action: 'catalog.book.create',
          targetType: 'book',
          targetId: created.id,
          outcome: 'success',
          requestId,
          details: { title: created.title, state: created.state },
        });

        return created;
      });

      return this.toBookResponse(book);
    } catch (error) {
      rethrowDuplicateEntry(error, 'isbn');
    }
  }

  async updateBook(
    bookId: string,
    body: UpdateBookDto,
    actorUserId: string,
    requestId: string,
  ): Promise<AdminBookResponse> {
    const existing = await this.catalogRepository.findBookById(bookId);
    if (!existing) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Book was not found.');
    }

    if (body.categoryId !== undefined) {
      await this.assertCategoryExists(body.categoryId);
    }
    if (body.authorIds !== undefined) {
      await this.assertAuthorIdsExist(body.authorIds);
    }
    if (body.topicIds !== undefined) {
      await this.assertTopicIdsExist(body.topicIds);
    }
    if (body.publicationYear !== undefined) {
      this.assertPublicationYearAllowed(body.publicationYear);
    }

    try {
      const updated = await this.dataSource.transaction(async (manager) => {
        const book = await this.catalogRepository.updateBookWithVersion(manager, {
          bookId,
          expectedVersion: body.version,
          title: body.title?.trim(),
          categoryId: body.categoryId,
          isbn: body.isbn !== undefined ? normalizeIsbn(body.isbn) : undefined,
          publicationYear: body.publicationYear,
          publisherName: body.publisherName,
          description: body.description,
        });
        if (!book) {
          throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Book version is stale.');
        }

        if (body.authorIds !== undefined) {
          await this.catalogRepository.replaceAuthors(manager, {
            bookId,
            authorIds: body.authorIds,
          });
        }
        if (body.topicIds !== undefined) {
          await this.catalogRepository.replaceTopics(manager, { bookId, topicIds: body.topicIds });
        }

        await this.auditService.append(manager, {
          actorUserId,
          action: 'catalog.book.update',
          targetType: 'book',
          targetId: bookId,
          outcome: 'success',
          requestId,
          details: { version: book.version },
        });

        return book;
      });

      return this.toBookResponse(updated);
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }
      rethrowDuplicateEntry(error, 'isbn');
    }
  }

  async updateBookState(
    bookId: string,
    body: UpdateBookStateDto,
    actorUserId: string,
    requestId: string,
  ): Promise<AdminBookResponse> {
    const existing = await this.catalogRepository.findBookById(bookId);
    if (!existing) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Book was not found.');
    }

    if (!isAllowedBookStateTransition(existing.state, body.state)) {
      throw new ApiException(
        409,
        ErrorCode.INVALID_TRANSITION,
        'Book state transition is not allowed.',
      );
    }

    if (body.state === 'published') {
      await this.assertPublishable(existing);
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      const book = await this.catalogRepository.updateBookStateWithVersion(manager, {
        bookId,
        expectedVersion: body.version,
        state: body.state,
      });
      if (!book) {
        throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Book version is stale.');
      }

      await this.auditService.append(manager, {
        actorUserId,
        action: 'catalog.book.state',
        targetType: 'book',
        targetId: bookId,
        outcome: 'success',
        requestId,
        details: { from: existing.state, to: body.state },
      });

      return book;
    });

    return this.toBookResponse(updated);
  }

  async listCategories(query: TaxonomyListQueryDto) {
    const { items, total } = await this.catalogRepository.listCategories(query);
    return {
      data: items.map(toCategoryResponse),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async createCategory(body: CreateCategoryDto) {
    try {
      const category = await this.dataSource.transaction((manager) =>
        this.catalogRepository.createCategory(manager, {
          code: body.code.trim(),
          name: body.name.trim(),
        }),
      );
      return toCategoryResponse(category);
    } catch (error) {
      rethrowDuplicateEntry(error, 'code');
    }
  }

  async patchCategory(categoryId: string, body: PatchTaxonomyDto) {
    const existing = await this.catalogRepository.findCategoryById(categoryId);
    if (!existing) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Category was not found.');
    }

    const updated = await this.dataSource.transaction((manager) =>
      this.catalogRepository.renameCategoryIfUnchanged(manager, {
        categoryId,
        expectedName: body.expectedName,
        name: body.name.trim(),
      }),
    );
    if (!updated) {
      throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Category name has changed.');
    }
    return toCategoryResponse(updated);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const existing = await this.catalogRepository.findCategoryById(categoryId);
    if (!existing) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Category was not found.');
    }
    const inUse = await this.catalogRepository.countBooksForCategory(categoryId);
    if (inUse > 0) {
      throw new ApiException(
        409,
        ErrorCode.VERSION_CONFLICT,
        'Category is still referenced by books.',
      );
    }
    await this.dataSource.transaction((manager) =>
      this.catalogRepository.deleteCategory(manager, categoryId),
    );
  }

  async listAuthors(query: TaxonomyListQueryDto) {
    const { items, total } = await this.catalogRepository.listAuthors(query);
    return {
      data: items.map(toNamedTaxonomyResponse),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async createAuthor(body: CreateNamedTaxonomyDto) {
    try {
      const author = await this.dataSource.transaction((manager) =>
        this.catalogRepository.createAuthor(manager, { name: body.name.trim() }),
      );
      return toNamedTaxonomyResponse(author);
    } catch (error) {
      rethrowDuplicateEntry(error, 'name');
    }
  }

  async patchAuthor(authorId: string, body: PatchTaxonomyDto) {
    const existing = await this.catalogRepository.findAuthorById(authorId);
    if (!existing) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Author was not found.');
    }

    const updated = await this.dataSource.transaction((manager) =>
      this.catalogRepository.renameAuthorIfUnchanged(manager, {
        authorId,
        expectedName: body.expectedName,
        name: body.name.trim(),
      }),
    );
    if (!updated) {
      throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Author name has changed.');
    }
    return toNamedTaxonomyResponse(updated);
  }

  async deleteAuthor(authorId: string): Promise<void> {
    const existing = await this.catalogRepository.findAuthorById(authorId);
    if (!existing) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Author was not found.');
    }
    const inUse = await this.catalogRepository.countBooksForAuthor(authorId);
    if (inUse > 0) {
      throw new ApiException(
        409,
        ErrorCode.VERSION_CONFLICT,
        'Author is still referenced by books.',
      );
    }
    await this.dataSource.transaction((manager) =>
      this.catalogRepository.deleteAuthor(manager, authorId),
    );
  }

  async listTopics(query: TaxonomyListQueryDto) {
    const { items, total } = await this.catalogRepository.listTopics(query);
    return {
      data: items.map(toNamedTaxonomyResponse),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async createTopic(body: CreateNamedTaxonomyDto) {
    try {
      const topic = await this.dataSource.transaction((manager) =>
        this.catalogRepository.createTopic(manager, { name: body.name.trim() }),
      );
      return toNamedTaxonomyResponse(topic);
    } catch (error) {
      rethrowDuplicateEntry(error, 'name');
    }
  }

  async patchTopic(topicId: string, body: PatchTaxonomyDto) {
    const existing = await this.catalogRepository.findTopicById(topicId);
    if (!existing) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Topic was not found.');
    }

    const updated = await this.dataSource.transaction((manager) =>
      this.catalogRepository.renameTopicIfUnchanged(manager, {
        topicId,
        expectedName: body.expectedName,
        name: body.name.trim(),
      }),
    );
    if (!updated) {
      throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Topic name has changed.');
    }
    return toNamedTaxonomyResponse(updated);
  }

  async deleteTopic(topicId: string): Promise<void> {
    const existing = await this.catalogRepository.findTopicById(topicId);
    if (!existing) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Topic was not found.');
    }
    const inUse = await this.catalogRepository.countBooksForTopic(topicId);
    if (inUse > 0) {
      throw new ApiException(
        409,
        ErrorCode.VERSION_CONFLICT,
        'Topic is still referenced by books.',
      );
    }
    await this.dataSource.transaction((manager) =>
      this.catalogRepository.deleteTopic(manager, topicId),
    );
  }

  async listCopies(bookId: string, query: TaxonomyListQueryDto) {
    const book = await this.catalogRepository.findBookById(bookId);
    if (!book) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Book was not found.');
    }
    const { items, total } = await this.catalogRepository.listCopiesForBook(
      bookId,
      query.page,
      query.pageSize,
    );
    return {
      data: items.map(toAdminCopyResponse),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async createCopy(
    bookId: string,
    body: CreateCopyDto,
    actorUserId: string,
    requestId: string,
  ): Promise<AdminCopyResponse> {
    const book = await this.catalogRepository.findBookById(bookId);
    if (!book) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Book was not found.');
    }

    try {
      const copy = await this.dataSource.transaction(async (manager) => {
        const created = await this.catalogRepository.createCopy(manager, {
          bookId,
          barcode: body.barcode.trim(),
          shelfLocation: body.shelfLocation ?? null,
        });

        await this.auditService.append(manager, {
          actorUserId,
          action: 'catalog.copy.create',
          targetType: 'book_copy',
          targetId: created.id,
          outcome: 'success',
          requestId,
          details: { bookId, barcode: created.barcode },
        });

        return created;
      });

      return toAdminCopyResponse(copy);
    } catch (error) {
      rethrowDuplicateEntry(error, 'barcode');
    }
  }

  async updateCopy(
    copyId: string,
    body: UpdateCopyDto,
    actorUserId: string,
    requestId: string,
  ): Promise<AdminCopyResponse> {
    const existing = await this.catalogRepository.findCopyById(copyId);
    if (!existing) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Copy was not found.');
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      if (body.conditionState !== undefined) {
        await this.circulationInventoryService.assertCopyAvailableForMutation(copyId, manager);
      }
      const copy = await this.catalogRepository.updateCopyWithVersion(manager, {
        copyId,
        expectedVersion: body.version,
        shelfLocation: body.shelfLocation,
        conditionState: body.conditionState,
      });
      if (!copy) {
        throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Copy version is stale.');
      }

      await this.auditService.append(manager, {
        actorUserId,
        action: 'catalog.copy.update',
        targetType: 'book_copy',
        targetId: copyId,
        outcome: 'success',
        requestId,
        details: {
          shelfLocation: copy.shelfLocation,
          conditionState: copy.conditionState,
        },
      });

      return copy;
    });

    return toAdminCopyResponse(updated);
  }

  private async toBookResponse(book: Book): Promise<AdminBookResponse> {
    const authorIds = await this.catalogRepository.getAuthorIdsForBook(book.id);
    const topicIds = await this.catalogRepository.getTopicIdsForBook(book.id);
    return toAdminBookResponse(book, { authorIds, topicIds });
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.catalogRepository.findCategoryById(categoryId);
    if (!category) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Category was not found.');
    }
  }

  private async assertAuthorIdsExist(authorIds: string[]): Promise<void> {
    if (authorIds.length === 0) {
      return;
    }
    const count = await this.catalogRepository.countAuthorsByIds(
      this.dataSource.manager,
      authorIds,
    );
    if (count !== authorIds.length) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'One or more authors were not found.');
    }
  }

  private async assertTopicIdsExist(topicIds: string[]): Promise<void> {
    if (topicIds.length === 0) {
      return;
    }
    const count = await this.catalogRepository.countTopicsByIds(this.dataSource.manager, topicIds);
    if (count !== topicIds.length) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'One or more topics were not found.');
    }
  }

  private assertPublicationYearAllowed(publicationYear: number | null): void {
    if (publicationYear === null) {
      return;
    }
    const currentYear = this.clock.now().getUTCFullYear();
    if (publicationYear > currentYear) {
      throw new ApiException(
        422,
        ErrorCode.VALIDATION_FAILED,
        'Publication year cannot be in the future.',
        [{ field: 'publicationYear', code: 'OUT_OF_RANGE' }],
      );
    }
  }

  private async assertPublishable(book: Book): Promise<void> {
    if (!book.title.trim()) {
      throw new ApiException(
        409,
        ErrorCode.INVALID_TRANSITION,
        'Published books must have a title.',
      );
    }
    await this.assertCategoryExists(book.categoryId);
    this.assertPublicationYearAllowed(book.publicationYear);
  }
}
