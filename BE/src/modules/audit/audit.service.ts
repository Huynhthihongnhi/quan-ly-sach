import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { buildPageMeta } from '../../common/http/pagination/page-meta';
import { AuditRepository } from './audit.repository';
import { AuditListQueryDto } from './dto/audit-list-query.dto';
import { AuditEvent, AuditOutcome } from './entities/audit-event.entity';
import { AuditEventResponse, toAuditEventResponse } from './mappers/audit-event.mapper';

export interface AppendAuditEventInput {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  outcome: AuditOutcome;
  requestId: string;
  details?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async listEvents(query: AuditListQueryDto): Promise<{
    data: AuditEventResponse[];
    meta: ReturnType<typeof buildPageMeta>;
  }> {
    const { items, total } = await this.auditRepository.listEvents({
      actorId: query.actorId,
      action: query.action,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      data: items.map((event) => toAuditEventResponse(event)),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async append(manager: EntityManager, input: AppendAuditEventInput): Promise<AuditEvent> {
    const event = manager.create(AuditEvent, {
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      outcome: input.outcome,
      requestId: input.requestId,
      details: input.details ?? null,
    });
    return manager.save(AuditEvent, event);
  }
}
