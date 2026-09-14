import { readdirSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { sha256File } from './checksum';
import { MigrationFilePair } from './types';

const FILE_PATTERN = /^(\d+)_(.+)\.(up|down)\.sql$/;

export class MigrationCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationCatalogError';
  }
}

function assertInsideMigrationsDir(migrationsDir: string, filePath: string): void {
  const base = resolve(migrationsDir);
  const resolved = resolve(filePath);
  if (!resolved.startsWith(`${base}/`) && resolved !== base) {
    throw new MigrationCatalogError(`Migration path escapes migrations directory: ${filePath}`);
  }
}

export function loadMigrationCatalog(migrationsDir: string): MigrationFilePair[] {
  const absoluteDir = resolve(migrationsDir);
  const entries = readdirSync(absoluteDir, { withFileTypes: true });
  const grouped = new Map<
    string,
    { version: number; name: string; upPath?: string; downPath?: string }
  >();

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const match = FILE_PATTERN.exec(entry.name);
    if (!match) {
      continue;
    }

    const version = Number(match[1]);
    const name = match[2];
    const direction = match[3];
    if (!Number.isInteger(version) || version < 0) {
      throw new MigrationCatalogError(`Invalid migration version in file ${entry.name}`);
    }

    const key = `${version}_${name}`;
    const filePath = join(absoluteDir, entry.name);
    assertInsideMigrationsDir(absoluteDir, filePath);

    const current = grouped.get(key) ?? { version, name };
    if (direction === 'up') {
      current.upPath = filePath;
    } else {
      current.downPath = filePath;
    }
    grouped.set(key, current);
  }

  const pairs: MigrationFilePair[] = [];
  for (const item of grouped.values()) {
    if (!item.upPath || !item.downPath) {
      throw new MigrationCatalogError(
        `Migration ${item.version}_${item.name} is missing an up/down pair`,
      );
    }

    pairs.push({
      version: item.version,
      name: item.name,
      upPath: item.upPath,
      downPath: item.downPath,
      upChecksum: sha256File(item.upPath),
      downChecksum: sha256File(item.downPath),
    });
  }

  pairs.sort((left, right) => left.version - right.version);

  const versions = new Set<number>();
  for (const pair of pairs) {
    if (versions.has(pair.version)) {
      throw new MigrationCatalogError(`Duplicate migration version ${pair.version}`);
    }
    versions.add(pair.version);
  }

  for (let index = 1; index < pairs.length; index += 1) {
    const previous = pairs[index - 1]?.version;
    const current = pairs[index]?.version;
    if (previous !== undefined && current !== undefined && current !== previous + 1) {
      throw new MigrationCatalogError(
        `Migration versions must be consecutive; gap between ${previous} and ${current}`,
      );
    }
  }

  return pairs;
}

export function resolveMigrationsDir(pathValue: string, workingDir = process.cwd()): string {
  return isAbsolute(pathValue) ? pathValue : resolve(workingDir, pathValue);
}
