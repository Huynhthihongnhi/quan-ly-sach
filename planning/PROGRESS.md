# Tiến độ duy nhất của dự án

Đây là nguồn duy nhất ghi trạng thái task. Sprint docs mô tả phạm vi; TEST_CASES mô tả ca kiểm thử; không duy trì thêm checkbox tiến độ ở các file đó. Chưa có task ứng dụng nào hoàn thành tại thời điểm lập kế hoạch.

## Quy tắc trạng thái

- `ready`: có thể nhận việc; toàn bộ phụ thuộc đã done. Không đồng nghĩa đã được phép deploy hoặc chạy migration trên dữ liệu thật.
- `locked`: chưa thể thực hiện vì phụ thuộc hoặc một quyết định/sự cố. Ghi lý do cụ thể; nếu không còn trở ngại thì chuyển ready.
- `process`: đang làm; bắt buộc có một owner chịu trách nhiệm và evidence đang cập nhật. Tối đa 1 task process cho mỗi owner, 2 task process toàn dự án.
- `done`: tất cả tiêu chí nghiệm thu và test bắt buộc đạt, review xong, có evidence và owner. Tài liệu thiết kế không phải bằng chứng tính năng chạy được.

Luồng thường: locked -> ready -> process -> done. Khi process bị chặn, chuyển locked và ghi bằng chứng/lý do. Khi mở lại done, phải xác định task phụ thuộc bị ảnh hưởng, chuyển chúng về locked và cập nhật evidence. Không tự mở khóa bằng thời gian chờ.

Thứ tự chọn việc: phụ thuộc trước, sau đó P1 trước P2, rồi thứ tự sprint/task. P0 dành cho sự cố đang gây hại thực tế; hiện không có P0. P1 là điều kiện chặn mốc tài khoản/release, P2 là nghiệp vụ quan trọng theo lộ trình, P3 là cải thiện nhỏ, P4 là ý tưởng chưa cam kết. S7 có P1 nhưng vẫn chờ các phụ thuộc trước.

Một owner là tên người hoặc agent cụ thể, không phải tên nhóm. Owner là khóa công việc theo quy ước, không phải khóa hệ điều hành; hai người cần kiểm tra lại file trước khi nhận việc. Chưa có dịch vụ điều phối tự động. Dùng Git review hoặc một người tích hợp để tránh ghi đè.

Evidence phải là đường dẫn tương đối tới file có thật, ví dụ `evidence/S1-02.md`, không dùng `-` cho process/done. File evidence phải ghi Task, Verdict, ngày, phạm vi và kết quả thật; xem [mẫu](EVIDENCE_TEMPLATE.md). Chưa có validator planning được cài trong dự án; hiện đối chiếu cấu trúc/phụ thuộc bằng kiểm tra tài liệu. Kiểm tĩnh không tự xác minh tính trung thực của log.

## Bảng task

