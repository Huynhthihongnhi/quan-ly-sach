import type { OutboxPayload } from './messaging.types';

export interface OutboxSendGate {
  shouldCancelBeforeSend(templateCode: string, payload: OutboxPayload): Promise<boolean>;
}

export const OUTBOX_SEND_GATE = Symbol('OUTBOX_SEND_GATE');
