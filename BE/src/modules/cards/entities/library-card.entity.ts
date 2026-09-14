import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type LibraryCardState = 'active' | 'suspended' | 'revoked' | 'expired';

@Entity('library_cards')
export class LibraryCard {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: string;

  @Column({ name: 'card_number', type: 'varchar', length: 64 })
  cardNumber!: string;

  @Column({ type: 'varchar', length: 16 })
  state!: LibraryCardState;

  @Column({ name: 'issued_at', type: 'datetime', precision: 6 })
  issuedAt!: Date;

  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt!: Date;

  @Column({ name: 'issued_by', type: 'bigint', unsigned: true })
  issuedBy!: string;
}
