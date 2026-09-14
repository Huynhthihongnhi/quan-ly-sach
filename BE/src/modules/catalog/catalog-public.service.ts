import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ApiException } from '../../common/http/api.exception';
import { ErrorCode } from '../../common/http/error-code';
import { buildPageMeta } from '../../common/http/pagination/page-meta';
import { parseSortParam } from '../../common/http/pagination/sort-allowlist';
import { CirculationInventoryService } from '../circulation/circulation-inventory.service';
import { DigitalAssetsService } from '../digital/digital-assets.service';
import { CatalogPublicRepository } from './catalog-public.repository';
import { PublicBookListQueryDto } from './dto/public-book-list-query.dto';
import { TaxonomyListQueryDto } from './dto/taxonomy-list-query.dto';
import {
  PublicBookDetailResponse,
  PublicBookSummaryResponse,
  toPublicBookDetail,
  toPublicBookSummary,
} from './mappers/public-book.mapper';
import { toCategoryResponse, toNamedTaxonomyResponse } from './mappers/admin-book.mapper';

const PUBLIC_BOOK_SORT_ALLOWLIST = ['id', 'title', 'publicationYear'] as const;

@Injectable()
export class CatalogPublicService {
  constructor(
    private readonly catalogPublicRepository: CatalogPublicRepository,
    private readonly digitalAssetsService: DigitalAssetsService,
    private readonly circulationInventoryService: CirculationInventoryService,
  ) {}

  async listBooks(query: PublicBookListQueryDto): Promise<{
    data: PublicBookSummaryResponse[];
    meta: ReturnType<typeof buildPageMeta>;
  }> {
    const sort = this.parseBookSort(query.sort);
    const { items, total } = await this.catalogPublicRepository.listPublishedBooks({
      filters: {
        q: query.q,
        title: query.title,
        author: query.author,
        categoryId: query.categoryId,
        topicId: query.topicId,
        year: query.year,
      },
      page: query.page,
      pageSize: query.pageSize,
      sort,
    });

    const categoryIds = [...new Set(items.map((book) => book.categoryId))];
    const bookIds = items.map((book) => book.id);
    const [categoriesById, authorsByBookId, topicsByBookId] = await Promise.all([
      this.catalogPublicRepository.findCategoriesByIds(categoryIds),
      this.catalogPublicRepository.listAuthorsByBookIds(bookIds),
      this.catalogPublicRepository.listTopicsByBookIds(bookIds),
    ]);

    const data = items.map((book) => {
      const category = categoriesById.get(book.categoryId);
      if (!category) {
        throw new ApiException(500, ErrorCode.INTERNAL_ERROR, 'Book category is missing.');
      }
      const authors = authorsByBookId.get(book.id) ?? [];
      const topics = topicsByBookId.get(book.id) ?? [];
      return toPublicBookSummary(book, category, authors, topics);
    });

    return {
      data,
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async getBook(bookId: string): Promise<PublicBookDetailResponse> {
    const book = await this.catalogPublicRepository.findPublishedBookById(bookId);
    if (!book) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Book was not found.');
    }

    const category = await this.catalogPublicRepository.findCategoryById(book.categoryId);
    if (!category) {
      throw new ApiException(500, ErrorCode.INTERNAL_ERROR, 'Book category is missing.');
    }
    const authors = await this.catalogPublicRepository.listAuthorsForBook(book.id);
    const topics = await this.catalogPublicRepository.listTopicsForBook(book.id);
    const digitalAssets = await this.digitalAssetsService.listPublicMetadataForBook(book.id);
    const availableCopies = await this.resolveAvailableCopies(book.id);
    return toPublicBookDetail(book, category, authors, topics, digitalAssets, availableCopies);
  }

  private async resolveAvailableCopies(bookId: string): Promise<number | null> {
    if (!this.circulationInventoryService.isEnabled()) {
      return null;
    }
    return this.circulationInventoryService.countAvailableCopiesForBook(bookId);
  }

  async listCategories(query: TaxonomyListQueryDto) {
    const { items, total } = await this.catalogPublicRepository.listPublicCategories(query);
    return {
      data: items.map(toCategoryResponse),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async listAuthors(query: TaxonomyListQueryDto) {
    const { items, total } = await this.catalogPublicRepository.listPublicAuthors(query);
    return {
      data: items.map(toNamedTaxonomyResponse),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async listTopics(query: TaxonomyListQueryDto) {
    const { items, total } = await this.catalogPublicRepository.listPublicTopics(query);
    return {
      data: items.map(toNamedTaxonomyResponse),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  private parseBookSort(sort: string | undefined): {
    field: (typeof PUBLIC_BOOK_SORT_ALLOWLIST)[number];
    direction: 'asc' | 'desc';
  } {
    try {
      const parsed = parseSortParam(sort, PUBLIC_BOOK_SORT_ALLOWLIST);
      return {
        field: parsed.field as (typeof PUBLIC_BOOK_SORT_ALLOWLIST)[number],
        direction: parsed.direction,
      };
    } catch {
      throw new UnprocessableEntityException('Sort field is not allowed.');
    }
  }
}
