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
import { CirculationAdminPage } from '@/features/circulation/CirculationAdminPage';
import { LoanReceiptPage } from '@/features/circulation/LoanReceiptPage';
import { MyLoansPage } from '@/features/circulation/MyLoansPage';
import { AdminPurchaseQueuePage } from '@/features/purchases/AdminPurchaseQueuePage';
import { MyPurchaseRequestsPage } from '@/features/purchases/MyPurchaseRequestsPage';
import { SubmitPurchaseRequestPage } from '@/features/purchases/SubmitPurchaseRequestPage';
import { ReportsDashboardPage } from '@/features/reports/ReportsDashboardPage';
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
          path="/me/loans"
          element={
            <RequirePermission permission="loans.read.own">
              <MyLoansPage />
            </RequirePermission>
          }
        />
        <Route
          path="/me/loans/:id"
          element={
            <RequirePermission permission="loans.read.own">
              <LoanReceiptPage />
            </RequirePermission>
          }
        />
        <Route
          path="/circulation"
          element={
            <RequirePermission permission="loans.read.any">
              <CirculationAdminPage />
            </RequirePermission>
          }
        />
        <Route
          path="/catalog/manage/books"
          element={
            <RequirePermission permission="catalog.read">
              <CatalogAdminBooksPage />
            </RequirePermission>
          }
        />
        <Route
          path="/purchase-requests/new"
          element={
            <RequirePermission permission="purchases.create.own">
              <SubmitPurchaseRequestPage />
            </RequirePermission>
          }
        />
        <Route
          path="/me/purchase-requests"
          element={
            <RequirePermission permission="purchases.read.own">
              <MyPurchaseRequestsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/purchase-requests"
          element={
            <RequirePermission permission="purchases.read.any">
              <AdminPurchaseQueuePage />
            </RequirePermission>
          }
        />
        <Route
          path="/reports"
          element={
            <RequirePermission permission="reports.read">
              <ReportsDashboardPage />
            </RequirePermission>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
