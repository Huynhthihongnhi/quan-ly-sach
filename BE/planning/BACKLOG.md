# Backlog BE chi tiết

Mã Sx-yy trùng task gốc để truy vết. Mỗi mục mô tả **phần BE**; phạm vi giao diện và nghiệm thu toàn task vẫn theo [sprint gốc](../../planning/README.md), phụ thuộc/status theo [PROGRESS](../../planning/PROGRESS.md). Owner dưới đây là vai trò đề xuất; khi nhận việc phải ghi một người cụ thể ở PROGRESS.

Mọi path `src/...`, `test/...`, `tools/...`, `migrations/...` bên dưới được hiểu nằm trong `BE` và chưa tồn tại. Trước tạo file protected như migrations, lockfile hoặc cấu hình secret, phải có quyền phù hợp. Không đánh dấu task done bằng việc hoàn thành mô tả trong backlog này.

## S0: Nền tảng, ưu tiên P1

### S0-01: Chốt nền tảng và đồng bộ thiết kế

- Owner dự kiến: chủ dự án + người phụ trách BE. Input: D01-D05, BE-D01/BE-D02, backbone và schema.
- Thực hiện: ghi nhận ORM đã được duyệt tại D11; xác nhận NestJS, root runtime BE, package manager, module format, MySQL patch và bộ package ORM/test dự kiến. Xác định D06-D10 do ai xử lý và trước task nào. Chuẩn bị diff đồng bộ layout runtime sau khi chốt; các tham chiếu thiếu đã được sửa trong review tài liệu.
- Đầu ra: decision có ngày/người xác nhận/bằng chứng, stack compatibility record, phạm vi scaffold cụ thể. Không coi đề xuất trong BE là decision đã duyệt.
- Nghiệm thu: không còn D01-D05 mơ hồ cho scaffold; D06-D10 có owner/hạn; chưa có cài đặt hoặc migration ngầm.
- Test/evidence: TST-S0-01, review thủ công; không tạo RED giả cho quyết định.

### S0-02: Scaffold backend

- Owner: BE. Phạm vi: package/config TypeScript, `src/main.ts`, `src/app.module.ts`, `src/worker.ts`, `src/worker.module.ts`, config, README local. Git/workspace toàn dự án phối hợp owner dự án.
- Thực hiện: tạo Nest project theo bộ version đã chốt; tạo hai entrypoint; bật strict; lint/typecheck/build; inject config và clock. Chỉ tạo module nền cần cho slice đầu, không generate CRUD cả 27 bảng.
- Nghiệm thu: API và worker build được từ cùng manifest; fail khi config bắt buộc thiếu; không auto migrate; ghi exact command/version vào evidence. Cập nhật lệnh backbone theo quyền và quy trình dự án.
- ORM: khai báo dependency đã chọn và version tường minh; data source/module config có `synchronize: false`, `migrationsRun: false`; S0-04 mới kiểm mapping thực khi DB local đã sẵn sàng. Không đòi runner chưa tồn tại để hoàn tất build S0-02.
- Test: TST-S0-02; build sạch và kiểm static; chứng minh script trả nonzero khi có lỗi TypeScript.

### S0-03: Docker local và dịch vụ phụ trợ

- Owner: người triển khai local/BE. Phạm vi: Compose/Dockerfile được duyệt, hướng dẫn [operations](../docs/07-operations.md).
- Thực hiện: MySQL, mail sandbox, network/volume local-test riêng; tạo quyền runtime khác runner; cấu hình UTC; kết nối API/worker; kiểm cold start và reconnect. Không lấy credential production.
- Nghiệm thu: DB healthy trước API ready; restart không mất dữ liệu volume; mail local kiểm được qua sandbox; phần cứng macOS chạy image đã pin.
- Test: TST-S0-03; integration start/restart có mục tiêu, không full e2e.

### S0-04: Khung test và fixture

