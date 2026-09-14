import { delay, http, HttpResponse } from 'msw';

const API_BASE = '/api/v1';

const sampleBooks = {
  alpha: {
    id: '101',
    title: 'Alpha Published',
    categoryId: '1',
    categoryName: 'General',
    isbn: null,
    publicationYear: 2020,
    authors: [{ id: '10', name: 'Author Alpha' }],
    topics: [{ id: '20', name: 'Topic A' }],
  },
  beta: {
    id: '102',
    title: 'Beta Published',
    categoryId: '1',
    categoryName: 'General',
    isbn: null,
    publicationYear: 2021,
    authors: [{ id: '11', name: 'Author Beta' }],
    topics: [{ id: '21', name: 'Topic B' }],
  },
  digital: {
    id: '104',
    title: 'Digital Reader Sample',
    categoryId: '1',
    categoryName: 'General',
    isbn: null,
    publicationYear: 2022,
    authors: [{ id: '13', name: 'Digital Author' }],
    topics: [{ id: '20', name: 'Topic A' }],
  },
  vietnamese: {
    id: '103',
    title: 'Đại số cơ bản',
    categoryId: '2',
    categoryName: 'Khoa học tự nhiên',
    isbn: null,
    publicationYear: 2020,
    authors: [{ id: '12', name: 'Nguyễn Văn A' }],
    topics: [{ id: '22', name: 'Đại học' }],
  },
};

function filterPublicBooks(searchParams: URLSearchParams): typeof sampleBooks.alpha[] {
  let data = Object.values(sampleBooks);
  const q = (searchParams.get('q') ?? '').toLowerCase();
  const categoryId = searchParams.get('categoryId');
  const topicId = searchParams.get('topicId');
  const year = searchParams.get('year');

  if (categoryId) {
    data = data.filter((book) => book.categoryId === categoryId);
  }
  if (topicId) {
    data = data.filter((book) => book.topics.some((topic) => topic.id === topicId));
  }
  if (year) {
    data = data.filter((book) => String(book.publicationYear ?? '') === year);
  }
  if (q) {
    data = data.filter((book) => {
      const haystack = [
        book.title,
        book.categoryName,
        ...book.authors.map((author) => author.name),
        ...book.topics.map((topic) => topic.name),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  return data;
}

let catalogNetworkFail = false;

export function setCatalogNetworkFail(value: boolean): void {
  catalogNetworkFail = value;
}

export const catalogHandlers = [
  http.get(`${API_BASE}/books`, async ({ request }) => {
    if (catalogNetworkFail) {
      return HttpResponse.error();
    }

    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    const page = Number(url.searchParams.get('page') ?? '1');

    if (q === 'slow') {
      await delay(400);
      return HttpResponse.json({
        data: [{ ...sampleBooks.beta, title: 'Slow stale result' }],
        meta: { page: 1, pageSize: 12, total: 1 },
      });
    }

    if (q === 'fast') {
      return HttpResponse.json({
        data: [{ ...sampleBooks.alpha, title: 'Fast fresh result' }],
        meta: { page: 1, pageSize: 12, total: 1 },
      });
    }

    let data = filterPublicBooks(url.searchParams);
    if (url.searchParams.get('categoryId') === 'missing') {
      data = [];
    }

    const pageSize = 12;
    const start = (page - 1) * pageSize;
    const pageItems = data.slice(start, start + pageSize);

    return HttpResponse.json({
      data: pageItems,
      meta: { page, pageSize, total: data.length },
    });
  }),

  http.get(`${API_BASE}/books/:id`, ({ params }) => {
    if (params.id === '101') {
      return HttpResponse.json({
        data: {
          ...sampleBooks.alpha,
          publisherName: 'Publisher',
          description: 'Detail description',
          availableCopies: null,
          digitalAssets: [],
        },
      });
    }
    if (params.id === '103') {
      return HttpResponse.json({
        data: {
          ...sampleBooks.vietnamese,
          publisherName: 'NXB Giáo dục',
          description: 'Giáo trình đại số cho sinh viên năm nhất.',
          availableCopies: null,
          digitalAssets: [],
        },
      });
    }
    if (params.id === '104') {
      return HttpResponse.json({
        data: {
          ...sampleBooks.digital,
          publisherName: 'Library Press',
          description: 'Sample book with a public digital asset.',
          availableCopies: null,
          digitalAssets: [
            {
              id: '901',
              mimeType: 'application/pdf',
              byteSize: 128,
              readAccess: 'public',
              downloadRequiresCard: true,
              rightsNote: 'Campus license only.',
            },
          ],
        },
      });
    }
    if (params.id === '105') {
      return HttpResponse.json({
        data: {
          ...sampleBooks.digital,
          id: '105',
          title: 'Second Digital Book',
          publisherName: 'Library Press',
          description: 'Another digital title.',
          availableCopies: null,
          digitalAssets: [
            {
              id: '902',
              mimeType: 'application/pdf',
              byteSize: 128,
              readAccess: 'public',
              downloadRequiresCard: false,
              rightsNote: 'Open download policy.',
            },
          ],
        },
      });
    }
    return HttpResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Book was not found.' } },
      { status: 404 },
    );
  }),

  http.get(`${API_BASE}/categories`, () =>
    HttpResponse.json({
      data: [
        { id: '1', code: 'general', name: 'General' },
        { id: '2', code: 'science', name: 'Khoa học tự nhiên' },
      ],
      meta: { page: 1, pageSize: 100, total: 2 },
    }),
  ),

  http.get(`${API_BASE}/topics`, () =>
    HttpResponse.json({
      data: [
        { id: '20', name: 'Topic A' },
        { id: '21', name: 'Topic B' },
        { id: '22', name: 'Đại học' },
      ],
      meta: { page: 1, pageSize: 100, total: 3 },
    }),
  ),

  http.get(`${API_BASE}/admin/books`, () => {
    if (!activeCatalogAdminSession()) {
      return HttpResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Forbidden' } },
        { status: 403 },
      );
    }
    return HttpResponse.json({
      data: [
        { id: '101', title: 'Alpha Published', state: 'published', version: '1', categoryId: '1' },
        { id: '201', title: 'Draft title', state: 'draft', version: '1', categoryId: '1' },
      ],
      meta: { page: 1, pageSize: 20, total: 2 },
    });
  }),
];

let catalogAdminSession = false;

export function setCatalogAdminSession(value: boolean): void {
  catalogAdminSession = value;
}

function activeCatalogAdminSession(): boolean {
  return catalogAdminSession;
}
