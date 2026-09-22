import type { ApiErrorField } from '@/lib/api/types';

export function apiFieldMessage(
  fields: ApiErrorField[] | undefined,
  field: string,
): string | null {
  const match = fields?.find((entry) => entry.field === field);
  if (!match) {
    return null;
  }
  if (match.code === 'TOO_SHORT') {
    return 'Password must be at least 12 characters.';
  }
  return 'Invalid value.';
}
