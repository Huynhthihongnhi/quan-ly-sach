# Sơ đồ cơ sở dữ liệu

Bản thiết kế trực quan cho [`schema.sql`](schema.sql). Mục tiêu: MySQL 8.4 / InnoDB. Ứng dụng dùng UTC; API trả `BIGINT` dạng chuỗi.

**Trạng thái:** bản nháp thiết kế, chưa chạy migration.

---

## Tổng quan module

```mermaid
---
config:
  theme: base
  themeVariables:
    fontFamily: cascadia mono, consolas, noto sans mono, menlo, monospace
    fontSize: 15px
    primaryColor: "#8ECAFF"
    primaryTextColor: "#111111"
    primaryBorderColor: "#444444"
    lineColor: "#444444"
    textColor: "#111111"
    edgeLabelBackground: "#FFFFFF"
---
flowchart LR
    S0["S0<br/>Migration"] --> S1["S1<br/>IAM"]
    S1 --> S2["S2<br/>Xác thực"]
    S1 --> S3["S3<br/>Danh mục sách"]
    S3 --> S4["S4<br/>Thẻ & tài sản số"]
    S4 --> S5["S5<br/>Mượn trả"]
    S2 --> S5
    S1 --> S6["S6<br/>Đề xuất mua"]

    classDef step fill:#8ECAFF,stroke:#444444,stroke-width:2px,color:#111111
    classDef accent fill:#D0BFFF,stroke:#444444,stroke-width:2px,color:#111111
    class S0 accent
    class S1,S2,S3,S4,S5,S6 step
    linkStyle default stroke:#444444,stroke-width:1.5px
```

**Tóm tắt:** `users` là trung tâm định danh. `books` và `book_copies` tách phiên bản sách khỏi bản sao vật lý. `loans` gắn thẻ thư viện, bản sao và vòng đời mượn trả.

---

## Chú thích màu (Vivid Clay)

| Vai trò | Màu | Ý nghĩa trong ER |
| ------- | --- | ---------------- |
| Nền chính | Xanh da trời `#8ECAFF` | Hộp thực thể |
| Viền | Xám đậm `#444444` | Quan hệ và khung |
| Chữ | Đen `#111111` | Nhãn và thuộc tính |

---

## S0: Lịch sử migration

Bảng `schema_migrations` do runner quản lý trước migration ứng dụng. Không có khóa ngoại.

| Cột chính | Ý nghĩa |
| --------- | ------- |
| `version` PK | Phiên bản migration |
| `state` | `running`, `applied`, `failed`, `rolled_back` |
| `direction` | `up` hoặc `down` |

---

## S1: Định danh và phân quyền (IAM)

```mermaid
---
config:
  theme: base
  layout: elk
  themeVariables:
    fontFamily: cascadia mono, consolas, noto sans mono, menlo, monospace
    fontSize: 15px
    primaryColor: "#8ECAFF"
    primaryTextColor: "#111111"
    primaryBorderColor: "#444444"
    lineColor: "#444444"
    textColor: "#111111"
    edgeLabelBackground: "#FFFFFF"
---
erDiagram
    direction TB

    users ||--|| profiles : "có hồ sơ"
    users ||--o{ user_roles : "được gán"
    roles ||--o{ user_roles : "gán cho"
    roles ||--o{ role_permissions : "có quyền"
    permissions ||--o{ role_permissions : "thuộc"
    users ||--o{ auth_sessions : "đăng nhập"
    users |o--o{ audit_events : "thực hiện"

    users {
        bigint id PK
        string email UK
        string status "invited|active|blocked|archived"
        bigint auth_version
    }

    profiles {
        bigint user_id PK, FK
        string display_name
        string phone
    }

    roles {
        bigint id PK
        string code UK
        string name
        bool is_system
    }

    permissions {
        bigint id PK
        string code UK
        string description
    }

    user_roles {
        bigint user_id PK, FK
        bigint role_id PK, FK
        bigint assigned_by FK
    }

    role_permissions {
        bigint role_id PK, FK
        bigint permission_id PK, FK
    }

    auth_sessions {
        bigint id PK
        bigint user_id FK
        binary token_hash UK
        datetime idle_expires_at
        datetime absolute_expires_at
    }

    audit_events {
        bigint id PK
        bigint actor_user_id FK
        string action
        string target_type
        string outcome
    }
```

**Tóm tắt:** Một `users` có tối đa một `profiles`. Vai trò và quyền nối qua bảng nối `user_roles` và `role_permissions`. `auth_sessions` lưu hash token, không lưu cookie thô.

**Ghi chú:** `iam_policy_locks` là khóa singleton (`id = 1`) dùng khi khóa/block/archive admin; không có FK.

---

## S2: Thử thách xác thực và email

