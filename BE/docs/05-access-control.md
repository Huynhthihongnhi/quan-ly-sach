# Tài khoản, xác thực và phân quyền

Thiết kế dựa trên `users`, `profiles`, `roles`, `permissions`, `user_roles`, `role_permissions`, `auth_sessions`, `identity_challenges`, `iam_policy_locks` và `rate_limit_buckets` trong [schema](../../planning/database/schema.sql). Session, tài khoản mời và role mẫu chờ D02-D04, không phải chức năng đã chạy.

## 1. Nguyên tắc truy cập

Backend kiểm ba lớp: danh tính hợp lệ, permission cho hành động, dữ liệu có thuộc phạm vi người gọi không. **RBAC** là cấp quyền qua vai trò; **ownership** là kiểm dữ liệu thuộc ai. Có `loans.read.own` không được xem loan của người khác.

Khách được list/search/filter và xem metadata sách published. Các route này không gọi guard yêu cầu thẻ. Prefix `/admin` chỉ giúp tổ chức API; mọi route vẫn phải khai báo permission cụ thể.

## 2. Registry quyền đề xuất

| Nhóm | Permission code | Reader | Librarian | Admin |
| --- | --- | --- | --- | --- |
| Tài khoản | `users.read`, `users.write`, `users.roles.write` | Không | Không | Có |
| Hồ sơ người khác | `profiles.read`, `profiles.write` | Không | Không | Có |
| Vai trò | `roles.read`, `roles.write`, `permissions.read` | Không | Không | Có |
| Nhật ký | `audit.read` | Không | Không | Có |
| Danh mục CMS | `catalog.read`, `catalog.write`, `copies.write` | Không | Có | Có |
| Thẻ | `cards.read`, `cards.write` | Không | Có | Có |
| Quản lý file | `digital.write` | Không | Có | Có |
| Tải của mình | `digital.download.own` | Có | Có | Có |
| Mượn cá nhân | `loans.create.own`, `loans.read.own`, `loans.cancel.own` | Có | Có | Có |
| Lưu thông | `loans.read.any`, `loans.manage` | Không | Có | Có |
| Yêu cầu mua cá nhân | `purchases.create.own`, `purchases.read.own` | Có | Có | Có |
| Xử lý yêu cầu mua | `purchases.read.any`, `purchases.review` | Không | Có | Có |
| Báo cáo | `reports.read` | Không | Có | Có |

Ma trận là seed đề xuất để D02 duyệt. Admin không tự động bỏ qua mọi guard bằng một nhánh `if admin`. Họ được gán permission rõ ràng và vẫn chịu luật thẻ, trạng thái, chống self-review. Thủ thư có các quyền độc giả như đề bài yêu cầu, nhưng phải có thẻ hợp lệ khi mượn/tải theo policy.

`GET/PATCH /me/profile` và `GET /me/library-cards` dùng policy authenticated-self, không cần thêm code trùng nghĩa. Guard từ chối endpoint chưa khai báo policy. Permission không được đăng ký trong code bị từ chối khi gán. Khi triển khai, registry đặt tại `modules/access`, seed DB từ registry này thay vì duy trì hai danh sách.

## 3. Vòng đời tài khoản

1. Admin tạo invited user với email chuẩn hóa và profile trong cùng transaction. Chưa cho login, chưa có password hợp lệ. Gán roles là hành động riêng có `users.roles.write`.
2. Sau S2, admin gửi activation: tạo challenge và outbox trong cùng transaction. Link có hạn dùng, chỉ dùng một lần.
3. Activation kiểm đúng purpose, user vẫn invited, email snapshot khớp và challenge chưa dùng/hết hạn. Ghi password hash, email_verified_at, active và consumed_at cùng transaction.
4. Block/archive tăng auth_version và revoke sessions, ghi audit. Unblock không phục hồi các session cũ. Chuyển invited sang active phải đi qua activation hoặc bootstrap được duyệt.

Email ASCII trim + lowercase toàn địa chỉ là chính sách ứng dụng đề xuất, không phải hành vi tự có của ascii_bin. D02 cần xác nhận email trường học phù hợp. Không đổi email qua profile; nếu bổ sung đổi email phải thiết kế xác minh và vô hiệu hóa challenge cũ.

