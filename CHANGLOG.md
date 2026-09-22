# Changelog

Tóm tắt những gì đã **hoàn thành** (trạng thái `done`) trong dự án, theo thời gian. Mỗi dòng là 1 task, viết ngắn gọn theo hướng tính năng/nghiệp vụ cho người đọc nhanh (chủ dự án, thủ thư, thành viên mới) — không lặp lại chi tiết kỹ thuật, số liệu test, hay lịch sử review.

File này **không thay thế**:
- [`planning/PROGRESS.md`](planning/PROGRESS.md) — nguồn duy nhất về trạng thái, phụ thuộc, owner; có nhật ký chi tiết từng lần đổi trạng thái (kể cả process/locked, lỗi phát hiện, countercheck).
- [`planning/evidence/<ID>.md`](planning/evidence/) — bằng chứng kỹ thuật đầy đủ (lệnh đã chạy, kết quả, RED/GREEN) cho từng task.

Muốn biết trạng thái **hiện tại** (kể cả task đang `process`/`locked`), xem `planning/PROGRESS.md`, không xem file này.

## Quy ước cập nhật

- **Khi nào thêm dòng:** ngay khi một task chuyển `done` trong `planning/PROGRESS.md` (cùng lúc với dòng nhật ký ở đó, không để lệch). Task đang `process`/`locked` **không** xuất hiện ở đây cho tới khi done thật — khớp quy tắc "Không ghi done chỉ vì code đã tạo" của `planning/PROGRESS.md`.
- **Định dạng một dòng:**
  ```
  - YYYY-MM-DD **<Task ID>** <mô tả ngắn, hướng tính năng>. ([evidence](planning/evidence/<Task ID>.md))
  ```
- **Nhóm theo Sprint:** heading `## Sprint SN — <trọng tâm>`, sprint mới nhất hoàn thành lên đầu file. Trong một sprint, liệt kê task theo thứ tự tăng dần (đúng thứ tự xây dựng: schema → API → giao diện → nghiệm thu).
- **Nội dung một dòng:** 1 câu, nêu cái gì dùng được cho ai — không liệt kê số ca test, tên file sửa, hay chi tiết lỗi/countercheck (đã có ở evidence). Nếu một task có quyết định (Dxx) đi kèm quan trọng, ghi chú ngắn trong ngoặc.
- **Ai cập nhật:** người/agent hoàn thành task đó, ngay trong cùng lần chuyển done — không dồn cập nhật sau.
- Sprint đang dở (còn task `process`/`locked`) thì heading sprint đó vẫn hiện nhưng chỉ liệt kê các task đã thật sự `done`; không tạo heading cho sprint chưa có task nào done.

## Sprint S7 — Bảo mật, phục hồi, UAT, production

- 2026-09-15 **S7-01** Rà soát bảo mật toàn hệ thống: ma trận quyền cho mọi route API, vá lỗ hổng có thể bật nhầm chế độ bỏ qua xác thực ngoài môi trường test, nâng cấp thư viện vá 2 lỗ hổng bảo mật thật. ([evidence](planning/evidence/S7-01.md))

*(S7-02 đang `process`, chờ máy chủ Ubuntu 24.04 thật để hoàn tất — xem `planning/PROGRESS.md`.)*

## Sprint S6 — Yêu cầu mua, duyệt và báo cáo

- 2026-09-14 **S6-01** Thêm chức năng gửi yêu cầu mua sách mới. ([evidence](planning/evidence/S6-01.md))
- 2026-09-14 **S6-02** Thủ thư/admin duyệt hoặc từ chối yêu cầu mua sách. ([evidence](planning/evidence/S6-02.md))
- 2026-09-14 **S6-03** Giao diện gửi yêu cầu mua, xem lịch sử của tôi, và hàng chờ duyệt cho thủ thư trên CMS. ([evidence](planning/evidence/S6-03.md))
- 2026-09-14 **S6-04** Báo cáo mượn/trả, tồn kho và yêu cầu mua — xem trên dashboard hoặc xuất CSV. ([evidence](planning/evidence/S6-04.md))
- 2026-09-15 **S6-05** Nghiệm thu nghiệp vụ Sprint S6: xác nhận toàn bộ luồng yêu cầu mua và báo cáo khớp đề bài gốc. ([evidence](planning/evidence/S6-05.md))

## Sprint S5 — Mượn/trả, giữ chỗ, quá hạn, nhắc email

- 2026-09-14 **S5-01** Thêm schema mượn/trả sách (circulation). ([evidence](planning/evidence/S5-01.md))
- 2026-09-14 **S5-02** Độc giả đăng ký giữ chỗ mượn sách, chống gửi trùng yêu cầu. ([evidence](planning/evidence/S5-02.md))
- 2026-09-14 **S5-03** Hủy giữ chỗ, nhận sách tại quầy, trả sách, báo mất sách. ([evidence](planning/evidence/S5-03.md))
- 2026-09-14 **S5-04** Tự động nhắc hạn trả sách qua email trước 3 ngày. ([evidence](planning/evidence/S5-04.md))
- 2026-09-14 **S5-05** Giao diện mượn sách, "sách của tôi", và màn quản lý lưu thông cho thủ thư trên CMS. ([evidence](planning/evidence/S5-05.md))
- 2026-09-14 **S5-06** Kiểm chứng dữ liệu mượn/trả không sai lệch khi nhiều người thao tác cùng lúc. ([evidence](planning/evidence/S5-06.md))
- 2026-09-14 **S5-07** Nghiệm thu nghiệp vụ mượn/trả — hoàn thành Sprint S5. ([evidence](planning/evidence/S5-07.md))

## Sprint S4 — Thẻ thư viện, đọc/tải tài liệu

