# Kiến trúc đề xuất

Đây là thiết kế dự kiến theo D01-D10, chưa phải cấu trúc đã triển khai. Một backend chia module đủ đáp ứng giai đoạn đầu và giúp transaction nghiệp vụ dễ kiểm thử; chưa có nhu cầu tách microservice.

## Thành phần và trách nhiệm

| Thành phần | Trách nhiệm | Không chịu trách nhiệm |
| --- | --- | --- |
| React web | Giao diện khách, độc giả và CMS; form; hiển thị quyền | Quyết định cuối cùng về quyền và tồn kho |
| NestJS API, chờ D01 | Auth, users, RBAC, profiles, catalog, cards, digital, circulation, purchases, reports | Gửi email bên trong transaction HTTP |
| Worker cùng codebase API | Outbox, reminder, hết hạn reservation, dọn session/challenge | Tự sửa schema hoặc tự mở quyền |
| MySQL | Dữ liệu, FK, unique, transaction và history migrations | Lưu PDF/bí mật dạng rõ |
| File storage qua adapter | Nội dung điện tử private, key do server sinh | Quyết định quyền đọc dựa trên đường dẫn |
| Reverse proxy | HTTPS, cùng origin web/API, giới hạn upload và mạng | Thay guard quyền backend |
| Mail sandbox/provider | Nhận email qua worker | Nguồn quyết định trạng thái reset |

## Layout đề xuất sau khi D01 được chốt

```text
apps/web/src/features/{auth,users,roles,profile,catalog,cards,loans,purchases,reports}
apps/web/src/components/ui
apps/web/src/lib/api
apps/api/src/modules/{auth,users,roles,profiles,catalog,cards,digital,loans,purchases,reports}
apps/api/src/common
apps/api/test
apps/api/migrations
packages/contracts
planning
```

Layout trên là đề xuất cũ còn chờ D01; tài liệu chi tiết hiện nằm tại [BE](../BE/README.md), với layout runtime BE chờ chốt trước scaffold. Không tạo đồng thời hai backend ở apps/api và BE.

`packages/contracts` chỉ thêm khi có nhu cầu chia sẻ thật; OpenAPI sinh từ backend là nguồn kiểu API dự kiến. Không import entity/database model vào frontend. Controller kiểm DTO và gọi service; service giữ nghiệp vụ/transaction; repository giữ truy vấn. Hướng ORM đã được duyệt tại [D11](DECISIONS.md#d11); kế hoạch dùng TypeORM + mysql2 và kiểm chứng phiên bản trong S0. Tắt synchronize và tự chạy migration; SQL up/down là nguồn thay đổi schema duy nhất.

## Luồng xác thực dự kiến

Login xác minh password hash, kiểm user active, tạo token ngẫu nhiên và lưu digest vào auth_sessions. Web nhận cookie HttpOnly, không lưu session token vào localStorage. Mọi request protected kiểm session, trạng thái user, auth_version và quyền hiện hành; quyền riêng tư còn cần kiểm ownership (dữ liệu thuộc ai).

Đề xuất kiểm Origin/CSRF token ràng buộc session cho mọi thao tác thay đổi, kể cả cơ chế chống login CSRF trước khi có phiên. Cookie Secure chỉ với HTTPS; local nên có HTTPS tương đương hoặc cấu hình dev tường minh. Không suy diễn intranet là môi trường không cần bảo vệ. [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

User mới ở invited, chưa login được. Admin gửi activation qua outbox; token được tiêu thụ trong cùng transaction với việc đặt password/active. Nếu chủ dự án muốn self-registration, tạo task riêng cho verify email, hạn mức và chống tự gán role; không chỉ mở endpoint tạo user hiện tại ra public.

## Transaction và tính nhất quán

- Khóa user trước khi reset, block, cấp/revoke thẻ hoặc checkout; kiểm lại trạng thái ngay trong transaction cần bảo vệ.
- Thao tác admin cuối cùng cùng lấy `iam_policy_locks` hàng 1 trước khi sửa memberships/user status. Các luồng còn lại không lấy hàng này sau khi đã giữ user lock.
- Circulation lấy khóa theo thứ tự user -> card -> copy -> loan; chọn ID theo thứ tự tăng khi có nhiều hàng. Revalidate sau khi lấy khóa. Scheduler expire dùng cùng quy ước, không đảo thứ tự.
- Khi circulation được nối ở S5-01, tồn khả dụng = copies serviceable không có loan reserved/borrowed. S3 chưa có bảng loans nên trả availableCopies null, không query bảng tương lai. Không duy trì counter rời làm nguồn thứ hai hoặc fallback che lỗi khi circulation đã được bật.
- Request idempotency key unique theo actor; lưu request_hash để từ chối cùng key nhưng khác payload. Kiểm cả đường retry khi chưa có copy trống, trước khi trả hết sách.
- Loan thay trạng thái và loan_events cùng transaction. Gửi email sau commit qua outbox; SMTP không tham gia transaction MySQL.

`FOR UPDATE` giữ khóa tới khi transaction kết thúc. `SKIP LOCKED` phù hợp khi lấy công việc từ hàng đợi; không dùng kết quả bị bỏ qua như số tồn tuyệt đối. [MySQL locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html).

## Docker và vận hành

Local đề xuất Compose gồm web, api, worker, mysql, mail sandbox. Health check phải kiểm service sẵn sàng, không chỉ container đã tạo. [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) mô tả `service_healthy`.

Production không đưa mail sandbox/dev hot reload vào release. Dùng image cố định theo digest, một migration runner tách khỏi API replicas và private DB network. Quyền DB ứng dụng chỉ cho DML cần thiết, runner có quyền DDL riêng; secrets qua môi trường triển khai, không commit. Backup phải bao gồm DB và private file store, có restore drill.

## Điểm cần nhớ

Frontend giúp người dùng thao tác; backend quyết định quyền; database bảo vệ liên kết và tranh chấp. Test tại cả ba lớp để một lỗi UI không mở quyền hoặc làm sai dữ liệu.
