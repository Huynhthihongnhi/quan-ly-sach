import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const COLLECTION_PREREQUEST = [
  "const method = pm.request.method;",
  "const url = pm.request.url.toString();",
  "const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];",
  "const publicMutations = [",
  "  '/auth/login',",
  "  '/auth/forgot-password',",
  "  '/auth/reset-password',",
  "  '/auth/activate',",
  "];",
  "if (mutationMethods.includes(method)) {",
  "  const origin = pm.environment.get('webOrigin');",
  "  if (origin) {",
  "    pm.request.headers.upsert({ key: 'Origin', value: origin });",
  "  }",
  "  pm.request.headers.upsert({ key: 'X-Requested-With', value: 'library-web' });",
  "  const isPublic = publicMutations.some((path) => url.includes(path));",
  "  if (!isPublic) {",
  "    const csrf = pm.environment.get('csrfToken');",
  "    if (csrf) {",
  "      pm.request.headers.upsert({ key: 'X-CSRF-Token', value: csrf });",
  "    }",
  "  }",
  "}",
].join('\n');

const LOGIN_TEST_SCRIPT = [
  "pm.test('Status 200', () => pm.response.to.have.status(200));",
  "const body = pm.response.json();",
  "const payload = body.data ?? body;",
  "if (payload.csrfToken) {",
  "  pm.environment.set('csrfToken', payload.csrfToken);",
  "}",
  "if (payload.user?.id) {",
  "  pm.environment.set('userId', payload.user.id);",
  "}",
].join('\n');

function saveFirstIdScript(envKey) {
  return [
    'try {',
    '  const body = pm.response.json();',
    '  let rows = body.data;',
    '  if (rows && !Array.isArray(rows) && Array.isArray(rows.data)) {',
    '    rows = rows.data;',
    '  }',
    '  if (Array.isArray(rows) && rows[0]?.id) {',
    `    pm.environment.set('${envKey}', rows[0].id);`,
    '  }',
    '} catch (e) { /* ignore */ }',
  ];
}

function jsonHeader() {
  return [{ key: 'Content-Type', value: 'application/json' }];
}

function apiUrl(path, query = []) {
  const host = path.startsWith('/health') ? '{{baseUrl}}' : '{{baseUrl}}/api/v1';
  const raw = `${host}${path}`;
  if (query.length === 0) {
    return raw;
  }
  return {
    raw: `${raw}?${query.map(([k, v]) => `${k}=${v}`).join('&')}`,
    host: [host.replace('{{baseUrl}}', '{{baseUrl}}')],
    path: path.split('/').filter(Boolean),
    query: query.map(([k, v]) => ({ key: k, value: v })),
  };
}

function request(name, method, path, options = {}) {
  const { body, headers, description, tests, query, mode, formdata, events } = options;
  const item = {
    name,
    request: {
      method,
      header: headers ?? (mode === 'formdata' ? [] : jsonHeader()),
      url: typeof path === 'string' ? apiUrl(path, query) : path,
      description: description ?? '',
    },
  };
  if (body !== undefined) {
    item.request.body = { mode: 'raw', raw: body };
  }
  if (mode === 'formdata' && formdata) {
    item.request.body = { mode: 'formdata', formdata };
  }
  const scriptEvents = [];
  if (tests) {
    scriptEvents.push({ listen: 'test', script: { type: 'text/javascript', exec: tests } });
  }
  if (events) {
    scriptEvents.push(...events);
  }
  if (scriptEvents.length > 0) {
    item.event = scriptEvents;
  }
  return item;
}

function folder(name, description, items) {
  return { name, description, item: items };
}