- 2026-09-14 **S4-01** Thêm schema và quản lý thẻ thư viện (thủ thư xác nhận gắn thẻ cho user). ([evidence](planning/evidence/S4-01.md))
- 2026-09-14 **S4-02** Thêm schema tài liệu số (digital assets). ([evidence](planning/evidence/S4-02.md))
- 2026-09-14 **S4-03** Tải lên, đọc và tải xuống tài liệu số (PDF) gắn với sách. ([evidence](planning/evidence/S4-03.md))
- 2026-09-14 **S4-04** Giao diện xem tài liệu số và tải xuống trên CMS. ([evidence](planning/evidence/S4-04.md))
- 2026-09-14 **S4-05** Xác nhận ma trận quyền đọc/tải tài liệu số đúng theo vai trò — hoàn thành Sprint S4. ([evidence](planning/evidence/S4-05.md))

## Sprint S3 — Danh mục, tìm kiếm, filters, giao diện khách

- 2026-09-13 **S3-01** Thêm schema danh mục sách (catalog: sách, danh mục, tác giả, chủ đề). ([evidence](planning/evidence/S3-01.md))
- 2026-09-14 **S3-02** API quản trị danh mục cho CMS (thêm/sửa sách, danh mục, tác giả, chủ đề). ([evidence](planning/evidence/S3-02.md))
- 2026-09-14 **S3-03** API tra cứu công khai sách/danh mục/tác giả/chủ đề, không cần đăng nhập. ([evidence](planning/evidence/S3-03.md))
- 2026-09-14 **S3-04** Giao diện danh mục công khai cho khách và màn quản lý sách trên CMS. ([evidence](planning/evidence/S3-04.md))
- 2026-09-14 **S3-05** Tối ưu hiệu năng danh sách sách cho catalog lớn (đo với 10.000+ đầu sách). ([evidence](planning/evidence/S3-05.md))
- 2026-09-14 **S3-06** Nghiệm thu tra cứu danh mục công khai — hoàn thành Sprint S3. ([evidence](planning/evidence/S3-06.md))

## Sprint S2 — Quên/reset mật khẩu, kích hoạt, profiles

- 2026-09-13 **S2-01** Thêm cơ chế gửi email qua hàng đợi mã hoá (challenge/outbox). ([evidence](planning/evidence/S2-01.md))
- 2026-09-13 **S2-02** Quên mật khẩu và mời kích hoạt tài khoản qua email. ([evidence](planning/evidence/S2-02.md))
- 2026-09-13 **S2-03** Đặt lại mật khẩu và kích hoạt tài khoản bằng link trong email. ([evidence](planning/evidence/S2-03.md))
- 2026-09-13 **S2-04** Kiểm soát quyền sở hữu hồ sơ cá nhân (chỉ tự sửa hồ sơ của mình). ([evidence](planning/evidence/S2-04.md))
- 2026-09-13 **S2-05** Giao diện quên/đặt lại mật khẩu, kích hoạt tài khoản, và hồ sơ cá nhân trên CMS. ([evidence](planning/evidence/S2-05.md))
- 2026-09-13 **S2-06** Nghiệm thu toàn bộ luồng tài khoản — hoàn thành Sprint S2. ([evidence](planning/evidence/S2-06.md))

## Sprint S1 — Users, roles, permissions, login và CMS

- 2026-09-13 **S1-01** Thêm schema IAM (người dùng, vai trò, quyền, audit) và tài khoản admin khởi tạo. ([evidence](planning/evidence/S1-01.md))
- 2026-09-13 **S1-02** Đăng nhập, phiên làm việc (session), đăng xuất, chống CSRF, giới hạn số lần thử. ([evidence](planning/evidence/S1-02.md))
- 2026-09-13 **S1-03** Quản lý người dùng: danh sách, tạo mới (mời), đổi trạng thái, hồ sơ. ([evidence](planning/evidence/S1-03.md))
- 2026-09-13 **S1-04** Quản lý vai trò, quyền, và gán vai trò cho người dùng. ([evidence](planning/evidence/S1-04.md))
- 2026-09-13 **S1-05** Tra cứu nhật ký audit, sổ tay vận hành cơ bản. ([evidence](planning/evidence/S1-05.md))
- 2026-09-13 **S1-06** Giao diện đăng nhập, quản lý người dùng và vai trò trên CMS. ([evidence](planning/evidence/S1-06.md))
- 2026-09-13 **S1-07** Nghiệm thu toàn diện hệ thống quyền (IAM) — hoàn thành Sprint S1. ([evidence](planning/evidence/S1-07.md))

## Sprint S0 — Nền tảng, quyết định kỹ thuật, Docker local, TDD, migrations

- 2026-09-11 **S0-01** Chốt các quyết định kỹ thuật nền tảng (ngôn ngữ, framework, database, cơ chế đăng nhập). ([evidence](planning/evidence/S0-01.md))
- 2026-09-11 **S0-02** Khởi tạo mã nguồn backend NestJS. ([evidence](planning/evidence/S0-02.md))
- 2026-09-11 **S0-03** Dựng môi trường Docker local (MySQL 8.4.5 + Mailpit). ([evidence](planning/evidence/S0-03.md))
- 2026-09-11 **S0-04** Bộ khung kiểm thử tích hợp và concurrency. ([evidence](planning/evidence/S0-04.md))
- 2026-09-11 **S0-05** Chuẩn hoá contract HTTP, guard, và định dạng lỗi dùng chung toàn API. ([evidence](planning/evidence/S0-05.md))
- 2026-09-13 **S0-06** Công cụ chạy migration (CLI `db:status`/`preview`/`up`/`down`) và lịch sử migration. ([evidence](planning/evidence/S0-06.md))
