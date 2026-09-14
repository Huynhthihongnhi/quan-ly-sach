import { Clock } from '../../src/platform/clock/clock.interface';

export class FakeClock implements Clock {
  private current: Date;

  constructor(initial: Date = new Date('2026-09-11T08:00:00.000Z')) {
    this.current = new Date(initial);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(date: Date): void {
    this.current = new Date(date);
  }

  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
