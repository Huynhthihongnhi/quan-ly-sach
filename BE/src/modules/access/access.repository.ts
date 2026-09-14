import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { User } from '../identity/entities/user.entity';
import {
  isRegisteredPermissionCode,
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
} from './permission-registry';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';

export interface ListRolesParams {
  page: number;
  pageSize: number;
  sortField: 'id' | 'code' | 'createdAt';
  sortDirection: 'ASC' | 'DESC';
}

export interface ListPermissionsParams {
  page: number;
  pageSize: number;
  sortField: 'id' | 'code';
  sortDirection: 'ASC' | 'DESC';
}

export interface CreateRoleInput {
  code: string;
  name: string;
  description?: string | null;
}

export interface UpdateRoleInput {
  roleId: string;
  expectedVersion: string;
  name?: string;
  description?: string | null;
}

export interface ReplaceUserRolesInput {
  userId: string;
  expectedUserVersion: string;
  roleIds: string[];
  assignedBy: string;
  assignedAt: Date;
}

export class AccessRepositoryError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'AccessRepositoryError';
  }
}

@Injectable()
export class AccessRepository {
  constructor(
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissions: Repository<Permission>,
    @InjectRepository(UserRole)
    private readonly userRoles: Repository<UserRole>,
    @InjectRepository(RolePermission)
    private readonly rolePermissions: Repository<RolePermission>,
  ) {}

  async seedRegistry(manager: EntityManager): Promise<void> {
    const permissionByCode = new Map<string, Permission>();

    for (const definition of PERMISSION_DEFINITIONS) {
      let permission = await manager.findOne(Permission, { where: { code: definition.code } });
      if (!permission) {
        permission = manager.create(Permission, {
          code: definition.code,
          description: definition.description,
        });
        permission = await manager.save(Permission, permission);
      }
      permissionByCode.set(definition.code, permission);
    }

    for (const roleDefinition of ROLE_DEFINITIONS) {
      let role = await manager.findOne(Role, { where: { code: roleDefinition.code } });
      if (!role) {
        role = manager.create(Role, {
          code: roleDefinition.code,
          name: roleDefinition.name,
          description: roleDefinition.description,
          isSystem: roleDefinition.isSystem,
        });
        role = await manager.save(Role, role);
      }

      for (const permissionCode of roleDefinition.permissionCodes) {
        if (!isRegisteredPermissionCode(permissionCode)) {
          throw new AccessRepositoryError(
            `Unknown permission code ${permissionCode}`,
            'permission_not_registered',
          );
        }

        const permission = permissionByCode.get(permissionCode);
        if (!permission) {
          continue;
        }

        const existing = await manager.findOne(RolePermission, {
          where: { roleId: role.id, permissionId: permission.id },
        });
        if (!existing) {
          await manager.save(
            RolePermission,
            manager.create(RolePermission, {
              roleId: role.id,
              permissionId: permission.id,
            }),
          );
        }
      }
    }
  }

  async findRoleByCode(code: string): Promise<Role | null> {
    return this.roles.findOne({ where: { code } });
  }

  async findRoleById(id: string): Promise<Role | null> {
    return this.roles.findOne({ where: { id } });
  }

  async listRoles(params: ListRolesParams): Promise<{ items: Role[]; total: number }> {
    const query = this.roles.createQueryBuilder('role');
    const sortColumn =
      params.sortField === 'code'
        ? 'role.code'
        : params.sortField === 'createdAt'
          ? 'role.created_at'
          : 'role.id';

    query.orderBy(sortColumn, params.sortDirection);
    if (params.sortField !== 'id') {
      query.addOrderBy('role.id', 'DESC');
    }

    const total = await query.getCount();
    const items = await query
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();

    return { items, total };
  }

  async listPermissions(
    params: ListPermissionsParams,
  ): Promise<{ items: Permission[]; total: number }> {
    const query = this.permissions.createQueryBuilder('permission');
    const sortColumn = params.sortField === 'code' ? 'permission.code' : 'permission.id';
    query.orderBy(sortColumn, params.sortDirection);
    if (params.sortField !== 'id') {
      query.addOrderBy('permission.id', 'DESC');
    }

    const total = await query.getCount();
    const items = await query
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();

    return { items, total };
  }

  async createRole(manager: EntityManager, input: CreateRoleInput): Promise<Role> {
    const role = manager.create(Role, {
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      isSystem: false,
    });
    return manager.save(Role, role);
  }

  async updateRoleWithVersion(
    manager: EntityManager,
    input: UpdateRoleInput,
  ): Promise<Role | null> {
    const setValues: Partial<Role> = {};
    if (input.name !== undefined) {
      setValues.name = input.name;
    }
    if (input.description !== undefined) {
      setValues.description = input.description;
    }

    const result = await manager
      .createQueryBuilder()
      .update(Role)
      .set({
        ...setValues,
        version: () => 'version + 1',
      })
      .where('id = :roleId', { roleId: input.roleId })
      .andWhere('version = :expectedVersion', { expectedVersion: input.expectedVersion })
      .andWhere('is_system = :isSystem', { isSystem: false })
      .execute();

    if ((result.affected ?? 0) === 0) {
      return null;
    }

    return manager.findOne(Role, { where: { id: input.roleId } });
  }

