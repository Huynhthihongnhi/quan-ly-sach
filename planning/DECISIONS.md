# Quyết định và giả định cần quản lý

Các mục D01-D05 đã được chốt tại S0-01 ngày 2026-09-11. D06-D10 vẫn là đề xuất có owner và hạn xử lý. Hướng dùng ORM đã được chủ dự án đồng ý tại D11. Khi chốt thêm quyết định, thêm ngày, người xác nhận, lựa chọn và bằng chứng ở chính mục đó. Nếu một mục tới hạn chưa chốt, task liên quan chuyển locked với mã Dxx ở PROGRESS.

| Mã | Trạng thái | Cần chốt | Đề xuất để lập plan | Hạn trước task | Người quyết định |
| --- | --- | --- | --- | --- | --- |
| D01 | **Chốt** | `netjs`, layout, package manager, versions | NestJS 11.2.3 TypeScript; `BE/` runtime root; npm; pin phiên bản khi scaffold | S0-02 | Chủ dự án + Tech Lead |
| D02 | **Chốt** | Tạo tài khoản, fields, roles | Admin mời user; reader/librarian/admin; display_name/phone; chưa tự đăng ký; email ASCII chuẩn hóa | S1-01 | Chủ dự án |
| D03 | **Chốt** | Cơ chế login | Session server-side qua cookie HttpOnly; same-origin web/API; CSRF; idle 30 phút, absolute 12 giờ là tham số đề xuất | S1-02 | Tech Lead + chủ dự án |
| D04 | **Chốt** | Reset và gửi mail | Link token một lần, TTL 15 phút; email sandbox local; production provider chưa chọn; activation TTL 24 giờ | S2-01 | Chủ dự án + Tech Lead |
| D05 | **Chốt** | Database và migration tool | MySQL 8.4 làm baseline thiết kế; patch/image digest chốt lúc chạy; SQL up/down với history/checksum và một runner | S0-03 | Tech Lead |
| D06 | Đề xuất | Thẻ và tài liệu | Thẻ do thủ thư xác nhận gắn user; một active card/user; đọc cần tài khoản, tải cần thẻ; PDF v1 tối đa 20 MiB | S4-01 / S4-03 | Chủ dự án + thủ thư |
| D07 | Đề xuất | Giữ chỗ, nhận sách, thẻ/password, reminder | Giữ 24 giờ, max 5 loan active/user, checkout rồi tính 1-15 ngày; xác thực lại account thay mật khẩu thẻ riêng; 3 lần sai/15 phút; reminder ngày địa phương | S5-01 | Chủ dự án + thủ thư |
| D08 | Đề xuất | Search tiếng Việt và hiệu năng | Contains, phân biệt tùy collation đã chốt; 10000 đầu sách để đo; dự kiến p95 đọc < 500 ms ở 20 client, chưa là SLA | S3-03 | Chủ dự án + Tech Lead |
| D09 | Đề xuất | Yêu cầu mua và báo cáo | Không thanh toán; người gửi không tự duyệt; report theo ngày địa phương; retention PII/audit cần chốt | S6-01 | Chủ dự án + thủ thư |
| D10 | Đề xuất | Production và vận hành | Ubuntu 26.04 LTS là ứng viên đáp ứng > 24; intranet qua mạng/VPN; RPO 24 giờ và RTO 4 giờ là mục tiêu dự thảo | S7-02 | Chủ dự án + vận hành |

Các giá trị TTL, hạn mức, tải và dung lượng trên không đến từ đề bài. Chúng giúp viết test có biên rõ ràng và phải được xác nhận hoặc thay trước triển khai. `temp.md` giới hạn mượn 15 ngày và nhắc trước 3 ngày là yêu cầu đã có.

<a id="d01"></a>

## D01: Framework, layout và package manager

- Ngày: 2026-09-11. Người xác nhận: chủ dự án, qua yêu cầu triển khai S0-01/S0-02 trong hội thoại hiện tại.
- Đã chốt: NestJS **11.2.3** + TypeScript 5.9 strict (compatibility gate: Nest 12 yêu cầu ESM/TS6, xung đột Jest/eslint hiện tại); runtime backend tại `BE/`; package manager npm cục bộ trong `BE/`; module format CommonJS + Jest/ts-jest (BE-D02).
- Bộ phiên bản pin tại `BE/package.json`; compatibility gate chạy trên Node.js v26.8.2 local ngày 2026-09-11.
- Bằng chứng: `planning/evidence/S0-01.md`, `planning/evidence/S0-02.md`.
- Tác động: S0-02 scaffold, S0-03 Docker, layout theo `BE/docs/02-architecture.md`.

<a id="d02"></a>

## D02: Tạo tài khoản và vai trò

- Ngày: 2026-09-11. Người xác nhận: chủ dự án, theo PRD và backlog S1.
- Đã chốt: admin mời user; roles reader/librarian/admin; profile chỉ displayName/phone; email ASCII normalize; chưa bật self-registration.
- Bằng chứng: PRD, `BE/docs/05-access-control.md`.
- Tác động: S1-01 entity/DTO/registry.

<a id="d03"></a>

## D03: Session và CSRF