| ID | Sprint | Priority | Status | Depends on | Owner | Evidence | Lock reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S0-01 | S0 | P1 | done | - | Cursor agent | planning/evidence/S0-01.md | - |
| S0-02 | S0 | P1 | done | S0-01 | Cursor agent | planning/evidence/S0-02.md | - |
| S0-03 | S0 | P1 | done | S0-02 | Cursor agent | planning/evidence/S0-03.md | - |
| S0-04 | S0 | P1 | done | S0-03 | Cursor agent | planning/evidence/S0-04.md | - |
| S0-05 | S0 | P1 | done | S0-02 | Cursor agent | planning/evidence/S0-05.md | - |
| S0-06 | S0 | P1 | done | S0-03, S0-04 | Cursor agent | planning/evidence/S0-06.md | - |
| S1-01 | S1 | P1 | done | S0-06 | Cursor agent | planning/evidence/S1-01.md | - |
| S1-02 | S1 | P1 | done | S1-01, S0-05 | Cursor agent | planning/evidence/S1-02.md | - |
| S1-03 | S1 | P1 | done | S1-02 | Cursor agent | planning/evidence/S1-03.md | - |
| S1-04 | S1 | P1 | done | S1-03 | Cursor agent | planning/evidence/S1-04.md | - |
| S1-05 | S1 | P1 | done | S1-04 | Cursor agent | planning/evidence/S1-05.md | - |
| S1-06 | S1 | P1 | done | S1-04, S1-05 | Cursor agent | planning/evidence/S1-06.md | - |
| S1-07 | S1 | P1 | done | S1-06 | Cursor agent | planning/evidence/S1-07.md | - |
| S2-01 | S2 | P1 | done | S1-07 | Cursor agent | planning/evidence/S2-01.md | - |
| S2-02 | S2 | P1 | done | S2-01 | Cursor agent | planning/evidence/S2-02.md | - |
| S2-03 | S2 | P1 | done | S2-02 | Cursor agent | planning/evidence/S2-03.md | - |
| S2-04 | S2 | P1 | done | S1-07 | Cursor agent | planning/evidence/S2-04.md | - |
| S2-05 | S2 | P1 | done | S2-03, S2-04 | Cursor agent | planning/evidence/S2-05.md | - |
| S2-06 | S2 | P1 | done | S2-05 | Cursor agent | planning/evidence/S2-06.md | - |
| S3-01 | S3 | P2 | done | S2-06 | Cursor agent | planning/evidence/S3-01.md | - |
| S3-02 | S3 | P2 | done | S3-01 | Cursor agent | planning/evidence/S3-02.md | - |
| S3-03 | S3 | P2 | done | S3-02 | Cursor agent | planning/evidence/S3-03.md | - |
| S3-04 | S3 | P2 | done | S3-03 | Cursor agent | planning/evidence/S3-04.md | - |
| S3-05 | S3 | P2 | done | S3-03 | Cursor agent | planning/evidence/S3-05.md | - |
| S3-06 | S3 | P2 | done | S3-04, S3-05 | Cursor agent | planning/evidence/S3-06.md | - |
| S4-01 | S4 | P2 | done | S2-06 | Cursor agent | planning/evidence/S4-01.md | - |
| S4-02 | S4 | P2 | done | S3-06 | Cursor agent | planning/evidence/S4-02.md | - |
| S4-03 | S4 | P2 | done | S4-01, S4-02 | Cursor agent | planning/evidence/S4-03.md | - |
| S4-04 | S4 | P2 | done | S4-03 | Cursor agent | planning/evidence/S4-04.md | - |
| S4-05 | S4 | P2 | done | S4-04 | Cursor agent | planning/evidence/S4-05.md | - |
| S5-01 | S5 | P2 | done | S3-06, S4-01 | Cursor agent | planning/evidence/S5-01.md | - |
| S5-02 | S5 | P2 | done | S5-01 | Cursor agent | planning/evidence/S5-02.md | - |
| S5-03 | S5 | P2 | ready | S5-02 | - | - | - |
| S5-04 | S5 | P2 | locked | S5-03, S2-01 | - | - | Chờ phụ thuộc |
| S5-05 | S5 | P2 | locked | S5-03 | - | - | Chờ phụ thuộc |
| S5-06 | S5 | P2 | locked | S5-04, S5-05 | - | - | Chờ phụ thuộc |
| S5-07 | S5 | P2 | locked | S5-06 | - | - | Chờ phụ thuộc |
| S6-01 | S6 | P2 | locked | S2-06 | - | - | Chờ phụ thuộc |
| S6-02 | S6 | P2 | locked | S6-01, S1-05 | - | - | Chờ phụ thuộc |
| S6-03 | S6 | P2 | locked | S6-02 | - | - | Chờ phụ thuộc |
| S6-04 | S6 | P2 | locked | S5-07, S6-02 | - | - | Chờ phụ thuộc |
| S6-05 | S6 | P2 | locked | S6-03, S6-04 | - | - | Chờ phụ thuộc |
| S7-01 | S7 | P1 | locked | S6-05, S4-05 | - | - | Chờ phụ thuộc |
| S7-02 | S7 | P1 | locked | S7-01 | - | - | Chờ phụ thuộc |
| S7-03 | S7 | P1 | locked | S7-02 | - | - | Chờ phụ thuộc |
| S7-04 | S7 | P2 | locked | S7-03 | - | - | Chờ phụ thuộc |
| S7-05 | S7 | P1 | locked | S7-03 | - | - | Chờ phụ thuộc |
| S7-06 | S7 | P1 | locked | S7-04, S7-05 | - | - | Chờ phụ thuộc |

## Nhật ký thay đổi tiến độ

