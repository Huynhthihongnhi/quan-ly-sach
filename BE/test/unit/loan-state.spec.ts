import {
  assertReservationActiveForCheckout,
  isAllowedLoanTransition,
  isReturnCopyCondition,
  targetStateForAction,
} from '../../src/modules/circulation/loan-state';
import { computeDueAt } from '../../src/modules/circulation/loan-due-date.util';

describe('loan-state transitions', () => {
  it('allows cancel and checkout only from reserved', () => {
    expect(isAllowedLoanTransition('cancel', 'reserved')).toBe(true);
    expect(isAllowedLoanTransition('checkout', 'reserved')).toBe(true);
    expect(isAllowedLoanTransition('cancel', 'borrowed')).toBe(false);
    expect(isAllowedLoanTransition('checkout', 'borrowed')).toBe(false);
  });

  it('allows return and mark_lost only from borrowed', () => {
    expect(isAllowedLoanTransition('return', 'borrowed')).toBe(true);
    expect(isAllowedLoanTransition('mark_lost', 'borrowed')).toBe(true);
    expect(isAllowedLoanTransition('return', 'reserved')).toBe(false);
    expect(isAllowedLoanTransition('mark_lost', 'returned')).toBe(false);
  });

  it('maps actions to terminal states', () => {
    expect(targetStateForAction('cancel')).toBe('cancelled');
    expect(targetStateForAction('checkout')).toBe('borrowed');
    expect(targetStateForAction('return')).toBe('returned');
    expect(targetStateForAction('mark_lost')).toBe('lost');
  });

  it('rejects checkout when reservation expiry is in the past or at now', () => {
    const now = new Date('2026-09-14T12:00:00.000Z');
    expect(assertReservationActiveForCheckout(new Date('2026-09-15T12:00:00.000Z'), now)).toBe(
      true,
    );
    expect(assertReservationActiveForCheckout(new Date('2026-09-14T12:00:00.000Z'), now)).toBe(
      false,
    );
    expect(assertReservationActiveForCheckout(new Date('2026-09-13T12:00:00.000Z'), now)).toBe(
      false,
    );
  });

  it('accepts only serviceable or repair on return', () => {
    expect(isReturnCopyCondition('serviceable')).toBe(true);
    expect(isReturnCopyCondition('repair')).toBe(true);
    expect(isReturnCopyCondition('lost')).toBe(false);
    expect(isReturnCopyCondition('retired')).toBe(false);
  });
});

describe('computeDueAt', () => {
  it('adds requestedDays in UTC day units', () => {
    const checkedOutAt = new Date('2026-09-14T08:30:00.000Z');
    expect(computeDueAt(checkedOutAt, 1).toISOString()).toBe('2026-09-15T08:30:00.000Z');
    expect(computeDueAt(checkedOutAt, 15).toISOString()).toBe('2026-09-29T08:30:00.000Z');
  });

  it('throws when requestedDays is out of schema range', () => {
    const at = new Date('2026-09-14T08:30:00.000Z');
    expect(() => computeDueAt(at, 0)).toThrow(RangeError);
    expect(() => computeDueAt(at, 16)).toThrow(RangeError);
  });
});