  async deleteRoleWithVersion(
    manager: EntityManager,
    roleId: string,
    expectedVersion: string,
  ): Promise<'deleted' | 'not_found' | 'version_conflict' | 'in_use' | 'system_role'> {
    const role = await manager.findOne(Role, { where: { id: roleId } });
    if (!role) {
      return 'not_found';
    }
    if (role.isSystem) {
      return 'system_role';
    }
    if (role.version !== expectedVersion) {
      return 'version_conflict';
    }

    const assignmentCount = await manager.count(UserRole, { where: { roleId } });
    if (assignmentCount > 0) {
      return 'in_use';
    }

    await manager.delete(RolePermission, { roleId });
    await manager.delete(Role, { id: roleId });
    return 'deleted';
  }

  async getPermissionCodesForRole(roleId: string): Promise<string[]> {
    const rows = await this.permissions
      .createQueryBuilder('permission')
      .select('permission.code', 'code')
      .innerJoin(RolePermission, 'rolePermission', 'rolePermission.permissionId = permission.id')
      .where('rolePermission.roleId = :roleId', { roleId })
      .orderBy('permission.code', 'ASC')
      .getRawMany<{ code: string }>();

    return rows.map((row) => row.code);
  }

  async replaceRolePermissions(
    manager: EntityManager,
    roleId: string,
    expectedVersion: string,
    permissionCodes: readonly string[],
  ): Promise<Role | null> {
    for (const code of permissionCodes) {
      if (!isRegisteredPermissionCode(code)) {
        throw new AccessRepositoryError(
          `Unknown permission code ${code}`,
          'permission_not_registered',
        );
      }
    }

    const permissions = permissionCodes.length
      ? await manager.find(Permission, { where: { code: In([...permissionCodes]) } })
      : [];
    if (permissions.length !== permissionCodes.length) {
      throw new AccessRepositoryError(
        'One or more permission codes were not found',
        'permission_not_registered',
      );
    }

    const result = await manager
      .createQueryBuilder()
      .update(Role)
      .set({ version: () => 'version + 1' })
      .where('id = :roleId', { roleId })
      .andWhere('version = :expectedVersion', { expectedVersion })
      .execute();

    if ((result.affected ?? 0) === 0) {
      return null;
    }

    await manager.delete(RolePermission, { roleId });
    for (const permission of permissions) {
      await manager.save(
        RolePermission,
        manager.create(RolePermission, {
          roleId,
          permissionId: permission.id,
        }),
      );
    }

    return manager.findOne(Role, { where: { id: roleId } });
  }

  async getRolesForUser(userId: string): Promise<Role[]> {
    return this.roles
      .createQueryBuilder('role')
      .innerJoin(UserRole, 'userRole', 'userRole.roleId = role.id')
      .where('userRole.userId = :userId', { userId })
      .orderBy('role.code', 'ASC')
      .getMany();
  }

  async replaceUserRoles(
    manager: EntityManager,
    input: ReplaceUserRolesInput,
  ): Promise<{ user: User; roles: Role[] } | null> {
    const roles = input.roleIds.length
      ? await manager.find(Role, { where: { id: In(input.roleIds) } })
      : [];
    if (roles.length !== input.roleIds.length) {
      throw new AccessRepositoryError('One or more roles were not found', 'role_not_found');
    }

    const userUpdate = await manager
      .createQueryBuilder()
      .update(User)
      .set({ version: () => 'version + 1' })
      .where('id = :userId', { userId: input.userId })
      .andWhere('version = :expectedVersion', { expectedVersion: input.expectedUserVersion })
      .execute();

    if ((userUpdate.affected ?? 0) === 0) {
      return null;
    }

    await manager.delete(UserRole, { userId: input.userId });
    for (const roleId of input.roleIds) {
      await this.assignRole(manager, {
        userId: input.userId,
        roleId,
        assignedBy: input.assignedBy,
        assignedAt: input.assignedAt,
      });
    }

    const user = await manager.findOne(User, { where: { id: input.userId } });
    if (!user) {
      return null;
    }

    return { user, roles };
  }

  async assignRole(
    manager: EntityManager,
    params: { userId: string; roleId: string; assignedBy: string; assignedAt?: Date },
  ): Promise<UserRole> {
    const existing = await manager.findOne(UserRole, {
      where: { userId: params.userId, roleId: params.roleId },
    });
    if (existing) {
      return existing;
    }

    const assignment = manager.create(UserRole, {
      userId: params.userId,
      roleId: params.roleId,
      assignedBy: params.assignedBy,
      assignedAt: params.assignedAt ?? new Date(),
    });
    return manager.save(UserRole, assignment);
  }

  async deleteRoleById(manager: EntityManager, roleId: string): Promise<void> {
    await manager.delete(Role, { id: roleId });
  }

  async countUserRoleAssignments(roleId: string): Promise<number> {
    return this.userRoles.count({ where: { roleId } });
  }
}
