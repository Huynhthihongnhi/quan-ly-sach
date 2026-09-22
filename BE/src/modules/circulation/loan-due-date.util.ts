const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeDueAt(checkedOutAt: Date, requestedDays: number): Date {
  if (requestedDays < 1 || requestedDays > 15) {
    throw new RangeError('requestedDays must be between 1 and 15');
  }
  return new Date(checkedOutAt.getTime() + requestedDays * MS_PER_DAY);
}
