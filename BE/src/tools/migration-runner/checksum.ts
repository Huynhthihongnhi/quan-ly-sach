import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function sha256File(path: string): string {
  const content = readFileSync(path);
  return createHash('sha256').update(content).digest('hex');
}
