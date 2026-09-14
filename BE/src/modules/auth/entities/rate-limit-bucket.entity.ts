import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('rate_limit_buckets')
export class RateLimitBucket {
  @PrimaryColumn({ type: 'varchar', length: 64, charset: 'ascii', collation: 'ascii_bin' })
  scope!: string;

  @PrimaryColumn({ name: 'subject_hash', type: 'binary', length: 32 })
  subjectHash!: Buffer;

  @PrimaryColumn({ name: 'window_start', type: 'datetime', precision: 6 })
  windowStart!: Date;

  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt!: Date;

  @Column({ name: 'request_count', type: 'int', unsigned: true, default: 0 })
  requestCount!: number;
}
