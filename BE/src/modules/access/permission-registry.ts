export interface PermissionDefinition {
  code: string;
  description: string;
}

export interface RoleDefinition {
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissionCodes: readonly string[];
}

export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  { code: 'users.read', description: 'Read user accounts' },
  { code: 'users.write', description: 'Create and update user accounts' },
  { code: 'users.roles.write', description: 'Assign roles to users' },
  { code: 'profiles.read', description: 'Read profiles of other users' },
  { code: 'profiles.write', description: 'Update profiles of other users' },
  { code: 'roles.read', description: 'Read roles' },
  { code: 'roles.write', description: 'Create and update roles' },
  { code: 'permissions.read', description: 'Read permission registry' },
  { code: 'audit.read', description: 'Read audit events' },
  { code: 'catalog.read', description: 'Read catalog metadata' },
  { code: 'catalog.write', description: 'Write catalog metadata' },
  { code: 'copies.write', description: 'Manage book copies' },
  { code: 'cards.read', description: 'Read library cards' },
  { code: 'cards.write', description: 'Manage library cards' },
  { code: 'digital.write', description: 'Manage digital assets' },
  { code: 'digital.download.own', description: 'Download own digital assets' },
  { code: 'loans.create.own', description: 'Create own loans' },
  { code: 'loans.read.own', description: 'Read own loans' },
  { code: 'loans.cancel.own', description: 'Cancel own loans' },
  { code: 'loans.read.any', description: 'Read any loan' },
  { code: 'loans.manage', description: 'Manage circulation' },
  { code: 'purchases.create.own', description: 'Create own purchase requests' },
  { code: 'purchases.read.own', description: 'Read own purchase requests' },
  { code: 'purchases.read.any', description: 'Read any purchase request' },
  { code: 'purchases.review', description: 'Review purchase requests' },
  { code: 'reports.read', description: 'Read reports' },
  { code: 'demo.read', description: 'Read contract demo resources' },
] as const;

const ADMIN_ESSENTIAL_PERMISSIONS = [
  'users.read',
  'users.write',
  'users.roles.write',
  'profiles.read',
  'profiles.write',
  'roles.read',
  'roles.write',
  'permissions.read',
  'audit.read',
] as const;

export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    code: 'reader',
    name: 'Reader',
    description: 'Library reader',
    isSystem: true,
    permissionCodes: [
      'digital.download.own',
      'loans.create.own',
      'loans.read.own',
      'loans.cancel.own',
      'purchases.create.own',
      'purchases.read.own',
    ],
  },
  {
    code: 'librarian',
    name: 'Librarian',
    description: 'Library staff',
    isSystem: true,
    permissionCodes: [
      'digital.download.own',
      'loans.create.own',
      'loans.read.own',
      'loans.cancel.own',
      'purchases.create.own',
      'purchases.read.own',
      'catalog.read',
      'catalog.write',
      'copies.write',
      'cards.read',
      'cards.write',
      'digital.write',
      'loans.read.any',
      'loans.manage',
      'purchases.read.any',
      'purchases.review',
      'reports.read',
    ],
  },
  {
    code: 'admin',
    name: 'Administrator',
    description: 'System administrator',
    isSystem: true,
    permissionCodes: PERMISSION_DEFINITIONS.map((permission) => permission.code),
  },
] as const;

export const ADMIN_ROLE_CODE = 'admin';
export const ADMIN_ESSENTIAL_PERMISSION_CODES = ADMIN_ESSENTIAL_PERMISSIONS;

export function isRegisteredPermissionCode(code: string): boolean {
  return PERMISSION_DEFINITIONS.some((permission) => permission.code === code);
}
