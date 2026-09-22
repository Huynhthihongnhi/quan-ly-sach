# CMS (Quan-Ly-Sach)

React TypeScript admin UI for library staff. Served under `/cms/` with API calls to `/api/v1`.

## Stack

- Vite, React 19, TypeScript
- Tailwind CSS v4
- shadcn-style UI primitives (Radix + CVA)
- Vitest, Testing Library, MSW

## Local development

```sh
cd CMS
npm install
npm run dev
```

Dev server: http://127.0.0.1:5174/cms/ (proxies `/api` to BE on port 3000).

Start BE separately:

```sh
cd BE
npm run docker:up
npm run start:dev
```

## Scripts

```sh
npm run validate   # lint, typecheck, test, build
npm run test       # component tests (TST-S1-06)
npm run build
```

## Features (S1-06)

- Login with session cookie and CSRF token handling
- Users list, invite, block confirm
- Roles list and permission edit with version conflict messaging
- Permission-based navigation and 403 page
