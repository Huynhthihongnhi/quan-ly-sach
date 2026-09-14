import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('book_authors')
export class BookAuthor {
  @PrimaryColumn({ name: 'book_id', type: 'bigint', unsigned: true })
  bookId!: string;

  @PrimaryColumn({ name: 'author_id', type: 'bigint', unsigned: true })
  authorId!: string;

  @Column({ name: 'author_order', type: 'smallint', unsigned: true, default: 1 })
  authorOrder!: number;
}
