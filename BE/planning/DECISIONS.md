# Quyết định cần xử lý cho BE

File này ghi tác động BE và đề xuất bổ sung. Trạng thái quyết định sản phẩm vẫn theo [DECISIONS gốc](../../planning/DECISIONS.md). Hướng dùng ORM đã được chủ dự án đồng ý tại [D11](../../planning/DECISIONS.md#d11); các quyết định khác không tự đổi trạng thái. Không có lựa chọn nào ở dưới chặn việc hoàn thành review tài liệu hiện tại.

## 1. D01-D05 ảnh hưởng đến BE

Trạng thái cập nhật ngày 2026-09-11 sau S0-01. Chi tiết đầy đủ ở [DECISIONS gốc](../../planning/DECISIONS.md).

| Mã gốc | Trạng thái | Phần đã chốt | Task tiếp theo |
| --- | --- | --- | --- |
| D01 | Chốt | NestJS 11.2.3, layout `BE/`, npm, CommonJS+Jest, pin tại `BE/package.json` | S0-02 done |
| D02 | Chốt | Admin mời; reader/librarian/admin; displayName/phone | S1-01 |
| D03 | Chốt | Session cookie, CSRF, same-origin; TTL tham số test | S1-02 |
| D04 | Chốt | Link email một lần; TTL reset/activation; sandbox local | S2-01 |
| D05 | Chốt | MySQL 8.4 baseline; SQL runner; ORM không auto DDL | S0-03, S0-06 |
| D06 | Thẻ, quyền đọc/tải, file | Một active card/user; đọc cần account mặc định, tải cần thẻ; PDF <=20 MiB | S4-01/S4-03 |
| D07 | Reservation, checkout, re-auth và reminder | Giữ 24 giờ; max 5 loan active; password account + card; 3 lần sai/15 phút; nhắc theo ngày địa phương | S5-01 |
| D08 | Search và mục tiêu đo | Contains và filter AND; thử tiếng Việt theo collation; 10000 đầu sách, 20 client là fixture/tải đề xuất | S3-03/S3-05 |
| D09 | Purchase, report, retention | Không self-review; không thanh toán; ngày địa phương; retention PII/audit chưa chốt | S6-01/S6-04 |
| D10 | Production | Ubuntu >24, bản cụ thể chốt khi deploy; intranet/VPN; backup DB + files + keyring | S7-02 |

Yêu cầu hiện tại xác định vị trí tài liệu là `BE`. Nó chưa tự xác nhận framework hoặc package manager. Root plan còn `apps/api`/`apps/web`; khi scaffold, đồng bộ layout theo lựa chọn runtime đã chốt, không tạo cả hai bộ backend.

## 2. BE-D01: data access

**Hướng ORM: đã được chủ dự án đồng ý ngày 2026-09-11**, theo bằng chứng tại D11. TypeORM + mysql2 tiếp tục là lựa chọn kỹ thuật của kế hoạch. Không hỏi lại có dùng ORM hay không; các bước tiếp theo kiểm bộ phiên bản và mapping thực. Bảng dưới lưu lý do thiết kế, không phải câu hỏi đang chờ người dùng trả lời.

| Option | What it does | Cost | Risk | Recommended |
| --- | --- | --- | --- | --- |
| TypeORM + mysql2 | Map entity, query builder và transaction; schema bằng SQL riêng | Vừa | Cần kiểm generated columns và precision; tắt auto sync | Có |
| mysql2 với repository SQL trực tiếp | Tất cả query và mapping viết tường minh | Vừa đến cao | Dễ lặp mapping/DTO nếu thiếu quy ước | Không |

TypeORM được chọn trong kế hoạch vì có tích hợp Nest và giữ được transaction/SQL rõ ràng trong repository; chưa thêm dependency. S0-02 kiểm install/build/module format và cấu hình không tự DDL; S0-04 kiểm BIGINT/DATETIME(6)/BINARY(32), generated columns và rollback bằng bảng thử cô lập; S0-06 kiểm runner cùng schema sau migration. Không yêu cầu fixture ứng dụng hoàn chỉnh trước khi S0-06 có runner.

## 3. Chi tiết mới cần đưa vào quyết định liên quan

| Mã BE | Quan sát hoặc đề xuất | Người xử lý dự kiến | Hạn xử lý và tiêu chí |
| --- | --- | --- | --- |
| BE-D02 | Chọn ESM/CJS và Jest tương thích major Nest | Người triển khai BE | S0-02: build cả API/worker, unit và HTTP test chạy thật |
| BE-D03 | Rate limit phải sẵn từ login, dù comment SQL gắn S2 | Người triển khai BE/DB | S0-06/S1-02: migration nền chứa rate_limit_buckets; không mở login thiếu bảo vệ |
| BE-D04 | CSRF lấy lại sau reload khi DB chỉ lưu digest | Người triển khai BE | S1-02: chứng minh dẫn xuất theo phiên, multi-tab, rotation và origin guard |
| BE-D05 | Profile nghề nghiệp và các trường trường học chưa có | Chủ dự án | S1-01: xác nhận chỉ displayName/phone hoặc đề xuất schema bổ sung |
| BE-D06 | Bootstrap assigned_by NOT NULL và admin cuối | Người triển khai BE + chủ dự án | S1-01: bootstrap/policy/audit nền trước các API mutation; S1-05 kiểm tích hợp và tranh chấp toàn bộ đường API |
| BE-D07 | Cards/assets không version; taxonomy dùng expectedName | Người triển khai BE | S3-02/S4-01: lock + expected state/value; nếu cần lịch sử đổi qua lại phải bổ sung version bằng migration duyệt riêng |
| BE-D08 | Công cụ scan file và xử lý file/DB không atomic | Người triển khai BE + vận hành | S4-03: kiểm định định dạng, scanner được chọn, quarantine và đối soát orphan |
| BE-D09 | Reminder 08:00, mỗi 5 phút, loan ngắn gửi bắt kịp | Chủ dự án + thủ thư | S5-04: gắn D07; ca mượn 1/2/3 ngày có kết quả rõ |
| BE-D10 | Isolation READ COMMITTED và retry tối đa 2 | Người triển khai BE/DB | S0-04/S5-06: race tests bằng MySQL, không suy diễn từ mock |
| BE-D11 | Outbox gửi ít nhất một lần; provider chưa có receipt | Chủ dự án + vận hành | S2-01/S7: chấp nhận mail có thể trùng hoặc chọn provider có idempotency đã thử |
| BE-D12 | Root README từng có tham chiếu file chưa tồn tại | Đã xử lý trong review tài liệu | Link đã trỏ về BE/SQL gốc; lệnh validator planning chưa có đã được bỏ; chưa tạo validator dự án mới |

TTL, retry, poll interval, page size và giới hạn upload trong tài liệu là tham số có thể thay. Các rule cố định từ yêu cầu như guest tra cứu, mượn <=15 ngày và nhắc trước 3 ngày không bị đổi thành cấu hình cho phép bỏ qua tùy ý.

## 4. Cách ghi một quyết định được chốt

Ghi mã, ngày, người quyết định, lựa chọn cụ thể, lý do ngắn và bằng chứng ở decision nguồn. Liệt kê tài liệu/schema/API/task/test bị ảnh hưởng. Chỉ cập nhật backbone/PRD/pattern khi có quyền tương ứng; request tạo tài liệu BE không tự đổi các quy ước toàn dự án.

Nếu framework chưa xác nhận, vẫn dùng bộ thiết kế này để review nghiệp vụ và database. Nest provider/module và bộ phiên bản cần xác nhận/kiểm chứng sau; hướng ORM đã duyệt vẫn giữ. Chưa tạo scaffold dựa trên framework chưa được chốt.
