import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('orm_probe_records')
export class OrmProbeRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'external_id', type: 'bigint', unsigned: true })
  externalId!: string;

  @Column({ type: 'binary', length: 32 })
  tag!: Buffer;

  @Column({ name: 'observed_at', type: 'datetime', precision: 6 })
  observedAt!: Date;

  @Column({ type: 'int', unsigned: true, default: 0 })
  version!: number;

  @Column({ type: 'varchar', length: 120 })
  label!: string;
}
