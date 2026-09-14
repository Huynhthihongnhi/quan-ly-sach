# Phạm vi và tech stack

## 1. Dữ kiện đã quan sát

| Nguồn | Kết luận dùng trong thiết kế |
| --- | --- |
| [PRD](../../.vibekit/docs/PRD.md) | Ưu tiên users, roles, permissions, profiles, login, forgot/reset; khách được tra cứu không cần thẻ |
| [backbone.yml](../../backbone.yml) | TypeScript; MySQL; RESTful API; TDD; Docker Desktop trên macOS; production Ubuntu Server > 24 |
| [Schema](../../planning/database/schema.sql) | 27 bảng; MySQL 8.4, InnoDB; FK RESTRICT; không có INSERT hoặc dữ liệu thật |
| [Quyết định gốc](../../planning/DECISIONS.md) | Session, email link, roles và hạn mức vẫn là đề xuất |
| Thư mục dự án | `BE/docs` và `BE/planning` có sẵn nhưng trống trước task này; không có package ứng dụng; chưa khởi tạo Git |
| Yêu cầu hiện tại | Thiết lập tài liệu và kiến trúc BE trong `BE` dựa trên nguồn database |
| [D11](../../planning/DECISIONS.md#d11) | Chủ dự án đã đồng ý dùng ORM; không coi đây là xác nhận mọi phiên bản hoặc framework |

`schema.sql` ghi rõ DESIGN DRAFT ONLY. Tài liệu này phân tích cấu trúc, không suy ra đã có database đang chạy hoặc có dữ liệu sản xuất.

## 2. Kết quả thiết kế

Đề xuất một **modular monolith**, tức một backend chia thành module nghiệp vụ, cùng dùng một database. API và worker dùng chung codebase nhưng chạy bằng hai entrypoint. Cách này giữ transaction mượn/trả trong MySQL và giảm số dịch vụ cần vận hành.

Frontend dùng React, TypeScript, Tailwind CSS và shadcn/ui. Những thư viện giao diện này nằm ở FE/CMS. Backend giao tiếp bằng JSON/HTTP, tài liệu điện tử dùng response nhị phân. FE/CMS nhận kiểu API từ OpenAPI khi mã BE được tạo.

## 3. Công nghệ đề xuất và điều kiện chọn

| Thành phần | Đề xuất | Trạng thái và bằng chứng cần có |
| --- | --- | --- |
| Ngôn ngữ | TypeScript, strict mode | Phù hợp backbone; patch cùng bộ tooling chốt ở S0-02 |
| Runtime | Node.js 24 LTS | Dòng ứng viên; kiểm engines của CLI, framework, ORM và test runner trước pin patch/image |
| HTTP framework | NestJS, Express adapter | Chờ xác nhận `netjs`; chọn một major tương thích, không mặc định CLI mới nhất |
| Data access | `@nestjs/typeorm`, TypeORM, `mysql2` | Hướng ORM đã duyệt D11; thư viện là lựa chọn kỹ thuật trong kế hoạch; kiểm S0-02/S0-04/S0-06 |
| Database | MySQL 8.4, InnoDB, `utf8mb4_0900_ai_ci` | Baseline có trong SQL; patch/digest chờ D05 |
| Schema changes | Cặp SQL up/down + runner có `schema_migrations` | Theo thiết kế gốc; ORM không tự đồng bộ hoặc tự chạy migration |
| Cấu hình | Nest Config và schema validation | Tập trung tên biến, kiểm thiếu cấu hình ngay khi khởi động |
| DTO/validation | DTO rõ kiểu, `ValidationPipe` với allowlist | Nếu chọn class-validator/class-transformer, khai báo dependency tường minh và kiểm theo Nest major |
| API docs | `@nestjs/swagger` | Contract trong Markdown trước; OpenAPI sinh từ code sau |
| Authentication | Session lưu server, cookie HttpOnly, CSRF | Theo `auth_sessions`; D03 chưa duyệt |
| Email và tác vụ nền | MySQL outbox + worker; mail adapter SMTP | Theo `email_outbox`; không cần thêm Redis để khớp schema hiện tại |
| File | Private filesystem qua `FileStore` adapter, có thể thay object storage | Một host ở giai đoạn đầu; mọi replica phải đọc được cùng kho file nếu mở rộng |
| Test | Nest testing utilities + Jest + HTTP client Supertest | Đề xuất bộ kiểm thử; kiểm ESM/CJS và dependency trước cài |
| Package manager | npm trong `BE`, workspaces chỉ khi dự án chốt | D01 chưa chốt; không tự tạo root workspace từ task tài liệu |

Node.js công bố v24 thuộc dòng LTS tại thời điểm tra cứu. Dùng dòng LTS làm ứng viên, không coi một patch trong tài liệu là bản đã cài. [Node.js releases](https://nodejs.org/en/about/previous-releases).

Tài liệu Nest hiện có hướng dẫn v12 với khác biệt giữa yêu cầu runtime và CLI, định dạng ESM, và stack kiểm thử. Vì vậy S0-02 phải chốt đồng bộ cả bộ package; không trộn cấu hình v11 với mặc định v12. [Nest migration guide](https://docs.nestjs.com/migration-guide).

Nest có tích hợp TypeORM và driver MySQL. Đề xuất này tận dụng provider/module của Nest, còn schema SQL vẫn được quản lý riêng. `synchronize: false` áp dụng cả local, test và production để test không che thiếu migration. [Nest database](https://docs.nestjs.com/techniques/database).

## 4. Giới hạn sản phẩm

- Mượn tối đa 15 ngày và email nhắc trước hạn 3 ngày là yêu cầu từ [đề bài](../../temp.md).
- Tài khoản được admin mời là đề xuất D02. Đăng ký tự phục vụ chưa được chốt.
- Chức năng yêu cầu mua lưu tên tài liệu, tác giả, năm xuất bản và quyết định của thủ thư. Chưa có giao dịch thanh toán, tiền phạt hoặc gia hạn mượn.
- Khách xem danh sách/tìm kiếm/lọc. Quyền đọc nội dung điện tử dành cho khách cần D06; không suy diễn quyền tra cứu thành quyền lấy file.
- Các giá trị 30 phút/12 giờ session, 15 phút reset, 24 giờ activation/giữ chỗ, 5 phiếu active, 20 MiB PDF và tải đo hiệu năng đều là tham số đề xuất.

## 5. Đối chiếu nguồn còn thiếu hoặc khác nhau

| Điểm | Cách xử lý trong BE |
| --- | --- |
| Root planning dùng `apps/api`, yêu cầu mới dùng `BE` | Tài liệu đặt tại BE; layout runtime BE là đề xuất cần đồng bộ ở S0-01/S0-02 |
| Root README từng trỏ API/schema/test strategy và validator planning chưa có | Review task đã đổi link về BE và SQL gốc; bỏ lệnh validator planning chưa tồn tại |
| Sơ đồ profile vẽ quan hệ bắt buộc nhưng SQL chỉ ép tối đa một profile/user | Service tạo user và profile cùng transaction; kiểm lại bằng test |
| Quan hệ outbox/notification trong hình thể hiện quá chặt | Một outbox có thể không phải reminder; notification có đúng một outbox |
| Diagram rút gọn enum | Mọi enum ở API phải lấy đầy đủ từ SQL, không lấy nhãn rút gọn trong hình |

## 6. ClearThought Brief và điểm kiểm chứng

Operation: `implementation_plan`.

Problem: tạo thiết kế BE có thể triển khai theo schema và stack dự án.

Observed facts: 27 bảng SQL, PRD có thứ tự ưu tiên, chưa có app/runtime, nhiều Dxx chưa chốt.

Assumptions: NestJS; API/worker cùng codebase; TypeORM là lựa chọn kỹ thuật trong hướng ORM đã duyệt; các hạn mức lấy từ quyết định gốc và luôn ghi là đề xuất.

Plan: ánh xạ bảng sang module, mô tả API và transaction, nối task/test, rồi kiểm tài liệu.

Validation: kiểm đủ bảng, liên kết nội bộ, mã task/test, enum, ví dụ JSON và validator kit. Runtime tests chưa chạy.

Risks: mâu thuẫn source khi scaffold; giảm bằng bước đối chiếu D01-D10, API/schema và test trước viết mã.

Sequential Thinking dùng chế độ implicit: kết luận gắn với nguồn quan sát, phần chưa biết có task xử lý; không ghi giả bằng chứng thực thi.

## 7. Thuật ngữ kỹ thuật dùng trong bộ BE

| Thuật ngữ | Cách hiểu trong dự án |
| --- | --- |
| Module | Nhóm mã xử lý một phần nghiệp vụ, như thẻ hoặc mượn/trả |
| ORM | Thư viện ánh xạ object trong mã sang bảng/query database; ở đây đề xuất TypeORM |
| DTO | Kiểu dữ liệu nhận/trả qua API, có danh sách trường được cho phép |
| Transaction | Nhóm ghi dữ liệu cùng thành công hoặc cùng rollback với DML; DDL MySQL có giới hạn riêng |
| Invariant | Điều kiện luôn phải đúng, thí dụ một copy không có hai loan đang hiệu lực |
| Worker | Process xử lý công việc nền, như gửi email |
| Outbox | Bảng lưu công việc gửi email trước khi worker thực hiện |
| Lease | Quyền giữ công việc tạm thời có hạn dùng, để worker khác tiếp quản khi worker cũ chết |
| Idempotency | Gửi lại cùng yêu cầu không tạo thêm hiệu ứng nghiệp vụ |
| Optimistic version | Số phiên bản dùng để từ chối bản sửa dựa trên dữ liệu đã cũ |
| Fixture | Dữ liệu thử được tạo có chủ đích, không phải dữ liệu thật của người dùng |
| Barrier | Điểm đồng bộ trong test để hai thao tác thực sự chạy chồng thời gian |
| ESM/CJS | Hai cách tổ chức module JavaScript; cần chọn để build và test dùng cùng quy ước |

Thuật ngữ nghiệp vụ tiếp tục theo [CONTEXT](../../.vibekit/docs/CONTEXT.md), không thay nghĩa độc giả, tài khoản, thẻ thư viện hoặc yêu cầu mua.
