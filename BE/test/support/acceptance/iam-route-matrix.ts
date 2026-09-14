export type IamPersona = 'admin' | 'librarian' | 'reader';

export interface IamRouteCase {
  id: string;
  method: 'get' | 'post' | 'patch';
  path: string;
  permission: string;
  expected: Record<IamPersona, number>;
  body?: Record<string, unknown>;
}

export const IAM_ACCEPTANCE_ROUTES: readonly IamRouteCase[] = [
  {
    id: 'list-users',
    method: 'get',
    path: '/api/v1/users',
    permission: 'users.read',
    expected: { admin: 200, librarian: 403, reader: 403 },
  },
  {
    id: 'create-user',
    method: 'post',
    path: '/api/v1/users',
    permission: 'users.write',
    expected: { admin: 201, librarian: 403, reader: 403 },
    body: { email: 'invited.acceptance@test.local', displayName: 'Invited Acceptance' },
  },
  {
    id: 'list-roles',
    method: 'get',
    path: '/api/v1/roles',
    permission: 'roles.read',
    expected: { admin: 200, librarian: 403, reader: 403 },
  },
  {
    id: 'list-permissions',
    method: 'get',
    path: '/api/v1/permissions',
    permission: 'permissions.read',
    expected: { admin: 200, librarian: 403, reader: 403 },
  },
  {
    id: 'list-audit-events',
    method: 'get',
    path: '/api/v1/audit-events',
    permission: 'audit.read',
    expected: { admin: 200, librarian: 403, reader: 403 },
  },
  {
    id: 'demo-admin',
    method: 'get',
    path: '/api/v1/demo/admin',
    permission: 'demo.read',
    expected: { admin: 200, librarian: 403, reader: 403 },
  },
  {
    id: 'own-profile',
    method: 'get',
    path: '/api/v1/me/profile',
    permission: 'session',
    expected: { admin: 200, librarian: 200, reader: 200 },
  },
] as const;
