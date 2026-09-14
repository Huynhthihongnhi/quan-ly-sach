import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { DigitalFileStorage } from './digital-file-storage.interface';

export class LocalDigitalFileStorage implements DigitalFileStorage {
  constructor(private readonly rootDirectory: string) {}

  private resolveSafePath(storageKey: string): string {
    if (!/^[\x21-\x7E]+$/.test(storageKey) || storageKey.includes('..')) {
      throw new Error('Invalid storage key.');
    }
    const absoluteRoot = resolve(this.rootDirectory);
    const absoluteTarget = resolve(join(this.rootDirectory, storageKey));
    if (!absoluteTarget.startsWith(`${absoluteRoot}${sep}`) && absoluteTarget !== absoluteRoot) {
      throw new Error('Storage key escapes root directory.');
    }
    return absoluteTarget;
  }

  async putObject(storageKey: string, content: Buffer): Promise<void> {
    const targetPath = this.resolveSafePath(storageKey);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content);
  }

  async readObject(storageKey: string): Promise<Buffer> {
    return readFile(this.resolveSafePath(storageKey));
  }

  async deleteObject(storageKey: string): Promise<void> {
    const targetPath = this.resolveSafePath(storageKey);
    await rm(targetPath, { force: true });
  }

  async objectExists(storageKey: string): Promise<boolean> {
    try {
      await stat(this.resolveSafePath(storageKey));
      return true;
    } catch {
      return false;
    }
  }
}
