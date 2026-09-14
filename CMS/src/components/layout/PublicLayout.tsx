import { Link, Outlet } from 'react-router-dom';

export function PublicLayout(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/catalog" className="text-base font-semibold text-slate-900">
            Library catalog
          </Link>
          <Link to="/login" className="text-sm font-medium text-blue-700 hover:underline">
            Staff login
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
