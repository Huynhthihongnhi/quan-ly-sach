import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { AppRoutes } from '@/routes/AppRoutes';

export default function App(): React.JSX.Element {
  return (
    <BrowserRouter basename="/cms">
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