```mermaid
---
config:
  theme: base
  layout: elk
  themeVariables:
    fontFamily: cascadia mono, consolas, noto sans mono, menlo, monospace
    fontSize: 15px
    primaryColor: "#8ECAFF"
    primaryTextColor: "#111111"
    primaryBorderColor: "#444444"
    lineColor: "#444444"
    textColor: "#111111"
    edgeLabelBackground: "#FFFFFF"
---
erDiagram
    direction TB

    users ||--o{ identity_challenges : "nhận"
    users |o--o{ email_outbox : "liên quan"
    identity_challenges |o--o{ email_outbox : "kích hoạt"

    users {
        bigint id PK
        string email UK
    }

    identity_challenges {
        bigint id PK
        bigint user_id FK
        string purpose "reset|activate"
        binary token_hash UK
        datetime expires_at
    }

    email_outbox {
        bigint id PK
        bigint user_id FK
        bigint challenge_id FK
        string template_code
        string dedupe_key UK
        string state "queued|sent|failed"
    }

    rate_limit_buckets {
        string scope PK
        binary subject_hash PK
        datetime window_start PK
        int request_count
    }
```

**Tóm tắt:** `identity_challenges` phục vụ đặt lại mật khẩu và kích hoạt tài khoản. `email_outbox` hàng đợi gửi email bền vững. `rate_limit_buckets` độc lập, không FK.

---

## S3: Danh mục sách

```mermaid
---
config:
  theme: base
  layout: elk
  themeVariables:
    fontFamily: cascadia mono, consolas, noto sans mono, menlo, monospace
    fontSize: 15px
    primaryColor: "#8ECAFF"
    primaryTextColor: "#111111"
    primaryBorderColor: "#444444"
    lineColor: "#444444"
    textColor: "#111111"
    edgeLabelBackground: "#FFFFFF"
---
erDiagram
    direction TB

    categories ||--o{ books : "phân loại"
    users ||--o{ books : "tạo"
    books ||--o{ book_authors : "có"
    authors ||--o{ book_authors : "viết"
    books ||--o{ book_topics : "thuộc"
    topics ||--o{ book_topics : "gắn"
    books ||--o{ book_copies : "có bản sao"

    categories {
        bigint id PK
        string code UK
        string name
    }

    authors {
        bigint id PK
        string name
    }

    topics {
        bigint id PK
        string name UK
    }

    books {
        bigint id PK
        bigint category_id FK
        string title
        string isbn UK
        string state "draft|published|archived"
        bigint created_by FK
    }

    book_authors {
        bigint book_id PK, FK
        bigint author_id PK, FK
        int author_order
    }

    book_topics {
        bigint book_id PK, FK
        bigint topic_id PK, FK
    }

    book_copies {
        bigint id PK
        bigint book_id FK
        string barcode UK
        string condition_state
    }
```

**Tóm tắt:** `books` là phiên bản/đầu mục sách; `book_copies` là bản sao vật lý có barcode riêng. Tác giả và chủ đề gắn qua bảng nối.

---

## S4: Thẻ thư viện và tài sản số

```mermaid
---
config:
  theme: base
  layout: elk
  themeVariables:
    fontFamily: cascadia mono, consolas, noto sans mono, menlo, monospace
    fontSize: 15px
    primaryColor: "#8ECAFF"
    primaryTextColor: "#111111"
    primaryBorderColor: "#444444"
    lineColor: "#444444"
    textColor: "#111111"
    edgeLabelBackground: "#FFFFFF"
---
erDiagram
    direction TB

    users ||--o{ library_cards : "sở hữu"
    users ||--o{ library_cards : "cấp"
    books ||--o{ digital_assets : "có file"
    users ||--o{ digital_assets : "tải lên"

    users {
        bigint id PK
        string email UK
    }

    library_cards {
        bigint id PK
        bigint user_id FK
        string card_number UK
        string state "active|suspended|revoked"
        bigint issued_by FK
        datetime expires_at
    }

    books {
        bigint id PK
        string title
    }

    digital_assets {
        bigint id PK
        bigint book_id FK
        string storage_key UK
        string mime_type
        string state "quarantine|ready|rejected"
        string read_access
        bigint uploaded_by FK
    }
```

**Tóm tắt:** Mỗi thành viên có thể có nhiều thẻ nhưng chỉ một thẻ `active` (ràng buộc unique trên cột ảo `active_user_id`). `digital_assets` lưu metadata file số, không lưu nội dung thô trong DB.

---

## S5: Mượn trả và thông báo

