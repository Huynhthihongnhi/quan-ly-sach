import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PublicBookDetailPage } from '@/features/catalog/PublicBookDetailPage';
import { DigitalDocumentViewerPage } from '@/features/digital/DigitalDocumentViewerPage';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { setDigitalDownloadScenario } from '../../mocks/digital-handlers';
import { resetMockSession, setMockSession } from '../../mocks/handlers';

const publicDigitalRoutes = (
  <Routes>
    <Route element={<PublicLayout />}>
      <Route path="/catalog/view/:id" element={<PublicBookDetailPage />} />
      <Route path="/catalog/view/:id/documents/:assetId" element={<DigitalDocumentViewerPage />} />
    </Route>
    <Route path="/login" element={<div>Login page</div>} />
  </Routes>
);

function renderPublicDigital(initialRoute: string): void {
  render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>{publicDigitalRoutes}</AuthProvider>
    </MemoryRouter>,
  );
}

describe('TST-S4-04 digital document viewer UI', () => {
  beforeEach(() => {
    resetMockSession();
    setDigitalDownloadScenario('ok');
  });

  it('shows download policy on the book detail page while keeping enforcement on the API', async () => {
    renderPublicDigital('/catalog/view/104');

    expect(await screen.findByText('Digital documents')).toBeInTheDocument();
    expect(
      screen.getByText(/Download requires sign-in and an active library card linked to your account/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload/i })).not.toBeInTheDocument();
  });

  it('guides readers when download fails because the library card expired', async () => {
    setMockSession('reader');
    setDigitalDownloadScenario('expired-card');
    renderPublicDigital('/catalog/view/104/documents/901');

    await screen.findByTestId('document-viewer-frame');
    await userEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(
      await screen.findByText(/library card is expired or inactive/i),
    ).toBeInTheDocument();
  });

  it('stops the previous viewer load when switching to another book document', async () => {
    const user = userEvent.setup();

    function SwitchDocumentControl(): React.JSX.Element {
      const navigate = useNavigate();
      return (
        <button
          type="button"
          onClick={() => {
            navigate('/catalog/view/105/documents/902', {
              state: {
                bookTitle: 'Second Digital Book',
                asset: {
                  id: '902',
                  mimeType: 'application/pdf',
                  byteSize: 128,
                  readAccess: 'public',
                  downloadRequiresCard: false,
                  rightsNote: 'Open download policy.',
                },
              },
            });
          }}
        >
          Switch document
        </button>
      );
    }

    render(
      <MemoryRouter initialEntries={['/catalog/view/104/documents/901']}>
        <AuthProvider>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route
                path="/catalog/view/:id/documents/:assetId"
                element={
                  <>
                    <DigitalDocumentViewerPage />
                    <SwitchDocumentControl />
                  </>
                }
              />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    const firstFrame = await screen.findByTestId('document-viewer-frame');
    expect(firstFrame.getAttribute('src') ?? '').toMatch(/^blob:/);

    await user.click(screen.getByRole('button', { name: 'Switch document' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Second Digital Book' })).toBeInTheDocument();
    });
    const secondFrame = screen.getByTestId('document-viewer-frame');
    expect(secondFrame.getAttribute('src') ?? '').toMatch(/^blob:/);
    expect(secondFrame.getAttribute('src')).not.toBe(firstFrame.getAttribute('src'));
  });

  it('does not expose session tokens in the viewer iframe URL', async () => {
    renderPublicDigital('/catalog/view/104/documents/901');

    const frame = await screen.findByTestId('document-viewer-frame');
    const src = frame.getAttribute('src') ?? '';
    expect(src.startsWith('blob:')).toBe(true);
    expect(src.toLowerCase()).not.toContain('csrf');
    expect(src.toLowerCase()).not.toContain('token');
  });

  it('states that in-browser preview is not a copy-control mechanism (S4-05)', async () => {
    renderPublicDigital('/catalog/view/104/documents/901');

    expect(
      await screen.findByText(/does not prevent copying/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/checked on each request/i)).toBeInTheDocument();
  });

  it('hides CMS upload affordances on the public reader catalog surface', async () => {
    setMockSession('reader');
    renderPublicDigital('/catalog/view/104');

    await screen.findByText('Digital Reader Sample');
    expect(screen.queryByText(/upload/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/admin\/books\/.*assets/i)).not.toBeInTheDocument();
  });
});
