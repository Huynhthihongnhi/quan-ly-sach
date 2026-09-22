import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type PurchaseRequestState = 'pending' | 'approved' | 'rejected';

@Entity('purchase_requests')
export class PurchaseRequest {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'requester_id', type: 'bigint', unsigned: true })
  requesterId!: string;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ name: 'author_text', type: 'varchar', length: 300 })
  authorText!: string;

  @Column({ name: 'publication_year', type: 'smallint', unsigned: true })
  publicationYear!: number;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  note!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  state!: PurchaseRequestState;

  @Column({ name: 'request_key', type: 'varchar', length: 64 })
  requestKey!: string;

  @Column({ name: 'request_hash', type: 'binary', length: 32 })
  requestHash!: Buffer;

  @Column({ name: 'reviewed_by', type: 'bigint', unsigned: true, nullable: true })
  reviewedBy!: string | null;

  @Column({ name: 'review_reason', type: 'varchar', length: 1000, nullable: true })
  reviewReason!: string | null;

  @Column({ name: 'reviewed_at', type: 'datetime', precision: 6, nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'bigint', unsigned: true, default: '1' })
  version!: string;

  @Column({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}
