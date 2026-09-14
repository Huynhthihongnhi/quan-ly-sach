import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type LoanState = 'reserved' | 'borrowed' | 'returned' | 'cancelled' | 'expired' | 'lost';

@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: string;

  @Column({ name: 'card_id', type: 'bigint', unsigned: true })
  cardId!: string;

  @Column({ name: 'copy_id', type: 'bigint', unsigned: true })
  copyId!: string;

  @Column({ name: 'request_key', type: 'varchar', length: 64 })
  requestKey!: string;

  @Column({ name: 'request_hash', type: 'binary', length: 32 })
  requestHash!: Buffer;

  @Column({ type: 'varchar', length: 16, default: 'reserved' })
  state!: LoanState;

  @Column({ name: 'requested_days', type: 'tinyint', unsigned: true })
  requestedDays!: number;

  @Column({ name: 'reserved_at', type: 'datetime', precision: 6 })
  reservedAt!: Date;

  @Column({ name: 'reservation_expires_at', type: 'datetime', precision: 6 })
  reservationExpiresAt!: Date;

  @Column({ name: 'checked_out_at', type: 'datetime', precision: 6, nullable: true })
  checkedOutAt!: Date | null;

  @Column({ name: 'due_at', type: 'datetime', precision: 6, nullable: true })
  dueAt!: Date | null;

  @Column({ name: 'closed_at', type: 'datetime', precision: 6, nullable: true })
  closedAt!: Date | null;

  @Column({ type: 'bigint', unsigned: true, default: '1' })
  version!: string;
}
