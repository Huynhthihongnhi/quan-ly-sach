import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { OutboxSendGate } from '../messaging/outbox-send-gate.token';
import type { OutboxPayload } from '../messaging/messaging.types';
import { isLoanOverdue } from './library-timezone.util';
import { LOAN_DUE_REMINDER_TEMPLATE } from './loan-reminder.constants';
import { CLOCK, type Clock } from '../../platform/clock/clock.interface';
import { Inject } from '@nestjs/common';

@Injectable()
export class LoanReminderSendGateService implements OutboxSendGate {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async shouldCancelBeforeSend(templateCode: string, payload: OutboxPayload): Promise<boolean> {
    if (templateCode !== LOAN_DUE_REMINDER_TEMPLATE) {
      return false;
    }
    if (!payload.loanId || !payload.dueAtSnapshot) {
      return true;
    }

    const dueAtSnapshot = new Date(payload.dueAtSnapshot);
    const now = this.clock.now();
    if (isLoanOverdue(dueAtSnapshot, now)) {
      return true;
    }

    const rows: Array<{ state: string; due_at: Date | null }> = await this.dataSource.query(
      `SELECT state, due_at FROM loans WHERE id = ? LIMIT 1`,
      [payload.loanId],
    );
    const loan = rows[0];
    if (!loan || loan.state !== 'borrowed') {
      return true;
    }
    const dueAtDb = loan.due_at instanceof Date ? loan.due_at : new Date(String(loan.due_at));
    if (!loan.due_at || dueAtDb.getTime() !== dueAtSnapshot.getTime()) {
      return true;
    }
    return false;
  }
}
