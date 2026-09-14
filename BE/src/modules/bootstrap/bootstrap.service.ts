import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AccessRepository } from '../access/access.repository';
import { IamPolicyService, IamPolicyError } from '../access/iam-policy.service';
import { ADMIN_ROLE_CODE } from '../access/permission-registry';
import { Role } from '../access/entities/role.entity';
import { UserRole } from '../access/entities/user-role.entity';
import { User } from '../identity/entities/user.entity';
import { hashPassword } from '../identity/password-hasher';
import { UserRepository } from '../identity/user.repository';

export class BootstrapError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'BootstrapError';
  }
}

export interface BootstrapAdminInput {
  email: string;
  password: string;
  displayName: string;
  phone?: string | null;
  requestId: string;
}

export interface BootstrapAdminResult {
  created: boolean;
  userId: string | null;
}

@Injectable()
export class BootstrapService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly userRepository: UserRepository,
    private readonly accessRepository: AccessRepository,
    private readonly iamPolicyService: IamPolicyService,
    private readonly auditService: AuditService,
  ) {}

  async bootstrapAdmin(input: BootstrapAdminInput): Promise<BootstrapAdminResult> {
    if (!input.password || input.password.length < 12) {
      throw new BootstrapError(
        'Bootstrap password must be at least 12 characters',
        'bootstrap_password_weak',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      await this.iamPolicyService.acquirePolicyLock(manager);
      await this.accessRepository.seedRegistry(manager);

      const existingAdmin = await manager
        .createQueryBuilder(User, 'user')
        .innerJoin(UserRole, 'userRole', 'userRole.userId = user.id')
        .innerJoin(Role, 'role', 'role.id = userRole.roleId AND role.code = :adminRoleCode', {
          adminRoleCode: ADMIN_ROLE_CODE,
        })
        .where('user.status = :status', { status: 'active' })
        .getOne();

      if (existingAdmin) {
        return { created: false, userId: existingAdmin.id };
      }

      const passwordHash = await hashPassword(input.password);
      const { user } = await this.userRepository.createWithProfile(manager, {
        email: input.email,
        displayName: input.displayName,
        phone: input.phone ?? null,
        status: 'active',
        passwordHash,
      });

      await manager.update(User, { id: user.id }, { emailVerifiedAt: new Date() });

      const adminRole = await manager.findOne(Role, { where: { code: ADMIN_ROLE_CODE } });
      if (!adminRole) {
        throw new BootstrapError(
          'Admin role is missing from registry seed',
          'bootstrap_role_missing',
        );
      }

      await this.accessRepository.assignRole(manager, {
        userId: user.id,
        roleId: adminRole.id,
        assignedBy: user.id,
      });

      await this.auditService.append(manager, {
        actorUserId: user.id,
        action: 'iam.bootstrap.admin',
        targetType: 'user',
        targetId: user.id,
        outcome: 'success',
        requestId: input.requestId,
        details: { email: user.email },
      });

      return { created: true, userId: user.id };
    });
  }

  async seedRegistryOnly(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      try {
        await this.iamPolicyService.acquirePolicyLock(manager);
      } catch (error) {
        if (error instanceof IamPolicyError && error.code === 'iam_policy_lock_missing') {
          throw error;
        }
        throw error;
      }
      await this.accessRepository.seedRegistry(manager);
    });
  }
}
