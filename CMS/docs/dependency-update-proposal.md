# Đề xuất cập nhật dependency CMS

Ngày đối chiếu: 2026-09-18. Trạng thái: **đã áp dụng ngày 2026-09-18** sau khi chủ dự án duyệt ("Cho phép cài theo đề xuất"); bảng dưới giữ nguyên là đề xuất gốc. Phiên bản thực tế đã cài, bản mới nhất trên npm và audit sau cài xem [dependencies.md](dependencies.md).

Phạm vi ghi khi được duyệt: `CMS/package.json`, `CMS/package-lock.json`, `CMS/node_modules/`. Dùng npm và `--ignore-scripts`, không chạy lifecycle script. Giữ `CMS/yarn.lock` làm bản cũ, không dùng để cài đồng thời với npm; việc bỏ lockfile cũ cần thao tác riêng.

| Gói | Hiện có | Đề xuất | Mục đích |
| --- | --- | --- | --- |
| axios | 1.8.4 | 1.20.0 | Bản vá trong major 1 |
| react-router | 7.4.1 | 7.18.4 | Bản vá trong major 7 |
| vite | 6.2.3 | 6.4.3 | Bản vá trong major 6 |
| react-hook-form | 7.55.0 | 7.88.0 | Cài lại bản phát hành có đủ khai báo kiểu, giữ major 7 |
| @tanstack/react-query | Chưa có | 5.103.1 | Cache, tải và cập nhật dữ liệu API |
| zustand | Chưa có | 5.0.15 | Trạng thái giao diện |
| exceljs | Chưa có | 4.4.0 | Xuất XLSX bằng API riêng |
| vitest | Chưa có | 3.2.7 | Kiểm thử phù hợp Vite 6 |
| @testing-library/react | Chưa có | 16.3.3 | Kiểm thử thao tác drawer với React 19 |
| @testing-library/dom | Chưa có | 10.4.1 | Peer dependency cho Testing Library |
| jsdom | Chưa có | 26.1.0 | DOM cho kiểm thử component |

Lệnh dự kiến sau khi được duyệt:

```sh
cd CMS
npm install --ignore-scripts --save-exact axios@1.20.0 react-router@7.18.4 react-hook-form@7.88.0 @tanstack/react-query@5.103.1 zustand@5.0.15 exceljs@4.4.0
npm install --ignore-scripts --save-dev --save-exact vite@6.4.3 vitest@3.2.7 @testing-library/react@16.3.3 @testing-library/dom@10.4.1 jsdom@26.1.0
```

Không nâng major React, MUI, MUI X, TypeScript, Zod hoặc ESLint trong lần này. Lockfile có thể đổi dependency gián tiếp trong quá trình giải quyết bộ gói; phải review diff, kiểm peer dependency, lint, typecheck, test, build và chạy lại audit. Audit ban đầu có 20 mục (1 critical, 13 high, 4 moderate, 2 low); kết quả này không tự chứng minh khả năng khai thác trong CMS và không được coi là đã xử lý bằng đề xuất.

Nguồn: `npm outdated --json`, `npm audit --json`, `npm view <package> version peerDependencies engines --json` từ [npm registry](https://registry.npmjs.org/). Xem báo cáo đầy đủ trong [dependencies.md](dependencies.md).
