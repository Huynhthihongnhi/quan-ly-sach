# Ánh xạ database sang BE

Nguồn cấu trúc duy nhất: [schema.sql](../../planning/database/schema.sql), gồm **27 bảng**. Tên bảng, enum và khóa dưới đây được đối chiếu với SQL, không lấy từ tên rút gọn trên sơ đồ. Chưa có dữ liệu seed hoặc database được thực thi trong task này.

## 1. Danh mục bảng và chủ sở hữu

| Bảng | Module sở hữu | Khóa và ý nghĩa | Việc BE phải bảo vệ |
| --- | --- | --- | --- |
| `schema_migrations` | runner | PK `version`; checksum up/down, trạng thái, runner | Một runner, không bỏ qua version hoặc tự xóa lỗi |
| `users` | identity | PK `id`; email unique; `version`, `auth_version` riêng | Chuẩn hóa email, active có password, không trả hash |
| `profiles` | identity | PK/FK `user_id`; display_name, phone, version | Tạo cùng user; chỉ sửa trường hồ sơ |
| `roles` | access | PK `id`; code unique, `is_system`, version | Code hệ thống bất biến; không xóa role đang được dùng |
| `permissions` | access | PK `id`; code unique | Registry từ code, CMS chỉ đọc và gán |
| `user_roles` | access | PK user/role; `assigned_by` FK users | Actor do server lấy; gán có kiểm quyền, chống mất admin cuối |
| `role_permissions` | access | PK role/permission | Chỉ cho code đã đăng ký; đổi có hiệu lực request tiếp theo |
| `auth_sessions` | auth | Token digest unique; CSRF digest, auth_version, TTL | Session gắn đúng user; revoke, idle và absolute expiry |
| `iam_policy_locks` | access | Singleton PK `id=1` | Phải seed hàng 1 trước mọi thay đổi có thể mất admin cuối |
| `audit_events` | audit | Actor nullable; action, target, outcome, request_id | Chỉ ghi chi tiết cho phép, không có bí mật hoặc log request thô |
| `identity_challenges` | auth | Token digest unique; purpose, email snapshot, TTL | Một lần dùng; kiểm purpose, email và user dưới transaction |
| `rate_limit_buckets` | auth | PK scope/subject_hash/window_start | Tăng atomic; giới hạn dùng chung giữa process |
| `email_outbox` | messaging | Dedupe unique; ciphertext, state, lease, attempts | Không gửi trong transaction HTTP; chống worker ghi bằng lease cũ |
| `categories` | catalog | Code unique; mỗi book có một loại | Loại tài liệu, không trộn với trạng thái bản sách |
| `authors` | catalog | Name có index, không unique | Hai người cùng tên là hợp lệ; không tự merge |
| `topics` | catalog | Name unique theo collation | Xử lý xung đột dấu/hoa thường theo D08 |
| `books` | catalog | Category FK; ISBN unique nullable; creator, version | Đầu mục/ấn bản, public chỉ published |
| `book_authors` | catalog | PK book/author; author_order | Thứ tự tác giả do API quy định; không trùng author trong book |
| `book_topics` | catalog | PK book/topic | Danh sách topic hợp lệ, thay liên kết cùng transaction book |
| `book_copies` | catalog | Barcode unique; condition, version | Bản vật lý; thay condition không phá loan đang hiệu lực |
| `library_cards` | cards | Card number unique; unique active_user_id; unique id/user | Một state active/user; kiểm cả thời gian và ownership |
| `digital_assets` | digital | Storage key unique; size/hash, read_access, state | File private; quarantine trước ready; không lộ key |
| `loans` | circulation | Unique user/request_key và active_copy_id; FK card/user | Một loan = một copy; chống trùng, sai thẻ, quá giới hạn |
| `loan_events` | circulation | Loan FK, actor nullable, chuyển trạng thái | Ghi cùng transaction loan; lịch sử chỉ append |
| `notification_deliveries` | circulation | Unique loan/due/kind và outbox_id | Một reminder logic cho mỗi hạn trả và loại |
| `purchase_requests` | purchases | Requester/key unique; version, reviewer | Người gửi không tự duyệt; yêu cầu độc lập với books |
| `purchase_request_events` | purchases | Request FK; actor NOT NULL | Chuyển trạng thái cùng transaction; audit requestId riêng nếu cần |

## 2. Ánh xạ kiểu dữ liệu

