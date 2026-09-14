import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ActivatePage } from '@/features/auth/ActivatePage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { CatalogAdminBooksPage } from '@/features/catalog/CatalogAdminBooksPage';
import { PublicBookDetailPage } from '@/features/catalog/PublicBookDetailPage';
import { DigitalDocumentViewerPage } from '@/features/digital/DigitalDocumentViewerPage';
import { PublicCatalogPage } from '@/features/catalog/PublicCatalogPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { RolesPage } from '@/features/roles/RolesPage';
import { UsersPage } from '@/features/users/UsersPage';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { RequireAuth } from '@/lib/auth/RequireAuth';
import { RequirePermission } from '@/lib/auth/RequirePermission';

export function AppRoutes(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/activate" element={<ActivatePage />} />
      <Route element={<PublicLayout />}>
        <Route path="/catalog" element={<PublicCatalogPage />} />
        <Route path="/catalog/view/:id" element={<PublicBookDetailPage />} />
        <Route path="/catalog/view/:id/documents/:assetId" element={<DigitalDocumentViewerPage />} />
      </Route>
      <Route
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/users" replace />} />
        <Route
          path="/users"
          element={
            <RequirePermission permission="users.read">
              <UsersPage />
            </RequirePermission>
          }
        />
        <Route
          path="/roles"
          element={
            <RequirePermission permission="roles.read">
              <RolesPage />
            </RequirePermission>
          }
        />
        <Route path="/profile" element={<ProfilePage />} />
        <Route
          path="/catalog/manage/books"
          element={
            <RequirePermission permission="catalog.read">
              <CatalogAdminBooksPage />
            </RequirePermission>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
