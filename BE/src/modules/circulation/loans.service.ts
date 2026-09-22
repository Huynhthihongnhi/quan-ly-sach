import { Inject, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { DataSource, QueryFailedError, type EntityManager } from 'typeorm';
import { ApiException } from '../../common/http/api.exception';
import { ErrorCode } from '../../common/http/error-code';
import { buildPageMeta } from '../../common/http/pagination/page-meta';
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
import { runWithDeadlockRetry } from './loan-deadlock.util';
import { computeDueAt } from './loan-due-date.util';
import { buildLoanRequestHash, normalizeLoanCardNumber } from './loan-request-hash.util';
import {
  assertReservationActiveForCheckout,
  isAllowedLoanTransition,
  type LoanTransitionAction,
  targetStateForAction,
} from './loan-state';
import { AdminLoanListQueryDto, OwnLoanListQueryDto } from './dto/loan-list-query.dto';
import {
  LoanDetailResponse,
  LoanResponse,
  toAdminLoanResponse,
  toLoanEventResponse,
  toLoanResponse,
} from './mappers/loan.mapper';
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

  async cancelLoan(params: {
    loanId: string;
    actingUserId: string;
    permissionCodes: string[];
    expectedVersion: string;
    reason?: string | null;
    requestId: string;
  }): Promise<LoanResponse> {
    return this.runTransition({
      ...params,
      action: 'cancel',
      auditAction: 'loan.cancel',
    });
  }

  async checkoutLoan(params: {
    loanId: string;
    actingUserId: string;
    permissionCodes: string[];
    expectedVersion: string;
    requestId: string;
  }): Promise<LoanResponse> {
    return this.runTransition({
      ...params,
      action: 'checkout',
      auditAction: 'loan.checkout',
      requireManage: true,
    });
  }

  async returnLoan(params: {
    loanId: string;
    actingUserId: string;
    permissionCodes: string[];
    expectedVersion: string;
    conditionState: 'serviceable' | 'repair';
    requestId: string;
  }): Promise<LoanResponse> {
    return this.runTransition({
      ...params,
      action: 'return',
      auditAction: 'loan.return',
      requireManage: true,
      copyConditionState: params.conditionState,
    });
  }

  async markLostLoan(params: {
    loanId: string;
    actingUserId: string;
    permissionCodes: string[];
    expectedVersion: string;
    reason: string;
    requestId: string;
  }): Promise<LoanResponse> {
    return this.runTransition({
      ...params,
      action: 'mark_lost',
      auditAction: 'loan.lost',
      requireManage: true,
      copyConditionState: 'lost',
      transitionReason: params.reason,
    });
  }

  private async runTransition(params: {
    loanId: string;
    actingUserId: string;
    permissionCodes: string[];
    expectedVersion: string;
    requestId: string;
    action: LoanTransitionAction;
    auditAction: string;
    requireManage?: boolean;
    reason?: string | null;
    transitionReason?: string;
    copyConditionState?: 'serviceable' | 'repair' | 'lost';
  }): Promise<LoanResponse> {
    await this.circulationInventory.assertSchemaReady();
    if (!this.circulationInventory.isEnabled()) {
      throw new ApiException(503, ErrorCode.DEPENDENCY_UNAVAILABLE, 'Circulation is not enabled.');
    }

    if (params.requireManage && !params.permissionCodes.includes('loans.manage')) {
      throw new ApiException(
        403,
        ErrorCode.FORBIDDEN,
        'You do not have permission for this action.',
      );
    }

    return runWithDeadlockRetry(this.circulationConfig.loanTransitionDeadlockRetries, () =>
      this.dataSource.transaction((manager) => this.transitionInTransaction(manager, params)),
    );
  }

  private async transitionInTransaction(
    manager: EntityManager,
    params: {
      loanId: string;
      actingUserId: string;
      permissionCodes: string[];
      expectedVersion: string;
      requestId: string;
      action: LoanTransitionAction;
      auditAction: string;
      reason?: string | null;
      transitionReason?: string;
      copyConditionState?: 'serviceable' | 'repair' | 'lost';
    },
  ): Promise<LoanResponse> {
    const loan = await this.loansRepository.findByIdForUpdate(manager, params.loanId);
    if (!loan) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Loan was not found.');
    }

    const canManage = params.permissionCodes.includes('loans.manage');
    if (!canManage && loan.userId !== params.actingUserId) {
      throw new ApiException(
        403,
        ErrorCode.FORBIDDEN,
        'Loan does not belong to the signed-in user.',
      );
    }

    if (loan.version !== params.expectedVersion) {
      throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Loan version has changed.');
    }

    if (!isAllowedLoanTransition(params.action, loan.state)) {
      throw new ApiException(
        409,
        ErrorCode.INVALID_TRANSITION,
        'Loan state transition is not allowed.',
      );
    }

    const now = this.clock.now();
    const user = await this.userRepository.findByIdForUpdate(manager, loan.userId);
    if (!user || user.status !== 'active') {
      throw new ApiException(
        403,
        ErrorCode.FORBIDDEN,
        'User account cannot complete this loan action.',
      );
    }

    const card = await this.cardsRepository.findByIdForUpdate(manager, loan.cardId);
    if (!card) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Library card was not found.');
    }

    if (params.action === 'checkout') {
      try {
        this.cardsService.assertCardEffective(card, now);
      } catch (error) {
        if (error instanceof ApiException) {
          throw new ApiException(error.getStatus(), ErrorCode.CARD_NOT_ELIGIBLE, error.message);
        }
        throw error;
      }
      if (!assertReservationActiveForCheckout(loan.reservationExpiresAt, now)) {
        throw new ApiException(
          409,
          ErrorCode.INVALID_TRANSITION,
          'Reservation has expired and cannot be checked out.',
        );
      }
    }

    const copy = await this.catalogRepository.findCopyByIdForUpdate(manager, loan.copyId);
    if (!copy) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Book copy was not found.');
    }

    const toState = targetStateForAction(params.action);
    const fromState = loan.state;

    let closedAt: Date | null | undefined;
    let checkedOutAt: Date | null | undefined;
    let dueAt: Date | null | undefined;

    if (params.action === 'cancel' || params.action === 'return' || params.action === 'mark_lost') {
      closedAt = now;
    }
    if (params.action === 'checkout') {
      checkedOutAt = now;
      dueAt = computeDueAt(now, loan.requestedDays);
    }

    const updated = await this.loansRepository.transitionLoanWithVersion(manager, {
      loanId: loan.id,
      expectedVersion: params.expectedVersion,
      toState,
      closedAt,
      checkedOutAt,
      dueAt,
    });

    if (!updated) {
      throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Loan version has changed.');
    }

    if (params.copyConditionState) {
      const copyUpdated = await this.catalogRepository.updateCopyWithVersion(manager, {
        copyId: copy.id,
        expectedVersion: copy.version,
        conditionState: params.copyConditionState,
      });
      if (!copyUpdated) {
        throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Book copy version has changed.');
      }
    }

    const eventReason = params.transitionReason ?? params.reason ?? null;
    await this.loansRepository.appendLoanEvent(manager, {
      loanId: loan.id,
      actorUserId: params.actingUserId,
      fromState,
      toState: toState,
      requestId: params.requestId,
      reason: eventReason,
    });

    await this.auditService.append(manager, {
      actorUserId: params.actingUserId,
      action: params.auditAction,
      targetType: 'loan',
      targetId: loan.id,
      outcome: 'success',
      requestId: params.requestId,
      details: {
        fromState,
        toState,
        copyId: copy.id,
        copyCondition: params.copyConditionState ?? null,
      },
    });

    const bookId = await this.loansRepository.findBookIdForCopy(manager, loan.copyId);
    if (!bookId) {
      throw new ApiException(500, ErrorCode.INTERNAL_ERROR, 'Loan copy reference is missing.');
    }

    return toLoanResponse(updated, bookId);
  }

  async listOwnLoans(userId: string, query: OwnLoanListQueryDto) {
    await this.assertCirculationReadable();
    const now = this.clock.now();
    const { items, total } = await this.loansRepository.listLoans({
      userId,
      state: query.state,
      overdue: query.overdue,
      now,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      data: items.map(({ loan, bookId }) => toLoanResponse(loan, bookId)),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async listAdminLoans(query: AdminLoanListQueryDto) {
    await this.assertCirculationReadable();
    const now = this.clock.now();
    const { items, total } = await this.loansRepository.listLoans({
      userId: query.userId,
      copyId: query.copyId,
      state: query.state,
      overdue: query.overdue,
      now,
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      data: items.map(({ loan, bookId }) => toAdminLoanResponse(loan, bookId)),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async getLoanDetail(params: {
    loanId: string;
    actingUserId: string;
    permissionCodes: string[];
  }): Promise<LoanDetailResponse> {
    await this.assertCirculationReadable();
    const loan = await this.loansRepository.findById(params.loanId);
    if (!loan) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Loan was not found.');
    }

    const canReadAny = params.permissionCodes.includes('loans.read.any');
    if (!canReadAny && loan.userId !== params.actingUserId) {
      throw new ApiException(
        403,
        ErrorCode.FORBIDDEN,
        'Loan does not belong to the signed-in user.',
      );
    }

    const bookId = await this.loansRepository.findBookIdForCopyId(loan.copyId);
    if (!bookId) {
      throw new ApiException(500, ErrorCode.INTERNAL_ERROR, 'Loan copy reference is missing.');
    }

    const events = await this.loansRepository.listEventsForLoan(loan.id);
    return {
      ...toLoanResponse(loan, bookId),
      events: events.map(toLoanEventResponse),
    };
  }

  private async assertCirculationReadable(): Promise<void> {
    await this.circulationInventory.assertSchemaReady();
    if (!this.circulationInventory.isEnabled()) {
      throw new ApiException(503, ErrorCode.DEPENDENCY_UNAVAILABLE, 'Circulation is not enabled.');
    }
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
