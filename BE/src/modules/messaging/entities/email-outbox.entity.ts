import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('email_outbox')
export class EmailOutbox {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true, nullable: true })
  userId!: string | null;

  @Column({ name: 'challenge_id', type: 'bigint', unsigned: true, nullable: true })
  challengeId!: string | null;

  @Column({ type: 'varchar', length: 254, charset: 'ascii', collation: 'ascii_bin' })
  recipient!: string;

  @Column({
    name: 'template_code',
    type: 'varchar',
    length: 64,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  templateCode!: string;

  @Column({
    name: 'dedupe_key',
    type: 'varchar',
    length: 191,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  dedupeKey!: string;

  @Column({ name: 'encrypted_payload', type: 'varbinary', length: 8192, nullable: true })
  encryptedPayload!: Buffer | null;

  @Column({ name: 'encryption_key_id', type: 'varchar', length: 64, nullable: true })
  encryptionKeyId!: string | null;

  @Column({ type: 'varchar', length: 16 })
  state!: string;

  @Column({ type: 'int', unsigned: true, default: 0 })
  attempts!: number;

  @Column({ name: 'available_at', type: 'datetime', precision: 6 })
  availableAt!: Date;

  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt!: Date;

  @Column({ name: 'lease_owner', type: 'varchar', length: 64, nullable: true })
  leaseOwner!: string | null;

  @Column({ name: 'leased_until', type: 'datetime', precision: 6, nullable: true })
  leasedUntil!: Date | null;

  @Column({ name: 'sent_at', type: 'datetime', precision: 6, nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'last_error_code', type: 'varchar', length: 64, nullable: true })
  lastErrorCode!: string | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}
