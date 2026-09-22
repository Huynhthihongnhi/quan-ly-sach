import {
  computeDueReminderSendAt,
  isLoanOverdue,
  libraryLocalDateTimeToUtc,
  subtractLocalDays,
  utcInstantToLibraryLocalParts,
} from '../../src/modules/circulation/library-timezone.util';

describe('library timezone reminder math', () => {
  it('maps UTC instants to Asia/Ho_Chi_Minh calendar dates with +7 offset', () => {
    expect(utcInstantToLibraryLocalParts(new Date('2026-09-14T20:00:00.000Z'))).toEqual({
      year: 2026,
      month: 9,
      day: 15,
    });
    expect(utcInstantToLibraryLocalParts(new Date('2026-09-14T16:59:59.000Z'))).toEqual({
      year: 2026,
      month: 9,
      day: 14,
    });
  });

  it('subtracts calendar days on local date parts', () => {
    expect(subtractLocalDays({ year: 2026, month: 9, day: 14 }, 3)).toEqual({
      year: 2026,
      month: 9,
      day: 11,
    });
  });

  it('computes 08:00 local send time as 01:00 UTC for Vietnam', () => {
    const sendAt = libraryLocalDateTimeToUtc({ year: 2026, month: 9, day: 11 }, 8);
    expect(sendAt.toISOString()).toBe('2026-09-11T01:00:00.000Z');
  });

  it('computes due-minus-3-days reminder at 08:00 local', () => {
    const dueAt = new Date('2026-09-17T15:30:00.000Z');
    const reminderSendAt = computeDueReminderSendAt(dueAt, {
      daysBefore: 3,
      localSendHour: 8,
    });
    expect(reminderSendAt.toISOString()).toBe('2026-09-14T01:00:00.000Z');
  });

  it('treats overdue strictly after due_at', () => {
    const dueAt = new Date('2026-09-14T12:00:00.000Z');
    expect(isLoanOverdue(dueAt, new Date('2026-09-14T11:59:59.999Z'))).toBe(false);
    expect(isLoanOverdue(dueAt, new Date('2026-09-14T12:00:00.000Z'))).toBe(false);
    expect(isLoanOverdue(dueAt, new Date('2026-09-14T12:00:00.001Z'))).toBe(true);
  });
});