```mermaid
---
config:
  theme: base
  layout: elk
  themeVariables:
    fontFamily: cascadia mono, consolas, noto sans mono, menlo, monospace
    fontSize: 15px
    primaryColor: "#8ECAFF"
    primaryTextColor: "#111111"
    primaryBorderColor: "#444444"
    lineColor: "#444444"
    textColor: "#111111"
    edgeLabelBackground: "#FFFFFF"
---
erDiagram
    direction TB

    users ||--o{ loans : "mượn"
    library_cards ||--o{ loans : "dùng thẻ"
    book_copies ||--o{ loans : "cấp bản sao"
    loans ||--o{ loan_events : "ghi sự kiện"
    users |o--o{ loan_events : "thực hiện"
    loans ||--o{ notification_deliveries : "nhắc hạn"
    email_outbox ||--|| notification_deliveries : "gửi qua"

    users {
        bigint id PK
    }

    library_cards {
        bigint id PK
        bigint user_id FK
    }

    book_copies {
        bigint id PK
        string barcode UK
    }

    loans {
        bigint id PK
        bigint user_id FK
        bigint card_id FK
        bigint copy_id FK
        string state "reserved|borrowed|returned"
        datetime due_at
    }

    loan_events {
        bigint id PK
        bigint loan_id FK
        bigint actor_user_id FK
        string to_state
    }

    notification_deliveries {
        bigint id PK
        bigint loan_id FK
        bigint outbox_id FK, UK
        string kind
    }

    email_outbox {
        bigint id PK
        string state
    }
```

**Tóm tắt:** `loans` gắn `(card_id, user_id)` composite FK với `library_cards`. Một bản sao chỉ có một loan đang active (`reserved` hoặc `borrowed`) nhờ cột ảo `active_copy_id`. Thông báo đến hạn đi qua `email_outbox`.

---

## S6: Đề xuất mua sách

```mermaid
---
config:
  theme: base
  themeVariables:
    fontFamily: cascadia mono, consolas, noto sans mono, menlo, monospace
    fontSize: 15px
    primaryColor: "#8ECAFF"
    primaryTextColor: "#111111"
    primaryBorderColor: "#444444"
    lineColor: "#444444"
    textColor: "#111111"
    edgeLabelBackground: "#FFFFFF"
---
erDiagram
    direction TB

    users ||--o{ purchase_requests : "gửi"
    users |o--o{ purchase_requests : "duyệt"
    purchase_requests ||--o{ purchase_request_events : "lịch sử"
    users ||--o{ purchase_request_events : "thực hiện"

    users {
        bigint id PK
        string email UK
    }

    purchase_requests {
        bigint id PK
        bigint requester_id FK
        string title
        string author_text
        string state "pending|approved|rejected"
        bigint reviewed_by FK
    }

    purchase_request_events {
        bigint id PK
        bigint purchase_request_id FK
        bigint actor_user_id FK
        string to_state
    }
```

**Tóm tắt:** Đây là yêu cầu mua sách (acquisition), không phải giao dịch thanh toán. Mọi chuyển trạng thái được ghi trong `purchase_request_events`.

---

## Bảng độc lập (không FK)

| Bảng | Module | Vai trò |
| ---- | ------ | ------- |
| `schema_migrations` | S0 | Theo dõi migration đã chạy |
| `iam_policy_locks` | S1 | Khóa singleton cho thao tác IAM nhạy cảm |
| `rate_limit_buckets` | S2 | Giới hạn tần suất theo scope và subject hash |

---

## Danh sách bảng (27)

| # | Bảng | Module |
| - | ---- | ------ |
| 1 | `schema_migrations` | S0 |
| 2 | `users` | S1 |
| 3 | `profiles` | S1 |
| 4 | `roles` | S1 |
| 5 | `permissions` | S1 |
| 6 | `user_roles` | S1 |
| 7 | `role_permissions` | S1 |
| 8 | `auth_sessions` | S1 |
| 9 | `iam_policy_locks` | S1 |
| 10 | `audit_events` | S1 |
| 11 | `identity_challenges` | S2 |
| 12 | `rate_limit_buckets` | S2 |
| 13 | `email_outbox` | S2 |
| 14 | `categories` | S3 |
| 15 | `authors` | S3 |
| 16 | `topics` | S3 |
| 17 | `books` | S3 |
| 18 | `book_authors` | S3 |
| 19 | `book_topics` | S3 |
| 20 | `book_copies` | S3 |
| 21 | `library_cards` | S4 |
| 22 | `digital_assets` | S4 |
| 23 | `loans` | S5 |
| 24 | `loan_events` | S5 |
| 25 | `notification_deliveries` | S5 |
| 26 | `purchase_requests` | S6 |
| 27 | `purchase_request_events` | S6 |

---

## Cách xem sơ đồ

- **GitHub / GitLab:** mở file này trên web; renderer hỗ trợ Mermaid 9.4+.
- **VS Code / Cursor:** cài extension "Markdown Preview Mermaid Support".
- **Trực tuyến:** dán từng khối mermaid vào [mermaid.live](https://mermaid.live).

Trạng thái kiểm tra: **syntax-reviewed** (chưa render trực quan trong phiên này).
