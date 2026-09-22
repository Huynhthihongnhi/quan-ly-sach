import { createHash } from 'node:crypto';

export function buildPurchaseRequestHash(input: {
  title: string;
  authorText: string;
  publicationYear: number;
  note?: string | null;
}): Buffer {
  const canonical = JSON.stringify({
    title: input.title.trim(),
    authorText: input.authorText.trim(),
    publicationYear: input.publicationYear,
    note: input.note?.trim() ?? null,
  });
  return createHash('sha256').update(canonical, 'utf8').digest();
}
