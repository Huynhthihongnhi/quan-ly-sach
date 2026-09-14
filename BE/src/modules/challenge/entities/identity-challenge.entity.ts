import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('identity_challenges')
export class IdentityChallenge {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: string;

  @Column({ type: 'varchar', length: 24 })
  purpose!: string;

  @Column({ name: 'token_hash', type: 'binary', length: 32 })
  tokenHash!: Buffer;

  @Column({
    name: 'email_snapshot',
    type: 'varchar',
    length: 254,
    charset: 'ascii',
    collation: 'ascii_bin',
  })
  emailSnapshot!: string;

  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt!: Date;

  @Column({ name: 'consumed_at', type: 'datetime', precision: 6, nullable: true })
  consumedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'datetime', precision: 6, nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}