const collection = {
  info: {
    name: 'Quan-Ly-Sach API',
    description:
      'REST API thu vien noi bo (prefix /api/v1).\\n\\n' +
      '1. Import environment Quan-Ly-Sach.local.postman_environment.json\\n' +
      '2. Bat Postman: Settings > Cookies (tu dong luu session sau Login)\\n' +
      '3. Chay folder 00 Session > Login (Admin) truoc cac request can quyen\\n' +
      '4. Mutation can Origin, X-Requested-With, X-CSRF-Token (script collection tu gan)\\n' +
      '5. Bootstrap admin mac dinh: admin@local.test / change-me-12chars (xem BE/README.md)\\n\\n' +
      'Swagger local: {{baseUrl}}/docs',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  event: [
    {
      listen: 'prerequest',
      script: { type: 'text/javascript', exec: COLLECTION_PREREQUEST.split('\n') },
    },
  ],
  item: [
    folder('00 Session', 'Dang nhap va cookie session', [
      request('Health Live', 'GET', '/health/live'),
      request('Health Ready', 'GET', '/health/ready'),
      request('Login (Admin)', 'POST', '/auth/login', {
        body: '{\n  "email": "{{adminEmail}}",\n  "password": "{{adminPassword}}"\n}',
        description: 'Tao session cookie + luu csrfToken vao environment.',
        tests: LOGIN_TEST_SCRIPT.split('\n'),
      }),
      request('Auth Me', 'GET', '/auth/me'),
      request('Auth CSRF', 'GET', '/auth/csrf', {
        tests: [
          "const body = pm.response.json();",
          "const payload = body.data ?? body;",
          "if (payload.csrfToken) pm.environment.set('csrfToken', payload.csrfToken);",
        ],
      }),
      request('Logout', 'POST', '/auth/logout'),
    ]),
    folder('01 Auth (public)', 'Khong can session', [
      request('Forgot Password', 'POST', '/auth/forgot-password', {
        body: '{\n  "email": "{{adminEmail}}"\n}',
      }),
      request('Reset Password', 'POST', '/auth/reset-password', {
        body: '{\n  "token": "{{challengeToken}}",\n  "newPassword": "NewValidPass123!"\n}',
        description: 'Lay token tu Mailpit (8025) sau Forgot Password.',
      }),
      request('Activate Account', 'POST', '/auth/activate', {
        body: '{\n  "token": "{{challengeToken}}",\n  "newPassword": "NewValidPass123!"\n}',
      }),
    ]),
    folder('02 Users and profile', 'Can users.* / profiles.*', [
      request('List users', 'GET', '/users', { query: [['page', '1'], ['pageSize', '20']] }),
      request('Create user (invited)', 'POST', '/users', {
        body: '{\n  "email": "reader.demo@local.test",\n  "displayName": "Reader Demo",\n  "phone": null\n}',
      }),
      request('Get user', 'GET', '/users/{{userId}}'),
      request('Update user status', 'PATCH', '/users/{{userId}}/status', {
        body: '{\n  "status": "active",\n  "version": "{{userVersion}}"\n}',
      }),
      request('Send activation email', 'POST', '/users/{{userId}}/activation-email'),
      request('Get user profile (admin)', 'GET', '/users/{{userId}}/profile'),
      request('Patch user profile (admin)', 'PATCH', '/users/{{userId}}/profile', {
        body: '{\n  "displayName": "Updated Name",\n  "phone": null,\n  "version": "{{profileVersion}}"\n}',
      }),
      request('Get my profile', 'GET', '/me/profile'),
      request('Patch my profile', 'PATCH', '/me/profile', {
        body: '{\n  "displayName": "My Display Name",\n  "phone": null,\n  "version": "{{profileVersion}}"\n}',
      }),
    ]),
    folder('03 Roles and permissions', '', [
      request('List roles', 'GET', '/roles', {
        query: [['page', '1'], ['pageSize', '50']],
        tests: saveFirstIdScript('roleId'),
      }),
      request('Create role', 'POST', '/roles', {
        body: '{\n  "code": "demo_role",\n  "name": "Demo Role",\n  "description": "Postman test role"\n}',
      }),
      request('Patch role', 'PATCH', '/roles/{{roleId}}', {
        body: '{\n  "name": "Demo Role Updated",\n  "description": null,\n  "version": "{{roleVersion}}"\n}',
      }),
      request('List permissions', 'GET', '/permissions', { query: [['page', '1'], ['pageSize', '100']] }),
      request('Set role permissions', 'PUT', '/roles/{{roleId}}/permissions', {
        body: '{\n  "permissionCodes": ["catalog.read"],\n  "version": "{{roleVersion}}"\n}',
      }),
      request('Get user roles', 'GET', '/users/{{userId}}/roles'),
      request('Set user roles', 'PUT', '/users/{{userId}}/roles', {
        body: '{\n  "roleIds": ["{{roleId}}"],\n  "version": "{{userVersion}}"\n}',
      }),
      request('Delete role', 'DELETE', '/roles/{{roleId}}', {
        headers: [{ key: 'If-Match', value: '{{roleVersion}}' }],
      }),
    ]),
    folder('04 Audit', '', [
      request('List audit events', 'GET', '/audit-events', {
        query: [['page', '1'], ['pageSize', '20']],
      }),
    ]),
    folder('05 Catalog (public)', 'Khong can dang nhap', [
      request('List published books', 'GET', '/books', {
        query: [['page', '1'], ['pageSize', '20']],
        tests: saveFirstIdScript('bookId'),
      }),
      request('Get published book', 'GET', '/books/{{bookId}}'),
      request('List categories (public)', 'GET', '/categories', { query: [['page', '1'], ['pageSize', '50']] }),
      request('List authors (public)', 'GET', '/authors', { query: [['page', '1'], ['pageSize', '50']] }),
      request('List topics (public)', 'GET', '/topics', { query: [['page', '1'], ['pageSize', '50']] }),
    ]),
    folder('06 Catalog (admin)', 'Can catalog.read / catalog.write / copies.write', [
      request('List admin books', 'GET', '/admin/books', {
        query: [['page', '1'], ['pageSize', '20']],
        tests: saveFirstIdScript('bookId'),
      }),
      request('Create draft book', 'POST', '/admin/books', {
        body: '{\n  "title": "Postman Demo Book",\n  "categoryId": "{{categoryId}}",\n  "authorIds": ["{{authorId}}"],\n  "topicIds": ["{{topicId}}"],\n  "publicationYear": 2024,\n  "description": "Created from Postman"\n}',
        tests: [
          "const body = pm.response.json();",
          "const row = body.data ?? body;",
          "if (row?.id) pm.environment.set('bookId', row.id);",
          "if (row?.version) pm.environment.set('bookVersion', row.version);",
        ],
      }),
      request('Get admin book', 'GET', '/admin/books/{{bookId}}'),
      request('Patch admin book', 'PATCH', '/admin/books/{{bookId}}', {
        body: '{\n  "title": "Postman Demo Book Updated",\n  "version": "{{bookVersion}}"\n}',
      }),
      request('Publish book', 'PATCH', '/admin/books/{{bookId}}/state', {
        body: '{\n  "state": "published",\n  "version": "{{bookVersion}}"\n}',
      }),
      request('List admin categories', 'GET', '/admin/categories', {
        query: [['page', '1'], ['pageSize', '50']],
        tests: saveFirstIdScript('categoryId'),
      }),
      request('Create category', 'POST', '/admin/categories', {
        body: '{\n  "code": "demo-cat",\n  "name": "Demo Category"\n}',
      }),
      request('List admin authors', 'GET', '/admin/authors', {
        query: [['page', '1'], ['pageSize', '50']],
        tests: saveFirstIdScript('authorId'),
      }),
      request('Create author', 'POST', '/admin/authors', { body: '{\n  "name": "Demo Author"\n}' }),
      request('List admin topics', 'GET', '/admin/topics', {
        query: [['page', '1'], ['pageSize', '50']],
        tests: saveFirstIdScript('topicId'),
      }),
      request('Create topic', 'POST', '/admin/topics', { body: '{\n  "name": "Demo Topic"\n}' }),
      request('List book copies', 'GET', '/admin/books/{{bookId}}/copies', {
        query: [['page', '1'], ['pageSize', '20']],
        tests: saveFirstIdScript('copyId'),
      }),
      request('Create copy', 'POST', '/admin/books/{{bookId}}/copies', {
        body: '{\n  "barcode": "BC-POSTMAN-001",\n  "shelfLocation": "A-01"\n}',
      }),
      request('Patch copy', 'PATCH', '/admin/copies/{{copyId}}', {
        body: '{\n  "shelfLocation": "A-02",\n  "version": "1"\n}',
      }),
    ]),
    folder('07 Digital assets', '', [
      request('Upload PDF for book', 'POST', '/admin/books/{{bookId}}/assets', {
        mode: 'formdata',
        formdata: [
          { key: 'file', type: 'file', src: [] },
          { key: 'rightsNote', value: 'Postman upload test', type: 'text' },
        ],
        description: 'Chon file PDF local. Can digital.write.',
        tests: [
          "const body = pm.response.json();",
          "const row = body.data ?? body;",
          "if (row?.id) pm.environment.set('digitalAssetId', row.id);",
        ],
      }),
      request('Patch asset access', 'PATCH', '/admin/assets/{{digitalAssetId}}/access', {
        body: '{\n  "readAccess": "authenticated",\n  "downloadRequiresCard": true,\n  "expectedState": "ready"\n}',
      }),
      request('Archive asset', 'POST', '/admin/assets/{{digitalAssetId}}/archive', {
        body: '{\n  "expectedState": "ready"\n}',
      }),
      request('Read digital asset (inline)', 'GET', '/digital-assets/{{digitalAssetId}}/read'),
      request('Download digital asset', 'GET', '/digital-assets/{{digitalAssetId}}/download'),
    ]),
    folder('08 Library cards', '', [
      request('My library cards', 'GET', '/me/library-cards', { query: [['page', '1'], ['pageSize', '20']] }),
      request('List admin cards', 'GET', '/admin/library-cards', {
        query: [['page', '1'], ['pageSize', '20']],
      }),
      request('Issue library card', 'POST', '/admin/library-cards', {
        body: '{\n  "userId": "{{userId}}",\n  "cardNumber": "CARD-POSTMAN-001",\n  "expiresAt": "2030-12-31T00:00:00.000Z"\n}',
        tests: [
          "const body = pm.response.json();",
          "const row = body.data ?? body;",
          "if (row?.id) pm.environment.set('libraryCardId', row.id);",
          "if (row?.cardNumber) pm.environment.set('cardNumber', row.cardNumber);",
        ],
      }),
      request('Update card state', 'PATCH', '/admin/library-cards/{{libraryCardId}}/state', {
        body: '{\n  "state": "active",\n  "expectedState": "active"\n}',
      }),
    ]),
    folder('09 Circulation (loans)', 'Reader: loans.create.own; Staff: loans.manage', [
      request('Create loan reservation', 'POST', '/loans', {
        headers: [
          ...jsonHeader(),
          { key: 'Idempotency-Key', value: '{{$guid}}' },
        ],
        body: '{\n  "bookId": "{{bookId}}",\n  "cardNumber": "{{cardNumber}}",\n  "password": "{{readerPassword}}",\n  "requestedDays": 15\n}',
        description: 'Dang nhap reader co thẻ. Dat cardNumber tu Issue library card.',
        tests: [
          "const body = pm.response.json();",
          "const row = (body.data ?? body).data ?? body.data ?? body;",
          "if (row?.id) pm.environment.set('loanId', row.id);",
          "if (row?.version) pm.environment.set('loanVersion', row.version);",
        ],
      }),
      request('My loans', 'GET', '/me/loans', { query: [['page', '1'], ['pageSize', '20']] }),
      request('Get loan by id', 'GET', '/loans/{{loanId}}'),
      request('Cancel reserved loan', 'POST', '/loans/{{loanId}}/cancel', {
        body: '{\n  "version": "{{loanVersion}}",\n  "reason": "Postman cancel test"\n}',
      }),
      request('Admin list loans', 'GET', '/admin/loans', {
        query: [['page', '1'], ['pageSize', '20']],
        tests: saveFirstIdScript('loanId'),
      }),
      request('Checkout loan', 'POST', '/admin/loans/{{loanId}}/checkout', {
        body: '{\n  "version": "{{loanVersion}}"\n}',
      }),
      request('Return loan', 'POST', '/admin/loans/{{loanId}}/return', {
        body: '{\n  "version": "{{loanVersion}}",\n  "conditionState": "serviceable"\n}',
      }),
      request('Mark loan lost', 'POST', '/admin/loans/{{loanId}}/lost', {
        body: '{\n  "version": "{{loanVersion}}",\n  "reason": "Postman lost test"\n}',
      }),
    ]),
    folder('10 Purchase requests', '', [
      request('Submit purchase request', 'POST', '/purchase-requests', {
        headers: [...jsonHeader(), { key: 'Idempotency-Key', value: '{{$guid}}' }],
        body: '{\n  "title": "Sach de xuat",\n  "authorText": "Tac gia A",\n  "publicationYear": 2023,\n  "note": "Postman test"\n}',
        tests: [
          "const body = pm.response.json();",
          "const row = body.data ?? body;",
          "if (row?.id) pm.environment.set('purchaseRequestId', row.id);",
          "if (row?.version) pm.environment.set('purchaseVersion', row.version);",
        ],
      }),
      request('My purchase requests', 'GET', '/me/purchase-requests', {
        query: [['page', '1'], ['pageSize', '20']],
      }),
      request('Get purchase request', 'GET', '/purchase-requests/{{purchaseRequestId}}'),
      request('Admin list purchase queue', 'GET', '/admin/purchase-requests', {
        query: [['state', 'pending'], ['page', '1'], ['pageSize', '20']],
        tests: saveFirstIdScript('purchaseRequestId'),
      }),
      request('Review purchase (approve)', 'POST', '/admin/purchase-requests/{{purchaseRequestId}}/review', {
        body: '{\n  "decision": "approved",\n  "version": "{{purchaseVersion}}"\n}',
      }),
      request('Review purchase (reject)', 'POST', '/admin/purchase-requests/{{purchaseRequestId}}/review', {
        body: '{\n  "decision": "rejected",\n  "reason": "Khong phu hop ngan sach",\n  "version": "{{purchaseVersion}}"\n}',
      }),
    ]),
    folder('11 Reports', 'Can reports.read', [
      request('Circulation report (JSON)', 'GET', '/reports/circulation', {
        query: [['from', '2026-01-01'], ['to', '2026-12-31'], ['format', 'json']],
      }),
      request('Circulation report (CSV)', 'GET', '/reports/circulation', {
        query: [['from', '2026-01-01'], ['to', '2026-12-31'], ['format', 'csv']],
      }),
      request('Inventory snapshot (JSON)', 'GET', '/reports/inventory', { query: [['format', 'json']] }),
      request('Inventory snapshot (CSV)', 'GET', '/reports/inventory', { query: [['format', 'csv']] }),
      request('Purchases report (JSON)', 'GET', '/reports/purchases', {
        query: [['from', '2026-01-01'], ['to', '2026-12-31'], ['format', 'json']],
      }),
      request('Purchases report (CSV)', 'GET', '/reports/purchases', {
        query: [['from', '2026-01-01'], ['to', '2026-12-31'], ['format', 'csv']],
      }),
    ]),
  ],
};

const outPath = resolve(__dirname, 'Quan-Ly-Sach.postman_collection.json');
writeFileSync(outPath, `${JSON.stringify(collection, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outPath}`);
