import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { CLOCK, type Clock } from '../../platform/clock/clock.interface';
import { AuditService } from '../audit/audit.service';
import { CardsRepository } from '../cards/cards.repository';
import { CatalogRepository } from '../catalog/catalog.repository';
import { UserRepository } from '../identity/user.repository';
import { CirculationConfigService } from './circulation-config.service';
import { runWithDeadlockRetry } from './loan-deadlock.util';
import { LoansRepository } from './loans.repository';

@Injectable()
export class LoanReservationExpiryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly loans: LoansRepository,
    private readonly users: UserRepository,
    private readonly cards: CardsRepository,
    private readonly catalog: CatalogRepository,
    private readonly audit: AuditService,
    private readonly config: CirculationConfigService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async expireReservations(filter: { userId?: string; bookId?: string } = {}): Promise<number> {
    const now = this.clock.now();
    const conditions = ["l.state = 'reserved'", 'l.reservation_expires_at <= ?'];
    const params: unknown[] = [now];
    if (filter.userId) {
      conditions.push('l.user_id = ?');
      params.push(filter.userId);
    }
    if (filter.bookId) {
      conditions.push('c.book_id = ?');
      params.push(filter.bookId);
    }
    const candidates: Array<{ id: string; userId: string; cardId: string; copyId: string }> =
      await this.dataSource.query(
        `SELECT l.id, l.user_id AS userId, l.card_id AS cardId, l.copy_id AS copyId
         FROM loans l JOIN book_copies c ON c.id = l.copy_id
         WHERE ${conditions.join(' AND ')} ORDER BY l.id ASC LIMIT 100`,
        params,
      );
    let expired = 0;
    for (const candidate of candidates) {
      const didExpire = await runWithDeadlockRetry(this.config.loanTransitionDeadlockRetries, () =>
        this.dataSource.transaction('READ COMMITTED', async (manager) => {
          await this.users.findByIdForUpdate(manager, candidate.userId);
          await this.cards.findByIdForUpdate(manager, candidate.cardId);
          await this.catalog.findCopyByIdForUpdate(manager, candidate.copyId);
          const loan = await this.loans.findByIdForUpdate(manager, candidate.id);
          if (!loan || loan.state !== 'reserved' || loan.reservationExpiresAt > now) return false;
          if (
            loan.userId !== String(candidate.userId) ||
            loan.cardId !== String(candidate.cardId) ||
            loan.copyId !== String(candidate.copyId)
          )
            return false;
          const updated = await this.loans.transitionLoanWithVersion(manager, {
            loanId: loan.id,
            expectedVersion: loan.version,
            toState: 'expired',
            closedAt: now,
          });
          if (!updated) return false;
          const requestId = randomUUID();
          await this.loans.appendLoanEvent(manager, {
            loanId: loan.id,
            actorUserId: null,
            fromState: 'reserved',
            toState: 'expired',
            requestId,
          });
          await this.audit.append(manager, {
            actorUserId: null,
            action: 'loan.expire',
            targetType: 'loan',
            targetId: loan.id,
            outcome: 'success',
            requestId,
          });
          return true;
        }),
      );
      if (didExpire) expired += 1;
    }
    return expired;
  }
}
