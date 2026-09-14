export const LIBRARY_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const LIBRARY_UTC_OFFSET_HOURS = 7;

export interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

export function utcInstantToLibraryLocalParts(instant: Date): LocalDateParts {
  const shifted = new Date(instant.getTime() + LIBRARY_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function subtractLocalDays(parts: LocalDateParts, days: number): LocalDateParts {
  const utcMidnight = Date.UTC(parts.year, parts.month - 1, parts.day);
  const target = new Date(utcMidnight - days * 24 * 60 * 60 * 1000);
  return {
    year: target.getUTCFullYear(),
    month: target.getUTCMonth() + 1,
    day: target.getUTCDate(),
  };
}

export function libraryLocalDateTimeToUtc(parts: LocalDateParts, hour: number, minute = 0): Date {
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, hour - LIBRARY_UTC_OFFSET_HOURS, minute, 0),
  );
}

export function computeDueReminderSendAt(
  dueAtUtc: Date,
  options: { daysBefore: number; localSendHour: number },
): Date {
  const dueLocal = utcInstantToLibraryLocalParts(dueAtUtc);
  const reminderLocal = subtractLocalDays(dueLocal, options.daysBefore);
  return libraryLocalDateTimeToUtc(reminderLocal, options.localSendHour);
}

export function isLoanOverdue(dueAtUtc: Date, now: Date): boolean {
  return dueAtUtc.getTime() < now.getTime();
}
