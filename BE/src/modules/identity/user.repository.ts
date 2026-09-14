import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { normalizeEmail } from './email-normalizer';
import { Profile } from './entities/profile.entity';
import { User, UserStatus } from './entities/user.entity';
import { requiresSessionInvalidation } from './user-status-transitions';

export interface ListUsersParams {
  q?: string;
  status?: UserStatus;
  page: number;
  pageSize: number;
  sortField: 'id' | 'email' | 'createdAt';
  sortDirection: 'ASC' | 'DESC';
}

export interface UpdateUserStatusParams {
  userId: string;
  expectedVersion: string;
  status: UserStatus;
  now: Date;
}

export interface UpdateProfileParams {
  userId: string;
  expectedVersion: string;
  displayName?: string;
  phone?: string | null;
}

export interface CreateUserWithProfileInput {
  email: string;
  displayName: string;
  phone?: string | null;
  status?: UserStatus;
  passwordHash?: string | null;
}

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Profile)
    private readonly profiles: Repository<Profile>,
  ) {}

  async createWithProfile(
    manager: EntityManager,
    input: CreateUserWithProfileInput,
  ): Promise<{ user: User; profile: Profile }> {
    const email = normalizeEmail(input.email);
    const user = manager.create(User, {
      email,
      status: input.status ?? 'invited',
      passwordHash: input.passwordHash ?? null,
    });
    await manager.save(User, user);
    const savedUser = await manager.findOneOrFail(User, { where: { email } });

    const profile = manager.create(Profile, {
      userId: savedUser.id,
      displayName: input.displayName,
      phone: input.phone ?? null,
    });
    const savedProfile = await manager.save(Profile, profile);

    return { user: savedUser, profile: savedProfile };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: normalizeEmail(email) } });
  }

  async findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  async findByIdForUpdate(manager: EntityManager, userId: string): Promise<User | null> {
    return manager
      .createQueryBuilder(User, 'user')
      .setLock('pessimistic_write')
      .where('user.id = :userId', { userId })
      .getOne();
  }

  async applyPasswordReset(
    manager: EntityManager,
    input: { userId: string; passwordHash: string },
  ): Promise<boolean> {
    const result = await manager
      .createQueryBuilder()
      .update(User)
      .set({
        passwordHash: input.passwordHash,
        authVersion: () => 'auth_version + 1',
        version: () => 'version + 1',
      })
      .where('id = :userId', { userId: input.userId })
      .andWhere('status = :status', { status: 'active' })
      .execute();

    return (result.affected ?? 0) > 0;
  }

  async applyActivation(
    manager: EntityManager,
    input: { userId: string; passwordHash: string; emailVerifiedAt: Date },
  ): Promise<boolean> {
    const result = await manager
      .createQueryBuilder()
      .update(User)
      .set({
        passwordHash: input.passwordHash,
        status: 'active',
        emailVerifiedAt: input.emailVerifiedAt,
        authVersion: () => 'auth_version + 1',
        version: () => 'version + 1',
      })
      .where('id = :userId', { userId: input.userId })
      .andWhere('status = :status', { status: 'invited' })
      .execute();

    return (result.affected ?? 0) > 0;
  }

  async findProfileByUserId(userId: string): Promise<Profile | null> {
    return this.profiles.findOne({ where: { userId } });
  }

  async listUsers(params: ListUsersParams): Promise<{ items: User[]; total: number }> {
    const query = this.users
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile');

    if (params.status) {
      query.andWhere('user.status = :status', { status: params.status });
    }

    if (params.q) {
      const pattern = `%${params.q.replace(/[%_\\]/g, '\\$&')}%`;
      query.andWhere('(user.email LIKE :pattern OR profile.display_name LIKE :pattern)', {
        pattern,
      });
    }

    const sortColumn =
      params.sortField === 'email'
        ? 'user.email'
        : params.sortField === 'createdAt'
          ? 'user.created_at'
          : 'user.id';

    query.orderBy(sortColumn, params.sortDirection);
    if (params.sortField !== 'id') {
      query.addOrderBy('user.id', 'DESC');
    }

    const total = await query.getCount();
    const items = await query
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();

    return { items, total };
  }

  async updateStatusWithVersion(
    manager: EntityManager,
    params: UpdateUserStatusParams,
  ): Promise<User | null> {
    const user = await manager.findOne(User, { where: { id: params.userId } });
    if (!user) {
      return null;
    }

    const setValues: Partial<User> & Record<string, unknown> = {
      status: params.status,
    };

    if (params.status === 'blocked') {
      setValues.blockedAt = params.now;
    } else if (user.status === 'blocked' && params.status === 'active') {
      setValues.blockedAt = null;
    }

    if (params.status === 'archived') {
      setValues.archivedAt = params.now;
    }

    const bumpAuthVersion = requiresSessionInvalidation(user.status, params.status);

    const updateQuery = manager
      .createQueryBuilder()
      .update(User)
      .set({
        ...setValues,
        version: () => 'version + 1',
        ...(bumpAuthVersion ? { authVersion: () => 'auth_version + 1' } : {}),
      })
      .where('id = :userId', { userId: params.userId })
      .andWhere('version = :expectedVersion', { expectedVersion: params.expectedVersion });

    const result = await updateQuery.execute();
    if ((result.affected ?? 0) === 0) {
      return null;
    }

    return manager.findOne(User, { where: { id: params.userId } });
  }

  async updateProfileWithVersion(
    manager: EntityManager,
    params: UpdateProfileParams,
  ): Promise<Profile | null> {
    const profile = await manager.findOne(Profile, { where: { userId: params.userId } });
    if (!profile) {
      return null;
    }

    const setValues: Partial<Profile> = {};
    if (params.displayName !== undefined) {
      setValues.displayName = params.displayName;
    }
    if (params.phone !== undefined) {
      setValues.phone = params.phone;
    }

    const result = await manager
      .createQueryBuilder()
      .update(Profile)
      .set({
        ...setValues,
        version: () => 'version + 1',
      })
      .where('user_id = :userId', { userId: params.userId })
      .andWhere('version = :expectedVersion', { expectedVersion: params.expectedVersion })
      .execute();

    if ((result.affected ?? 0) === 0) {
      return null;
    }

    return manager.findOne(Profile, { where: { userId: params.userId } });
  }
}
