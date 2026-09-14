import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent } from './entities/audit-event.entity';

export interface ListAuditEventsParams {
  actorId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

@Injectable()
export class AuditRepository {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditEventRepository: Repository<AuditEvent>,
  ) {}

  async listEvents(params: ListAuditEventsParams): Promise<{ items: AuditEvent[]; total: number }> {
    const query = this.auditEventRepository.createQueryBuilder('event');

    if (params.actorId) {
      query.andWhere('event.actor_user_id = :actorId', { actorId: params.actorId });
    }

    if (params.action) {
      query.andWhere('event.action = :action', { action: params.action });
    }

    if (params.from) {
      query.andWhere('event.created_at >= :from', { from: params.from });
    }

    if (params.to) {
      query.andWhere('event.created_at <= :to', { to: params.to });
    }

    query.orderBy('event.id', 'DESC');

    const total = await query.getCount();
    const items = await query
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();

    return { items, total };
  }
}
