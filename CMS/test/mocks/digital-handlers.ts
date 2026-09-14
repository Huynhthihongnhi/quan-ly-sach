import { delay, http, HttpResponse } from 'msw';

const API_BASE = '/api/v1';

const PDF_A = '%PDF-1.4 document-a';
const PDF_B = '%PDF-1.4 document-b';

let readRequestCount = 0;
let downloadScenario: 'ok' | 'expired-card' | 'forbidden' = 'ok';

export function resetDigitalMocks(): void {
  readRequestCount = 0;
  downloadScenario = 'ok';
}

export function setDigitalDownloadScenario(value: 'ok' | 'expired-card' | 'forbidden'): void {
  downloadScenario = value;
}

export function getDigitalReadRequestCount(): number {
  return readRequestCount;
}

export const digitalHandlers = [
  http.get(`${API_BASE}/digital-assets/:assetId/read`, async ({ params, request }) => {
    readRequestCount += 1;
    const url = new URL(request.url);
    if (url.searchParams.has('token') || url.searchParams.has('csrf')) {
      return HttpResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: 'Token in URL is not allowed.' } },
        { status: 400 },
      );
    }

    if (params.assetId === '901') {
      if (url.searchParams.get('slow') === '1') {
        await delay(500);
      }
      return new HttpResponse(PDF_A, {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      });
    }
    if (params.assetId === '902') {
      return new HttpResponse(PDF_B, {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      });
    }
    if (params.assetId === '903') {
      return HttpResponse.json(
        { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' } },
        { status: 401 },
      );
    }

    return HttpResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Digital asset was not found.' } },
      { status: 404 },
    );
  }),

  http.get(`${API_BASE}/digital-assets/:assetId/download`, ({ params }) => {
    if (downloadScenario === 'expired-card') {
      return HttpResponse.json(
        {
          error: {
            code: 'INVALID_TRANSITION',
            message: 'Library card is outside its validity window.',
          },
        },
        { status: 409 },
      );
    }
    if (downloadScenario === 'forbidden') {
      return HttpResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Forbidden.' } },
        { status: 403 },
      );
    }
    if (params.assetId === '901' || params.assetId === '902') {
      return new HttpResponse(PDF_A, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="document.pdf"',
        },
      });
    }
    return HttpResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Digital asset was not found.' } },
      { status: 404 },
    );
  }),
];
