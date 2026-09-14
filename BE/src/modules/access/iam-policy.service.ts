import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User } from '../identity/entities/user.entity';
import { ADMIN_ESSENTIAL_PERMISSION_CODES, ADMIN_ROLE_CODE } from './permission-registry';
import { IamPolicyLock } from './entities/iam-policy-lock.entity';
import { Role } from './entities/role.entity';
import { UserRole } from './entities/user-role.entity';

export class IamPolicyError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'IamPolicyError';
  }
}

@Injectable()
export class IamPolicyService {
  async acquirePolicyLock(manager: EntityManager): Promise<IamPolicyLock> {
    const lock = await manager
      .createQueryBuilder(IamPolicyLock, 'lock')
      .setLock('pessimistic_write')
      .where('lock.id = :id', { id: 1 })
      .getOne();

    if (!lock) {
      throw new IamPolicyError('IAM policy lock row is missing', 'iam_policy_lock_missing');
    }

    return lock;
  }

  async countActiveAdmins(manager: EntityManager, excludeUserId?: string): Promise<number> {
    const query = manager
      .createQueryBuilder(User, 'user')
      .innerJoin(UserRole, 'userRole', 'userRole.userId = user.id')
      .innerJoin(Role, 'role', 'role.id = userRole.roleId AND role.code = :adminRoleCode', {
        adminRoleCode: ADMIN_ROLE_CODE,
      })
      .where('user.status = :status', { status: 'active' });

    if (excludeUserId) {
      query.andWhere('user.id <> :excludeUserId', { excludeUserId });
    }

    return query.getCount();
  }

  async assertRetainsLastAdmin(
    manager: EntityManager,
    params: { targetUserId: string; wouldRemoveAdminRole?: boolean; wouldBlockOrArchive?: boolean },
  ): Promise<void> {
    await this.acquirePolicyLock(manager);

    const targetIsActiveAdmin = await this.isActiveAdmin(manager, params.targetUserId);
    if (!targetIsActiveAdmin) {
      return;
    }

    const removesAdmin =
      params.wouldRemoveAdminRole === true || params.wouldBlockOrArchive === true;
    if (!removesAdmin) {
      return;
    }

    const remainingAdmins = await this.countActiveAdmins(manager, params.targetUserId);
    if (remainingAdmins === 0) {
      throw new IamPolicyError('Operation would remove the last active admin', 'last_admin_denied');
    }
  }

  async assertRolePermissionChangeSafe(
    manager: EntityManager,
    roleCode: string,
    removedPermissionCodes: readonly string[],
  ): Promise<void> {
    if (roleCode !== ADMIN_ROLE_CODE) {
      return;
    }

    const removesEssential = removedPermissionCodes.some((code) =>
      ADMIN_ESSENTIAL_PERMISSION_CODES.includes(
        code as (typeof ADMIN_ESSENTIAL_PERMISSION_CODES)[number],
      ),
    );
    if (!removesEssential) {
      return;
    }

    await this.acquirePolicyLock(manager);
    const adminCount = await this.countActiveAdmins(manager);
    if (adminCount === 0) {
      throw new IamPolicyError(
        'No active admin remains after permission change',
        'last_admin_denied',
      );
    }
  }

  private async isActiveAdmin(manager: EntityManager, userId: string): Promise<boolean> {
    const count = await manager
      .createQueryBuilder(User, 'user')
      .innerJoin(UserRole, 'userRole', 'userRole.userId = user.id')
      .innerJoin(Role, 'role', 'role.id = userRole.roleId AND role.code = :adminRoleCode', {
        adminRoleCode: ADMIN_ROLE_CODE,
      })
      .where('user.id = :userId', { userId })
      .andWhere('user.status = :status', { status: 'active' })
      .getCount();

    return count > 0;
  }
}
