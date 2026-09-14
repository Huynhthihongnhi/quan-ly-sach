import { PublicDigitalAssetResponse } from '../../digital/mappers/public-digital-asset.mapper';
import { Author } from '../entities/author.entity';
import { Book } from '../entities/book.entity';
import { Category } from '../entities/category.entity';
import { Topic } from '../entities/topic.entity';

export interface PublicNamedRef {
  id: string;
  name: string;
}

export interface PublicBookSummaryResponse {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  isbn: string | null;
  publicationYear: number | null;
  authors: PublicNamedRef[];
  topics: PublicNamedRef[];
}

export interface PublicBookDetailResponse extends PublicBookSummaryResponse {
  publisherName: string | null;
  description: string | null;
  availableCopies: number | null;
  digitalAssets: PublicDigitalAssetResponse[];
}

export function toPublicBookSummary(
  book: Book,
  category: Category,
  authors: Author[],
  topics: Topic[],
): PublicBookSummaryResponse {
  return {
    id: book.id,
    title: book.title,
    categoryId: book.categoryId,
    categoryName: category.name,
    isbn: book.isbn,
    publicationYear: book.publicationYear,
    authors: authors.map((author) => ({ id: author.id, name: author.name })),
    topics: topics.map((topic) => ({ id: topic.id, name: topic.name })),
  };
}

export function toPublicBookDetail(
  book: Book,
  category: Category,
  authors: Author[],
  topics: Topic[],
  digitalAssets: PublicDigitalAssetResponse[],
  availableCopies: number | null,
): PublicBookDetailResponse {
  return {
    ...toPublicBookSummary(book, category, authors, topics),
    publisherName: book.publisherName,
    description: book.description,
    availableCopies,
    digitalAssets,
  };
}
