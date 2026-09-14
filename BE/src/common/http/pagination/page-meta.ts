export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export function buildPageMeta(page: number, pageSize: number, total: number): PageMeta {
  return { page, pageSize, total };
}