| SQL | Nội bộ/DTO đề xuất | Quy tắc |
| --- | --- | --- |
| `BIGINT UNSIGNED` | Chuỗi thập phân | IDs và version không ép sang JS number; validate từ 1 đến 18446744073709551615 cho ID |
| `BINARY(32)` | Buffer trong adapter | Digest 32 bytes; không trả qua API hoặc ghi log |
| `DATETIME(6)` | Chuỗi UTC bảo toàn độ chính xác ở adapter | API ISO 8601 có Z; round-trip timestamp dùng làm dedupe phải giữ 6 chữ số phần thập phân |
| `BOOLEAN` | Boolean DTO | MySQL biểu diễn số; mapper kiểm 0/1, không dùng truthiness của chuỗi |
| `SMALLINT`, `TINYINT`, `INT` | Number sau validate giới hạn | requestedDays 1..15; năm 1000..9999 theo schema |
| `VARCHAR`, `TEXT` | String với giới hạn rõ | Kiểm ký tự/byte theo cột; không silently truncate |
| `JSON` | Object có schema allowlist | Audit details không cho object tùy ý từ HTTP |
| `VARBINARY(8192)` | Buffer ciphertext | Có hạn kích thước, key ID và envelope mã hóa có xác thực |
| Cột generated | Chỉ đọc | Không insert/update `active_user_id` hoặc `active_copy_id` |

`users.version` phục vụ chống ghi đè dữ liệu. `users.auth_version` phục vụ vô hiệu hóa session. Hai trường có mục đích khác nhau; không tăng auth_version chỉ vì sửa displayName.

