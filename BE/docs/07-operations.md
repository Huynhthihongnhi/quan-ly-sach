# Môi trường, migration và vận hành

Đây là kế hoạch cho S0 và S7. Chưa có Dockerfile, Compose, biến môi trường, runner hoặc deployment được tạo/chạy. Các path và script bên dưới là hợp đồng đầu ra để đội triển khai hoàn thiện sau khi chốt stack.

## 1. Môi trường local

Docker Desktop trên macOS chạy MySQL, mail sandbox và tùy chế độ có API/worker. FE/CMS dùng dev server qua reverse proxy hoặc build tĩnh cùng origin. Dịch vụ mysql có healthcheck kiểm query thực; API chỉ ready khi kết nối database và schema version tương thích.

Compose `depends_on` với `service_healthy` có thể chờ dependency qua healthcheck. Nó không thay cơ chế reconnect khi DB lỗi trong lúc chạy. [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/).

| Service | Dữ liệu bền vững | Điều kiện sẵn sàng |
| --- | --- | --- |
| mysql | Volume DB riêng local/test | Query health thành công, đúng MySQL 8.4 patch đã chốt |
| api | Không lưu trạng thái chỉ trong RAM | DB ready, schema compatible, config hợp lệ |
| worker | MySQL lưu job/lease | DB/schema/mail config hợp lệ; heartbeat được theo dõi |
| mail sandbox | Chỉ mail thử local | Endpoint nhận mail; không dùng credential production |
| private storage | Volume/file store riêng | Quyền đọc/ghi phù hợp, không được proxy publish như static |
| proxy | Cấu hình route/TLS | FE, CMS và API đi đúng prefix, giới hạn intranet theo môi trường |

S0-03 phải kiểm CPU architecture của máy dev và image, quyền volume trên macOS, hot reload và cold start. Test dùng DB/volume riêng, tên rõ ràng; không dọn database bằng pattern rộng.

## 2. Danh mục cấu hình dự kiến

