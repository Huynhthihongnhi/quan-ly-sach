import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('iam_policy_locks')
export class IamPolicyLock {
  @PrimaryColumn({ type: 'tinyint', unsigned: true })
  id!: number;

  @Column({ type: 'bigint', unsigned: true, default: 1 })
  version!: string;
}
