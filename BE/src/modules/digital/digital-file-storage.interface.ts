export interface DigitalFileStorage {
  /** Stores bytes at a server-owned key (not a public URL). */
  putObject(storageKey: string, content: Buffer): Promise<void>;
  readObject(storageKey: string): Promise<Buffer>;
  deleteObject(storageKey: string): Promise<void>;
  objectExists(storageKey: string): Promise<boolean>;
}
