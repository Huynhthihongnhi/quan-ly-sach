# S4-05 Digital read/download acceptance matrix (D06)

Recorded expectations for API checks in `BE/test/acceptance/digital-rights-acceptance.spec.ts`. CMS copy-disclaimer check lives in `CMS/test/features/digital/document-viewer.test.tsx`.

| Persona | Session | Asset readAccess | Asset state | Read `/digital-assets/:id/read` | Download `/digital-assets/:id/download` |
| --- | --- | --- | --- | --- | --- |
| Guest | none | public | ready | 200 | 401 (session required) |
| Guest | none | authenticated | ready | 401 | 401 |
| Guest | none | card | ready | 401 | 401 |
| Reader | signed in, no card | public | ready | 200 | 403 when `downloadRequiresCard` |
| Reader | signed in, no card | authenticated | ready | 200 | 403 when `downloadRequiresCard` |
| Reader | signed in, no card | card | ready | 403 (no active card) | 403 when card required |
| Reader | signed in, active card | card | ready | 200 | 200 when `downloadRequiresCard` |
| Any | any | any | quarantine | 409 | 409 |
| Any | direct wrong id | n/a | n/a | 404 | 404 |
| Reader | card revoked after issue | public | ready | 200 | 403 on new download when card required |

Public catalog (`GET /books`, `GET /books/:id`) stays available without a library card.

Browser preview is not a copy-control mechanism; the CMS viewer states that access is checked per request and viewing does not prevent copying.
