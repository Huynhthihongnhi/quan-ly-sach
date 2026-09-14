import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('loan_events')
export class LoanEvent {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'loan_id', type: 'bigint', unsigned: true })
  loanId!: string;

  @Column({ name: 'actor_user_id', type: 'bigint', unsigned: true, nullable: true })
  actorUserId!: string | null;

  @Column({ name: 'from_state', type: 'varchar', length: 16, nullable: true })
  fromState!: string | null;

  @Column({ name: 'to_state', type: 'varchar', length: 16 })
  toState!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason!: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 64 })
  requestId!: string;
}
