import { LibraryCard } from '../entities/library-card.entity';

export interface LibraryCardResponse {
  id: string;
  userId: string;
  cardNumber: string;
  state: LibraryCard['state'];
  issuedAt: string;
  expiresAt: string;
  issuedBy: string;
}

export function toLibraryCardResponse(card: LibraryCard): LibraryCardResponse {
  return {
    id: card.id,
    userId: card.userId,
    cardNumber: card.cardNumber,
    state: card.state,
    issuedAt: card.issuedAt.toISOString(),
    expiresAt: card.expiresAt.toISOString(),
    issuedBy: card.issuedBy,
  };
}
