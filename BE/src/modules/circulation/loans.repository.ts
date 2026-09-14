import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Loan, LoanState } from './entities/loan.entity';
import { LoanEvent } from './entities/loan-event.entity';

export interface LoanWithBookId {
  loan: Loan;
  bookId: string;
}

export interface LoanListFilters {
  userId?: string;
  copyId?: string;
  state?: LoanState;
  overdue?: boolean;
  now: Date;
  page: number;
  pageSize: number;
}

export interface InsertLoanInput {
  userId: string;
  cardId: string;
  copyId: string;
  requestKey: string;
  requestHash: Buffer;
  requestedDays: number;
  reservedAt: Date;
  reservationExpiresAt: Date;
}

@Injectable()
export class LoansRepository {
  constructor(
    @InjectRepository(Loan)
    private readonly loans: Repository<Loan>,
    @InjectRepository(LoanEvent)
    private readonly loanEvents: Repository<LoanEvent>,
  ) {}

  findById(loanId: string): Promise<Loan | null> {
    return this.loans.findOne({ where: { id: loanId } });
  }

  async findBookIdForCopyId(copyId: string): Promise<string | null> {
    const rows: Array<{ bookId: string }> = await this.loans.query(
      `SELECT book_id AS bookId FROM book_copies WHERE id = ? LIMIT 1`,
      [copyId],
    );
    return rows[0]?.bookId ? String(rows[0].bookId) : null;
  }

