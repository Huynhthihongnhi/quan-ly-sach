import { Entity, PrimaryColumn } from 'typeorm';

@Entity('book_topics')
export class BookTopic {
  @PrimaryColumn({ name: 'book_id', type: 'bigint', unsigned: true })
  bookId!: string;

  @PrimaryColumn({ name: 'topic_id', type: 'bigint', unsigned: true })
  topicId!: string;
}
