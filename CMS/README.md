# CMS (Quan-Ly-Sach)

`CMS/` là nguồn frontend quản trị duy nhất, dùng Minimal UI/MUI. `CMS-old/` đã ngừng sử dụng và được đưa vào thùng rác; tra cứu mã lịch sử qua Git khi cần.

## Stack

- Vite 6, React 19, TypeScript
- Minimal UI, MUI 7, Emotion
- Axios, TanStack Query, Zustand, React Hook Form, Zod, ExcelJS
- Vitest, Testing Library, MSW

## Local development

```sh
make install
make dev
```

Chạy từ thư mục gốc repo. Mở http://localhost:8081/cms/. `make cms` chỉ chạy frontend; `make dev` chạy thêm DB và BE. Vite chuyển `/api` tới BE tại `127.0.0.1:3000`. Nếu cổng 8081 đã bị chiếm, CMS dừng với lỗi, không tự đổi cổng.

Mở terminal khác sau khi CMS đã chạy:

```sh
make tunnel-cms
```

Mở `/cms/` trên URL tunnel vừa nhận. Script từ chối mở tunnel nếu cổng chưa có listener hoặc listener không chạy từ `CMS/` trong repo này. URL tunnel phải nằm trong `ALLOWED_ORIGINS` của `BE/.env` để đăng nhập và ghi dữ liệu. Xem [hướng dẫn dev](../scripts/README.md).

Nếu đổi cổng, dùng cùng giá trị cho cả hai lệnh: `make dev CMS_PORT=8082` và `make tunnel-cms CMS_PORT=8082`; cập nhật origin BE tương ứng. Khi chạy trực tiếp: `cd CMS && npm run dev` dùng cổng 8081 mặc định.

## Kiểm tra

```sh
cd CMS
npm ci --ignore-scripts
npm run validate
```

`package-lock.json` là lockfile đang dùng. `yarn.lock` chỉ là dấu vết phiên bản template, không dùng để cài đặt. `validate` chạy lint, typecheck, test và build.

## Nguồn mã

- Entry: `src/main.tsx` -> `src/App.tsx` -> `src/routes/sections/`.
- CSS và fonts: `src/global.css`. Provider dùng chung: Query, auth, settings, theme, snackbar.
- Session cookie HttpOnly và CSRF theo BE; thư mục `src/auth/context/jwt` giữ tên template nhưng không dùng JWT demo.
- API cùng origin tại `/api/v1`; router và Vite cùng base `/cms/`.
- `src/features`, `src/lib/api`, `src/lib/auth`, `src/routes/AppRoutes.tsx`, UI Radix và các test liên quan là mã lịch sử còn trong `CMS/`. Entry hiện tại không nạp cây này. Không dùng làm nền cho tính năng mới; theo [kiến trúc](docs/architecture.md) và [lộ trình](../planning/cms-roadmap.md).

Các test lịch sử vẫn được chạy nhưng không chứng minh tính năng đó đã nối vào giao diện MUI. Dashboard hiện còn trang mẫu.

Link email cần `APP_PUBLIC_ORIGIN=http://localhost:8081/cms` ở BE; `ALLOWED_ORIGINS` chỉ chứa origin, không có `/cms`. Các route `/cms/reset-password` và `/cms/activate` giữ contract link email của BE.
