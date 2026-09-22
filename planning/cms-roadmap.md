# Kế hoạch triển khai CMS bằng Data Grid

Ngày lập: 2026-09-18. Phương pháp: ClearThought `implementation_plan` và Sequential Thinking implicit. Nguồn: [D12](DECISIONS.md#d12), [kiến trúc CMS](../CMS/docs/architecture.md), [API BE](../BE/docs/04-api-contract.md), source controller/DTO/service trong `BE/src/modules`.

Phạm vi yêu cầu lần này: đồng bộ tài liệu/backbone, kiểm tra dependency, tạo drawer dùng chung và nền Query/Zustand/ExcelJS. Việc chuyển toàn bộ nghiệp vụ sang CMS mới được lập kế hoạch theo các bước dưới. Chỉ [PROGRESS.md](PROGRESS.md) lưu trạng thái; bảng này không phải bằng chứng chức năng đã chạy.

## Thứ tự triển khai

| Bước / ID | Phụ thuộc | Công việc cụ thể và file chính | Đầu ra | Điều kiện nghiệm thu |
| --- | --- | --- | --- | --- |
| 1 / CMS-01 | Yêu cầu D12 | Đồng bộ backbone/PRD/context/planning; kiểm phiên bản; nền QueryProvider, Zustand drawer, FormDrawer, ExcelJS; thêm test | Bộ nền có tài liệu và dependency được khóa | Lint/typecheck/test/build; probe; đối chiếu link và lịch sử CMS cũ |
| 2 / CMS-02 | CMS-01 | Chuyển `auth/context`, `lib/axios.ts`, `global-config.ts`, `routes`, Vite sang session BE; đồng bộ `/cms/`, `/api/v1`, cổng local, proxy và link email | Login/logout/reload hoạt động với cookie/CSRF; bỏ JWT demo và fallback admin; chưa self-register | Kiểm login sai, 401, 403, CSRF, reload, đa tab, logout xóa cache; không ghi credential vào browser storage |
| 3 / CMS-03 | CMS-02 | Tạo cấu hình list dùng lại trong `sections`: query keys, map pagination/sort/filter, error state và permission actions; dùng DataGrid hiện có | Một grid mẫu nối endpoint users read-only | Grid page 0 gọi API page 1; size <=100; ID string; hủy query cũ; URL giữ bộ lọc; unsupported sort bị tắt |
| 4 / CMS-04 | CMS-03 | `sections/users`, `sections/roles`, `pages`, `routes/paths.ts`, nav: bảng user/role/permission; drawer mời user, sửa profile/status, gán role/quyền, xóa role | Lát cắt quản trị tài khoản hoàn chỉnh | Test users.read/write, roles.write, users.roles.write; last-admin; role system; If-Match; 409/422 giữ form; invalidation đúng list/detail |
| 5 / CMS-05 | CMS-04 | Chuyển forgot/reset/activation, profile từ yêu cầu S2; endpoint và form MUI mới | Phục hồi tài khoản và hồ sơ | Token chỉ dùng một lần, hết hạn rõ ràng, không lộ tồn tại email, reset không tự login; lỗi field có nhãn |
| 6 / CMS-06 | CMS-04 | `sections/catalog`: bảng sách admin, taxonomy và copies; drawer thêm/sửa/state; copy tabs theo book | Quản lý danh mục trên MUI | Draft/published/archived; expectedName/version; liên kết author/topic; lỗi tham chiếu 409; sort đúng khả năng endpoint |
| 7 / CMS-07 | CMS-06 | `sections/cards`, `sections/digital`: cấp/đổi trạng thái thẻ, upload và policy file; phân biệt metadata và file binary | Thẻ và tài liệu điện tử theo quyền | Không đặt multipart boundary thủ công; chỉ asset ready được đọc; quarantine/error rõ; expectedState; không lộ file URL private |
| 8 / CMS-08 | CMS-07 | `sections/circulation`: bảng reserved/borrowed/overdue, drawer nhận sách/trả/báo mất, lịch sử và phiếu | Thủ thư quản lý mượn/trả | Version conflict; dueAt do BE tính; không sửa stock ở UI; chuyển trạng thái đúng; không retry POST mù |
| 9 / CMS-09 | CMS-04 | `sections/purchases`: bảng hàng đợi, drawer duyệt/từ chối, chi tiết và events | Quản lý yêu cầu mua | Không self-review; reason bắt buộc khi từ chối; version; chặn double submit; không tạo luồng thanh toán |
| 10 / CMS-10 | CMS-06, CMS-08, CMS-09 | `sections/reports`: ngày Việt Nam, JSON reports, Data Grid tổng hợp và nút ExcelJS trên từng bảng | Xuất trang hiện tại/dòng đã chọn, báo cáo XLSX | Tiếng Việt, ID lớn, kiểu số, ngày, chuỗi giống công thức; đúng filter/permission; lỗi mạng giữ UI; không giả xuất toàn bộ dữ liệu |
| 11 / CMS-11 | CMS-05 đến CMS-10 | Chuyển hoặc tách các luồng độc giả cũ ra `FE/` khi scope được xác nhận; public catalog, tài liệu, loans, purchase own | Quyết định vị trí reader rõ và regression tests được port | Khách tra cứu không login; không hiển thị tác vụ thủ thư; không mất yêu cầu S3-S6 khi thay template |
| 12 / CMS-12 | CMS-11, S7-02, S7-03 | Regression/UAT, kiểm bàn phím, responsive, bundle export, proxy phục vụ static CMS, deep links, release checklist | Bằng chứng nghiệm thu CMS mới | Chạy targeted tests trước; chấm visual/e2e gate và xin duyệt nếu cần; production không có dev demo, JWT mock, source map riêng tư hoặc route bỏ guard |

Mỗi bước là một thay đổi có thể review. Ước lượng sau khi nhận CMS-02 và đo API thật; chưa cam kết ngày công vì dữ liệu và phạm vi reader còn cần quyết định. CMS-09 có thể làm sau CMS-04 mà không đợi catalog, nhưng kế hoạch mặc định thực hiện tuần tự. Không dùng kế hoạch này để tự deploy, chạy migration hoặc đổi schema.

## Ma trận màn hình và endpoint

Tất cả API dưới đây có prefix `/api/v1`. UI dùng namespace `/cms/dashboard/...` sau CMS-02. Đây là đường dẫn UI mục tiêu, chưa phải route đang có.

| Màn | API đọc | API ghi / drawer | Permission chính | Cột/lọc đầu tiên |
| --- | --- | --- | --- | --- |
| Users | `/users`, `/users/:id`, `/users/:id/profile`, `/users/:id/roles` | POST user, PATCH profile/status, PUT roles, POST activation-email | users.read/write, profiles.read/write, users.roles.write, roles.read | ID, email, status, createdAt; q/status |
| Roles / permissions | `/roles`, `/permissions` | POST/PATCH/DELETE role, PUT role permissions | roles.read/write, permissions.read | ID, code, name, isSystem; sort theo allowlist |
| Books | `/admin/books`, `/admin/books/:id` | POST/PATCH metadata, PATCH state | catalog.read/write | ID, title, category, year, state; q/state |
| Taxonomy | `/admin/categories`, `/admin/authors`, `/admin/topics` | POST, PATCH expectedName, DELETE khi không tham chiếu | catalog.read/write | ID, code nếu có, name |
| Copies | `/admin/books/:id/copies` | POST copy, PATCH `/admin/copies/:id` | catalog.read, copies.write | barcode, shelfLocation, conditionState |
| Cards | `/admin/library-cards` | POST, PATCH state với expectedState | cards.read/write | userId, cardNumber, state, expiresAt |
| Digital assets | Metadata sách và source controller digital | Upload, đổi access, archive | digital.write; đọc/tải theo policy BE | trạng thái scan, readAccess, downloadRequiresCard |
| Loans | `/admin/loans`, `/loans/:id` | POST checkout/return/lost; cancel theo quyền | loans.read.any, loans.manage | copy, người mượn, state, dueAt, overdue |
| Purchases | `/admin/purchase-requests`, `/purchase-requests/:id` | POST review | purchases.read.any, purchases.review | title, authorText, requester, state, createdAt |
| Reports | `/reports/circulation`, `/reports/inventory`, `/reports/purchases` | Không CRUD; tạo XLSX từ JSON | reports.read | from/to; số liệu theo contract từng báo cáo |

Không suy ra mọi màn đều có DELETE. Users/books chủ yếu đổi trạng thái; loans/purchases có nghiệp vụ chuyển trạng thái riêng. Permission phía frontend chỉ điều khiển trải nghiệm, backend quyết định quyền cuối cùng.

## Trình tự làm một màn

1. Đọc DTO, controller, service và fixtures của endpoint; ghi query params, envelopes, permission, version và lỗi. OpenAPI export từng được ghi lỗi ở S7-02, nên phải sửa/kiểm lại trước tự động sinh type; không tự tạo type từ tài liệu cũ rồi coi là contract đã xác minh.
2. Viết type/adapters giữ ID string; chuyển grid page/sort/filter sang DTO có allowlist. Kiểm adapter với request/response thật hoặc fixtures đã đối chiếu source.
3. Viết query key và `useQuery`, truyền AbortSignal. Mỗi list có loading, error/retry, empty; không lưu rows vào Zustand.
4. Gắn DataGrid, bộ lọc và permission actions. Giữ total trong lúc tải; chặn thao tác trên rows cũ. Bật selector chỉ cho phạm vi có thể bảo đảm export đúng.
5. Tạo form RHF/Zod, reset theo ID/mode. Bọc `FormDrawer` bằng RHF FormProvider; hiển thị delete/transition đúng nghiệp vụ.
6. `useMutation` gửi version/If-Match/expectedState, chờ Promise, map 422 vào form; 409 không mất nhập liệu. Thành công invalidate đúng keys rồi đóng drawer.
7. Thêm ExcelJS bằng allowlist cột và tập rows rõ ràng. Không xuất credential, dữ liệu ngoài quyền hoặc cột actions.
8. Test thao tác và lỗi, chạy `npm run validate`, cập nhật evidence rồi PROGRESS. Bằng chứng CMS cũ chỉ tham khảo yêu cầu; phải chạy test mới trước ghi done.

## Rủi ro và điểm còn mở

- Dependency audit còn phải theo dõi theo [báo cáo](../CMS/docs/dependencies.md); không dùng `npm audit fix --force` để ép nâng major.
- Reader app chưa có nơi triển khai độc lập. CMS-11 quyết định vị trí trước port, không tự dựng hai bản cùng chức năng.
- S7-02 vẫn chờ host Ubuntu 24.04 thật; S7-03 còn chờ backup/restore, retention và RPO/RTO. CMS roadmap không đóng thay các gate đó.
- Cần xác minh giấy phép template Minimal UI đang sử dụng trước phát hành. Data Grid Community không yêu cầu mua Pro/Premium cho các tính năng đã chọn.
