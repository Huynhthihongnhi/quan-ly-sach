import { Book } from '../entities/book.entity';
import { BookCopy } from '../entities/book-copy.entity';

export interface AdminBookResponse {
  id: string;
  title: string;
  categoryId: string;
  isbn: string | null;
  publisherName: string | null;
  publicationYear: number | null;
  description: string | null;
  state: string;
  version: string;
  authorIds: string[];
  topicIds: string[];
  availableCopies: null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCopyResponse {
  id: string;
  bookId: string;
  barcode: string;
  shelfLocation: string | null;
  conditionState: string;
  version: string;
  createdAt: string;
}

export interface TaxonomyItemResponse {
  id: string;
  name: string;
  code?: string;
}

export function toAdminBookResponse(
  book: Book,
  links: { authorIds: string[]; topicIds: string[] },
): AdminBookResponse {
  return {
    id: book.id,
    title: book.title,
    categoryId: book.categoryId,
    isbn: book.isbn,
    publisherName: book.publisherName,
    publicationYear: book.publicationYear,
    description: book.description,
    state: book.state,
    version: book.version,
    authorIds: links.authorIds,
    topicIds: links.topicIds,
    availableCopies: null,
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  };
}

export function toAdminCopyResponse(copy: BookCopy): AdminCopyResponse {
  return {
    id: copy.id,
    bookId: copy.bookId,
    barcode: copy.barcode,
    shelfLocation: copy.shelfLocation,
    conditionState: copy.conditionState,
    version: copy.version,
    createdAt: copy.createdAt.toISOString(),
  };
}

export function toCategoryResponse(category: { id: string; code: string; name: string }) {
  return { id: category.id, code: category.code, name: category.name };
}

export function toNamedTaxonomyResponse(item: { id: string; name: string }) {
  return { id: item.id, name: item.name };
}
