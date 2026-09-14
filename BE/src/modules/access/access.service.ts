import { Inject, Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { DataSource } from 'typeorm';
import { ApiException } from '../../common/http/api.exception';
import { PaginationQueryDto } from '../../common/http/dto/pagination-query.dto';
import { ErrorCode } from '../../common/http/error-code';
import { buildPageMeta } from '../../common/http/pagination/page-meta';
import { parseSortParam } from '../../common/http/pagination/sort-allowlist';
import { CLOCK, Clock } from '../../platform/clock/clock.interface';
import { AuditService } from '../audit/audit.service';
import { UserRepository } from '../identity/user.repository';
import { AccessRepository, AccessRepositoryError } from './access.repository';
import { CreateRoleDto } from './dto/create-role.dto';
import { ReplaceRolePermissionsDto } from './dto/replace-role-permissions.dto';
import { ReplaceUserRolesDto } from './dto/replace-user-roles.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { IamPolicyError, IamPolicyService } from './iam-policy.service';
import {
  PermissionResponse,
  RoleResponse,
  toPermissionResponse,
  toRoleResponse,
  UserRolesResponse,
} from './mappers/access.mapper';
import { ADMIN_ROLE_CODE } from './permission-registry';

const ROLE_SORT_ALLOWLIST = ['id', 'code', 'createdAt'] as const;
const PERMISSION_SORT_ALLOWLIST = ['id', 'code'] as const;

@Injectable()
export class AccessService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly accessRepository: AccessRepository,
    private readonly userRepository: UserRepository,
    private readonly iamPolicyService: IamPolicyService,
    private readonly auditService: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async listRoles(query: PaginationQueryDto): Promise<{
    data: RoleResponse[];
    meta: ReturnType<typeof buildPageMeta>;
  }> {
    const { field, direction } = parseSortParam(query.sort, ROLE_SORT_ALLOWLIST);
    const { items, total } = await this.accessRepository.listRoles({
      page: query.page,
      pageSize: query.pageSize,
      sortField: field as (typeof ROLE_SORT_ALLOWLIST)[number],
      sortDirection: direction === 'asc' ? 'ASC' : 'DESC',
    });

    return {
      data: items.map((role) => toRoleResponse(role)),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async createRole(
    body: CreateRoleDto,
    actorUserId: string,
    requestId: string,
  ): Promise<RoleResponse> {
    try {
      const role = await this.dataSource.transaction(async (manager) => {
        const created = await this.accessRepository.createRole(manager, {
          code: body.code,
          name: body.name,
          description: body.description ?? null,
        });

        await this.auditService.append(manager, {
          actorUserId,
          action: 'roles.create',
          targetType: 'role',
          targetId: created.id,
          outcome: 'success',
          requestId,
          details: { code: created.code },
        });

        return created;
      });

      return toRoleResponse(role);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as { code?: string }).code === 'ER_DUP_ENTRY'
      ) {
        throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Role code is already in use.');
      }
      throw error;
    }
  }

  async updateRole(
    roleId: string,
    body: UpdateRoleDto,
    actorUserId: string,
    requestId: string,
  ): Promise<RoleResponse> {
    const existing = await this.accessRepository.findRoleById(roleId);
    if (!existing) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Role was not found.');
    }
    if (existing.isSystem) {
      throw new ApiException(403, ErrorCode.FORBIDDEN, 'System roles cannot be modified.');
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      const role = await this.accessRepository.updateRoleWithVersion(manager, {
        roleId,
        expectedVersion: body.version,
        name: body.name,
        description: body.description,
      });
      if (!role) {
        throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Role version is stale.');
      }

      await this.auditService.append(manager, {
        actorUserId,
        action: 'roles.update',
        targetType: 'role',
        targetId: roleId,
        outcome: 'success',
        requestId,
      });

      return role;
    });

    return toRoleResponse(updated);
  }

  async deleteRole(
    roleId: string,
    expectedVersion: string,
    actorUserId: string,
    requestId: string,
  ): Promise<void> {
    const result = await this.dataSource.transaction(async (manager) => {
      const deleteResult = await this.accessRepository.deleteRoleWithVersion(
        manager,
        roleId,
        expectedVersion,
      );

      if (deleteResult === 'not_found') {
        throw new ApiException(404, ErrorCode.NOT_FOUND, 'Role was not found.');
      }
      if (deleteResult === 'system_role') {
        throw new ApiException(403, ErrorCode.FORBIDDEN, 'System roles cannot be deleted.');
      }
      if (deleteResult === 'version_conflict') {
        throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Role version is stale.');
      }
      if (deleteResult === 'in_use') {
        throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Role is still assigned to users.');
      }

      await this.auditService.append(manager, {
        actorUserId,
        action: 'roles.delete',
        targetType: 'role',
        targetId: roleId,
        outcome: 'success',
        requestId,
      });

      return deleteResult;
    });

    return void result;
  }

  async listPermissions(query: PaginationQueryDto): Promise<{
    data: PermissionResponse[];
    meta: ReturnType<typeof buildPageMeta>;
  }> {
    const { field, direction } = parseSortParam(query.sort, PERMISSION_SORT_ALLOWLIST);
    const { items, total } = await this.accessRepository.listPermissions({
      page: query.page,
      pageSize: query.pageSize,
      sortField: field as (typeof PERMISSION_SORT_ALLOWLIST)[number],
      sortDirection: direction === 'asc' ? 'ASC' : 'DESC',
    });

    return {
      data: items.map(toPermissionResponse),
      meta: buildPageMeta(query.page, query.pageSize, total),
    };
  }

  async replaceRolePermissions(
    roleId: string,
    body: ReplaceRolePermissionsDto,
    actorUserId: string,
    requestId: string,
  ): Promise<RoleResponse> {
    const existing = await this.accessRepository.findRoleById(roleId);
    if (!existing) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'Role was not found.');
    }
    if (existing.isSystem) {
      throw new ApiException(
        403,
        ErrorCode.FORBIDDEN,
        'System role permissions cannot be modified.',
      );
    }

    const currentCodes = await this.accessRepository.getPermissionCodesForRole(roleId);
    const removedCodes = currentCodes.filter((code) => !body.permissionCodes.includes(code));

    try {
      const role = await this.dataSource.transaction(async (manager) => {
        await this.iamPolicyService.assertRolePermissionChangeSafe(
          manager,
          existing.code,
          removedCodes,
        );

        const updated = await this.accessRepository.replaceRolePermissions(
          manager,
          roleId,
          body.version,
          body.permissionCodes,
        );
        if (!updated) {
          throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'Role version is stale.');
        }

        await this.auditService.append(manager, {
          actorUserId,
          action: 'roles.permissions.replace',
          targetType: 'role',
          targetId: roleId,
          outcome: 'success',
          requestId,
        });

        return updated;
      });

      const permissionCodes = await this.accessRepository.getPermissionCodesForRole(role.id);
      return toRoleResponse(role, permissionCodes);
    } catch (error) {
      if (error instanceof AccessRepositoryError && error.code === 'permission_not_registered') {
        throw new ApiException(422, ErrorCode.VALIDATION_FAILED, error.message);
      }
      if (error instanceof IamPolicyError && error.code === 'last_admin_denied') {
        throw new ApiException(
          409,
          ErrorCode.LAST_ADMIN_REQUIRED,
          'Operation would remove the last active admin.',
        );
      }
      throw error;
    }
  }

  async getUserRoles(userId: string): Promise<UserRolesResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'User was not found.');
    }

    const roles = await this.accessRepository.getRolesForUser(userId);
    return {
      userId: user.id,
      userVersion: user.version,
      roles: roles.map((role) => toRoleResponse(role)),
    };
  }

  async replaceUserRoles(
    userId: string,
    body: ReplaceUserRolesDto,
    actorUserId: string,
    requestId: string,
  ): Promise<UserRolesResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'User was not found.');
    }

    const currentRoles = await this.accessRepository.getRolesForUser(userId);
    const hadAdminRole = currentRoles.some((role) => role.code === ADMIN_ROLE_CODE);

    const requestedRoles = body.roleIds.length
      ? await Promise.all(body.roleIds.map((id) => this.accessRepository.findRoleById(id)))
      : [];
    if (requestedRoles.some((role) => role === null)) {
      throw new ApiException(404, ErrorCode.NOT_FOUND, 'One or more roles were not found.');
    }

    const willHaveAdminRole = requestedRoles.some((role) => role?.code === ADMIN_ROLE_CODE);

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        if (hadAdminRole && !willHaveAdminRole) {
          await this.iamPolicyService.assertRetainsLastAdmin(manager, {
            targetUserId: userId,
            wouldRemoveAdminRole: true,
          });
        }

        const replaced = await this.accessRepository.replaceUserRoles(manager, {
          userId,
          expectedUserVersion: body.version,
          roleIds: body.roleIds,
          assignedBy: actorUserId,
          assignedAt: this.clock.now(),
        });
        if (!replaced) {
          throw new ApiException(409, ErrorCode.VERSION_CONFLICT, 'User version is stale.');
        }

        await this.auditService.append(manager, {
          actorUserId,
          action: 'users.roles.replace',
          targetType: 'user',
          targetId: userId,
          outcome: 'success',
          requestId,
          details: { roleIds: body.roleIds },
        });

        return replaced;
      });

      return {
        userId: result.user.id,
        userVersion: result.user.version,
        roles: result.roles.map((role) => toRoleResponse(role)),
      };
    } catch (error) {
      if (error instanceof AccessRepositoryError && error.code === 'role_not_found') {
        throw new ApiException(404, ErrorCode.NOT_FOUND, error.message);
      }
      if (error instanceof IamPolicyError && error.code === 'last_admin_denied') {
        throw new ApiException(
          409,
          ErrorCode.LAST_ADMIN_REQUIRED,
          'Operation would remove the last active admin.',
        );
      }
      throw error;
    }
  }
}
