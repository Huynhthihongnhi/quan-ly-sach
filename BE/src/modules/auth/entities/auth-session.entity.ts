import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('auth_sessions')
export class AuthSession {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: string;

  @Column({ name: 'token_hash', type: 'binary', length: 32 })
  tokenHash!: Buffer;

  @Column({ name: 'csrf_hash', type: 'binary', length: 32 })
  csrfHash!: Buffer;

  @Column({ name: 'auth_version', type: 'bigint', unsigned: true })
  authVersion!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;

  @Column({ name: 'last_seen_at', type: 'datetime', precision: 6 })
  lastSeenAt!: Date;

  @Column({ name: 'idle_expires_at', type: 'datetime', precision: 6 })
  idleExpiresAt!: Date;

  @Column({ name: 'absolute_expires_at', type: 'datetime', precision: 6 })
  absoluteExpiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'datetime', precision: 6, nullable: true })
  revokedAt!: Date | null;
}
