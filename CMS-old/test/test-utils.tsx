import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { setCsrfToken } from '@/lib/api/client';

export function renderWithProviders(
  ui: React.ReactElement,
  {
    route = '/',
    csrf = null,
  }: {
    route?: string;
    csrf?: string | null;
  } = {},
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  setCsrfToken(csrf);
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
    options,
  );
}