- 2026-09-14: S5-02 done (POST /loans reservation, idempotency, re-auth rate limit, concurrency 6/6 TST-S5-02, validate pass). S5-03 ready.
- 2026-09-14: S5-01 done (migration 000009 circulation, integration 8/8 TST-S5-01, validate pass). S5-02 ready.
- 2026-09-14: S4-05 done (digital rights matrix, acceptance 5/5 TST-S4-05, CMS disclaimer test). Sprint S4 hoàn thành.
- 2026-09-14: S4-04 done (CMS document viewer + download UX, component 5/5 TST-S4-04, CMS validate 31/31). S4-05 ready.
- 2026-09-14: S4-03 done (digital upload/read/download APIs, security 6/6 TST-S4-03, validate pass). S4-04 ready.
- 2026-09-14: S4-02 done (digital_assets migration 000008, integration 5/5 TST-S4-02, public catalog regression). S4-03 ready.
- 2026-09-14: S4-01 done (library cards migration 000007, security 6/6 TST-S4-01, CMS profile cards). S4-02 ready; S5-01 ready.
- 2026-09-14: S3-06 done (acceptance API 4/4 TST-S3-06, CMS 3/3, IAM acceptance 24/24 regression). Sprint S3 hoàn thành.
- 2026-09-14: S3-05 done (batch list hydration, performance 5/5 TST-S3-05, fixture 10048 books, validate pass). S3-06 chuyển ready.
- 2026-09-14: S3-04 done (CMS public catalog + manage list, component 6/6 TST-S3-04, CMS validate 22/22). S3-05 vẫn ready; S3-06 chờ S3-05.
- 2026-09-14: S3-03 done (public GET /books, /categories, /authors, /topics, contract 7/7 TST-S3-03). S3-04 và S3-05 chuyển ready.
- 2026-09-14: S3-02 done (CMS catalog admin API, security 6/6 TST-S3-02, full security 32/32). S3-03 chuyển ready.
- 2026-09-13: S3-01 done (catalog schema migration 000006, entities/repository, integration 6/6 TST-S3-01, full integration 64/64). S3-02 chuyển ready.
- 2026-09-13: S2-06 done (account milestone acceptance 4/4 TST-S2-06, S1/S2 regression pass). S3-01 chuyển ready. Sprint S2 hoàn thành.
- 2026-09-13: S2-05 done (CMS forgot/reset/activate/profile pages, component tests 8/8 TST-S2-05). S2-06 chuyển ready.
- 2026-09-13: S2-04 done (profile ownership/allowlist/permission security 6/6 TST-S2-04). S2-05 chuyển ready.
- 2026-09-13: S2-03 done (reset-password/activate 204, atomic challenge consumption, session revoke, security 6/6 TST-S2-03). S2-04 vẫn ready; S2-05 chờ S2-04.
- 2026-09-13: S2-02 done (forgot-password 202 uniform, activation invite, rate limit, link origin, security 6/6 TST-S2-02). S2-03 chuyển ready.
- 2026-09-13: S2-01 done (challenge/outbox migration 000005, encrypted outbox worker, security 8/8 TST-S2-01). S2-02 chuyển ready.
- 2026-09-13: S1-07 done (IAM acceptance matrix 25/25, guard countercheck fails when bypassed, migration roundtrip, integration 58/58). S2-01 và S2-04 chuyển ready.
- 2026-09-13: S1-06 done (CMS login/users/roles, component tests 6/6 TST-S1-06). S1-07 chuyển ready.
- 2026-09-13: S1-05 done (audit query API, IAM integration review, concurrency last-admin, runbook, integration 5/5 TST-S1-05). S1-06 chuyển ready.
- 2026-09-13: S1-04 done (roles/permissions/user-roles API, IAM policy on role changes, integration 7/7 TST-S1-04). S1-05 chuyển ready.
- 2026-09-13: S1-03 done (users API list/create/status/profile, IAM policy on block/archive, integration 7/7 TST-S1-03). S1-04 chuyển ready.
- 2026-09-13: S1-02 done (auth migration 000004, login/session/logout/CSRF/rate limit, integration 6/6 TST-S1-02). S1-03 chuyển ready.
- 2026-09-13: S1-01 done (IAM migration 000003, identity/access/audit/bootstrap, integration 9/9). S1-02 chuyển ready.
- 2026-09-13: S0-06 done (migration runner, schema_migrations, CLI db:*, integration 9/9). S1-01 chuyển ready.
- 2026-09-11: S0-04 done (test harness, ORM probe, integration 15/15, concurrency 1/1). S0-06 chuyển ready.
- 2026-09-11: S0-05 done (HTTP contract, guards, error envelope, contract test 12/12, OpenAPI export). S1-02 vẫn locked theo S1-01.
- 2026-09-11: S0-03 done (Docker local MySQL 8.4.5 + Mailpit, integration test pass, health ready). S0-04 chuyển ready.
- 2026-09-11: S0-01 done (D01-D05 chốt, D06-D10 có owner/hạn); S0-02 done (scaffold BE, build/test/lint pass). S0-03 và S0-05 chuyển ready.
- 2026-09-11: tạo baseline kế hoạch; S0-01 ready, các task còn lại locked theo phụ thuộc. Không có process/done. Việc viết bộ planning không được tính là hoàn thành task triển khai.
