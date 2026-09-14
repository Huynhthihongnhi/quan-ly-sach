import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Profile } from './profile.entity';

export type UserStatus = 'invited' | 'active' | 'blocked' | 'archived';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'varchar', length: 254, charset: 'ascii', collation: 'ascii_bin' })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'invited' })
  status!: UserStatus;

  @Column({ name: 'email_verified_at', type: 'datetime', precision: 6, nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ name: 'auth_version', type: 'bigint', unsigned: true, default: 1 })
  authVersion!: string;

  @Column({ type: 'bigint', unsigned: true, default: 1 })
  version!: string;

  @Column({ name: 'blocked_at', type: 'datetime', precision: 6, nullable: true })
  blockedAt!: Date | null;

  @Column({ name: 'archived_at', type: 'datetime', precision: 6, nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt!: Date;

  @OneToOne(() => Profile, (profile) => profile.user)
  profile?: Profile;
}
