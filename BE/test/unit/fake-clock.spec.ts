import { FakeClock } from '../support/fake-clock';

describe('FakeClock', () => {
  it('returns the configured instant and advances deterministically', () => {
    const clock = new FakeClock(new Date('2026-09-11T08:00:00.000Z'));

    expect(clock.now().toISOString()).toBe('2026-09-11T08:00:00.000Z');

    clock.advanceMs(1_500);
    expect(clock.now().toISOString()).toBe('2026-09-11T08:00:01.500Z');

    clock.set(new Date('2026-09-12T01:00:00.000Z'));
    expect(clock.now().toISOString()).toBe('2026-09-12T01:00:00.000Z');
  });
});
