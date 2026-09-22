# Phiên bản dependency CMS

Ngày đối chiếu: 2026-09-18, sau khi áp dụng [đề xuất cập nhật](dependency-update-proposal.md) đã được duyệt. Môi trường: Node 26.8.2, npm 11.19.1 (`packageManager` khai báo `npm@11.19.1`). Nguồn: `npm outdated --json`, `npm audit --json`, `npm ls <gói>`, đọc `node_modules/<gói>/package.json`. Đây là ảnh chụp một thời điểm; chạy lại các lệnh trên trước khi nâng cấp.

## Thư viện chính đã cài

| Gói | Đã cài | Mới nhất trên npm | Ghi chú |
| --- | --- | --- | --- |
| axios | 1.20.0 | 1.20.0 | Mới nhất |
| zustand | 5.0.15 | 5.0.15 | Mới nhất |
| @tanstack/react-query | 5.103.1 | 5.103.1 | Mới nhất |
| exceljs | 4.4.0 | 4.4.0 | Mới nhất; xem audit nhóm 3 |
| react-hook-form | 7.88.0 | 7.88.0 | Mới nhất |
| @testing-library/react | 16.3.3 | 16.3.3 | Mới nhất |
| react-router | 7.18.4 | 8.4.0 | Giữ major 7 |
| @mui/material | 7.0.1 | 9.4.0 | Giữ major 7; bản vá 7.3.11 nằm trong range |
| @mui/x-data-grid | 7.28.2 | 9.14.0 | Giữ major 7; bản vá 7.29.13 nằm trong range |
| @mui/x-date-pickers | 7.28.2 | 9.14.0 | Giữ major 7; 7.29.4 nằm trong range |
| @mui/lab | 7.0.0-beta.10 | 9.0.0-beta.9 | Giữ 7 beta; 7.0.0-beta.17 nằm trong range |
| react, react-dom | 19.1.0 | 19.3.0 | Bản vá nằm trong range |
| zod | 3.24.2 | 4.6.5 | Giữ major 3; 3.25.76 nằm trong range |
| typescript | 5.8.2 | 7.0.2 | Giữ major 5; 5.9.3 nằm trong range |
| vite | 6.4.3 | 8.3.0 | Giữ major 6 |
| vitest | 3.2.7 | 5.0.1 | Giữ major 3; xem audit nhóm 2 |
| jsdom | 26.1.0 | 30.1.0 | Giữ major 26 |

"Mới nhất" nghĩa là gói không xuất hiện trong `npm outdated`. Các gói còn lại của template (fontsource, eslint và plugin, prettier, framer-motion, es-toolkit, dayjs, @types/*) đều có bản vá nằm trong range hiện tại; danh sách đầy đủ lấy từ `npm outdated`. Không nâng major MUI, MUI X, React Router, Zod, Vitest, TypeScript, Vite trong CMS-01; mỗi lần nâng major cần task riêng với test hồi quy.

## Kết quả audit

`npm audit --json` sau cài đặt: 18 mục, gồm 0 critical, 9 high, 7 moderate, 2 low. Trước cài đặt (bộ gói template gốc) là 20 mục với 1 critical. Kết quả "CMS audit 0 findings" trong `planning/evidence/S7-01.md` thuộc CMS cũ (`CMS-old/`), một cây dependency khác, không so sánh trực tiếp.

Nhóm 1: có bản vá nằm trong range, chỉ đổi lockfile, không đổi major. Gồm brace-expansion, flatted, js-yaml, lodash, minimatch, nanoid, picomatch, postcss, rollup (high); @humanfs/node, ajv, yaml (moderate); @eslint/plugin-kit, eslint (low). Phần lớn là dependency gián tiếp của tooling lint/build/test (eslint, typescript-eslint, vite, rollup, postcss). Hai ngoại lệ có đường đi vào runtime: `lodash@4.17.21` qua `simplebar-react` -> `simplebar-core` (layout của template; các advisory liên quan `_.template`, `_.unset`, `_.omit` với dữ liệu không tin cậy, CMS không gọi các hàm này) và `minimatch` qua `exceljs` -> `archiver` -> `glob` (đường Node, không chạy trong bundle trình duyệt). Lệnh dự kiến: `npm audit fix` không có `--force`, kèm `npm update` trong range, rồi chạy lại `npm run validate`. Phải duyệt trước vì `package-lock.json` là protected path.

Nhóm 2: cần nâng major. `vitest@3.2.7` và `@vitest/mocker` (moderate, GHSA-82fw-gwwq-j7x9, đọc file tùy ý qua redirect mock trong môi trường test) chỉ có bản vá ở vitest 5. Rủi ro giới hạn ở máy dev/CI, không ảnh hưởng bundle. Theo dõi và nâng khi có task riêng, kiểm tương thích Vite 6 trước.

Nhóm 3: không có bản vá tiến. `exceljs@4.4.0` kéo theo `uuid@8.3.2` (moderate, GHSA-w5hq-g745-h8pq, thiếu kiểm biên buffer trong v3/v5/v6 khi truyền `buf`). npm gợi ý "fix" bằng cách hạ về exceljs 3.4.0; không làm vậy. CMS chỉ dùng `Workbook`, `addWorksheet`, `addRow`, `xlsx.writeBuffer`, `xlsx.load` và không gọi uuid với buffer tự cấp. Ghi nhận là rủi ro chấp nhận, chờ exceljs phát hành bản nâng uuid; kiểm lại ở mỗi lần audit.

## Ghi chú build và cấu hình

- `npm run validate` ngày 2026-09-18: lint pass, typecheck pass (src và test), 17/17 test (2 file), build pass trong 2.2 s.
- Chunk chính 1,38 MB (443 kB gzip) vượt ngưỡng cảnh báo 500 kB của Vite; tách chunk theo route và bỏ demo/mock là việc của CMS-12.
- Node 26 in `[DEP0190] DeprecationWarning` (child process với `shell: true`) trong bước `npm run build`; cảnh báo đến từ chuỗi tooling, chưa xác định gói cụ thể, không ảnh hưởng kết quả.
- Hai lockfile cùng tồn tại: `package-lock.json` (đang dùng) và `yarn.lock` (từ template). Chỉ cài bằng npm với `--ignore-scripts`. Đề nghị `trash CMS/yarn.lock` khi được duyệt; các script `re:dev`, `re:build`, `tsc:dev` trong `package.json` còn gọi yarn và nên bỏ cùng lúc.
- `.env` của template chứa các biến Firebase/Amplify/Auth0/Supabase/Mapbox không dùng; không đặt secret thật vào đó. Kiểm lại danh sách biến ở CMS-02 khi đổi `VITE_SERVER_URL` sang API dự án.

## Lệnh kiểm tra lại

```sh
cd CMS
npm outdated --json
npm audit --json
npm ls uuid lodash minimatch
```
