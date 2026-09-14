import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { LibraryCard, LibraryCardState } from './entities/library-card.entity';

export interface ListCardsAdminParams {
  userId?: string;
  state?: LibraryCardState;
  page: number;
  pageSize: number;
}

@Injectable()
export class CardsRepository {
  constructor(
    @InjectRepository(LibraryCard)
    private readonly cards: Repository<LibraryCard>,
  ) {}

  findById(cardId: string): Promise<LibraryCard | null> {
    return this.cards.findOne({ where: { id: cardId } });
  }

  findByCardNumber(cardNumber: string): Promise<LibraryCard | null> {
    return this.cards.findOne({ where: { cardNumber } });
  }

  findActiveCardForUser(userId: string): Promise<LibraryCard | null> {
    return this.cards.findOne({ where: { userId, state: 'active' } });
  }

  async findByIdForUpdate(manager: EntityManager, cardId: string): Promise<LibraryCard | null> {
    return manager
      .getRepository(LibraryCard)
      .createQueryBuilder('card')
      .where('card.id = :cardId', { cardId })
      .setLock('pessimistic_write')
      .getOne();
  }

  async findCardsForUserForUpdate(manager: EntityManager, userId: string): Promise<LibraryCard[]> {
    return manager
      .getRepository(LibraryCard)
      .createQueryBuilder('card')
      .where('card.user_id = :userId', { userId })
      .orderBy('card.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
  }

  async listForUser(params: {
    userId: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: LibraryCard[]; total: number }> {
    const qb = this.cards
      .createQueryBuilder('card')
      .where('card.user_id = :userId', { userId: params.userId })
      .orderBy('card.id', 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();

    return { items, total };
  }

  async listAdmin(params: ListCardsAdminParams): Promise<{ items: LibraryCard[]; total: number }> {
    const qb = this.cards.createQueryBuilder('card').orderBy('card.id', 'DESC');

    if (params.userId) {
      qb.andWhere('card.user_id = :userId', { userId: params.userId });
    }
    if (params.state) {
      qb.andWhere('card.state = :state', { state: params.state });
    }

    const total = await qb.getCount();
    const items = await qb
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();

    return { items, total };
  }

  async createCard(
    manager: EntityManager,
    input: {
      userId: string;
      cardNumber: string;
      state: LibraryCardState;
      issuedAt: Date;
      expiresAt: Date;
      issuedBy: string;
    },
  ): Promise<LibraryCard> {
    const repository = manager.getRepository(LibraryCard);
    const card = repository.create({
      userId: input.userId,
      cardNumber: input.cardNumber,
      state: input.state,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      issuedBy: input.issuedBy,
    });
    return repository.save(card);
  }

  async updateState(
    manager: EntityManager,
    cardId: string,
    state: LibraryCardState,
  ): Promise<void> {
    await manager.getRepository(LibraryCard).update({ id: cardId }, { state });
  }
}
