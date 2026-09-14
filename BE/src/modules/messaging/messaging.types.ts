export type OutboxState = 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface OutboxPayload {
  token: string;
  linkUrl: string;
  loanId?: string;
  dueAtSnapshot?: string;
  kind?: string;
}

export interface EnqueueOutboxInput {
  userId: string | null;
  challengeId: string | null;
  recipient: string;
  templateCode: string;
  dedupeKey: string;
  payload: OutboxPayload;
  availableAt: Date;
  expiresAt: Date;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailAdapter {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_ADAPTER = Symbol('MAIL_ADAPTER');
