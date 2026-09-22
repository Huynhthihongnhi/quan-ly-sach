import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('purchase_request_events')
export class PurchaseRequestEvent {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'purchase_request_id', type: 'bigint', unsigned: true })
  purchaseRequestId!: string;

  @Column({ name: 'actor_user_id', type: 'bigint', unsigned: true })
  actorUserId!: string;

  @Column({ name: 'from_state', type: 'varchar', length: 16, nullable: true })
  fromState!: string | null;

  @Column({ name: 'to_state', type: 'varchar', length: 16 })
  toState!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  reason!: string | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}
