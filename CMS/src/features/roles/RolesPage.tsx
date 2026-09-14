import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listPermissions, listRoles, replaceRolePermissions } from '@/lib/api/roles';
import { ApiClientError, type PermissionRecord, type RoleRecord } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthProvider';

export function RolesPage(): React.JSX.Element {
  const { can } = useAuth();
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<RoleRecord | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSubmitting, setSaveSubmitting] = useState(false);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesResponse, permissionsResponse] = await Promise.all([
        listRoles(),
        listPermissions(),
      ]);
      setRoles(rolesResponse.data);
      setPermissions(permissionsResponse.data);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Failed to load roles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  function openEditor(role: RoleRecord): void {
    setEditTarget(role);
    setSelectedCodes(role.permissionCodes ?? []);
    setSaveError(null);
  }

  async function handleSave(): Promise<void> {
    if (!editTarget || saveSubmitting) {
      return;
    }

    setSaveSubmitting(true);
    setSaveError(null);
    try {
      await replaceRolePermissions(editTarget.id, {
        permissionCodes: selectedCodes,
        version: editTarget.version,
      });
      setEditTarget(null);
      await loadRoles();
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === 'VERSION_CONFLICT') {
        setSaveError('This role was updated elsewhere. Reload the page and try again.');
      } else {
        setSaveError(caught instanceof ApiClientError ? caught.message : 'Failed to save role.');
      }
    } finally {
      setSaveSubmitting(false);
    }
  }

  function togglePermission(code: string): void {
    setSelectedCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Roles</h1>

      {error ? (
        <Alert variant="destructive" aria-live="assertive">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <p role="status">Loading roles...</p>
      ) : roles.length === 0 ? (
        <p>No roles found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>System</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>{role.code}</TableCell>
                <TableCell>{role.name}</TableCell>
                <TableCell>{role.isSystem ? 'Yes' : 'No'}</TableCell>
                <TableCell>
                  {can('roles.write') && !role.isSystem ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => openEditor(role)}>
                      Edit permissions
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent aria-describedby="edit-role-description">
          <DialogHeader>
            <DialogTitle>Edit permissions</DialogTitle>
            <DialogDescription id="edit-role-description">
              Update permissions for {editTarget?.name ?? 'this role'}.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {permissions.map((permission) => (
              <label key={permission.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCodes.includes(permission.code)}
                  onChange={() => togglePermission(permission.code)}
                />
                <span>
                  {permission.code}
                  <span className="ml-2 text-slate-500">{permission.description}</span>
                </span>
              </label>
            ))}
          </div>
          {saveError ? (
            <Alert variant="destructive" aria-live="assertive">
              {saveError}
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" disabled={saveSubmitting} onClick={() => void handleSave()}>
              {saveSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
