import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BookState = 'draft' | 'published' | 'archived';

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'category_id', type: 'bigint', unsigned: true })
  categoryId!: string;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ type: 'varchar', length: 20, nullable: true, charset: 'ascii', collation: 'ascii_bin' })
  isbn!: string | null;

  @Column({ name: 'publisher_name', type: 'varchar', length: 200, nullable: true })
  publisherName!: string | null;

  @Column({ name: 'publication_year', type: 'smallint', unsigned: true, nullable: true })
  publicationYear!: number | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  state!: BookState;

  @Column({ type: 'bigint', unsigned: true, default: 1 })
  version!: string;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt!: Date;
}
