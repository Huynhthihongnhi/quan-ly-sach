import { Link, NavLink, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/AuthProvider';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-100'}`;

export function AdminLayout(): React.JSX.Element {
  const { can, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-base font-semibold text-slate-900">
              Library CMS
            </Link>
            <nav className="flex items-center gap-1" aria-label="Main navigation">
              <NavLink to="/profile" className={navLinkClass}>
                Profile
              </NavLink>
              {can('users.read') ? (
                <NavLink to="/users" className={navLinkClass}>
                  Users
                </NavLink>
              ) : null}
              {can('roles.read') ? (
                <NavLink to="/roles" className={navLinkClass}>
                  Roles
                </NavLink>
              ) : null}
              {can('catalog.read') ? (
                <NavLink to="/catalog/manage/books" className={navLinkClass}>
                  Catalog
                </NavLink>
              ) : null}
              {can('loans.read.own') ? (
                <NavLink to="/me/loans" className={navLinkClass}>
                  My loans
                </NavLink>
              ) : null}
              {can('loans.read.any') ? (
                <NavLink to="/circulation" className={navLinkClass}>
                  Circulation
                </NavLink>
              ) : null}
            </nav>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
