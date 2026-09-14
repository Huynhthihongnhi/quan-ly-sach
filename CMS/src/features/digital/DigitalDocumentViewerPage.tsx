import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { downloadDigitalAsset } from '@/lib/api/digital-content';
import type { PublicDigitalAsset } from '@/lib/api/catalog-public';
import { useAuth } from '@/lib/auth/AuthProvider';
import {
  describeDigitalDownloadError,
  downloadPolicyHint,
} from './digital-content-messages';
import { useDigitalDocumentViewer } from './use-digital-document-viewer';

interface ViewerLocationState {
  asset?: PublicDigitalAsset;
  bookTitle?: string;
}

export function DigitalDocumentViewerPage(): React.JSX.Element {
  const { id: bookId, assetId } = useParams();
  const location = useLocation();
  const locationState = (location.state ?? {}) as ViewerLocationState;
  const asset = locationState.asset;
  const { loading, error, blobUrl } = useDigitalDocumentViewer(assetId);
  const { can } = useAuth();
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const downloadControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      downloadControllerRef.current?.abort();
      downloadControllerRef.current = null;
    };
  }, [assetId]);

  async function handleDownload(): Promise<void> {
    if (!assetId || downloading) {
      return;
    }

    downloadControllerRef.current?.abort();
    const controller = new AbortController();
    downloadControllerRef.current = controller;
    setDownloading(true);
    setDownloadError(null);

    try {
      const blob = await downloadDigitalAsset(assetId, controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `document-${assetId}.pdf`;
      anchor.rel = 'noopener';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      if (controller.signal.aborted) {
        return;
      }
      const message = describeDigitalDownloadError(caught);
      setDownloadError(message || 'Download failed.');
    } finally {
      if (!controller.signal.aborted) {
        setDownloading(false);
      }
    }
  }

  const canAttemptDownload = can('digital.download.own');
  const downloadRequiresCard = asset?.downloadRequiresCard ?? true;

  return (
    <div className="space-y-4">
      <Link
        to={bookId ? `/catalog/view/${bookId}` : '/catalog'}
        className="text-sm font-medium text-blue-700 hover:underline"
      >
        Back to book
      </Link>

      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">
          {locationState.bookTitle ?? 'Digital document'}
        </h1>
        {asset?.rightsNote ? (
          <p className="text-sm text-slate-600">{asset.rightsNote}</p>
        ) : null}
      </header>

      {loading ? <p className="text-sm text-slate-600">Loading document...</p> : null}
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {blobUrl ? (
        <iframe
          data-testid="document-viewer-frame"
          title="Document viewer"
          src={blobUrl}
          className="h-[70vh] w-full rounded-md border border-slate-200 bg-white"
        />
      ) : null}

      <section className="space-y-2 rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Download</h2>
        <p className="text-xs text-slate-600">{downloadPolicyHint(downloadRequiresCard)}</p>
        {!canAttemptDownload ? (
          <p className="text-xs text-slate-600">Sign in as a reader to enable download.</p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          disabled={!canAttemptDownload || downloading || !assetId}
          onClick={() => {
            void handleDownload();
          }}
        >
          {downloading ? 'Preparing download...' : 'Download PDF'}
        </Button>
        {downloadError ? <Alert variant="destructive">{downloadError}</Alert> : null}
      </section>

      <p className="text-xs text-slate-500">
        Viewing in the browser does not prevent copying. Access is checked on each request; links
        do not contain long-lived storage URLs or session tokens.
      </p>
    </div>
  );
}
