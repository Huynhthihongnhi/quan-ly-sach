import { Inject, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { ApiException } from '../../common/http/api.exception';
import { ErrorCode } from '../../common/http/error-code';
import { CLOCK, Clock } from '../../platform/clock/clock.interface';
import { AuditService } from '../audit/audit.service';
import { AuthConfigService } from '../auth/auth-config.service';
import { RateLimitRepository } from '../auth/rate-limit.repository';
import { CardsRepository } from '../cards/cards.repository';
import { CardsService } from '../cards/cards.service';
import { CatalogRepository } from '../catalog/catalog.repository';
import { User } from '../identity/entities/user.entity';
import { verifyPassword } from '../identity/password-hasher';
import { UserRepository } from '../identity/user.repository';
import { CirculationConfigService } from './circulation-config.service';
import { CirculationInventoryService } from './circulation-inventory.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { buildLoanRequestHash, normalizeLoanCardNumber } from './loan-request-hash.util';
import { LoanResponse, toLoanResponse } from './mappers/loan.mapper';
import { LoansRepository } from './loans.repository';

const INVALID_PASSWORD_MESSAGE = 'Invalid email or password.';
const REAUTH_RATE_LIMIT_MESSAGE = 'Too many failed password attempts.';

export interface CreateLoanResult {
  replay: boolean;
  data: LoanResponse;
}

@Injectable()
export class LoansService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly loansRepository: LoansRepository,
    private readonly circulationInventory: CirculationInventoryService,
    private readonly circulationConfig: CirculationConfigService,
    private readonly catalogRepository: CatalogRepository,
    private readonly cardsService: CardsService,
    private readonly cardsRepository: CardsRepository,
    private readonly userRepository: UserRepository,
    private readonly rateLimitRepository: RateLimitRepository,
    private readonly authConfig: AuthConfigService,
    private readonly auditService: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async createReservation(params: {
    actingUserId: string;
    body: CreateLoanDto;
    idempotencyKey: string;
    requestId: string;
  }): Promise<CreateLoanResult> {
    await this.circulationInventory.assertSchemaReady();
    if (!this.circulationInventory.isEnabled()) {
      throw new ApiException(503, ErrorCode.DEPENDENCY_UNAVAILABLE, 'Circulation is not enabled.');
    }

    const requestHash = buildLoanRequestHash({
      bookId: params.body.bookId,
      cardNumber: params.body.cardNumber,
      requestedDays: params.body.requestedDays,
    });

    const replay = await this.tryReplayExisting({
      userId: params.actingUserId,
      requestKey: params.idempotencyKey,
      requestHash,
    });
    if (replay) {
      return { replay: true, data: replay };
    }

    await this.assertPasswordForNewRequest(params.actingUserId, params.body.password);

    try {
      const created = await this.dataSource.transaction((manager) =>
        this.createReservationInTransaction(manager, {
          actingUserId: params.actingUserId,
          body: params.body,
          idempotencyKey: params.idempotencyKey,
          requestHash,
          requestId: params.requestId,
        }),
      );
      return { replay: false, data: created };
    } catch (error) {
      return this.recoverFromDuplicateRequest(error, {
        userId: params.actingUserId,
        requestKey: params.idempotencyKey,
        requestHash,
      });
    }
  }

  private async tryReplayExisting(input: {
    userId: string;
    requestKey: string;
    requestHash: Buffer;
  }): Promise<LoanResponse | null> {
    const existing = await this.loansRepository.findByUserAndRequestKey(
      input.userId,
      input.requestKey,
    );
    if (!existing) {
      return null;
    }
    if (!requestHashesMatch(existing.requestHash, input.requestHash)) {
      throw new ApiException(
        409,
        ErrorCode.IDEMPOTENCY_CONFLICT,
        'Idempotency key was already used with a different payload.',
      );
    }
    const bookId = await this.loansRepository.findBookIdForCopy(
      this.dataSource.manager,
      existing.copyId,
    );
    if (!bookId) {
      throw new ApiException(500, ErrorCode.INTERNAL_ERROR, 'Loan copy reference is missing.');
    }
    return toLoanResponse(existing, bookId);
  }

  private async recoverFromDuplicateRequest(
    error: unknown,
    input: { userId: string; requestKey: string; requestHash: Buffer },
  ): Promise<CreateLoanResult> {
    if (!isDuplicateRequestKeyError(error)) {
      throw error;
    }
    const replay = await this.tryReplayExisting(input);
    if (!replay) {
      throw error;
    }
    return { replay: true, data: replay };
  }

  private async assertPasswordForNewRequest(userId: string, password: string): Promise<void> {
    const userWithHash = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .getOne();

    const passwordValid = userWithHash?.passwordHash
      ? await verifyPassword(password, userWithHash.passwordHash)
      : false;

    if (passwordValid) {
      return;
    }

    await this.recordLoanReauthFailure(userId);
    throw new ApiException(401, ErrorCode.INVALID_CREDENTIALS, INVALID_PASSWORD_MESSAGE);
  }

  private async recordLoanReauthFailure(userId: string): Promise<void> {
    const now = this.clock.now();
    const windowStart = new Date(
      now.getTime() - (now.getTime() % this.circulationConfig.loanReauthWindowMs),
    );
    const expiresAt = new Date(windowStart.getTime() + this.circulationConfig.loanReauthWindowMs);
    const subjectHash = this.rateLimitRepository.hashSubject(
      this.authConfig.rateLimitHmacSecret,
      `loan-reauth:user:${userId}`,
    );

    await this.dataSource.transaction(async (manager) => {
      const result = await this.rateLimitRepository.consume(manager, {
        scope: 'loan.reauth',
        subjectHash,
        windowStart,
        expiresAt,
        maxRequests: this.circulationConfig.loanReauthMaxFailures,
        now,
      });
      if (!result.allowed) {
        throw new ApiException(
          429,
          ErrorCode.RATE_LIMITED,
          REAUTH_RATE_LIMIT_MESSAGE,
          undefined,
          Math.ceil(result.retryAfterMs / 1000),
        );
      }
    });
  }

  private async createReservationInTransaction(
    manager: EntityManager,
    params: {
      actingUserId: string;
      body: CreateLoanDto;
      idempotencyKey: string;
      requestHash: Buffer;
      requestId: string;
    },
  ): Promise<LoanResponse> {
    const now = this.clock.now();

    const user = await this.userRepository.findByIdForUpdate(manager, params.actingUserId);
    if (!user || user.status !== 'active') {
      throw new ApiException(403, ErrorCode.FORBIDDEN, 'User account cannot create loans.');
    }

    const existingLoan = await this.loansRepository.findByUserAndRequestKeyInTransaction(
      manager,
      params.actingUserId,
      params.idempotencyKey,
    );
    if (existingLoan) {
      if (!requestHashesMatch(existingLoan.requestHash, params.requestHash)) {
        throw new ApiException(
          409,
          ErrorCode.IDEMPOTENCY_CONFLICT,
          'Idempotency key was already used with a different payload.',
        );
      }
      const bookId = await this.loansRepository.findBookIdForCopy(manager, existingLoan.copyId);
      if (!bookId) {
        throw new ApiException(500, ErrorCode.INTERNAL_ERROR, 'Loan copy reference is missing.');
      }
      return toLoanResponse(existingLoan, bookId);
    }

    const card = await this.cardsRepository.findByCardNumber(
      normalizeLoanCardNumber(params.body.cardNumber),
    );
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

    const lockedCard = await this.cardsRepository.findByIdForUpdate(manager, card.id);
    if (!lockedCard) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Library card was not found.');
    }
    try {
      this.cardsService.assertCardEffective(lockedCard, now);
    } catch (error) {
      if (error instanceof ApiException) {
        throw new ApiException(error.getStatus(), ErrorCode.CARD_NOT_ELIGIBLE, error.message);
      }
      throw error;
    }

    const activeCount = await this.loansRepository.countActiveLoansForUser(
      manager,
      params.actingUserId,
    );
    if (activeCount >= this.circulationConfig.maxActiveLoans) {
      throw new ApiException(
        409,
        ErrorCode.ACTIVE_LOAN_LIMIT,
        'Active loan limit has been reached.',
      );
    }

    const book = await this.catalogRepository.findBookByIdForUpdate(manager, params.body.bookId);
    if (!book || book.state !== 'published') {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Book was not found.');
    }

    await this.loansRepository.expireStaleReservations(manager, now);

    const reservedAt = now;
    const reservationExpiresAt = new Date(now.getTime() + this.circulationConfig.reservationTtlMs);

    const loan = await this.insertLoanOnFirstAvailableCopy(manager, {
      bookId: params.body.bookId,
      userId: params.actingUserId,
      cardId: lockedCard.id,
      requestKey: params.idempotencyKey,
      requestHash: params.requestHash,
      requestedDays: params.body.requestedDays,
      reservedAt,
      reservationExpiresAt,
    });

    await this.loansRepository.appendLoanEvent(manager, {
      loanId: loan.id,
      actorUserId: params.actingUserId,
      fromState: null,
      toState: 'reserved',
      requestId: params.requestId,
    });

    await this.auditService.append(manager, {
      actorUserId: params.actingUserId,
      action: 'loan.reserve',
      targetType: 'loan',
      targetId: loan.id,
      outcome: 'success',
      requestId: params.requestId,
      details: { bookId: params.body.bookId, copyId: loan.copyId },
    });

    return toLoanResponse(loan, params.body.bookId);
  }

  private async insertLoanOnFirstAvailableCopy(
    manager: EntityManager,
    input: {
      bookId: string;
      userId: string;
      cardId: string;
      requestKey: string;
      requestHash: Buffer;
      requestedDays: number;
      reservedAt: Date;
      reservationExpiresAt: Date;
    },
  ) {
    const copyIds = await this.loansRepository.listServiceableCopyIdsForBook(manager, input.bookId);
    let attempts = 0;
    for (const copyId of copyIds) {
      if (attempts >= this.circulationConfig.maxCopyPickAttempts) {
        break;
      }
      const busy = await this.loansRepository.copyHasActiveLoan(manager, copyId);
      if (busy) {
        attempts += 1;
        continue;
      }
      try {
        return await this.loansRepository.insertLoan(manager, {
          userId: input.userId,
          cardId: input.cardId,
          copyId,
          requestKey: input.requestKey,
          requestHash: input.requestHash,
          requestedDays: input.requestedDays,
          reservedAt: input.reservedAt,
          reservationExpiresAt: input.reservationExpiresAt,
        });
      } catch (error) {
        if (isDuplicateActiveCopyError(error)) {
          attempts += 1;
          continue;
        }
        throw error;
      }
    }
    throw new ApiException(409, ErrorCode.NO_COPY_AVAILABLE, 'No copy is available to reserve.');
  }
}

function requestHashesMatch(stored: Buffer, incoming: Buffer): boolean {
  if (stored.length !== incoming.length) {
    return false;
  }
  return timingSafeEqual(stored, incoming);
}

function isDuplicateRequestKeyError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = (error as QueryFailedError & { driverError?: { message?: string } })
    .driverError;
  const message = driverError?.message ?? error.message;
  return (
    (error as { code?: string }).code === 'ER_DUP_ENTRY' && message.includes('uq_loans_request')
  );
}

function isDuplicateActiveCopyError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = (error as QueryFailedError & { driverError?: { message?: string } })
    .driverError;
  const message = driverError?.message ?? error.message;
  return (
    (error as { code?: string }).code === 'ER_DUP_ENTRY' && message.includes('uq_loans_active_copy')
  );
}
