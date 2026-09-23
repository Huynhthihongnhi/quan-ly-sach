import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { resetMockSession } from './mocks/handlers';
import { server } from './mocks/server';

function installBlobUrlCompat(): void {
  if (typeof URL.createObjectURL === 'function') {
    return;
  }

  const blobStore = new Map<string, Blob>();
  let blobId = 0;

  URL.createObjectURL = (blob: Blob): string => {
    const id = `blob:vitest-${++blobId}`;
    blobStore.set(id, blob);
    return id;
  };

  URL.revokeObjectURL = (url: string): void => {
    blobStore.delete(url);
  };
}

/**
 * jsdom + MSW mishandle fetch when an idle AbortSignal is attached. Forward abort
 * semantics without passing the signal into the underlying fetch MSW intercepts.
 */
function installFetchAbortSignalCompat(): void {
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal;
    if (!signal) {
      return originalFetch(input, init);
    }
    if (signal.aborted) {
      return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
    }

    const { signal: _ignored, ...rest } = init;
    const request = originalFetch(input, rest);

    return new Promise<Response>((resolve, reject) => {
      const onAbort = (): void => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      request.then(
        (response) => {
          signal.removeEventListener('abort', onAbort);
          resolve(response);
        },
        (error: unknown) => {
          signal.removeEventListener('abort', onAbort);
          reject(error);
        },
      );
    });
  }) as typeof fetch;
}

beforeAll(() => {
  installBlobUrlCompat();
  server.listen({ onUnhandledRequest: 'error' });
  installFetchAbortSignalCompat();
});
afterEach(() => {
  server.resetHandlers();
  resetMockSession();
});
afterAll(() => server.close());