  async listLoans(filters: LoanListFilters): Promise<{ items: LoanWithBookId[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.userId) {
      conditions.push('l.user_id = ?');
      params.push(filters.userId);
    }
    if (filters.copyId) {
      conditions.push('l.copy_id = ?');
      params.push(filters.copyId);
    }
    if (filters.state) {
      conditions.push('l.state = ?');
      params.push(filters.state);
    }
    if (filters.overdue === true) {
      conditions.push(`l.state = 'borrowed' AND l.due_at < ?`);
      params.push(filters.now);
    } else if (filters.overdue === false) {
      conditions.push(`NOT (l.state = 'borrowed' AND l.due_at < ?)`);
      params.push(filters.now);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (filters.page - 1) * filters.pageSize;

    const countRows: Array<{ total: string }> = await this.loans.query(
      `SELECT COUNT(*) AS total
       FROM loans l
       INNER JOIN book_copies c ON c.id = l.copy_id
       ${whereClause}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows: Array<Record<string, unknown>> = await this.loans.query(
      `SELECT l.id, l.user_id AS userId, l.card_id AS cardId, l.copy_id AS copyId,
              l.request_key AS requestKey, l.request_hash AS requestHash, l.state,
              l.requested_days AS requestedDays, l.reserved_at AS reservedAt,
              l.reservation_expires_at AS reservationExpiresAt, l.checked_out_at AS checkedOutAt,
              l.due_at AS dueAt, l.closed_at AS closedAt, l.version,
              c.book_id AS bookId
       FROM loans l
       INNER JOIN book_copies c ON c.id = l.copy_id
       ${whereClause}
       ORDER BY l.id DESC
       LIMIT ? OFFSET ?`,
      [...params, filters.pageSize, offset],
    );

    const items = rows.map((row) => ({
      loan: this.loans.create({
        id: String(row.id),
        userId: String(row.userId),
        cardId: String(row.cardId),
        copyId: String(row.copyId),
        requestKey: String(row.requestKey),
        requestHash: row.requestHash as Buffer,
        state: row.state as LoanState,
        requestedDays: Number(row.requestedDays),
        reservedAt: row.reservedAt as Date,
        reservationExpiresAt: row.reservationExpiresAt as Date,
        checkedOutAt: (row.checkedOutAt as Date | null) ?? null,
        dueAt: (row.dueAt as Date | null) ?? null,
        closedAt: (row.closedAt as Date | null) ?? null,
        version: String(row.version),
      }),
      bookId: String(row.bookId),
    }));

    return { items, total };
  }

  listEventsForLoan(loanId: string): Promise<LoanEvent[]> {
    return this.loanEvents.find({
      where: { loanId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  findByUserAndRequestKey(userId: string, requestKey: string): Promise<Loan | null> {
    return this.loans.findOne({ where: { userId, requestKey } });
  }

  findByIdForUpdate(manager: EntityManager, loanId: string): Promise<Loan | null> {
    return manager
      .getRepository(Loan)
      .createQueryBuilder('loan')
      .where('loan.id = :loanId', { loanId })
      .setLock('pessimistic_write')
      .getOne();
  }

  findByUserAndRequestKeyInTransaction(
    manager: EntityManager,
    userId: string,
    requestKey: string,
  ): Promise<Loan | null> {
    return manager.getRepository(Loan).findOne({ where: { userId, requestKey } });
  }

  async countActiveLoansForUser(manager: EntityManager, userId: string): Promise<number> {
    const rows: Array<{ count: string }> = await manager.query(
      `SELECT COUNT(*) AS count FROM loans
       WHERE user_id = ? AND state IN ('reserved', 'borrowed')`,
      [userId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async expireStaleReservations(manager: EntityManager, now: Date): Promise<void> {
    await manager.query(
      `UPDATE loans
       SET state = 'expired', closed_at = ?, version = version + 1
       WHERE state = 'reserved' AND reservation_expires_at <= ?`,
      [now, now],
    );
  }

  async findBookIdForCopy(manager: EntityManager, copyId: string): Promise<string | null> {
    const rows: Array<{ bookId: string }> = await manager.query(
      `SELECT book_id AS bookId FROM book_copies WHERE id = ? LIMIT 1`,
      [copyId],
    );
    return rows[0]?.bookId ? String(rows[0].bookId) : null;
  }

  async listServiceableCopyIdsForBook(manager: EntityManager, bookId: string): Promise<string[]> {
    const rows: Array<{ id: string }> = await manager.query(
      `SELECT c.id
       FROM book_copies c
       WHERE c.book_id = ? AND c.condition_state = 'serviceable'
       ORDER BY c.id ASC
       FOR UPDATE`,
      [bookId],
    );
    return rows.map((row) => String(row.id));
  }

  async copyHasActiveLoan(manager: EntityManager, copyId: string): Promise<boolean> {
    const rows: Array<{ count: string }> = await manager.query(
      `SELECT COUNT(*) AS count FROM loans
       WHERE copy_id = ? AND state IN ('reserved', 'borrowed')`,
      [copyId],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  async insertLoan(manager: EntityManager, input: InsertLoanInput): Promise<Loan> {
    const result: { insertId: number } = await manager.query(
      `INSERT INTO loans
       (user_id, card_id, copy_id, request_key, request_hash, state, requested_days,
        reserved_at, reservation_expires_at)
       VALUES (?, ?, ?, ?, ?, 'reserved', ?, ?, ?)`,
      [
        input.userId,
        input.cardId,
        input.copyId,
        input.requestKey,
        input.requestHash,
        input.requestedDays,
        input.reservedAt,
        input.reservationExpiresAt,
      ],
    );
    const loan = await manager
      .getRepository(Loan)
      .findOne({ where: { id: String(result.insertId) } });
    if (!loan) {
      throw new Error('Loan insert failed to reload row');
    }
    return loan;
  }

  async transitionLoanWithVersion(
    manager: EntityManager,
    input: {
      loanId: string;
      expectedVersion: string;
      toState: LoanState;
      closedAt?: Date | null;
      checkedOutAt?: Date | null;
      dueAt?: Date | null;
    },
  ): Promise<Loan | null> {
    const setValues: Partial<Loan> = { state: input.toState };
    if (input.closedAt !== undefined) {
      setValues.closedAt = input.closedAt;
    }
    if (input.checkedOutAt !== undefined) {
      setValues.checkedOutAt = input.checkedOutAt;
    }
    if (input.dueAt !== undefined) {
      setValues.dueAt = input.dueAt;
    }

    const result = await manager
      .createQueryBuilder()
      .update(Loan)
      .set({
        ...setValues,
        version: () => 'version + 1',
      })
      .where('id = :loanId', { loanId: input.loanId })
      .andWhere('version = :expectedVersion', { expectedVersion: input.expectedVersion })
      .execute();

    if ((result.affected ?? 0) === 0) {
      return null;
    }

    return manager.getRepository(Loan).findOne({ where: { id: input.loanId } });
  }

  async appendLoanEvent(
    manager: EntityManager,
    input: {
      loanId: string;
      actorUserId: string;
      fromState: LoanState | null;
      toState: LoanState;
      requestId: string;
      reason?: string | null;
    },
  ): Promise<void> {
    await manager.getRepository(LoanEvent).insert({
      loanId: input.loanId,
      actorUserId: input.actorUserId,
      fromState: input.fromState,
      toState: input.toState,
      reason: input.reason ?? null,
      requestId: input.requestId,
    });
  }
}
