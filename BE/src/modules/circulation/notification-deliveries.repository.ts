import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { NotificationDelivery } from './entities/notification-delivery.entity';

@Injectable()
export class NotificationDeliveriesRepository {
  constructor(
    @InjectRepository(NotificationDelivery)
    private readonly deliveries: Repository<NotificationDelivery>,
  ) {}

  async existsForLoanDueKind(
    manager: EntityManager,
    input: { loanId: string; dueAtSnapshot: Date; kind: string },
  ): Promise<boolean> {
    const rows: Array<{ count: string }> = await manager.query(
      `SELECT COUNT(*) AS count FROM notification_deliveries
       WHERE loan_id = ? AND due_at_snapshot = ? AND kind = ?`,
      [input.loanId, input.dueAtSnapshot, input.kind],
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }

  async insertDelivery(
    manager: EntityManager,
    input: {
      loanId: string;
      dueAtSnapshot: Date;
      kind: string;
      outboxId: string;
    },
  ): Promise<void> {
    await manager.getRepository(NotificationDelivery).insert({
      loanId: input.loanId,
      dueAtSnapshot: input.dueAtSnapshot,
      kind: input.kind,
      outboxId: input.outboxId,
    });
  }
}
