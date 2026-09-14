import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'varchar', length: 100, charset: 'ascii', collation: 'ascii_bin' })
  code!: string;

  @Column({ type: 'varchar', length: 500 })
  description!: string;
}
