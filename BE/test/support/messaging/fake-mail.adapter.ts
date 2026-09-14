import type { MailAdapter, MailMessage } from '../../../src/modules/messaging/messaging.types';

export class FakeMailAdapter implements MailAdapter {
  readonly sent: MailMessage[] = [];
  failCount = 0;
  private failuresRemaining = 0;

  queueFailures(count: number): void {
    this.failuresRemaining = count;
  }

  send(message: MailMessage): Promise<void> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      this.failCount += 1;
      return Promise.reject(new Error('Fake mail adapter failure'));
    }
    this.sent.push(message);
    return Promise.resolve();
  }

  reset(): void {
    this.sent.length = 0;
    this.failCount = 0;
    this.failuresRemaining = 0;
  }
}
