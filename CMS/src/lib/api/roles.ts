import { apiRequest } from './client';
import type { PageMeta, PermissionRecord, RoleRecord } from './types';

interface RolesListResponse {
  data: RoleRecord[];
  meta: PageMeta;
}

interface RoleResponse {
  data: RoleRecord;
}

interface PermissionsListResponse {
  data: PermissionRecord[];
  meta: PageMeta;
}

export async function listRoles(page = 1, pageSize = 20): Promise<RolesListResponse> {
  return apiRequest<RolesListResponse>(`/roles?page=${page}&pageSize=${pageSize}`);
}

export async function listPermissions(page = 1, pageSize = 100): Promise<PermissionsListResponse> {
  return apiRequest<PermissionsListResponse>(`/permissions?page=${page}&pageSize=${pageSize}`);
}

export async function replaceRolePermissions(
  roleId: string,
  input: { permissionCodes: string[]; version: string },
): Promise<RoleRecord> {
  const response = await apiRequest<RoleResponse>(`/roles/${roleId}/permissions`, {
    method: 'PUT',
    body: input,
  });
  return response.data;
}
