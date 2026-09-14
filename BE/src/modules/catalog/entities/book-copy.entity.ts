import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type CopyConditionState = 'serviceable' | 'repair' | 'lost' | 'retired';

@Entity('book_copies')
export class BookCopy {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'book_id', type: 'bigint', unsigned: true })
  bookId!: string;

  @Column({ type: 'varchar', length: 64, charset: 'ascii', collation: 'ascii_bin' })
  barcode!: string;

  @Column({ name: 'shelf_location', type: 'varchar', length: 120, nullable: true })
  shelfLocation!: string | null;

  @Column({ name: 'condition_state', type: 'varchar', length: 16, default: 'serviceable' })
  conditionState!: CopyConditionState;

  @Column({ type: 'bigint', unsigned: true, default: 1 })
  version!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}
