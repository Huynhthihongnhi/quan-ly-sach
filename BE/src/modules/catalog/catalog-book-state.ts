import type { BookState } from './entities/book.entity';

const ALLOWED_TRANSITIONS: Record<BookState, readonly BookState[]> = {
  draft: ['published', 'archived'],
  published: ['archived'],
  archived: ['published'],
};

export function isAllowedBookStateTransition(from: BookState, to: BookState): boolean {
  if (from === to) {
    return true;
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}