## 4. Login và session

Password dùng thuật toán hash chuyên dụng, đề xuất Argon2id; thông số benchmark trên runtime thực tại S1-02, không thấp hơn mức nền được chốt khi review. Password không phải hash SHA-256 thông thường. [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) hướng dẫn Argon2id và thông số tối thiểu. Session/challenge là giá trị ngẫu nhiên có entropy cao nên có thể lưu digest SHA-256 32 bytes trong cột BINARY(32).

Login áp dụng Origin allowlist, JSON và custom header trước xác minh credential để chống login CSRF. Trả lỗi chung cho password sai, user không tồn tại hoặc chưa được phép đăng nhập. Kiểm password tốn CPU ngoài transaction, sau đó khóa user và kiểm lại status/auth_version hoặc digest chưa đổi trước tạo session.

Session mới dùng 32 bytes ngẫu nhiên từ CSPRNG, client nhận cookie; DB chỉ lưu token_hash. Cookie production đề xuất `__Host-library-session`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, không có Domain. Có session cũ thì thay session, không tái dùng mã phiên do client cung cấp.

Mỗi protected request kiểm token_hash, revoked_at, user active, auth_version khớp, cả idle_expires_at và absolute_expires_at còn hạn. Refresh idle phải dùng update có điều kiện và không vượt absolute; một request đang xử lý không được làm session đã revoke sống lại. TTL đề xuất idle 30 phút, absolute 12 giờ theo D03.

CSRF của phiên phải lấy lại được sau reload mà không lưu raw token trong DB. Đề xuất dẫn xuất bằng HMAC-SHA-256 từ mã phiên ngẫu nhiên và context cố định, với khóa server riêng; lưu digest của kết quả tại csrf_hash. Login trả giá trị CSRF, GET `/auth/csrf` dẫn xuất lại từ cookie hợp lệ và không thay state. So sánh digest bằng hàm constant-time. Rotate khóa CSRF phải vô hiệu hóa phiên hoặc có chiến lược khóa cũ đã được kiểm thử. Chi tiết này cần review ở S1-02.

Mutating routes có session kiểm Origin, custom header và CSRF. Auth public mutation dùng Origin/custom header và bằng chứng tương ứng, không tạo pre-session giả vì `auth_sessions.user_id` bắt buộc. GET lấy CSRF là same-origin, no-store, không CORS cho origin ngoài danh sách.

Cookie/SameSite không thay cho toàn bộ chống CSRF. [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) có hướng dẫn custom header và login CSRF. [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) là nguồn đối chiếu cookie và quản lý phiên.

## 5. Quyền thay đổi có hiệu lực

V1 query quyền hiện hành từ DB ở mỗi protected request, không cache permission xuyên request. Block/reset tăng auth_version và revoke phiên; gỡ quyền không phải chờ TTL cookie.

Với thao tác ghi nhạy cảm, khóa user của actor và user mục tiêu theo ID tăng dần, rồi kiểm lại trạng thái/quyền bằng transaction hiện tại. Thay role membership/permission cũng khóa các user bị ảnh hưởng theo cùng quy tắc. Như vậy một request ghi không dùng permission cũ sau khi thay đổi quyền đã commit. Request đã commit trước việc thu hồi vẫn giữ kết quả hợp lệ.

Thay permission role có nhiều user là transaction rộng. V1 giới hạn quy mô và đo trước triển khai; khi cần lớn hơn phải thiết kế cơ chế invalidation khác, không bỏ kiểm quyền để giảm tải.

## 6. Bảo vệ admin cuối và bootstrap

Định nghĩa đề xuất: luôn còn ít nhất một user active mang role hệ thống `admin` với tập quyền quản trị thiết yếu. Role admin hệ thống, code và tập quyền thiết yếu được khóa khỏi sửa/xóa thông thường. Tập thiết yếu tối thiểu gồm quyền quản lý users, vai trò, permission và gán role trong registry.

