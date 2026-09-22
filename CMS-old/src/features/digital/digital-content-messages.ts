import { ApiClientError } from '@/lib/api/types';

export function describeDigitalReadError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '';
  }
  if (!(error instanceof ApiClientError)) {
    return 'Unable to load the document. Check your connection and try again.';
  }

  if (error.code === 'AUTHENTICATION_REQUIRED') {
    return 'Sign in to read this document. Staff login uses the link in the header.';
  }
  if (error.code === 'FORBIDDEN') {
    return 'Your account cannot read this document. An active library card may be required.';
  }
  if (error.code === 'INVALID_TRANSITION') {
    return 'Your library card is expired or inactive. Visit your profile or contact the library desk to renew or replace your card.';
  }
  if (error.status === 404) {
    return 'This document is not available.';
  }
  return error.message;
}

export function describeDigitalDownloadError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '';
  }
  if (!(error instanceof ApiClientError)) {
    return 'Download failed. Check your connection and try again.';
  }

  if (error.code === 'AUTHENTICATION_REQUIRED') {
    return 'Sign in before downloading this document.';
  }
  if (error.code === 'FORBIDDEN') {
    return 'Download is not allowed for your account. Sign in with the account that owns an active library card.';
  }
  if (error.code === 'INVALID_TRANSITION') {
    return 'Your library card is expired or inactive. Renew or replace your card before downloading again.';
  }
  if (error.status === 404) {
    return 'This document is not available for download.';
  }
  return error.message;
}

export function downloadPolicyHint(downloadRequiresCard: boolean): string {
  if (downloadRequiresCard) {
    return 'Download requires sign-in and an active library card linked to your account. The server verifies card status on every request.';
  }
  return 'Download requires sign-in. The server verifies permissions on every request.';
}
