import { hasPermission } from '@/lib/permissions';
import { isSafeInternalPath } from '@/lib/api/client';

export function resolvePostLoginPath(
  from: string | null,
  permissionCodes: readonly string[],
): string {
  if (from && isSafeInternalPath(from)) {
    return from;
  }
  if (hasPermission(permissionCodes, 'users.read')) {
    return '/users';
  }
  if (hasPermission(permissionCodes, 'catalog.read')) {
    return '/catalog/manage/books';
  }
  if (hasPermission(permissionCodes, 'roles.read')) {
    return '/roles';
  }
  return '/profile';
}
