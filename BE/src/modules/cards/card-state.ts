import type { LibraryCardState } from './entities/library-card.entity';

const ALLOWED_TRANSITIONS: Record<LibraryCardState, readonly LibraryCardState[]> = {
  active: ['suspended', 'revoked', 'expired'],
  suspended: ['active', 'revoked', 'expired'],
  revoked: [],
  expired: [],
};

export function isAllowedCardStateTransition(
  from: LibraryCardState,
  to: LibraryCardState,
): boolean {
  if (from === to) {
    return true;
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}
