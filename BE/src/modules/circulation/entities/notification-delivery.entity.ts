import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notification_deliveries')
export class NotificationDelivery {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'loan_id', type: 'bigint', unsigned: true })
  loanId!: string;

  @Column({ name: 'due_at_snapshot', type: 'datetime', precision: 6 })
  dueAtSnapshot!: Date;

  @Column({ type: 'varchar', length: 32, charset: 'ascii', collation: 'ascii_bin' })
  kind!: string;

  @Column({ name: 'outbox_id', type: 'bigint', unsigned: true })
  outboxId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}
