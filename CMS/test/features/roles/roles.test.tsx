import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RolesPage } from '@/features/roles/RolesPage';
import { setMockSession } from '../../mocks/handlers';
import { renderWithProviders } from '../../test-utils';

describe('TST-S1-06 roles conflict', () => {
  it('shows version conflict instead of silently overwriting', async () => {
    setMockSession('admin');
    const user = userEvent.setup();

    renderWithProviders(<RolesPage />, {
      route: '/roles',
      csrf: 'csrf-admin-token',
    });

    await screen.findByText('Custom Role');
    await user.click(screen.getByRole('button', { name: 'Edit permissions' }));

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]!);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This role was updated elsewhere. Reload the page and try again.',
    );
  });
});
