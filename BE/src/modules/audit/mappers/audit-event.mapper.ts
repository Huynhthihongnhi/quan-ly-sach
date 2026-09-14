import { AuditEvent } from '../entities/audit-event.entity';
import { sanitizeAuditDetails } from '../sanitize-audit-details';

export interface AuditEventResponse {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  outcome: string;
  requestId: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export function toAuditEventResponse(event: AuditEvent): AuditEventResponse {
  return {
    id: event.id,
    actorUserId: event.actorUserId,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    outcome: event.outcome,
    requestId: event.requestId,
    details: sanitizeAuditDetails(event.details),
    createdAt: event.createdAt.toISOString(),
  };
}
