# Chiến lược kiểm thử BE

Task này chỉ kiểm tài liệu. Kế hoạch dưới đây dành cho ứng dụng sau scaffold và giữ yêu cầu TDD của [backbone](../../backbone.yml). Các nhóm test gốc xem [TEST_CASES](../../planning/TEST_CASES.md) và [TASK_TEST_MAP](../../planning/TASK_TEST_MAP.md).

## 1. Chu trình TDD cho một hành vi

1. Chọn một tiêu chí từ task đang thực hiện. Viết test thể hiện hành vi người dùng hoặc invariant database.
2. Chạy test và lưu kết quả RED. Lỗi phải vì hành vi chưa có/sai, không chỉ vì dependency chưa cài hoặc DB chưa bật.
3. Viết phần mã nhỏ nhất để đạt test; chạy lại và lưu GREEN.
4. Refactor cấu trúc khi test đạt; chạy hồi quy module bị ảnh hưởng và contract liên quan.
5. Ghi command thật, versions, môi trường, kết quả đã lọc vào evidence. Chỉ đổi task done khi đủ tiêu chí của task gốc, bao gồm FE/CMS nếu đó là task tích hợp.

Tài liệu thuần túy không cần tạo test RED giả. Scaffold dùng kiểm build/config; concurrency và security cần oracle độc lập với việc chỉ gọi hàm rồi so chính đầu ra hàm đó.

## 2. Lớp kiểm thử

| Lớp | Kiểm gì | Môi trường |
| --- | --- | --- |
| Unit | Policy chuyển trạng thái, hạn mượn, normalize, mapping, thời gian | Clock/adapter giả; không network |
| Integration | Repository, FK, unique, CHECK, transaction, HTTP với guard thật | MySQL cùng dòng production, schema từ migration |
| Contract | DTO allowlist, JSON shape, status, headers, route policy, OpenAPI | Nest test app; auth và lỗi có ca tích hợp thật |
| Concurrency | Hai hành động chồng thời gian, rollback và retry | Ít nhất hai connection riêng, barrier điều khiển |
| Worker | Claim/reclaim, lease cũ, expiry, gửi lặp, downtime | MySQL + fake clock + mail sandbox/fake adapter |
| Performance | Query plan, p95 và worker lag | Dataset/tải/thời lượng đã chốt, không chạy mặc định |
| Acceptance | Luồng tài khoản hoặc thư viện hoàn chỉnh | API và FE/CMS phối hợp theo task gốc |

Không thay MySQL bằng SQLite cho test ràng buộc hoặc tranh chấp. Không dùng memory mutex để làm test copy cuối cùng đạt. Mock mail/file boundary là hợp lý cho unit; integration phải có ít nhất ca kiểm adapter thật trong local sandbox.

### Phạm vi kiểm chứng ORM theo thứ tự task

| Task | Proof bắt buộc | Phần chưa yêu cầu |
| --- | --- | --- |
| S0-02 | Dependency/module format build được; config tắt synchronize/migrationsRun; API/worker dùng cùng cấu hình data source | Chưa đòi fixture domain hoặc runner hoàn chỉnh |
| S0-04 | MySQL test cô lập với bảng probe SQL tường minh; BIGINT ở read/insert result/raw/entity; DATETIME(6) round-trip; BINARY(32); generated columns chỉ đọc; transaction manager chung; version conflict | Chưa gọi migration ứng dụng của S1-S6 |
| S0-06 | Runner thực; startup ORM không đổi schema/history; schema sau migration giữ PK/FK/CHECK/unique/generated columns theo SQL | Không tự tạo tất cả bảng tương lai |
| S1-01 và task schema sau | Fixture module bằng migrations đã tích hợp; rollback thực qua repository/audit; mapping bảng nối giữ trường riêng | Không dùng synchronize để bù file migration còn thiếu |

Các probe S0-04 chỉ chạy trên DB test riêng. Chèn lỗi sau write thứ nhất và assert từ connection khác rằng cả hai write đều rollback. Ca version dùng hai bản sửa cùng version và kiểm chỉ một commit; chỉ thấy version tự tăng từ decorator là chưa đạt. Unit/HTTP framework test của S0 không giả là login thật đã hoàn thành; auth integration với guard thật thuộc S1-02 trở đi.

## 3. Bộ fixture

Factory tạo dữ liệu có thứ tự FK và theo module đã tích hợp: policy row, permission/roles, users/profiles, assignments; rồi catalog/cards/loans/purchases khi đủ bảng. Bootstrap giải quyết assigned_by NOT NULL theo [access control](05-access-control.md). Dữ liệu fixture deterministic; credential test được tạo/băm riêng và không tái dùng production.

Chọn bộ dữ liệu kiểm được bằng tay: hai reader A/B, hai admin, một librarian, user invited/blocked/archived; thẻ active/suspended/expired/revoked; một book có bản cuối, một book có nhiều tác giả/chủ đề; loan đủ lifecycle; cùng tên tiếng Việt có/không dấu. Thêm ID/version lớn hơn Number.MAX_SAFE_INTEGER để bắt lỗi precision.

Mỗi test suite có database được phép riêng hoặc cách reset fixture được giới hạn rõ. Concurrency test cần commit thật để các connection thấy nhau; transaction bao quanh toàn test không thay được isolation giữa request. Cleanup dữ liệu giữ đúng FK và chỉ chạy trên DB test đã xác minh.

## 4. Ma trận hành vi bắt buộc