MySQL driver có các lựa chọn `supportBigNumbers`, `bigNumberStrings` và `dateStrings`. Cần kiểm đúng API của phiên bản TypeORM được chọn; tài liệu driver v0 là tham chiếu, chưa phải pin phiên bản cho dự án. [TypeORM MySQL driver](https://v0.typeorm.io/docs/drivers/mysql/).

Mỗi connection phải đặt session timezone `+00:00`; `DATETIME` tự nó không lưu timezone. Không cho JavaScript Date làm mất microsecond trước khi tạo `due_at_snapshot` hoặc dedupe key. Có thể tạo thời gian nghiệp vụ ở độ chính xác millisecond, nhưng dữ liệu đã lưu phải được đọc lại chính xác.

## 3. Enum đầy đủ từ SQL

| Bảng/trường | Giá trị |
| --- | --- |
| schema_migrations.state | `running`, `applied`, `failed`, `rolled_back` |
| schema_migrations.direction | `up`, `down` |
| users.status | `invited`, `active`, `blocked`, `archived` |
| audit_events.outcome | `success`, `denied`, `failed` |
| identity_challenges.purpose | `reset_password`, `activate_account` |
| email_outbox.state | `queued`, `processing`, `sent`, `failed`, `cancelled` |
| books.state | `draft`, `published`, `archived` |
| book_copies.condition_state | `serviceable`, `repair`, `lost`, `retired` |
| library_cards.state | `active`, `suspended`, `revoked`, `expired` |
| digital_assets.state | `quarantine`, `ready`, `rejected`, `archived` |
| digital_assets.read_access | `public`, `authenticated`, `card` |
| loans.state | `reserved`, `borrowed`, `returned`, `cancelled`, `expired`, `lost` |
| purchase_requests.state | `pending`, `approved`, `rejected` |

`overdue` là điều kiện `state='borrowed' AND due_at < now`, không phải enum mới. Các cột `loan_events.from_state/to_state` và `purchase_request_events.from_state/to_state` chưa có CHECK enum; service phải kiểm theo lifecycle tương ứng.

## 4. Ràng buộc quan trọng

- `uq_loans_active_copy` ngăn hai loan reserved/borrowed dùng cùng copy. Unique là lớp bảo vệ cuối; service vẫn phải chọn copy và kiểm nghiệp vụ trong transaction.
- `fk_loans_card_owner` là FK ghép `(card_id,user_id)` sang thẻ. Biết mã thẻ của người khác không đủ để mượn.
- `uq_cards_active_user` chỉ xét `state='active'`. Khi thẻ hết thời gian mà chưa đổi state, hàng này vẫn chiếm unique; cấp lại phải khóa user, chuyển thẻ cũ sang expired rồi thêm thẻ mới cùng transaction.
- `profiles` bảo đảm tối đa một hồ sơ/user, không ép mọi user phải có profile. Seed/bootstrap và create user phải ghi cả hai.
- FK đều `ON DELETE RESTRICT`. Ưu tiên archive hoặc chuyển trạng thái; DELETE role/taxonomy chỉ khi không còn tham chiếu và luật nghiệp vụ cho phép.
- ISBN NULL cho phép nhiều đầu mục chưa có ISBN; chuẩn hóa chuỗi rỗng thành NULL theo DTO đã chốt. Không bắt báo/tạp chí có ISBN.
- `book_authors` không có unique book/author_order. V1 đề xuất cấp thứ tự 1..n theo mảng request; trả ổn định bằng `(author_order, author_id)`.
- `purchase_requests` bắt lý do từ chối và reviewer/time khi kết thúc, nhưng không chặn self-review hoặc quyết định lại. Service bảo vệ bằng version và transition.

## 5. Tồn kho và tìm kiếm

Tồn khả dụng của một book = số `book_copies` có `condition_state='serviceable'` và không có loan `reserved` hoặc `borrowed`. Reservation đã quá giờ nhưng chưa được worker đóng vẫn giữ copy; API không báo khả dụng trước khi giải phóng bằng transaction.

Công thức này được bật khi S5-01 đã có schema và query circulation. Ở release S3, chưa có bảng loans, API trả availableCopies null theo [contract theo mốc](04-api-contract.md#contract-theo-mốc-triển-khai); không thực hiện JOIN vào bảng chưa triển khai. Metadata digital tương tự được nối ở S4-02, không eager-load từ entity book ở S3.

Query list/search bắt đầu từ books published. Bộ lọc kết hợp AND; tác giả/chủ đề dùng EXISTS hoặc query hai bước để không nhân đôi đầu sách khi nhiều bảng nối. Pagination và count phải cùng điều kiện. `%` và `_` trong từ người dùng là ký tự tìm chứa, cần escape, không mở wildcard tùy ý.

Index hiện có hỗ trợ trạng thái, loại/năm/id, author/topic join và allocation. Không có FULLTEXT trong SQL. Tìm `%term%` có thể quét nhiều hàng; S3-05 dùng dữ liệu tiếng Việt đại diện và EXPLAIN để quyết định thêm index/công cụ tìm kiếm. Không tuyên bố index tên hiện có tối ưu được mọi contains query.

## 6. Khoảng trống cần xử lý trước code tương ứng

| Mã | Quan sát | Hướng xử lý và task |
| --- | --- | --- |
| G01 | Không có seed user/role/permission/policy row | Thiết kế bootstrap có kiểm soát, fixture tách biệt; S1-01/S1-05 |
| G02 | Email ascii_bin phân biệt hoa thường | D02 chốt email ASCII trim + lowercase toàn địa chỉ; tất cả luồng dùng chung normalizer |
| G03 | Cards/assets không có version; asset scan không có lease | Card lock + expectedState; asset publish theo compare-and-set và worker đơn hoặc cơ chế claim riêng ở S4 |
| G04 | CHECK loans chưa ép mọi tổ hợp timestamp/lifecycle, max 15 ngày tính từ checkout | State machine service; dueAt chỉ server tính; S5-01/S5-03 |
| G05 | `request_key` chỉ có ở loan/purchase | Không quảng bá idempotency bền vững cho mọi POST; S0-05/S5-02/S6-01 |
| G06 | Outbox không có provider receipt/idempotency ID | Gửi ít nhất một lần; có thể trùng mail khi provider nhận nhưng worker chết; S2-01 |
| G07 | `schema_migrations` PK version chỉ giữ trạng thái lần chạy hiện tại | Lưu bản ghi mỗi lần chạy ở evidence vận hành; muốn lịch sử nhiều attempt trong DB cần proposal schema riêng |
| G08 | Không có loại độc giả sinh viên/giảng viên/nhân viên trong profile | Không tự thêm field hoặc role theo nghề; chốt D02 nếu cần lọc/báo cáo |
| G09 | Không có search benchmark, dữ liệu mẫu hoặc dung lượng thực | Fixture tổng hợp ở S0-04/S3-05; không dùng số mục tiêu làm kết quả đã đo |

## 7. Kế hoạch dữ liệu mẫu

Fixture test dùng địa chỉ thuộc `example.invalid`, barcode/mã thẻ giả và clock cố định. Tạo admin bootstrap, librarian, hai reader, invited, blocked; các trạng thái thẻ; sách published/draft/archived, ISBN NULL, hai tác giả, nhiều copy; file metadata hợp lệ và bị quarantine; loan mỗi trạng thái; yêu cầu mua pending/approved/rejected.

Mật khẩu test được băm trong factory lúc test, không seed credential dùng lại trong production. Seed business demo là tùy chọn local. Production chỉ bootstrap registry/quyền/admin theo quy trình đã duyệt, không nạp fixture test.
