import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { UsersPage } from '@/features/users/UsersPage';
import { setMockSession } from '../../mocks/handlers';
import { renderWithProviders } from '../../test-utils';

describe('UsersPage filter', () => {
  it('filters the list by status', async () => {
    setMockSession('admin');
    const user = userEvent.setup();

    renderWithProviders(<UsersPage />, {
      route: '/users',
      csrf: 'csrf-admin-token',
    });

    await screen.findByText('admin@test.local');
    expect(screen.getByText('invitee@test.local')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Status'), 'invited');

    await waitFor(() => {
      expect(screen.queryByText('admin@test.local')).not.toBeInTheDocument();
    });
    expect(screen.getByText('invitee@test.local')).toBeInTheDocument();
  });

  it('filters the list by search text', async () => {
    setMockSession('admin');
    const user = userEvent.setup();

    renderWithProviders(<UsersPage />, {
      route: '/users',
      csrf: 'csrf-admin-token',
    });

    await screen.findByText('admin@test.local');

    await user.type(screen.getByLabelText('Search'), 'invitee');

    await waitFor(() => {
      expect(screen.queryByText('admin@test.local')).not.toBeInTheDocument();
    });
    expect(screen.getByText('invitee@test.local')).toBeInTheDocument();
  });
});