| Nhóm | Tên đề xuất | Quy tắc |
| --- | --- | --- |
| App | `NODE_ENV`, `PORT`, `APP_PUBLIC_ORIGIN` | Origin tuyệt đối trong allowlist, không lấy từ Host request |
| Database | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_POOL_SIZE` | Runtime user có DML cần thiết; connection UTC; giới hạn pool tổng API + worker |
| Session | `SESSION_IDLE_SECONDS`, `SESSION_ABSOLUTE_SECONDS`, `SESSION_CSRF_KEY` | TTL theo D03; key không có mặc định production |
| Rate limit | `RATE_LIMIT_HASH_KEY`, bộ limit theo scope | Key riêng, không log subject thô; có fail policy khi DB lỗi |
| Challenge | `RESET_TTL_SECONDS`, `ACTIVATION_TTL_SECONDS` | Phải nhỏ hơn hoặc bằng thời gian outbox còn gửi có ích |
| Mail | `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` | Local sandbox tách production; timeout/retry có giới hạn |
| Mã hóa outbox | `OUTBOX_ACTIVE_KEY_ID`, keyring do deploy cấp | Giữ key cũ cho payload còn hạn; không ghi key vào tài liệu |
| File | `FILE_STORE_DRIVER`, `FILE_STORE_ROOT`, `UPLOAD_MAX_BYTES` | Root tuyệt đối, giới hạn trong vùng cho phép; storage_key không nhận từ client |
| Nghiệp vụ | `LIBRARY_TIMEZONE`, `RESERVATION_TTL_SECONDS`, `MAX_ACTIVE_LOANS` | Timezone dự kiến Asia/Ho_Chi_Minh; hạn mức chờ D07 |
| Worker | `JOB_BATCH_SIZE`, `JOB_LEASE_SECONDS`, `JOB_MAX_ATTEMPTS`, `JOB_POLL_SECONDS` | Claim có lease, timeout gửi nhỏ hơn lease hoặc gia hạn có điều kiện |

Đây là danh mục tên, không phải `.env` có thể nạp. Khi triển khai, config module validate kiểu/range, quan hệ idle <= absolute và các key bắt buộc. API/worker không được tự chạy với password/key fallback. Frontend chỉ nhận cấu hình public, không nhận DB/mail/keyring.

Tài khoản runner và tên database mục tiêu được truyền riêng cho công cụ migration, không dùng chung runtime credential. Không đưa credential lên command line hoặc lệnh trong shell history khi có cơ chế đầu vào an toàn hơn.

## 3. Data access và quyền database

ORM đặt `synchronize: false`, `migrationsRun: false`; API/worker không thực hiện DDL khi startup. Dùng một data source quản lý pool mỗi process, repository theo transaction manager. Chuẩn hóa connect timezone UTC và cấu hình BIGINT trước query đầu tiên.

Runtime user chỉ có quyền thao tác dữ liệu được cần; có thể giới hạn audit/events theo hướng append. Runner có DDL riêng, chỉ dùng trong quy trình migration được duyệt. Backup/restore dùng quyền vận hành riêng; DB không mở công khai ra Internet.

## 4. Kế hoạch migration

`planning/database/schema.sql` là bản thiết kế để tách, chưa phải migration có version. Runner tạo và kiểm `schema_migrations` trước application migrations. Không thêm bảng lịch sử thứ hai do ORM tự sinh.

| Nhóm logic | Bảng/phạm vi | Phụ thuộc dữ liệu; task tạo |
| --- | --- | --- |
| identity/access | users, profiles, roles, permissions, user_roles, role_permissions, iam_policy_locks, audit_events | History runner; S1-01 |
| auth nền | auth_sessions, rate_limit_buckets | users; trước login S1-02 |
| challenges/mail | identity_challenges, email_outbox | users; S2-01 |
| catalog | categories, authors, topics, books, book_authors, book_topics, book_copies | users; S3-01 |
| cards | library_cards | users; S4-01, không phụ thuộc catalog hoặc digital |
| digital | digital_assets | users, books; S4-02 |
| circulation | loans, loan_events, notification_deliveries | users, library_cards, book_copies, email_outbox; S5-01 |
| purchases | purchase_requests, purchase_request_events | users; S6-01, không phụ thuộc circulation |

Đây là nhóm logic, không phải số migration cố định. Một nhóm có thể thành nhiều cặp up/down. Cấp version liên tiếp theo thứ tự tích hợp thực, kiểm lại version kế tiếp trước khi nhận file; không gắn số sẵn khiến cards phải chờ digital hoặc purchases phải chờ circulation. Chuỗi file thực vẫn tuyến tính, không nhảy version; các nhóm có thể được tích hợp sớm chỉ khi phụ thuộc trong PROGRESS đã đạt. Thứ tự bảng trong file theo FK; down theo chiều ngược. Không chạy cả 27 bảng ngay ở S0 nếu scope milestone chưa cần.

S0-04 kiểm ORM trên bảng thử cô lập, không dùng migration ứng dụng chưa có. S0-06 hoàn thành runner và test bằng các migration thử. Khi S1-01 và các task schema sau tích hợp bảng thật, fixtures/integration của module đó mới dùng runner hoàn chỉnh. ORM startup không tự tạo thêm bảng để làm kiểm thử đạt.

Hợp đồng CLI dự kiến:

| Command đề xuất | Hành vi bắt buộc |
| --- | --- |
| `db:status` | Đọc danh sách file/history; báo absent nếu DB/history chưa có, không tự tạo |
| `db:preview -- --to <version>` | Kiểm thứ tự/checksum và in kế hoạch SQL; không ghi DB |
| `db:up -- --to <version>` | Chỉ sau duyệt mục tiêu; áp dụng tuần tự tới version |
| `db:down -- --version <version>` | Chỉ version applied cao nhất; báo phụ thuộc và nguy cơ mất dữ liệu |

Không chạy các lệnh này hiện tại vì chưa có package scripts. Nếu cần chọn một version, đó phải là version kế tiếp hợp lệ, không cho nhảy qua version còn thiếu.

Runner phải kiểm file pair, version duy nhất, path được giới hạn trong thư mục cho phép, checksum SHA-256 và schema đích đúng. Acquire advisory lock trên **cùng connection riêng** cho cả chuỗi chạy, kiểm lock thành công; mất connection thì dừng. History running được ghi bền vững trước DDL, applied sau khi hoàn thành; lỗi ghi failed nếu còn kết nối, còn running sau crash cần reconciliation thủ công. Không tiếp tục khi history đang failed/running hoặc checksum của bản đã chạy thay đổi.

DDL MySQL có implicit commit; rollback transaction không hoàn tác cả file SQL nhiều câu lệnh. Vì vậy một file có câu thứ hai lỗi có thể để lại bảng từ câu đầu. [MySQL implicit commit](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html).

Khi lỗi: dừng runner và release lock nếu còn giữ; ghi mã lỗi đã lọc, kiểm trạng thái schema thực, so với migration; lập phương án sửa tiếp hoặc restore có phê duyệt. Không tự down hoặc đánh dấu applied chỉ để mở khóa. History PK version chỉ lưu lần trạng thái hiện tại, nên log mỗi attempt lưu ở evidence vận hành ngoài bảng.

## 5. Hợp đồng package scripts sau S0

| Script đề xuất | Ý nghĩa cần được chứng minh |
| --- | --- |
| `start:dev`, `start:worker:dev` | API và worker local riêng |
| `build` | Build hai entrypoint với cùng config TypeScript |
| `start:prod`, `start:worker:prod` | Chạy artifact đã build, không biên dịch hoặc migrate ngầm |
| `lint`, `typecheck` | Quy tắc code và kiểu dữ liệu |
| `test:unit` | Luật nghiệp vụ cô lập |
| `test:integration` | MySQL thật + HTTP/adapter |
| `test:contract` | DTO, error, route policy, OpenAPI |
| `test:concurrency` | Nhiều connection và barrier cho tranh chấp |
| `openapi:export` | Sinh schema không chứa giá trị bí mật |
| `validate` | Chuỗi kiểm BE đã định nghĩa và đạt ở CI |

Sau scaffold mới ghi lệnh thực tương ứng vào backbone theo quy tắc dự án. Không dùng `npm test` thành công ở một app rỗng làm bằng chứng hoàn thành IAM.

## 6. Production và quan sát

Production dùng Ubuntu Server >24, exact release chờ D10. Kiểm bản OS, Docker Engine, kiến trúc CPU, registry và digest khi thực hiện S7-02; không coi một ví dụ Ubuntu trong root planning là OS đã triển khai.

API/worker cùng image digest nhưng command khác nhau. Reverse proxy HTTPS giới hạn mạng trường/VPN; backend vẫn kiểm quyền. Readiness kiểm DB và schema compatibility, liveness chỉ kiểm process; SMTP outage tạo backlog và cảnh báo, không làm API tra cứu restart liên tục. Graceful shutdown ngừng nhận request/claim mới, chờ trong deadline rồi đóng pool.

Theo dõi request rate, error rate, p95 latency, pool usage, slow query, deadlock, outbox queued/failed/oldest age, expired lease và lần job chạy thành công gần nhất. Log structured gồm requestId/jobId, action và error code; không log credential hoặc toàn bộ DTO auth. Không dùng email/cardNumber làm metric label.

Mục tiêu p95 <500 ms ở 20 client, RPO 24 giờ (mức dữ liệu có thể mất) và RTO 4 giờ (thời gian khôi phục) chỉ là dự thảo D08/D10. Muốn gọi là đạt phải có tải, phần cứng, dữ liệu, thời lượng và bằng chứng đo.

## 7. Release và phục hồi

1. Chuẩn bị artifact, versions/digests, API contract diff, migration preview và kết quả test phù hợp.
2. Trên staging, kiểm app cũ/mới tương thích schema khi rollout. Ưu tiên thêm cấu trúc trước rồi bỏ cấu trúc cũ ở release sau.
3. Backup database, files và cách lấy keyring tương ứng; thử restore vào môi trường cô lập và kiểm loan/file liên quan.
4. Trình mục tiêu production cụ thể, cửa sổ, backup và phương án phục hồi để duyệt hành động triển khai.
5. Chạy một runner đã duyệt, deploy artifact, kiểm health và smoke mục tiêu; quan sát lỗi/worker backlog.
6. Khi lỗi, rollback app nếu schema còn tương thích. Schema mất dữ liệu cần restore hoặc migration sửa đã duyệt; không tự chạy down.

Backup DB mà thiếu file hoặc khóa giải mã không bảo đảm phục hồi chức năng. Restore drill phải kiểm count/ràng buộc dữ liệu, mở được file được phép và xử lý outbox còn hạn mà không gửi mail thật ngoài ý muốn.
