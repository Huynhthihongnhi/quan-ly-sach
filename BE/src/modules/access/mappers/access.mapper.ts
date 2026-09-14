import { Permission } from '../entities/permission.entity';
import { Role } from '../entities/role.entity';

export interface RoleResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  version: string;
  createdAt: string;
  permissionCodes?: string[];
}

export interface PermissionResponse {
  id: string;
  code: string;
  description: string;
}

export interface UserRolesResponse {
  userId: string;
  userVersion: string;
  roles: RoleResponse[];
}

export function toRoleResponse(role: Role, permissionCodes?: string[]): RoleResponse {
  const response: RoleResponse = {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    version: role.version,
    createdAt: role.createdAt.toISOString(),
  };
  if (permissionCodes) {
    response.permissionCodes = permissionCodes;
  }
  return response;
}

export function toPermissionResponse(permission: Permission): PermissionResponse {
  return {
    id: permission.id,
    code: permission.code,
    description: permission.description,
  };
}
