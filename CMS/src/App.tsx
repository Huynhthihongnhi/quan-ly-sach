import { BrowserRouter, useRoutes } from 'react-router';
import { Suspense } from 'react';

import { routesSection } from 'src/routes/sections';
import { QueryProvider } from 'src/lib/query-provider';
import { ThemeProvider } from 'src/theme/theme-provider';
import { MotionLazy } from 'src/components/animate/motion-lazy';
import { SnackbarProvider } from 'src/components/snackbar';
import { SplashScreen } from 'src/components/loading-screen';
import { SettingsDrawer, SettingsProvider, defaultSettings } from 'src/components/settings';
import { AuthProvider } from 'src/auth/context/jwt';

function Router() {
  return useRoutes(routesSection);
}

export default function App(): React.JSX.Element {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <QueryProvider>
        <AuthProvider>
          <SettingsProvider defaultSettings={defaultSettings}>
            <ThemeProvider>
              <MotionLazy>
                <SnackbarProvider>
                  <SettingsDrawer defaultSettings={defaultSettings} />
                  <Suspense fallback={<SplashScreen />}>
                    <Router />
                  </Suspense>
                </SnackbarProvider>
              </MotionLazy>
            </ThemeProvider>
          </SettingsProvider>
        </AuthProvider>
      </QueryProvider>
    </BrowserRouter>
  );
}
