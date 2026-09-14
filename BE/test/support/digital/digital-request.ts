import { Server } from 'node:http';
import request from 'supertest';

const ORIGIN = 'http://127.0.0.1:3000';

export function digitalAgent(httpServer: Server, cookie?: string, csrfToken?: string) {
  const withSession = (req: request.Test) => (cookie ? req.set('Cookie', cookie) : req);

  const withMutation = (req: request.Test) => {
    let next = withSession(req).set('Origin', ORIGIN).set('X-Requested-With', 'library-web');
    if (csrfToken) {
      next = next.set('X-CSRF-Token', csrfToken);
    }
    return next;
  };

  return {
    uploadAsset: (bookId: string, file: Buffer, rightsNote: string, filename = 'sample.pdf') =>
      withMutation(request(httpServer).post(`/api/v1/admin/books/${bookId}/assets`))
        .field('rightsNote', rightsNote)
        .attach('file', file, { filename, contentType: 'application/pdf' }),

    patchAccess: (assetId: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).patch(`/api/v1/admin/assets/${assetId}/access`)).send(body),

    archive: (assetId: string, body: Record<string, unknown>) =>
      withMutation(request(httpServer).post(`/api/v1/admin/assets/${assetId}/archive`)).send(body),

    read: (assetId: string, range?: string) => {
      let req = withSession(request(httpServer).get(`/api/v1/digital-assets/${assetId}/read`));
      if (range) {
        req = req.set('Range', range);
      }
      return req;
    },

    download: (assetId: string) =>
      withSession(request(httpServer).get(`/api/v1/digital-assets/${assetId}/download`)),
  };
}
