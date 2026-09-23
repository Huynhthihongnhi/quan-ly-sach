import type { RouteObject } from 'react-router';

import { lazy } from 'react';
import { Navigate } from 'react-router';

import { CONFIG } from 'src/global-config';

import { authRoutes } from './auth';
import { dashboardRoutes } from './dashboard';

// ----------------------------------------------------------------------

const Page404 = lazy(() => import('src/pages/error/404'));
const ResetPasswordPage = lazy(() => import('src/pages/auth/jwt/reset-password'));
const ActivatePage = lazy(() => import('src/pages/auth/jwt/activate'));

const developmentRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: '/dev/form-drawer', Component: lazy(() => import('src/pages/dev/form-drawer-demo')) }]
  : [];

export const routesSection: RouteObject[] = [
  ...developmentRoutes,
  // Paths appended to APP_PUBLIC_ORIGIN by the BE email-link builder.
  { path: '/reset-password', Component: ResetPasswordPage },
  { path: '/activate', Component: ActivatePage },
  {
    path: '/',
    element: <Navigate to={CONFIG.auth.redirectPath} replace />,
  },

  // Auth
  ...authRoutes,

  // Dashboard
  ...dashboardRoutes,

  // No match
  { path: '*', element: <Page404 /> },
];
