const MAX_PUBLIC_QUERY_LENGTH = 200;

export function escapeLikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function buildContainsLikePattern(raw: string): string {
  const trimmed = raw.trim().slice(0, MAX_PUBLIC_QUERY_LENGTH);
  if (trimmed.length === 0) {
    return '%';
  }
  return `%${escapeLikePattern(trimmed)}%`;
}

export const PUBLIC_TEXT_QUERY_MAX_LENGTH = MAX_PUBLIC_QUERY_LENGTH;
