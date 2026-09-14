import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Loan, LoanState } from './entities/loan.entity';
import { LoanEvent } from './entities/loan-event.entity';

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

  findByUserAndRequestKey(userId: string, requestKey: string): Promise<Loan | null> {
    return this.loans.findOne({ where: { userId, requestKey } });
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
