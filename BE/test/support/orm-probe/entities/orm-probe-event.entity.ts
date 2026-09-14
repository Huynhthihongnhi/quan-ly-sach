import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('orm_probe_events')
export class OrmProbeEvent {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'record_id', type: 'bigint', unsigned: true })
  recordId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 32 })
  eventType!: string;

  @Column({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  createdAt!: Date;
}
