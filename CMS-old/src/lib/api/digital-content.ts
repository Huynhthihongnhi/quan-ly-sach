import { ApiClientError, type ApiErrorBody } from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

/** Relative API path only; never embed session tokens or storage keys in URLs. */
export function digitalReadPath(assetId: string): string {
  return `/digital-assets/${assetId}/read`;
}

export function digitalDownloadPath(assetId: string): string {
  return `/digital-assets/${assetId}/download`;
}

export function digitalReadUrl(assetId: string): string {
  return `${API_BASE}${digitalReadPath(assetId)}`;
}

async function toApiClientError(response: Response): Promise<ApiClientError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new ApiClientError(
      response.status,
      body.error?.code ?? 'UNKNOWN_ERROR',
      body.error?.message ?? 'Request failed.',
      body.error?.fields,
    );
  } catch {
    return new ApiClientError(response.status, 'UNKNOWN_ERROR', 'Request failed.');
  }
}

export async function fetchDigitalReadBlob(
  assetId: string,
  signal?: AbortSignal,
): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(digitalReadUrl(assetId), {
      method: 'GET',
      credentials: 'include',
      signal,
      headers: { Accept: 'application/pdf' },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Network request failed.');
  }

  if (!response.ok) {
    throw await toApiClientError(response);
  }

  return response.blob();
}

export async function downloadDigitalAsset(assetId: string, signal?: AbortSignal): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${digitalDownloadPath(assetId)}`, {
      method: 'GET',
      credentials: 'include',
      signal,
      headers: { Accept: 'application/pdf' },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Network request failed.');
  }

  if (!response.ok) {
    throw await toApiClientError(response);
  }

  return response.blob();
}