Mọi thao tác có thể làm mất admin cuối phải khóa `iam_policy_locks` hàng 1 trước, rồi khóa user theo ID tăng dần, kiểm lại số admin hợp lệ và mới ghi thay đổi. Bao gồm block/archive user, thay user_roles và thay quyền role hệ thống nếu sau này cho phép. Không có hàng 1 thì từ chối mutation thay vì bỏ qua kiểm tra.

Bootstrap phải giải quyết FK `user_roles.assigned_by` bắt buộc: trong quy trình local/operator được duyệt, tạo user admin + profile trước, rồi gán role admin với assigned_by là chính user vừa tạo và audit action bootstrap rõ ràng. Quyền bootstrap không được mở thành public endpoint. Không seed password mặc định; lấy credential qua đầu vào được bảo vệ, hash và không in ra log. Khóa singleton và cơ chế một lần phải chống hai lệnh bootstrap đồng thời.

Bootstrap, audit append và policy service bảo vệ admin cuối là đầu ra nền của S1-01. S1-03/S1-04 phải tích hợp và kiểm chúng ngay khi mở endpoint mutation. S1-05 kiểm lại toàn bộ đường API và tranh chấp, không phải thời điểm đầu tiên thêm cơ chế bảo vệ. Vì vậy S1-03 không được done với API block/archive còn thiếu policy, dù mốc nghiệm thu S1 chưa tới.

## 7. Forgot/reset và activation

Forgot-password luôn trả 202 với message chung. Chỉ tạo challenge cho user đủ điều kiện; giới hạn theo IP đã được proxy xác thực và hash email chuẩn hóa. Phản hồi không tiết lộ email tồn tại qua status/body; kiểm độ lệch thời gian và không gửi SMTP trong HTTP request.

Challenge chứa hash, email snapshot, purpose, expires_at; raw token chỉ nằm trong link gửi mail và payload outbox được mã hóa có xác thực. TTL reset đề xuất 15 phút, activation 24 giờ. URL base lấy từ cấu hình allowlist, không xây từ Host do request gửi. Link mở trang FE; FE gửi token qua POST body và xóa phần nhạy cảm khỏi URL sớm, dùng Referrer-Policy phù hợp.

Reset lookup digest để xác định user, sau đó khóa user rồi challenge; kiểm lại token/purpose/expiry/consumed/revoked/email snapshot và user active. Ghi hash password mới, consumed_at, tăng auth_version, revoke toàn bộ sessions, revoke challenge reset khác và audit cùng transaction. Hash password mới có thể tính trước khi giữ khóa; quyết định dùng hash phải sau bước kiểm lại. Không tự login sau reset.

Lỗi challenge hết hạn/đã dùng/sai purpose dùng mã chung `CHALLENGE_INVALID`; hai request reset đồng thời chỉ một request thành công. Các nguyên tắc phản hồi và token một lần được đối chiếu [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## 8. Rate limit, log và dữ liệu riêng tư

`rate_limit_buckets` cho phép nhiều API process dùng cùng giới hạn. Hash subject nên dùng HMAC với khóa riêng khi subject là email/IP dễ đoán. Tăng count bằng thao tác atomic trong một window, kiểm expires_at và có cleanup. Mật khẩu sai khi đăng ký mượn tối đa 3 lần là yêu cầu gốc; cửa sổ 15 phút là D07, cần chốt cùng cách kết thúc luồng thử.

Rate-limit login phải có ngay S1-02 mặc dù SQL gắn bảng rate_limit_buckets ở comment S2. Kế hoạch migration đưa bảng này vào phần nền auth trước khi mở login, hoặc phải có giải pháp giới hạn tương đương đã kiểm chứng; không để login công khai tới S2 mới bảo vệ.

Audit chỉ lưu actor, action, target, outcome, requestId và trường nghiệp vụ được phép. Không lưu password, cookie, CSRF, reset link, raw token, toàn bộ email payload hoặc cardNumber đầy đủ trong log. Nhật ký mutation thành công cùng transaction nghiệp vụ; denied/failed ghi ở transaction riêng sau rollback nếu cần, không làm sống lại mutation thất bại. Thời gian lưu và quyền truy cập log chờ D09.
