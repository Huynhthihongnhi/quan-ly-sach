# Hợp đồng REST API dự kiến

Các endpoint dưới đây là thiết kế v1, chưa được triển khai. Chúng áp dụng các đề xuất D02-D09; quyết định thay đổi phải cập nhật DTO, schema nếu cần và test cùng task. Mọi path trong bảng đều có tiền tố **`/api/v1`**, trừ health probe ghi riêng.

## 1. Quy ước chung

- JSON dùng camelCase, UTF-8. Tên cột SQL chỉ xuất hiện trong tầng mapping.
- ID và version là string thập phân. Timestamp là ISO 8601 UTC, thí dụ `2026-09-11T08:00:00.000000Z`; FE hiển thị Asia/Ho_Chi_Minh.
- Response một tài nguyên: `{ "data": {...} }`. Danh sách: `{ "data": [], "meta": { "page": 1, "pageSize": 20, "total": 0 } }`.
- `page` số nguyên >=1; `pageSize` 1..100, mặc định 20, là giới hạn API đề xuất. Sort chỉ nhận tên trong allowlist, mặc định id giảm dần; luôn thêm id làm tiêu chí phụ. Offset pagination không hứa snapshot cố định khi có dữ liệu mới.
- Public catalog không yêu cầu cookie/thẻ. Protected routes mặc định từ chối; quyền trong bảng là permission code, không phải tên vai trò.
- Tất cả JSON mutation yêu cầu `Content-Type: application/json`, Origin hợp lệ và header `X-Requested-With: library-web`. Mutation có session thêm `X-CSRF-Token`.
- Upload dùng multipart, cũng phải có Origin, custom header và CSRF. CORS local chỉ cho origin FE/CMS đã cấu hình; không dùng wildcard với credentials.
- Chỉ cho phép các trường DTO liệt kê; Nest validation đặt allowlist và từ chối trường lạ. Ví dụ class-validator dùng `whitelist` và `forbidNonWhitelisted`; cấu hình transform không được ép ID sang number. [Nest validation](https://docs.nestjs.com/techniques/validation).
- API trả `X-Request-Id`. Dữ liệu xác thực/cá nhân dùng `Cache-Control: no-store`.

## 2. HTTP status và lỗi

| Status | Khi dùng |
| --- | --- |
| 200 | GET/PATCH/PUT thành công; login; replay request tạo có idempotency |
| 201 | Tạo tài nguyên lần đầu; có Location |
| 202 | Yêu cầu gửi email được tiếp nhận; chưa chứng minh email đã đến |
| 204 | Logout hoặc DELETE quan hệ; không có body |
| 400 | JSON hỏng, header bắt buộc thiếu/sai định dạng |
| 401 | Thiếu/hết session, login sai hoặc account không được đăng nhập |
| 403 | Thiếu permission, CSRF/Origin sai, thẻ không đủ điều kiện khi danh tính đã rõ |
| 404 | ID không tồn tại hoặc dữ liệu cá nhân không thuộc caller; sách chưa published ở public |
| 409 | Version cũ, sai transition, hết copy, trùng key khác payload, mất admin cuối |
| 413 / 415 / 416 | Body quá lớn / loại nội dung không hỗ trợ / Range không hợp lệ |
| 422 | DTO sai trường/độ dài/giới hạn nghiệp vụ đầu vào |
| 429 | Rate limit; có Retry-After, không suy ra tồn tại tài khoản |
| 500 / 503 | Lỗi chưa biết / phụ thuộc chưa sẵn sàng; không trả SQL/stacktrace |

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Dữ liệu đã thay đổi. Vui lòng tải lại.",
    "requestId": "request-example-01",
    "fields": []
  }
}
```

`fields` chứa `{ "field": "requestedDays", "code": "OUT_OF_RANGE" }` khi cần. FE xử lý theo code ổn định, không parse message. Nhóm code đề xuất: `VALIDATION_FAILED`, `AUTHENTICATION_REQUIRED`, `INVALID_CREDENTIALS`, `FORBIDDEN`, `CSRF_INVALID`, `NOT_FOUND`, `VERSION_CONFLICT`, `INVALID_TRANSITION`, `EMAIL_CONFLICT`, `CARD_NOT_ELIGIBLE`, `NO_COPY_AVAILABLE`, `ACTIVE_LOAN_LIMIT`, `IDEMPOTENCY_CONFLICT`, `LAST_ADMIN_REQUIRED`, `CHALLENGE_INVALID`, `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`.

## 3. Xác thực, tài khoản và quyền

| Method | Path | Quyền | Request chính | Kết quả |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | Public + chống login CSRF | email, password | 200, cookie mới, user tối thiểu và csrfToken |
| GET | `/auth/me` | Session | Không | 200, id/status/profile và permissionCodes hiện hành |
| GET | `/auth/csrf` | Session, same-origin | Không | 200, CSRF của phiên; no-store |
| POST | `/auth/logout` | Session + CSRF | Không | 204, revoke phiên và xóa cookie |
| POST | `/auth/forgot-password` | Public + hạn tần suất | email | 202 cùng message cho email có/không có |
| POST | `/auth/reset-password` | Public + bằng chứng challenge | token, newPassword | 204, không tự login |
| POST | `/auth/activate` | Public + challenge kích hoạt | token, newPassword | 204, active; không tự login |
| GET | `/me/profile` | Session, chính mình | Không | 200 Profile |
| PATCH | `/me/profile` | Session, chính mình | displayName?, phone?, version | 200 Profile |
| GET | `/users` | `users.read` | q?, status?, page, pageSize | 200 trang user |
| POST | `/users` | `users.write` | email, displayName, phone? | 201 user invited + profile; chưa gửi email |
| GET | `/users/:id` | `users.read` | Không | 200 User |
| PATCH | `/users/:id/status` | `users.write` | status, version | 200 User; block/archive/re-enable theo policy |
| POST | `/users/:id/activation-email` | `users.write` | Không | 202 nếu invited hợp lệ; challenge/outbox ở S2 |
| GET | `/users/:id/profile` | `profiles.read` | Không | 200 Profile |
| PATCH | `/users/:id/profile` | `profiles.write` | displayName?, phone?, version | 200 Profile |
| GET | `/roles` | `roles.read` | page, pageSize | 200 Role[] có phân trang |
| POST | `/roles` | `roles.write` | code, name, description? | 201 role thường; isSystem do server quyết định |
| PATCH | `/roles/:id` | `roles.write` | name?, description?, version | 200 Role |
| DELETE | `/roles/:id` | `roles.write` | If-Match phiên bản | 204 nếu không system, không user tham chiếu |
| GET | `/permissions` | `permissions.read` | page, pageSize | 200 registry, không public CRUD |
| PUT | `/roles/:id/permissions` | `roles.write` | permissionCodes[], version | 200 Role và tập permission mới |
| GET | `/users/:id/roles` | `roles.read` và `users.read` | Không | 200 tập roles của user |
| PUT | `/users/:id/roles` | `users.roles.write` | roleIds[], version của user | 200 userVersion mới và roles |
| GET | `/audit-events` | `audit.read` | actorId?, action?, from?, to?, page | 200 dữ liệu audit đã lọc |

V1 không có public register, đổi email hoặc endpoint cấp arbitrary permission. D02 phải chốt trước code. `users/:id/status` không kích hoạt invited bằng cách bỏ qua email/password; không khôi phục archived trong v1. Account bị block có thể về active nếu đủ điều kiện, dùng lại session cũ vẫn bị từ chối.

## 4. Danh mục và file

| Method | Path | Quyền | Request chính | Kết quả |
| --- | --- | --- | --- | --- |
| GET | `/books` | Public | q?, title?, author?, categoryId?, topicId?, year?, page, pageSize | Chỉ published; AND giữa các bộ lọc |
| GET | `/books/:id` | Public | Không | Chi tiết published, số copy khả dụng, metadata digital an toàn |
| GET | `/categories`, `/authors`, `/topics` | Public | q?, page, pageSize | Chỉ taxonomy được dùng bởi book published |
| GET | `/admin/books` | `catalog.read` | state?, q?, page, pageSize | Cả draft/archived |
| GET | `/admin/books/:id` | `catalog.read` | Không | Book metadata cho CMS |
| POST | `/admin/books` | `catalog.write` | title, categoryId, authorIds[], topicIds[], isbn?, publisherName?, publicationYear?, description? | 201 draft |
| PATCH | `/admin/books/:id` | `catalog.write` | Metadata cho phép, version | 200; thay tập liên kết cùng transaction |
| PATCH | `/admin/books/:id/state` | `catalog.write` | state, version | 200; kiểm điều kiện công bố/lưu trữ |
| GET/POST | `/admin/categories`, `/admin/authors`, `/admin/topics` | GET `catalog.read`; POST `catalog.write` | Name, thêm code với category | List/201 |
| PATCH/DELETE | `/admin/categories/:id`, `/admin/authors/:id`, `/admin/topics/:id` | `catalog.write` | PATCH name và expectedName | 200/204; DELETE chỉ khi không tham chiếu |
| GET/POST | `/admin/books/:id/copies` | GET `catalog.read`; POST `copies.write` | barcode, shelfLocation? khi tạo | Trang copy/201 serviceable |
| PATCH | `/admin/copies/:id` | `copies.write` | shelfLocation?, conditionState?, version | 200; kiểm loan trước sửa condition |
| POST | `/admin/books/:id/assets` | `digital.write` | Multipart file, rightsNote | 201 metadata quarantine |
| PATCH | `/admin/assets/:id/access` | `digital.write` | readAccess, downloadRequiresCard, expectedState | 200; chỉ policy được D06 cho phép |
| POST | `/admin/assets/:id/archive` | `digital.write` | expectedState | 200; đóng quyền truy cập |
| GET | `/digital-assets/:id/read` | Chính sách file D06 | Range? | 200/206 stream inline nếu hợp lệ |
| GET | `/digital-assets/:id/download` | Session + `digital.download.own` + thẻ theo policy | Không truyền mã thẻ trong URL | 200 attachment nếu hợp lệ |

Một row có nhiều method/path trong bảng là nhóm endpoint cùng contract, phải tách operationId khi sinh OpenAPI. Taxonomy không có version trong SQL: PATCH khóa hàng và so expectedName; code category bất biến. DELETE tham chiếu trả 409. Việc đọc `readAccess=public` vẫn yêu cầu asset ready, book published và global policy cho phép.

### Contract theo mốc triển khai

Bảng endpoint mô tả đích hoàn chỉnh. Release S3 chưa có bảng loans/digital_assets, nên public catalog không JOIN hoặc hydrate quan hệ tới các bảng đó. Trước S5, `availableCopies` trả `null`, không dùng số 0 hoặc số bản serviceable để giả là tồn có thể mượn; FE chưa mở thao tác mượn ở giai đoạn này. S4 bổ sung metadata digital sau khi bảng/assets service đã sẵn sàng; trước đó danh sách `digitalAssets` là mảng rỗng.

S5-01 nối query tồn thực và kiểm điều kiện copy cùng loan cho catalog, S5-02 mở reservation sau khi query đó đã đạt test. Khi circulation đã được bật trong release, lỗi DB/bảng thiếu phải làm readiness hoặc request thất bại; không fallback về null hoặc đếm serviceable để che lỗi. Các giai đoạn dùng cùng kiểu nullable trong contract, FE không hiển thị thông tin cài đặt module cho độc giả.

## 5. Thẻ, mượn/trả và yêu cầu mua

| Method | Path | Quyền | Request chính | Kết quả |
| --- | --- | --- | --- | --- |
| GET | `/me/library-cards` | Session, chính mình | page, pageSize | Thẻ của caller; không trả thẻ user khác |
| GET | `/admin/library-cards` | `cards.read` | userId?, state?, page | Trang thẻ |
| POST | `/admin/library-cards` | `cards.write` | userId, cardNumber, expiresAt | 201, issuedBy và issuedAt do server |
| PATCH | `/admin/library-cards/:id/state` | `cards.write` | state, expectedState | 200; khóa user và card |
| POST | `/loans` | `loans.create.own`, session + thẻ | bookId, cardNumber, password, requestedDays; Idempotency-Key | 201 reserved hoặc 200 replay |
| GET | `/me/loans` | `loans.read.own` | state?, overdue?, page | Trang loan của caller |
| GET | `/loans/:id` | `loans.read.own` + ownership, hoặc `loans.read.any` | Không | Chi tiết/phiếu và lịch sử; không chứa credential |
| POST | `/loans/:id/cancel` | `loans.cancel.own` + ownership, hoặc `loans.manage` | version, reason? | 200 cancelled từ reserved |
| GET | `/admin/loans` | `loans.read.any` | userId?, copyId?, state?, overdue?, page | Ai mượn, hạn trả, lịch sử |
| POST | `/admin/loans/:id/checkout` | `loans.manage` | version | 200 borrowed, dueAt server tính |
| POST | `/admin/loans/:id/return` | `loans.manage` | version, conditionState serviceable/repair | 200 returned |
| POST | `/admin/loans/:id/lost` | `loans.manage` | version, reason | 200 lost và copy lost |
| POST | `/purchase-requests` | `purchases.create.own` | title, authorText, publicationYear, note?; Idempotency-Key | 201 pending hoặc 200 replay |
| GET | `/me/purchase-requests` | `purchases.read.own` | state?, page | Trang yêu cầu cá nhân |
| GET | `/purchase-requests/:id` | Own + `purchases.read.own`, hoặc `purchases.read.any` | Không | Request và events |
| GET | `/admin/purchase-requests` | `purchases.read.any` | state?, page | Hàng đợi CMS |
| POST | `/admin/purchase-requests/:id/review` | `purchases.review` | decision approved/rejected, reason?, version | 200, không cho tự duyệt |
| GET | `/reports/circulation`, `/reports/inventory`, `/reports/purchases` | `reports.read` | from, to, format json/csv | Tổng hợp theo định nghĩa ở business flows |

Health probes đề xuất `/health/live` và `/health/ready`, truy cập nội bộ, không chứa hostname/credential. Không mở dashboard quản trị, Swagger UI hay metrics ra khách chỉ vì health là public trong mạng triển khai.

## 6. DTO và ví dụ trọng tâm

User response: `id`, `email`, `status`, `version`, `createdAt`; profile response: `userId`, `displayName` (1..120), `phone` (nullable, <=32), `version`. GET me có thể lồng profile. Email chuẩn hóa <=254 ASCII theo D02. Giới hạn password và thuật toán được chốt tại S1-02; không dùng giới hạn cột hash để giới hạn password người dùng.

Book: title 1..300, isbn nullable <=20, publisherName <=200, year nullable 1000..9999. Mảng authorIds/topicIds không trùng, giới hạn 100 phần tử/mảng là đề xuất API. PATCH mảng thay toàn bộ quan hệ; bỏ field thì giữ nguyên. API không thêm schoolId hoặc loại độc giả chưa có trong schema.

```json
{
  "bookId": "120",
  "cardNumber": "CARD-DEMO-A",
  "password": "<mat-khau-chi-gui-qua-HTTPS>",
  "requestedDays": 15
}
```

Ví dụ trên chỉ là cấu trúc request, không phải credential chạy được. Header `Idempotency-Key` là chuỗi ASCII 1..64 ký tự được validate; khuyến nghị UUID. `userId`, `copyId`, `state`, `dueAt`, `reviewedBy` do server xác định.

```json
{
  "data": {
    "id": "910",
    "bookId": "120",
    "copyId": "501",
    "state": "reserved",
    "requestedDays": 15,
    "reservedAt": "2026-09-11T08:00:00.000000Z",
    "reservationExpiresAt": "2026-09-12T08:00:00.000000Z",
    "checkedOutAt": null,
    "dueAt": null,
    "version": "1"
  }
}
```

`bookId` được join từ copy, không phải cột trong loans. Phiếu hiển thị dữ liệu thật từ API; FE/CMS tự trình bày để in. API không hứa lưu snapshot tên sách độc lập vì schema chưa có trường đó.

Purchase DTO: title 1..300, authorText 1..300, publicationYear 1000..9999, note <=1000; lý do từ chối sau trim 1..1000. Gửi bookId là trường lạ. Xem [SQL](../../planning/database/schema.sql) trước thay giới hạn.

## 7. Version và idempotency

Với bảng có version, PATCH/PUT/transition nhận version; UPDATE thêm điều kiện version hiện tại rồi tăng 1. Không cập nhật hàng nào do version cũ trả 409. DELETE roles dùng `If-Match: "<version>"`; thiếu header trả 400. Cards/assets dùng row lock và expectedState, không giả có version chưa tồn tại.

Chỉ POST loans và purchase-requests có idempotency bền vững từ schema. Key có phạm vi user + loại tài nguyên. Hash payload chuẩn hóa bằng thuật toán ổn định; loan hash gồm bookId, cardNumber chuẩn hóa, requestedDays, **không gồm password, cookie hoặc CSRF**. Phiên đăng nhập vẫn phải hợp lệ trước replay. Request mới phải kiểm lại password/thẻ; replay cùng actor và payload trả tài nguyên đã có mà không tạo side effect mới.

Cùng key khác hash trả 409. Replay trả trạng thái hiện tại của tài nguyên, không hứa byte-for-byte response cũ vì schema không lưu response. Key giữ theo tuổi thọ bản ghi, không tự tái dùng sau một TTL tưởng tượng. Khi mất response sau commit, FE retry bằng cùng key; khi đổi ý định, tạo key mới.

## 8. Bàn giao cho FE/CMS

FE gửi cookie bằng cơ chế credentials phù hợp, giữ CSRF trong bộ nhớ và lấy lại qua `/auth/csrf` sau reload. Không lưu session cookie thủ công trong localStorage. 401 dẫn về login; 403 hiển thị thiếu quyền; 409 tải lại resource; 422 gắn lỗi field; 429 tuân Retry-After.

S0-05 phải có mock OpenAPI/fixtures cho các response trên. Khi có code, schema OpenAPI sinh từ DTO/controller là nguồn contract runtime; kiểm diff contract và sinh client trước tích hợp FE/CMS. [Nest OpenAPI](https://docs.nestjs.com/openapi/introduction).