| Nhóm | Ca cần chứng minh | Test gốc |
| --- | --- | --- |
| Nền tảng | Config thiếu fail; health DB sai; BIGINT string; unknown field; route thiếu policy bị từ chối | TST-S0-02 đến TST-S0-05 |
| Migration | Pair thiếu, checksum đổi, version nhảy, hai runner, crash sau câu DDL đầu, history failed/running | TST-S0-06 |
| Identity | Email normalization unique; profile atomic; FK actor; code permission không hợp lệ | TST-S1-01, TST-S1-03, TST-S1-04 |
| Session | Login sai/blocked/invited; fixation; expiry biên; revoke; CSRF trước/sau login; reload lấy CSRF | TST-S1-02 |
| Quyền | Gỡ role tác động phiên hiện có; reader A không đọc B; unknown permission; mass assignment | TST-S1-03, TST-S1-04 |
| Admin cuối | Hai admin cùng tự/gỡ lẫn nhau; block cạnh revoke; không có policy row; bootstrap đồng thời | TST-S1-05 |
| Outbox | Enqueue rollback; hai worker claim; lease cũ finalize; restart; provider nhận nhưng mất ACK | TST-S2-01 |
| Forgot/reset | Phản hồi không dò email; token một lần/hết hạn/sai purpose; reset cùng lúc; rollback không đổi password nửa chừng | TST-S2-02, TST-S2-03 |
| Profile | Chỉ field cho phép; ownership; version cũ | TST-S2-04 |
| Catalog | Guest không login/thẻ; draft không lộ; lọc AND; escape wildcard; không trùng book do join; ISBN NULL | TST-S3-01 đến TST-S3-03 |
| Search | Tiếng Việt, case/accent, EXPLAIN, N+1 và p95 trên fixture đã chốt | TST-S3-05 |
| Card | A biết mã B vẫn không dùng; now=expires_at bị từ chối; thẻ quá giờ active không chặn cấp lại hợp lệ | TST-S4-01 |
| Digital | Giả MIME, quá cỡ, traversal, quarantine; direct ID/Range phải qua quyền; scan cạnh archive; file/DB lỗi lệch | TST-S4-02, TST-S4-03 |
| Reservation | 0/16 ngày lỗi, 1/15 hợp lệ; hai user bản cuối; cùng key, khác payload; replay sau hết copy | TST-S5-01, TST-S5-02 |
| Circulation | Checkout cạnh expire; return cạnh lost; hai return; revoke card cạnh checkout; user blocked vẫn được trả | TST-S5-03, TST-S5-06 |
| Reminder | Local date/UTC biên ngày; loan ngắn; downtime; due snapshot; return trước gửi; dedupe | TST-S5-04 |
| Purchase | Không cần book có sẵn; chỉ own; key trùng; hai reviewer; self-review; reason trắng | TST-S6-01, TST-S6-02 |
| Reports | Fixture tính tay, UTC range, event join không nhân bản, CSV formula, quyền export | TST-S6-04 |
| Vận hành | DB/mail outage, backup + files + keyring, partial DDL recovery, smoke release | TST-S7-01 đến TST-S7-06 |

Các ca chi tiết mới trong BE bổ sung tiêu chí cho task tương ứng, chưa sửa TEST_CASES gốc hoặc ghi PASS cho ứng dụng.

## 5. Oracle cho tranh chấp

**Bản cuối:** fixture có đúng một serviceable copy và không có active loan. Hai request đi qua barrier sau bước đọc ứng viên trên hai connection. Sau commit, query SQL độc lập phải thấy đúng một loan active cho copy, đúng một event reserved của loan mới, số available bằng 0. User thua không có bản ghi nửa chừng.

**Reset đồng thời:** hai request dùng cùng challenge, một thành công; DB có consumed_at, một lần đổi credential hợp lệ, phiên cũ không dùng được. Nếu chèn lỗi trước commit, password/challenge/session đều phải về trạng thái trước transaction.

**Admin cuối:** sau hai mutation chạy chồng, ít nhất một active admin còn đủ tập quyền thiết yếu. Test đếm từ DB, không dựa vào button CMS bị ẩn.

**Lost cạnh return:** chỉ một transition cuối, một event tương ứng; copy lost không có mặt trong available. Không chỉ assert status HTTP mà bỏ kiểm condition_state.

## 6. Lệnh và evidence

Lệnh **hiện có**, chạy từ root: `node .vibekit/scripts/validate-kit.mjs .`. Đây là validator bộ kit.

Lệnh **dự kiến** trong BE: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run test:contract`, `npm run test:concurrency`, `npm run build`. S0-02/S0-04 phải tạo scripts, thử fail/pass và ghi command thật; hiện chưa có package để chạy.

Evidence theo [mẫu gốc](../../planning/EVIDENCE_TEMPLATE.md): task, phạm vi BE, ngày, version, command, RED/GREEN khi TDD, quan sát database, kết quả, giới hạn và reviewer. Không lưu raw token, email thật, screenshot có credential hoặc log chưa lọc.

## 7. Điều kiện bàn giao

Một slice BE chỉ sẵn sàng khi DTO, quyền, logic, persistence, audit, lỗi và test liên quan đều đạt. Không yêu cầu chạy lại mọi suite cho mỗi sửa Markdown. Mở rộng test khi có thay đổi, lỗi hoặc rủi ro chưa giải quyết.

Full e2e, visual loop hoặc performance load cần phạm vi và ngân sách tương ứng theo AGENTS. Tài liệu hiện tại có visual gate 0/6, không chạy e2e. Khi có UI thật, chấm lại gate theo thay đổi thực tế.
