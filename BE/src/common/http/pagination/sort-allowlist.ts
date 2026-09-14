export const DEFAULT_SORT_FIELD = 'id';
export const DEFAULT_SORT_DIRECTION = 'desc';

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

export function parseSortParam(sort: string | undefined, allowlist: readonly string[]): SortSpec {
  const allowed = new Set(allowlist);
  const fallback: SortSpec = {
    field: DEFAULT_SORT_FIELD,
    direction: DEFAULT_SORT_DIRECTION,
  };

  if (!sort) {
    return fallback;
  }

  const direction = sort.startsWith('-') ? 'desc' : 'asc';
  const field = sort.startsWith('-') ? sort.slice(1) : sort;

  if (!allowed.has(field)) {
    throw new Error(`Sort field "${field}" is not allowed`);
  }

  return { field, direction };
}
