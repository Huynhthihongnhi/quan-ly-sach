# Kiến trúc FE CMS

Cập nhật 2026-09-18 theo [D12](../../planning/DECISIONS.md#d12). `CMS/` là giao diện quản trị đang phát triển từ Minimal UI starter 7. `CMS-old/` giữ mã giao diện trước lần thay template. `FE/` cho độc giả chưa được scaffold riêng. Không lấy trạng thái hoàn thành của CMS cũ để kết luận CMS mới đã nối nghiệp vụ.

## Stack và trách nhiệm

| Công nghệ | Trách nhiệm trong CMS | Nguồn trong repo |
| --- | --- | --- |
| React 19, TypeScript, Vite 6 | SPA và build | `package.json`, `vite.config.ts` |
| MUI 7, Emotion, Minimal UI | Layout, theme, input, drawer | `src/theme`, `src/layouts`, `src/components` |
| MUI X Data Grid Community 7 | Bảng quản trị, phân trang, thao tác trên dòng | Theme tại `src/theme/core/components/mui-x-data-grid.tsx` |
| Axios 1 | HTTP transport | `src/lib/axios.ts`, cần chuyển adapter demo sang BE |
| TanStack Query 5 | Dữ liệu API, cache, loading/error, mutation và invalidation | `src/lib/query-provider.tsx` đã được gắn trong `src/app.tsx` |
| Zustand 5 | Trạng thái giao diện: mode drawer, ID đang chọn | `src/components/form-drawer/create-drawer-store.ts` |
| React Hook Form 7, Zod 3 | Giá trị biểu mẫu, validation, lỗi trường | `src/components/hook-form` và form theo nghiệp vụ |
| ExcelJS 4 | Tạo file `.xlsx` từ cột/dòng được cho phép | `src/utils/export-excel.ts` |
| Snackbar dùng chung | Thông báo toast sau thao tác: success, error, info, warning | `src/components/snackbar` (store Zustand + MUI Alert) |
| Vitest 3, Testing Library, jsdom | Kiểm thử component và tiện ích | `test`, `vitest.config.ts` |

Phiên bản patch đã cài và phiên bản mới nhất được đối chiếu tại [dependencies.md](dependencies.md). Không lấy số major trong bảng này thay lockfile.

## Quy tắc dữ liệu

Luồng đọc: page -> query hook -> Axios -> REST API -> TanStack Query -> Data Grid. Luồng ghi: form -> mutation hook -> Axios -> API -> invalidate query liên quan -> đóng drawer và hiện snackbar thành công khi hoàn tất. Snackbar dùng chung tại `src/components/snackbar` phát thông báo qua `useSnackbar()` trong component hoặc accessor `snackbar` ngoài React; xem [snackbar.md](snackbar.md).

TanStack Query giữ bản ghi và danh sách từ server. Zustand chỉ giữ trạng thái UI, không sao chép rows, tổng số bản ghi, permission hoặc session thành một cache thứ hai. Form state nằm ở React Hook Form. Dữ liệu lọc cần chia sẻ đường dẫn nằm trong URL; không duy trì cả URL và store độc lập cho cùng một bộ lọc.

Không persist password, CSRF, session, dữ liệu biểu mẫu hoặc PII vào localStorage/sessionStorage. Store drawer chỉ chứa `{ mode, id }`. Mỗi module tạo store riêng ngoài render. Mutation thành công invalidates danh sách và chi tiết; lỗi 409 giữ biểu mẫu và yêu cầu tải lại version trước khi ghi tiếp.

## Layout tiếp tục từ template

```text
CMS/src/
  app.tsx                         # QueryProvider, auth và theme providers
  pages/                          # Route entry, mỏng
  routes/paths.ts                 # Đường dẫn UI
  routes/sections/                # Route tree và guards
  sections/<domain>/              # View, form, columns theo nghiệp vụ (sẽ bổ sung)
  lib/axios.ts                    # HTTP client hiện còn theo demo
  lib/query-provider.tsx          # Cấu hình TanStack Query
  components/form-drawer/         # Drawer và factory Zustand đã tạo
  components/snackbar/            # Toast dùng chung (store Zustand + MUI Alert)
  components/hook-form/           # Input và provider hiện có
  theme/                         # Theme, bao gồm override Data Grid
  utils/export-excel.ts           # Export ExcelJS đã tạo
CMS/test/                         # Test CMS mới
```

API/query hooks theo từng domain có thể đặt cùng `sections/<domain>` khi làm lát cắt đầu tiên; chỉ tách `src/api` dùng chung khi thật sự được nhiều view dùng. Tái sử dụng `routes/paths.ts`, `CONFIG`, `themeConfig`, `Iconify` và theme hiện có. Không đưa Tailwind/shadcn hoặc TanStack Table vào CMS mới. Không import source runtime từ `CMS-old/`.

## Khoảng cách tới backend hiện tại

`src/auth/context/jwt` đang là demo JWT, đọc sessionStorage; provider còn fallback role `admin`. `src/lib/axios.ts` có endpoint demo `/api/auth/sign-in`, `/api/auth/me`; interceptor hiện làm mất `AxiosError.response.status`. Đây chưa phải cơ chế xác thực được chấp nhận cho dự án. Chuyển toàn bộ cùng một bước CMS-02, không bật màn quản trị chỉ bằng cách đặt `auth.skip`.

Backend đã chọn [D03](../../planning/DECISIONS.md#d03): cookie HttpOnly do server quản lý, CSRF trong bộ nhớ, cùng origin. Runtime nguồn chuẩn: [AuthController](../../BE/src/modules/auth/auth.controller.ts), [API contract](../../BE/docs/04-api-contract.md), [fixtures](../../BE/test/fixtures/contract/).

| Giao tiếp | Contract cần dùng |
| --- | --- |
| Base URL | `/api/v1`; route UI CMS mục tiêu `/cms/` |
| Login | `POST /auth/login`, đọc `response.data.data.user` và `csrfToken` |
| Current user | `GET /auth/me` trả `data.userId`, `data.permissionCodes`; không giả có object `user` của demo |
| Profile | `GET /me/profile` riêng nếu cần tên/điện thoại |
| Reload | `GET /auth/csrf` trả `data.csrfToken` |
| JSON mutation | `X-Requested-With: library-web`; session mutation thêm `X-CSRF-Token`; JSON content type |
| Multipart upload | Không tự đặt boundary/JSON content type; vẫn gửi custom header và CSRF |
| Cookie | Axios `withCredentials: true`; origin được BE cho phép, ưu tiên Vite proxy cùng origin |
| Logout, 401 | Hủy queries đang chạy, xóa query cache và UI store, xóa CSRF, trở lại login |
| 403 | Hiển thị thiếu quyền; không coi mọi 403 là hết phiên |
| 409 / 422 / 429 | Giữ form và xử lý xung đột / lỗi trường / Retry-After |

Sau chuyển đổi, interceptor giữ nguyên AxiosError hoặc chuyển sang lỗi có `status`, `code`, `fields`, `requestId`; không log body chứa thông tin riêng. Truyền `signal` từ query function vào Axios để hủy yêu cầu cũ. Không tự retry mutation thiếu idempotency. `QueryProvider` hiện chỉ là nền, quy tắc không retry 4xx chỉ có hiệu lực nếu adapter bảo toàn status.

Dev hiện chạy cổng **8081**, base `/`, chưa có proxy API. CMS-02 phải cập nhật Vite base, router basename, proxy, đường dẫn navigation và link email đồng bộ trước khi dùng `/cms/` theo production. Cấu hình reverse proxy BE hiện chưa phục vụ CMS build. Việc có dependency không đồng nghĩa đã hoàn thành các mục này.

## Bảng quản trị và xuất dữ liệu

Xem [data-grid.md](data-grid.md) cho phân trang phía server và ExcelJS. Xem [form-drawer.md](form-drawer.md) cho API component và ví dụ RHF. Xem [snackbar.md](snackbar.md) cho thông báo toast dùng chung. Lộ trình theo nghiệp vụ tại [cms-roadmap.md](../../planning/cms-roadmap.md); trạng thái chỉ nằm trong [PROGRESS](../../planning/PROGRESS.md).

Tài liệu đúng major: [MUI 7 Drawer](https://v7.mui.com/material-ui/react-drawer/), [MUI X 7](https://v7.mui.com/x/react-data-grid/), [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview), [Zustand](https://github.com/pmndrs/zustand), [ExcelJS 4.4](https://github.com/exceljs/exceljs/tree/v4.4.0).
