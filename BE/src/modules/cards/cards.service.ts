import { Inject, Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { DataSource } from 'typeorm';
import { ApiException } from '../../common/http/api.exception';
import { ErrorCode } from '../../common/http/error-code';
import { buildPageMeta } from '../../common/http/pagination/page-meta';
import { CLOCK, Clock } from '../../platform/clock/clock.interface';
import { AuditService } from '../audit/audit.service';
import { UserRepository } from '../identity/user.repository';
import { isAllowedCardStateTransition } from './card-state';
import { CardsRepository } from './cards.repository';
import { IssueLibraryCardDto } from './dto/issue-library-card.dto';
import { LibraryCardListQueryDto } from './dto/library-card-list-query.dto';
import { UpdateLibraryCardStateDto } from './dto/update-library-card-state.dto';
import { LibraryCard, LibraryCardState } from './entities/library-card.entity';
import { LibraryCardResponse, toLibraryCardResponse } from './mappers/library-card.mapper';

@Injectable()
export class CardsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cardsRepository: CardsRepository,
    private readonly userRepository: UserRepository,
    private readonly auditService: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async listOwnCards(userId: string, query: LibraryCardListQueryDto) {
    const { items, total } = await this.cardsRepository.listForUser({
      userId,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      data: items.map(toLibraryCardResponse),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async listAdminCards(query: LibraryCardListQueryDto) {
    const { items, total } = await this.cardsRepository.listAdmin({
      userId: query.userId,
      state: query.state,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      data: items.map(toLibraryCardResponse),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async issueCard(
    body: IssueLibraryCardDto,
    actorUserId: string,
    requestId: string,
  ): Promise<LibraryCardResponse> {
    const now = this.clock.now();
    const expiresAt = new Date(body.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
      throw new ApiException(422, ErrorCode.VALIDATION_FAILED, 'expiresAt must be in the future.');
    }

    const cardNumber = body.cardNumber.trim();
    if (cardNumber.length === 0) {
      throw new ApiException(422, ErrorCode.VALIDATION_FAILED, 'cardNumber is required.');
    }

    try {
      const created = await this.dataSource.transaction(async (manager) => {
        const user = await this.userRepository.findByIdForUpdate(manager, body.userId);
        if (!user) {
          throw new ApiException(404, ErrorCode.NOT_FOUND, 'User was not found.');
        }
        if (user.status !== 'active') {
          throw new ApiException(409, ErrorCode.INVALID_TRANSITION, 'User is not active.');
        }

        const existingCards = await this.cardsRepository.findCardsForUserForUpdate(
          manager,
          body.userId,
        );
        for (const card of existingCards) {
          if (card.state !== 'active') {
            continue;
          }
          const nextState: LibraryCardState = card.expiresAt <= now ? 'expired' : 'revoked';
          await this.cardsRepository.updateState(manager, card.id, nextState);
        }

        const card = await this.cardsRepository.createCard(manager, {
          userId: body.userId,
          cardNumber,
          state: 'active',
          issuedAt: now,
          expiresAt,
          issuedBy: actorUserId,
        });

        await this.auditService.append(manager, {
          actorUserId,
          action: 'cards.card.issue',
          targetType: 'library_card',
          targetId: card.id,
          outcome: 'success',
          requestId,
          details: { userId: body.userId, cardNumber },
        });

        return card;
      });

      return toLibraryCardResponse(created);
    } catch (error) {
      rethrowDuplicateCardNumber(error);
    }
  }

  async updateCardState(
    cardId: string,
    body: UpdateLibraryCardStateDto,
    actorUserId: string,
    requestId: string,
  ): Promise<LibraryCardResponse> {
    const now = this.clock.now();

    const updated = await this.dataSource.transaction(async (manager) => {
      const card = await this.cardsRepository.findByIdForUpdate(manager, cardId);
      if (!card) {
        throw new ApiException(404, ErrorCode.NOT_FOUND, 'Library card was not found.');
      }

      if (card.state !== body.expectedState) {
        throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Card state has changed.');
      }

      if (!isAllowedCardStateTransition(card.state, body.state)) {
        throw new ApiException(
          409,
          ErrorCode.INVALID_TRANSITION,
          'Card state transition is not allowed.',
        );
      }

      if (body.state === 'active') {
        const user = await this.userRepository.findByIdForUpdate(manager, card.userId);
        if (!user || user.status !== 'active') {
          throw new ApiException(409, ErrorCode.INVALID_TRANSITION, 'User is not active.');
        }
        if (card.expiresAt <= now) {
          throw new ApiException(409, ErrorCode.INVALID_TRANSITION, 'Card has expired.');
        }

        const siblings = await this.cardsRepository.findCardsForUserForUpdate(manager, card.userId);
        for (const sibling of siblings) {
          if (sibling.id === card.id || sibling.state !== 'active') {
            continue;
          }
          await this.cardsRepository.updateState(manager, sibling.id, 'revoked');
        }
      }

      await this.cardsRepository.updateState(manager, card.id, body.state);
      const saved = await this.cardsRepository.findByIdForUpdate(manager, cardId);
      if (!saved) {
        throw new ApiException(500, ErrorCode.INTERNAL_ERROR, 'Library card update failed.');
      }

      await this.auditService.append(manager, {
        actorUserId,
        action: 'cards.card.state',
        targetType: 'library_card',
        targetId: saved.id,
        outcome: 'success',
        requestId,
        details: { state: body.state },
      });

      return saved;
    });

    return toLibraryCardResponse(updated);
  }

  async assertActiveCardForUser(actingUserId: string, at?: Date): Promise<LibraryCard> {
    const card = await this.cardsRepository.findActiveCardForUser(actingUserId);
    if (!card) {
      throw new ApiException(403, ErrorCode.FORBIDDEN, 'An active library card is required.');
    }
    this.assertCardEffective(card, at ?? this.clock.now());
    return card;
  }

  async assertCardUsableForUser(params: {
    actingUserId: string;
    cardNumber: string;
    at?: Date;
  }): Promise<LibraryCard> {
    const now = params.at ?? this.clock.now();
    const card = await this.cardsRepository.findByCardNumber(params.cardNumber.trim());
    if (!card) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Library card was not found.');
    }
    if (card.userId !== params.actingUserId) {
      throw new ApiException(
        403,
        ErrorCode.FORBIDDEN,
        'Library card does not belong to the signed-in user.',
      );
    }
    this.assertCardEffective(card, now);
    return card;
  }

  assertCardEffective(card: LibraryCard, at: Date): void {
    if (card.state !== 'active') {
      throw new ApiException(409, ErrorCode.INVALID_TRANSITION, 'Library card is not active.');
    }
    if (at < card.issuedAt || at >= card.expiresAt) {
      throw new ApiException(
        409,
        ErrorCode.INVALID_TRANSITION,
        'Library card is outside its validity window.',
      );
    }
  }
}

function rethrowDuplicateCardNumber(error: unknown): never {
  if (error instanceof ApiException) {
    throw error;
  }
  if (error instanceof QueryFailedError && (error as { code?: string }).code === 'ER_DUP_ENTRY') {
    throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Card number is already in use.');
  }
  throw error;
}