- Ngày: 2026-09-11. Người xác nhận: chủ dự án + Tech Lead.
- Đã chốt: session server-side, cookie HttpOnly, same-origin FE/CMS/API, CSRF cho mutation; idle 30 phút và absolute 12 giờ là tham số mặc định cho test.
- Bằng chứng: `BE/docs/05-access-control.md`, bảng so sánh session bên dưới.
- Tác động: S1-02 auth module.

<a id="d04"></a>

## D04: Reset, activation và email

- Ngày: 2026-09-11. Người xác nhận: chủ dự án + Tech Lead.
- Đã chốt: link email một lần; reset TTL 15 phút; activation TTL 24 giờ; mail sandbox local; provider production chọn tại S2-01/S7.
- Bằng chứng: `BE/docs/06-business-flows.md`, bảng so sánh reset bên dưới.
- Tác động: S2-01 outbox/worker; S2-02/S2-03 challenge flows.

<a id="d05"></a>

## D05: MySQL và migration runner

- Ngày: 2026-09-11. Người xác nhận: Tech Lead, theo schema SQL gốc.
- Đã chốt: MySQL 8.4 baseline thiết kế; schema thay đổi chỉ qua cặp SQL up/down + runner có history/checksum; ORM `synchronize: false`, `migrationsRun: false`.
- Patch/image digest Docker chốt tại S0-03; runner code tại S0-06.
- Bằng chứng: `planning/database/schema.sql`, `BE/docs/07-operations.md`.
- Tác động: S0-03 compose, S0-06 tools/migrations, S0-04 ORM proof trên MySQL test.

## Owner và hạn cho D06-D10 (chưa chốt nội dung)

| Mã | Owner dự kiến | Hạn xử lý | Task bị chặn nếu trễ |
| --- | --- | --- | --- |
| D06 | Chủ dự án + thủ thư | Trước S4-01 | S4-01, S4-03 |
| D07 | Chủ dự án + thủ thư | Trước S5-01 | S5-01, S5-04 |
| D08 | Chủ dự án + Tech Lead | Trước S3-03 | S3-03, S3-05 |
| D09 | Chủ dự án + thủ thư | Trước S6-01 | S6-01, S6-04 |
| D10 | Chủ dự án + vận hành | Trước S7-02 | S7-02, S7-03 |

<a id="d11"></a>

## D11: Đồng ý dùng ORM

- Ngày: 2026-09-11. Người xác nhận: chủ dự án, trong hội thoại của task review BE.
- Bằng chứng trực tiếp: "oke đồng ý, orm trong dự án này. Review lại và kiểm tra lại các task".
- Đã chốt: dự án sử dụng ORM cho tầng truy cập MySQL; không hỏi lại lựa chọn có dùng ORM hay không.
- Lựa chọn kỹ thuật trong kế hoạch hiện tại: TypeORM + `mysql2`, theo đề xuất đã giải thích. Câu xác nhận không nêu tên thư viện hoặc phiên bản, nên compatibility gate vẫn cần tại S0-02/S0-04/S0-06.
- Schema tiếp tục do SQL up/down có history quản lý; API/worker đặt `synchronize: false`, `migrationsRun: false`.
- Tác động: S0-01 ghi quyết định, S0-02 tích hợp dependency/config, S0-04 kiểm mapping/transaction trên MySQL, S0-06 kiểm schema không đổi khi ORM khởi động. Chi tiết ở [quyết định BE](../BE/planning/DECISIONS.md) và [backlog BE](../BE/planning/BACKLOG.md).

## So sánh trọng yếu: session

| Option | What it does | Cost | Risk | Recommended |
| --- | --- | --- | --- | --- |
| Session server-side | Cookie giữ mã ngẫu nhiên, backend quản lý hiệu lực | Một truy vấn/cache kiểm phiên | Cần CSRF và cookie đúng cấu hình | Có |
| Access/refresh JWT | Token ngắn hạn và refresh có rotation | Nhiều logic revoke/rotation | Quyền cũ còn hiệu lực nếu không kiểm version | Không |

Đề xuất session vì CMS và web cùng hệ thống cần chặn user/gỡ quyền có hiệu lực ngay. Lựa chọn đã chốt tại D03. [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) hướng dẫn quản lý session và thuộc tính cookie.

## So sánh trọng yếu: reset

| Option | What it does | Cost | Risk | Recommended |
| --- | --- | --- | --- | --- |
| Link email một lần | Người dùng mở link và nhập mật khẩu mới | Ít bước và endpoint | Token trong URL cần tránh log/referrer | Có |
| OTP email | Nhập mã rồi đổi mật khẩu | Thêm verify step và hạn lần thử | Dễ bị đoán nếu rate limit yếu | Không |

Đề xuất link để giảm bước cho đợt đầu; vẫn áp dụng thời hạn, một lần dùng và giới hạn yêu cầu. [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) là nguồn đối chiếu.

## Cơ sở môi trường

Docker hiện liệt kê Ubuntu 26.04 LTS trong hệ được hỗ trợ. Phải kiểm tra lại bản OS, kiến trúc CPU và version Docker ở S7-02; không diễn giải câu > 24 thành tự động cho phép dùng 24.04. [Docker Engine trên Ubuntu](https://docs.docker.com/engine/install/ubuntu/).

Nếu chốt JWT, OTP hoặc đăng ký tự phục vụ, cập nhật S1/S2, schema sessions/challenges, API và test tương ứng trước khi mở task phụ thuộc. Không cần bỏ phần catalog và circulation chỉ vì các chi tiết auth đổi.
