import {
  parseLocalDate,
  resolveReportRange,
  ReportRangeError,
} from '../../src/modules/reports/date-range.util';

describe('report date range parsing (Asia/Ho_Chi_Minh, half-open UTC)', () => {
  it('parses a valid YYYY-MM-DD local date', () => {
    expect(parseLocalDate('2026-09-14')).toEqual({ year: 2026, month: 9, day: 14 });
  });

  it('rejects a malformed date string', () => {
    expect(() => parseLocalDate('2026/09/14')).toThrow(ReportRangeError);
  });

  it('rejects a calendar date that does not exist', () => {
    expect(() => parseLocalDate('2026-02-30')).toThrow(ReportRangeError);
  });

  it('tags the error with the field that actually failed, not always "from"', () => {
    expect.assertions(2);
    try {
      resolveReportRange('2026-09-01', '2026-02-30');
    } catch (error) {
      expect(error).toBeInstanceOf(ReportRangeError);
      expect((error as ReportRangeError).field).toBe('to');
    }
  });

  it('converts a single local day to a half-open UTC range', () => {
    const range = resolveReportRange('2026-09-14', '2026-09-14');
    expect(range.startUtc.toISOString()).toBe('2026-09-13T17:00:00.000Z');
    expect(range.endUtc.toISOString()).toBe('2026-09-14T17:00:00.000Z');
  });

  it('extends the end boundary by one local day for a multi-day range', () => {
    const range = resolveReportRange('2026-09-01', '2026-09-14');
    expect(range.startUtc.toISOString()).toBe('2026-08-31T17:00:00.000Z');
    expect(range.endUtc.toISOString()).toBe('2026-09-14T17:00:00.000Z');
  });

  it('rejects to before from', () => {
    expect(() => resolveReportRange('2026-09-14', '2026-09-01')).toThrow(ReportRangeError);
  });

  it('rejects a range longer than 366 days', () => {
    expect(() => resolveReportRange('2025-01-01', '2026-01-02')).toThrow(ReportRangeError);
  });

  it('accepts a range exactly at the 366 day cap', () => {
    expect(() => resolveReportRange('2025-01-01', '2026-01-01')).not.toThrow();
  });
});
