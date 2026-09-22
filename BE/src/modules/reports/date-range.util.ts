import {
  LocalDateParts,
  libraryLocalDateTimeToUtc,
  subtractLocalDays,
} from '../circulation/library-timezone.util';

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_REPORT_RANGE_DAYS = 366;

export class ReportRangeError extends Error {
  readonly reason: 'INVALID_FORMAT' | 'INVALID_DATE' | 'RANGE_ORDER' | 'RANGE_TOO_LONG';
  readonly field: 'from' | 'to';

  constructor(reason: ReportRangeError['reason'], field: 'from' | 'to', message: string) {
    super(message);
    this.reason = reason;
    this.field = field;
  }
}

export interface ReportUtcRange {
  fromParts: LocalDateParts;
  toParts: LocalDateParts;
  startUtc: Date;
  endUtc: Date;
}

export function parseLocalDate(value: string, field: 'from' | 'to' = 'from'): LocalDateParts {
  if (!LOCAL_DATE_PATTERN.test(value)) {
    throw new ReportRangeError('INVALID_FORMAT', field, `"${value}" is not a YYYY-MM-DD date.`);
  }
  const [year, month, day] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new ReportRangeError('INVALID_DATE', field, `"${value}" is not a real calendar date.`);
  }
  return { year, month, day };
}

export function resolveReportRange(from: string, to: string): ReportUtcRange {
  const fromParts = parseLocalDate(from, 'from');
  const toParts = parseLocalDate(to, 'to');
  const startUtc = libraryLocalDateTimeToUtc(fromParts, 0);
  const endUtc = libraryLocalDateTimeToUtc(subtractLocalDays(toParts, -1), 0);

  if (endUtc.getTime() <= startUtc.getTime()) {
    throw new ReportRangeError('RANGE_ORDER', 'to', '"to" must not be before "from".');
  }

  const rangeDays = Math.round((endUtc.getTime() - startUtc.getTime()) / (24 * 60 * 60 * 1000));
  if (rangeDays > MAX_REPORT_RANGE_DAYS) {
    throw new ReportRangeError(
      'RANGE_TOO_LONG',
      'to',
      `Range spans ${rangeDays} days; the limit is ${MAX_REPORT_RANGE_DAYS}.`,
    );
  }

  return { fromParts, toParts, startUtc, endUtc };
}