- Owner: BE + QA. Phạm vi: `test/{unit,integration,contract,concurrency,fixtures,support}`, cấu hình runner/CI trong scope được duyệt.
- Thực hiện: Nest test app, MySQL cùng dòng production, khung factory dữ liệu, fake clock, ít nhất hai connection cho race; thiết lập script fail-fast. Kiểm ORM bằng bảng probe SQL tường minh trong DB test riêng, không chờ runner S0-06 hoặc fixture ứng dụng S1.
- ORM proof: BIGINT đọc/insert ID/raw/entity không mất precision; DATETIME(6) giữ microsecond; BINARY(32) round-trip; generated columns không bị ghi; rollback cả write/event thử bằng một manager; hai update cùng version chỉ một thành công. Xem [phạm vi kiểm chứng](../docs/08-testing.md#phạm-vi-kiểm-chứng-orm-theo-thứ-tự-task).
- Nghiệm thu: test sai chủ đích thất bại vì assertion, test đúng đạt; DB test khác local; fixture không rò credential; không dùng SQLite thay SQL behaviors.
- Test: TST-S0-04; giữ ví dụ kiểm chứng trong evidence, không để test cố ý sai tồn tại trong nhánh bàn giao.

### S0-05: Hợp đồng HTTP và phân quyền route

- Owner: BE, phối hợp FE/CMS. Phạm vi: common HTTP/errors, DTO, guards, OpenAPI và API client contract.
- Thực hiện: `/api/v1`, error envelope, pagination, ID string, version, allowlist body, public/authenticated/permission metadata; requestId; common headers. Viết một route public và một route protected để chứng minh mặc định từ chối.
- Nghiệm thu: 400/401/403/404/409/422/429 có shape thống nhất; không trả nội bộ; FE/CMS có fixtures. OpenAPI export thực không cần credential production.
- Test: TST-S0-05; contract của [API](../docs/04-api-contract.md), BIGINT lớn và field lạ.

### S0-06: Runner và kế hoạch SQL có version

- Owner: BE/DB. Phạm vi: `tools` cho runner, history contract, SQL trong đường dẫn migrations được duyệt.
- Thực hiện: parser tên/pair/version/checksum, read-only status/preview, một connection giữ lock, history running/applied/failed, chọn version liên tiếp, down bản cao nhất. Tách schema theo [operations](../docs/07-operations.md), không chạy DDL production.
- Nghiệm thu: không có hai nguồn migration ORM/SQL; dry-run không ghi; checksum drift chặn; failed/running cần reconciliation; file có DDL thứ hai lỗi không bị báo rollback toàn bộ thành công.
- ORM proof: sau migration thử, khởi động data source không thêm/sửa bảng hoặc ghi history; đối chiếu PK/FK/CHECK/unique/generated columns với SQL. Nhóm cards và digital tách riêng; cấp số migration theo thứ tự tích hợp thực, không ép purchases chờ circulation bằng số gói cố định.
- Test: TST-S0-06 trên DB test. Test runner đồng thời, mất connection, incomplete pair và checksum đổi. Đưa rate_limit_buckets vào auth nền trước S1-02.

## S1: Tài khoản và quyền, ưu tiên P1

### S1-01: Identity và RBAC data

- Owner: BE. Phạm vi: `modules/identity`, `modules/access`, audit append/policy service, bootstrap command và migration/registry được duyệt.
- Thực hiện: map users/profiles/roles/permissions và bảng nối; normalizer email; DTO mapper; registry quyền; policy row; bootstrap admin một lần và audit append. Giải quyết assigned_by và cơ chế giữ admin cuối trước khi S1-03/S1-04 tạo các endpoint thay đổi quyền. Ghi rõ D02, không tự thêm loại độc giả vào profile.
- Nghiệm thu: create user/profile atomic; unique email chuẩn hóa; role/permission code đúng registry; FK assigned_by hợp lệ; IDs/version không mất precision; không serialize hash.
- Nghiệm thu nền IAM: bootstrap lần hai không đổi credential; policy từ chối mất admin cuối dưới singleton lock; không có password mặc định; entity bảng nối giữ assigned_by/assigned_at; rollback giữ toàn bộ DML/audit nhất quán. Dùng migration thực từ S0-06 cho fixture module.
- Test: TST-S1-01, fixture role trùng, FK lỗi, ID lớn, profile rollback.

### S1-02: Login, session, logout và CSRF

- Owner: BE. Phạm vi: `modules/auth`, guard tích hợp identity/access, rate-limit repository.
- Thực hiện: hash password, session token ngẫu nhiên lưu digest; cookie; auth_version; idle/absolute expiry; Origin/custom header trước login; CSRF phiên và lấy lại sau reload. Rate limit bền vững có ngay khi mở login.
- Nghiệm thu: user invited/blocked không login; cookie production đúng thuộc tính; logout revoke server; request lỗi không lộ account; key/TTL validate; không phục hồi session đã hết hạn bằng cập nhật last_seen.
- Test: TST-S1-02; expired boundary, CSRF sai/mất, login cross-origin, rotation, multi-tab, đổi password trong lúc login.

### S1-03: Quản lý users

- Owner: BE. Phạm vi: identity controller/service/repository, audit dùng chung.
- Thực hiện: list/detail/create invited/status theo quyền; pagination; allowlist; version; archive thay DELETE. Tạo invited chưa gửi mail cho tới S2. Không dùng endpoint user để tự gán admin hoặc đổi password.
- Nghiệm thu: user thường không đọc/sửa user khác; stale version 409; block/archive revoke sessions; audit không có dữ liệu nhạy cảm. Endpoint dùng policy chung đã có ở S1-01 và phải có ca từ chối mất admin cuối trước khi task này done; không chờ S1-05 mới thêm bảo vệ.
- Test: TST-S1-03; mass assignment, ownership, blocked session và rollback.

### S1-04: Vai trò và gán quyền

- Owner: BE. Phạm vi: access module và permission registry.
- Thực hiện: role CRUD có giới hạn, GET permissions, thay role_permissions và user_roles theo tập; kiểm version parent; kiểm actor được phép gán. Sửa quyền có hiệu lực phiên đang mở ở request kế tiếp.
- Nghiệm thu: role hệ thống bất biến theo policy; unknown permission bị từ chối; không tự leo quyền qua DTO; delete role đang dùng trả conflict; mutation và audit atomic.
- Tích hợp policy S1-01 ngay trong endpoint thay roles/permissions; kiểm version parent bằng update có điều kiện hoặc lock + so version, không chỉ `save` làm tăng version tự động.
- Test: TST-S1-04; revoke trong phiên cũ, actor mất quyền khi request đang chờ, trùng assignment và route thiếu policy.

### S1-05: Admin cuối, bootstrap và audit

- Owner: BE/DB. Phạm vi: kiểm tích hợp IAM policy/bootstrap/audit đã có từ S1-01 với toàn bộ endpoint S1-03/S1-04, thêm audit query và runbook.
- Thực hiện: rà đủ đường gọi dùng singleton lock; chạy các cặp gỡ/block/archive/đổi role đồng thời; xác minh bootstrap không có HTTP public; kiểm audit query/filter và mask dữ liệu. Không trì hoãn cơ chế bảo vệ cơ bản đến task này.
- Nghiệm thu: hai thao tác đồng thời không xóa hết admin hợp lệ; thiếu row khóa thì fail closed; bootstrap chỉ một lần; không password mặc định hoặc credential in ra stdout.
- Test: TST-S1-05; race dưới barrier và count DB; fault injection trước commit.

### Bàn giao S1-06 và S1-07

BE cung cấp contract login/me/users/roles/permissions, cookie/CSRF instructions và fixtures 401/403/409/422 cho CMS. S1-06 vẫn là task UI. S1-07 demo với guard và MySQL thật; API-only pass không đủ done nếu CMS chưa đạt. Test gốc: TST-S1-06, TST-S1-07.

## S2: Hoàn tất mốc tài khoản, ưu tiên P1

### S2-01: Challenge, outbox và worker

- Owner: BE. Phạm vi: auth challenge, messaging module, mail/encryption adapters, worker entrypoint.
- Thực hiện: challenge hash; payload mã hóa; enqueue trong tx; claim lease ngắn; retry/reaper; kiểm trạng thái nghiệp vụ trước gửi; xóa ciphertext khi hết nhu cầu.
- Nghiệm thu: không gọi SMTP trong HTTP transaction; hai worker không claim cùng lease; finalize lease cũ bị từ chối; mail có thể trùng sau mất ACK được mô tả đúng; provider/keyring được xác định cho local.
- Test: TST-S2-01; rollback enqueue, lease expiry, restart, ciphertext hỏng, timeout/permanent failure.

### S2-02: Forgot-password và mời kích hoạt

- Owner: BE. Phạm vi: auth public endpoint, admin activation endpoint, template dữ liệu tối thiểu.
- Thực hiện: email normalizer, rate-limit nhiều process, phản hồi 202 chung, URL từ cấu hình; user đủ điều kiện mới có challenge/outbox; resend vô hiệu challenge cũ theo policy đã chốt.
- Nghiệm thu: email tồn tại/không tồn tại không phân biệt qua body/status; queue lỗi không tạo challenge lẻ; template không ghi secret vào log; user mới được đi tới activation ở S2-03.
- Test: TST-S2-02; burst song song, unknown/blocked email, link expiry trước khi worker gửi.

### S2-03: Reset/activation atomic

- Owner: BE. Phạm vi: challenge consumption use cases, session revocation và audit.
- Thực hiện: lock user rồi challenge; kiểm purpose/expiry/email; cập nhật password/consumed/status/auth_version theo luồng; revoke session/challenge liên quan; không tự login.
- Nghiệm thu: token chỉ dùng một lần; hai reset chỉ một thành công; error rollback toàn phần DML; activation không active user bị block giữa chừng.
- Test: TST-S2-03; password cũ/session cũ thất bại; fake clock đúng thời điểm hết hạn.

### S2-04: Profiles

- Owner: BE. Phạm vi: identity profile controllers/use cases.
- Thực hiện: own profile và admin profile, displayName/phone, optimistic version, allowlist. Không mở email/status/role qua profile endpoint.
- Nghiệm thu: user A không đọc/sửa B; hai update version giống nhau chỉ một ghi; response không rò field nội bộ.
- Test: TST-S2-04, contract own/admin và field cấm.

### Bàn giao S2-05 và S2-06

Giao luồng activation/reset, mã lỗi chung và nguyên tắc xử lý link cho FE/CMS. Demo invited -> active -> login -> forgot -> reset -> login mới; session cũ bị từ chối. S2-06 phải chốt rõ self-registration bật hay chưa. Test: TST-S2-05, TST-S2-06. Đây là mốc kết thúc ưu tiên đợt đầu.

## S3: Danh mục và tra cứu, ưu tiên P2

### S3-01: Catalog data

- Owner: BE/DB. Phạm vi: catalog entities/repositories và migration được duyệt.
- Thực hiện: map categories/authors/topics/books/links/copies; IDs, nullable ISBN; order tác giả; fixture nhiều quan hệ; constraint/version mapping.
- Nghiệm thu: một book nhiều tác giả/chủ đề và bản sách hoạt động đúng; FK lỗi không tạo metadata nửa chừng; không bắt ISBN với tạp chí.
- Test: TST-S3-01, fixture ISBN NULL/trùng, order và barcode unique.

### S3-02: CMS catalog/copies

- Owner: BE. Phạm vi: admin catalog endpoints và audit.
- Thực hiện: metadata CRUD, taxonomy allowed operations, publish/archive, thêm/sửa copy; version/expectedName. S3 chỉ dùng bảng catalog đã có; S5-01 nối kiểm loan vào copy mutation trước khi S5-02 mở reservation.
- Nghiệm thu: không công bố thiếu dữ liệu; reader không sửa; archive không phá return của loan đã có; field state qua endpoint metadata bị từ chối.
- Test: TST-S3-02 và stale version trên schema S3; condition change cạnh loan là kiểm hồi quy bắt buộc khi tích hợp S5-01.

### S3-03: Public query

- Owner: BE, thống nhất semantics với FE. Phạm vi: public catalog controller, query repository và mapper.
- Thực hiện: published-only, q/title/author/category/topic/year, AND, escape wildcard, pagination/order ổn định, taxonomy công khai từ sách đã xuất bản.
- Phân kỳ contract: S3 trả availableCopies null, digitalAssets rỗng và không query/eager-load loans/digital_assets chưa có; FE chưa mở thao tác mượn. S4-02 nối metadata file, S5-01 nối tồn khả dụng thật. Sau khi module đã được bật, lỗi DB không được fallback để che lỗi.
- Nghiệm thu: guest không cookie/thẻ vẫn dùng; 404 cho draft/archived; count và kết quả không nhân đôi từ join; không lộ borrower/storage key.
- Test: TST-S3-03, không dấu/có dấu, hoa thường, filter tổ hợp, empty và Unicode.

### S3-05: Query plan và tải tra cứu

- Owner: BE/DB. Phạm vi: query plan, fixture benchmark; index nếu được duyệt.
- Thực hiện: chốt D08, tạo dataset tổng hợp đại diện tối thiểu 10000 đầu sách; đo baseline rồi kiểm EXPLAIN, N+1 và p95; chỉ tối ưu có bằng chứng.
- Nghiệm thu: report ghi hardware/MySQL/dataset/tải/thời lượng, không dùng mục tiêu làm số đo; mọi đổi semantics có test hồi quy.
- Test: TST-S3-05; chạy theo ngân sách được chốt, không chạy load mặc định từ task tài liệu.

### Bàn giao S3-04 và S3-06

Giao contract filters/query URL và availability snapshot cho FE; CMS có draft/published/archive. Demo guest với trình duyệt chưa login. Test: TST-S3-04, TST-S3-06; trạng thái tích hợp theo PROGRESS.

## S4: Thẻ và tài liệu điện tử, ưu tiên P2

### S4-01: Thẻ thư viện

- Owner: BE. Phạm vi: cards module.
- Thực hiện: list own/admin, cấp, suspend/revoke/expire/re-enable theo state machine; lock user trước thẻ; xử lý thẻ hết giờ nhưng còn active; actor do server lấy.
- Nghiệm thu: một active card/user; biết mã người khác không tự liên kết được; thẻ hết giờ bị từ chối không phụ thuộc scheduler; trả sách không bị chặn bởi thẻ hết hạn.
- Test: TST-S4-01, issue song song, boundary expiry và rollback cấp lại.

### S4-02: Digital metadata

- Owner: BE/DB. Phạm vi: digital assets mapping, file store interface và metadata repository.
- Thực hiện: storage key server, hash/byte_size, MIME, rightsNote, state/read_access; file riêng database; compare-and-set cho state vì chưa có version.
- Tích hợp catalog: bổ sung digitalAssets an toàn vào response book sau khi migration digital đã có; public chỉ nhận metadata được phép, không eager-load storage_key. Kiểm hồi quy public catalog và schema tối thiểu trước/sau S4.
- Nghiệm thu: size >0, key unique; không có URL vật lý public trong DTO; ready không tự đặt từ request upload.
- Test: TST-S4-02, duplicate key, file mất, book FK lỗi.

### S4-03: Upload/read/download

- Owner: BE + vận hành file. Phạm vi: digital controllers, private store adapter, kiểm file và stream.
- Thực hiện: chốt D06/scanner, validate size/MIME/content, quarantine; scan -> ready/rejected; read/download/Range qua guard; đối soát file/DB; hạn stream.
- Nghiệm thu: quyền kiểm mỗi request, A không dùng thẻ B; direct URL không bypass; scan không làm asset archived sống lại; template file độc hại không đưa ready khi chưa kiểm.
- Test: TST-S4-03, traversal, spoofed MIME, interrupted upload, range, DB/storage outage.

### Bàn giao S4-04 và S4-05

FE nhận mã lỗi login/card/file state và URL API đọc có quyền; CMS nhận trạng thái quarantine. Chốt với thủ thư quyền đọc/tải và rightsNote; ghi giới hạn sao chép nội dung đã xem. Test: TST-S4-04, TST-S4-05.

## S5: Mượn/trả và nhắc hạn, ưu tiên P2

### S5-01: Loan model và invariant

- Owner: BE/DB. Phạm vi: circulation entities/policies, migration được duyệt.
- Thực hiện: loans/events, composite card ownership FK, active_copy unique; state machine; requestedDays 1..15; dueAt khi checkout; reservation TTL theo D07.
- Tích hợp catalog trước reservation: thay availableCopies null bằng query tồn thật, nối kiểm active loan vào copy condition mutation; cấu hình release yêu cầu schema circulation đã có và readiness fail khi thiếu. S5-02 không được mở nếu chưa đạt các kiểm này.
- Nghiệm thu: không hai loan active/copy; event cùng transaction; không có overdue enum; condition lost không vào available.
- Test: TST-S5-01; direct SQL kiểm FK/CHECK/generated unique, unit state transitions.

### S5-02: Reservation và phiếu

- Owner: BE. Phạm vi: reserve use case, availability query và receipt DTO.
- Thực hiện: session/permission, idempotency trước kiểm tồn, re-auth và giới hạn 3 lần sai, khóa user/card/copy theo quy ước; kiểm cap; tạo reserved/events/audit.
- Nghiệm thu: cùng key không tạo thêm; khác hash 409; hai người giành bản cuối tối đa một thành công; phiếu không có password; replay trả resource hiện tại đúng actor.
- Hoàn thành expire use case và job giải phóng reservation hết hạn ngay trong task này. S5-03 tái dùng cùng use case khi kiểm race với checkout; không mở giữ chỗ mà phải chờ task sau mới có đường hết hạn.
- Test: TST-S5-02, barrier nhiều connection, mất response sau commit, 0/1/15/16 ngày.

### S5-03: Checkout, return, cancel, lost và expire

- Owner: BE. Phạm vi: transition use cases, scheduler expiry, query lịch sử.
- Thực hiện: role/ownership/version; dueAt server tính; events/audit; copy condition; expire theo cùng service và lock order; retry deadlock có giới hạn.
- Nghiệm thu: checkout sau hết giữ chỗ lỗi; return/lost cho phép đóng loan user bị block; duplicate return không tăng tồn; terminal state không bị mở lại.
- Test: TST-S5-03, checkout-expire và return-lost song song; fault injection rollback.

### S5-04: Reminder và overdue

- Owner: BE. Phạm vi: reminder scheduler, notification_deliveries, outbox integration.
- Thực hiện: chốt D07 mốc local/loan ngắn; scan bắt kịp; khóa/revalidate; dedupe loan/due/kind; kiểm lại trước gửi; overdue derive từ state + dueAt.
- Nghiệm thu: restart không tạo reminder logic trùng; due timestamp không mất microsecond; return trước kiểm gửi được cancel; race sau kiểm SMTP được mô tả giới hạn.
- Test: TST-S5-04, fake clock biên ngày, downtime nhiều lượt, mail mất ACK.

### S5-06: Kiểm tranh chấp và phục hồi

- Owner: BE + QA. Phạm vi: `test/concurrency`, fault injection support và evidence.
- Thực hiện: chọn race thật dưới barrier; hai connection trở lên; đo retry/deadline; assert DB bằng query độc lập; không che lỗi bằng sleep tuần tự.
- Nghiệm thu: admin revoke/card revoke/checkout, copy cuối, cùng key, cap user, expire/checkout, return/lost đều bảo toàn invariant; rollback không để event mồ côi hoặc state nửa chừng.
- Test: TST-S5-06 và nhóm TST-S5-02/TST-S5-03 bị ảnh hưởng.

### Bàn giao S5-05 và S5-07

Giao FE phiếu JSON, request key và xử lý conflict; CMS nhận danh sách ai đang mượn/quá hạn cùng quyền transition. In phiếu thuộc UI, không có binary report engine bắt buộc. Demo đủ search -> giữ -> nhận -> nhắc -> trả. Test: TST-S5-05, TST-S5-07.

## S6: Yêu cầu mua và báo cáo, ưu tiên P2

### S6-01: Submit/query yêu cầu mua

- Owner: BE. Phạm vi: purchases data, endpoint cá nhân và events.
- Thực hiện: chốt D09; title/authorText/year độc lập books, requester từ session, request key/hash; pending và event atomic; own query.
- Nghiệm thu: guest không gửi, user A không đọc B; request chưa có sách trong catalog hợp lệ; cùng key không thêm yêu cầu.
- Test: TST-S6-01, field cấm, year boundary và replay.

### S6-02: Duyệt/từ chối

- Owner: BE. Phạm vi: review use case, CMS queue và audit.
- Thực hiện: lock requester/actor và request theo quy ước, kiểm pending/version/permission, cấm self-review, lý do reject bắt buộc; update/events atomic.
- Nghiệm thu: hai reviewer chỉ một quyết định; reviewer từ actor; không sinh payment hoặc catalog entry khi approved.
- Test: TST-S6-02, reject reason trắng, stale version, concurrent approve/reject.

### S6-04: Báo cáo và CSV

- Owner: BE/DB. Phạm vi: reports query/DTO/export.
- Thực hiện: định nghĩa đầu sách/bản vật lý/lượt theo [business flows](../docs/06-business-flows.md); ngày local chuyển UTC; filter/limit; permission và CSV protection.
- Nghiệm thu: count khớp fixture tính tay; không nhân loan do events join; không xuất dữ liệu cá nhân ngoài scope; không quảng bá báo cáo tồn quá khứ chưa có lịch sử nguồn.
- Test: TST-S6-04, date boundaries, formulas trong cell, permission và max range.

### Bàn giao S6-03 và S6-05

Giao CMS queue/review/version conflict, FE form và lịch sử cá nhân. Đối chiếu UC6/UC11 và báo cáo; nêu payment/self-registration còn ngoài scope theo decision. Test: TST-S6-03, TST-S6-05.

## S7: Kiểm chứng và vận hành

### S7-01: Rà soát bảo mật ứng dụng, P1

- Owner: người review + BE. Phạm vi: route matrix, auth, quyền, file, audit và cấu hình runtime.
- Thực hiện: threat model theo code thực; kiểm direct API bypass UI, mass assignment, ownership, CSRF, SSRF/path file, secret redaction; sửa điểm đã xác minh.
- Nghiệm thu: findings có evidence/priority, đã xử lý lỗi chặn release; ghi coverage gap thay vì khẳng định an toàn tuyệt đối.
- Test: TST-S7-01; dùng security review skill phù hợp tại lúc review mã, không suy ra từ tài liệu này rằng scanner đã chạy.

### S7-02: Staging và cấu hình production, P1

- Owner: vận hành + BE. Phạm vi: OS/Docker/image/proxy/network/config được duyệt.
- Thực hiện: chốt D10, pin digests, secret injection, DB private, API/worker riêng, graceful shutdown, health và metrics.
- Nghiệm thu: staging tương đương mục tiêu, cookie HTTPS đúng, intranet hạn chế truy cập; không có mail sandbox trong release.
- Test: TST-S7-02; read-only configuration check và smoke môi trường được phép.

### S7-03: Migration upgrade và restore, P1

- Owner: DB/vận hành. Phạm vi: runbook và sandbox restore đã duyệt.
- Thực hiện: backup DB/files/keyring, thử restore, migration preview, partial DDL failure/reconciliation; kiểm compatibility old/new app.
- Nghiệm thu: restore thật mở được file và dữ liệu đúng; history khớp schema; không tự down trên production; RPO/RTO có số đo nếu được chốt.
- Test: TST-S7-03; bằng chứng command/target đã lọc dữ liệu nhạy cảm.

### S7-04: Đo tải và lỗi phụ thuộc, P2

- Owner: BE/vận hành. Phạm vi: tải được giới hạn và monitoring.
- Thực hiện: D08/D10 xác định hardware/dataset/concurrency/duration; đo read/login/checkout/backlog; thử DB/mail outage có thời hạn và recovery.
- Nghiệm thu: kết quả gắn workload, retry không bùng tải, backlog được xử lý lại; không gọi benchmark chưa chạy là SLA đạt.
- Test: TST-S7-04; chỉ chạy sau khi chốt ngân sách/tải và môi trường.

### S7-05: UAT tích hợp, P1

- Owner: chủ dự án/QA + FE/CMS/BE. Phạm vi: release candidate và persona test.
- Thực hiện: guest, reader, librarian, admin qua các UC; đối chiếu bugs còn mở, quyền và thông điệp lỗi. Chấm gate trước full e2e/visual loop theo AGENTS.
- Nghiệm thu: người dùng xác nhận phạm vi, ghi hạn chế/deferred rõ; không bỏ qua quyền API vì UI đã ổn.
- Test: TST-S7-05; không tự chạy full e2e từ kế hoạch này.

### S7-06: Release và bàn giao, P1

- Owner: người được phép deploy + BE/vận hành. Phạm vi: artifact, migration plan, backup và target deployment cụ thể.
- Thực hiện: chuẩn bị bằng chứng từ task trước, checklist smoke/rollback, rồi xin duyệt hành động deploy cuối; chạy đúng target và quan sát health/errors/jobs.
- Nghiệm thu: phiên bản triển khai khớp artifact đã kiểm; smoke đạt; runbook và kênh bàn giao admin an toàn; không có credential trong docs.
- Test: TST-S7-06; lưu release receipt và giới hạn kiểm chứng.

## Điều kiện review chung cho từng PR BE

PR mô tả trigger và kết quả quan sát, API/schema ảnh hưởng, test thật và giới hạn. Review kiểm đúng permission/ownership, transaction context, nguồn dữ liệu duy nhất, version/idempotency khi cần, audit đã lọc, lỗi ổn định và lệnh validate phù hợp. Phạm vi review tương xứng thay đổi; không mở rộng thành cải tổ framework khi đang giao một slice nhỏ.
