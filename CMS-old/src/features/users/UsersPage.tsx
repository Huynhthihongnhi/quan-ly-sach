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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createUser, listUsers, updateUserStatus } from '@/lib/api/users';
import { ApiClientError, type UserRecord } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthProvider';

export function UsersPage(): React.JSX.Element {
  const { can } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [blockTarget, setBlockTarget] = useState<UserRecord | null>(null);
  const [blockSubmitting, setBlockSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listUsers({ q: q || undefined, status: status || undefined });
      setUsers(response.data);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (createSubmitting) {
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);
    try {
      await createUser({ email, displayName });
      setCreateOpen(false);
      setEmail('');
      setDisplayName('');
      await loadUsers();
    } catch (caught) {
      setCreateError(caught instanceof ApiClientError ? caught.message : 'Failed to create user.');
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function confirmBlock(): Promise<void> {
    if (!blockTarget || blockSubmitting) {
      return;
    }

    setBlockSubmitting(true);
    try {
      await updateUserStatus(blockTarget.id, {
        status: 'blocked',
        version: blockTarget.version,
      });
      setBlockTarget(null);
      await loadUsers();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Failed to block user.');
      setBlockTarget(null);
    } finally {
      setBlockSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        {can('users.write') ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Invite user
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="users-search">Search</Label>
          <Input
            id="users-search"
            placeholder="Search by email"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="users-status-filter">Status</Label>
          <select
            id="users-status-filter"
            value={status}
            className="block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="invited">Invited</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" aria-live="assertive">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <p role="status">Loading users...</p>
      ) : users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.status}</TableCell>
                <TableCell>
                  {can('users.write') && user.status === 'active' ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setBlockTarget(user)}
                    >
                      Block
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent aria-describedby="create-user-description">
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription id="create-user-description">
              Create an invited account. Activation email is handled in a later sprint.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void handleCreate(event)}>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-display-name">Display name</Label>
              <Input
                id="create-display-name"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            {createError ? (
              <Alert variant="destructive" aria-live="assertive">
                {createError}
              </Alert>
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={createSubmitting} aria-busy={createSubmitting}>
                {createSubmitting ? 'Saving...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={blockTarget !== null} onOpenChange={(open) => !open && setBlockTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block user</DialogTitle>
            <DialogDescription>
              Blocking revokes active sessions. Confirm you want to block{' '}
              {blockTarget?.email ?? 'this user'}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={blockSubmitting}
              onClick={() => void confirmBlock()}
            >
              {blockSubmitting ? 'Blocking...' : 'Block user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
