import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type DigitalAssetState = 'quarantine' | 'ready' | 'rejected' | 'archived';
export type DigitalReadAccess = 'public' | 'authenticated' | 'card';

@Entity('digital_assets')
export class DigitalAsset {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'book_id', type: 'bigint', unsigned: true })
  bookId!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 191 })
  storageKey!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'byte_size', type: 'bigint', unsigned: true })
  byteSize!: string;

  @Column({ name: 'content_hash', type: 'binary', length: 32 })
  contentHash!: Buffer;

  @Column({ type: 'varchar', length: 16, default: 'quarantine' })
  state!: DigitalAssetState;

  @Column({ name: 'read_access', type: 'varchar', length: 16, default: 'authenticated' })
  readAccess!: DigitalReadAccess;

  @Column({ name: 'download_requires_card', type: 'boolean', default: true })
  downloadRequiresCard!: boolean;

  @Column({ name: 'rights_note', type: 'varchar', length: 500 })
  rightsNote!: string;

  @Column({ name: 'uploaded_by', type: 'bigint', unsigned: true })
  uploadedBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}
