import { describe, expect, it } from 'vitest';

import axiosInstance from 'src/lib/axios';

describe('axios instance', () => {
  it('targets the versioned API and sends credentials', () => {
    expect(axiosInstance.defaults.baseURL).toBe('/api/v1');
    expect(axiosInstance.defaults.withCredentials).toBe(true);
  });

  it('sends x-requested-with so the BE MutationOriginGuard accepts writes', () => {
    expect(axiosInstance.defaults.headers.common['x-requested-with']).toBe('library-web');
  });
});
