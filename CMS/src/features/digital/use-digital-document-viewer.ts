import { useEffect, useState } from 'react';
import { fetchDigitalReadBlob } from '@/lib/api/digital-content';
import { describeDigitalReadError } from './digital-content-messages';

export interface DigitalDocumentViewerState {
  loading: boolean;
  error: string | null;
  blobUrl: string | null;
}

export function useDigitalDocumentViewer(assetId: string | undefined): DigitalDocumentViewerState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) {
      setLoading(false);
      setError('Document id is missing.');
      setBlobUrl(null);
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setBlobUrl(null);

    void fetchDigitalReadBlob(assetId, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch((caught) => {
        if (controller.signal.aborted) {
          return;
        }
        const message = describeDigitalReadError(caught);
        if (!message) {
          return;
        }
        setError(message);
        setBlobUrl(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setBlobUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return null;
      });
    };
  }, [assetId]);

  return { loading, error, blobUrl };
}
