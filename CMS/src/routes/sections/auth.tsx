import type { RouteObject } from 'react-router';

import { Outlet } from 'react-router';
import { lazy, Suspense } from 'react';

import { AuthSplitLayout } from 'src/layouts/auth-split';

import { SplashScreen } from 'src/components/loading-screen';

import { GuestGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

/** **************************************
 * Jwt
 *************************************** */
const Jwt = {
  SignInPage: lazy(() => import('src/pages/auth/jwt/sign-in')),
  ForgotPasswordPage: lazy(() => import('src/pages/auth/jwt/forgot-password')),
  ResetPasswordPage: lazy(() => import('src/pages/auth/jwt/reset-password')),
  ActivatePage: lazy(() => import('src/pages/auth/jwt/activate')),
};

// Self-registration stays closed (CMS-02): librarian accounts are provisioned by an admin.
// reset-password and activate stay open because they are reached from a one-time email token.
const authJwt = {
  path: 'jwt',
  children: [
    {
      path: 'sign-in',
      element: (
        <GuestGuard>
          <AuthSplitLayout
            slotProps={{
              section: { title: 'Quản trị thư viện' },
            }}
          >
            <Jwt.SignInPage />
          </AuthSplitLayout>
        </GuestGuard>
      ),
    },
    {
      path: 'forgot-password',
      element: (
        <GuestGuard>
          <AuthSplitLayout>
            <Jwt.ForgotPasswordPage />
          </AuthSplitLayout>
        </GuestGuard>
      ),
    },
    {
      path: 'reset-password',
      element: (
        <AuthSplitLayout>
          <Jwt.ResetPasswordPage />
        </AuthSplitLayout>
      ),
    },
    {
      path: 'activate',
      element: (
        <AuthSplitLayout>
          <Jwt.ActivatePage />
        </AuthSplitLayout>
      ),
    },
  ],
};

// ----------------------------------------------------------------------

export const authRoutes: RouteObject[] = [
  {
    path: 'auth',
    element: (
      <Suspense fallback={<SplashScreen />}>
        <Outlet />
      </Suspense>
    ),
    children: [authJwt],
  },
];
