# Ngữ cảnh dự án Quan-Ly-Sach

## Thuật ngữ

| Thuật ngữ | Ý nghĩa |
| --- | --- |
| Khách | Người chưa đăng nhập, được xem danh sách, tìm kiếm và lọc sách trong phạm vi mạng được phép truy cập. |
| Độc giả | Sinh viên, giảng viên hoặc nhân viên của trường sử dụng thư viện. |
| Thủ thư | Người quản lý tài liệu, mượn/trả và yêu cầu mua theo quyền được cấp. |
| Tài khoản (user) | Danh tính dùng để đăng nhập hệ thống. |
| Hồ sơ (profile) | Thông tin mô tả người dùng; không dùng để lưu mật khẩu. |
| Vai trò (role) | Nhóm quyền gán cho người dùng. |
| Quyền (permission) | Quyền thực hiện thao tác cụ thể; backend kiểm tra trước thao tác được bảo vệ. |
| Thẻ thư viện | Mã định danh độc giả phục vụ mượn và tải tài liệu theo đề bài; không bắt buộc khi tra cứu. |
| Tài liệu | Sách, báo, tạp chí và tài liệu thư viện quản lý. |
| Sách bản in | Sách vật lý tại thư viện, có số lượng và tình trạng mượn/trả. |
| Tài liệu điện tử | Tập tin được phép cung cấp để đọc hoặc tải theo quyền truy cập. |
| Yêu cầu mua | Đề nghị mua tài liệu do độc giả gửi, thủ thư chấp nhận hoặc từ chối; chưa mặc định có thanh toán trực tuyến. |
| CMS | Giao diện quản trị nội dung và nghiệp vụ dành cho người được cấp quyền. |
| RESTful API | Giao diện HTTP để frontend gọi các tài nguyên và chức năng backend. |
| TDD | Viết kiểm thử hành vi thất bại trước, triển khai để kiểm thử đạt, rồi cải thiện cấu trúc. |
| Migration | Thay đổi cấu trúc database có phiên bản; up áp dụng, down hoàn tác theo khả năng của thay đổi. |
| Intranet | Mạng nội bộ của trường, giới hạn phạm vi truy cập hệ thống. |

## Các khu vực chính

- Đề bài gốc: [temp.md](../../temp.md).
- Phạm vi và thứ tự ưu tiên: [PRD.md](PRD.md).
- Quy tắc, đường dẫn và lệnh kiểm tra: [backbone.yml](../../backbone.yml).
- Backend và kiểm thử: `BE/`, NestJS và MySQL. Frontend quản trị và kiểm thử: `CMS/`, Minimal UI/MUI, React và TypeScript. `FE/` cho độc giả chưa scaffold.
- `CMS/` là nguồn frontend quản trị duy nhất. `CMS-old/` đã ngừng sử dụng và được đưa vào thùng rác. Không lấy mã cũ hoặc kết quả test lịch sử làm bằng chứng màn MUI đã nối nghiệp vụ.
- Entry CMS: `src/main.tsx` -> `src/App.tsx` -> `src/routes/sections/`. Phát triển tiếp theo [kiến trúc CMS](../../CMS/docs/architecture.md) và [lộ trình](../../planning/cms-roadmap.md).
- Khởi động: `make dev`, hoặc `make cms` cho frontend; URL `http://localhost:8081/cms/`. Tunnel: `make tunnel-cms`, xem [runbook](../../scripts/README.md).
- Cấu hình agent: `AGENTS.md` dùng chung; `CLAUDE.md` và các thư mục agent đã có.
- Kiểm tra kit: `node .vibekit/scripts/validate-kit.mjs .`. Lệnh này không kiểm thử ứng dụng.

## Quy ước hiện có

- Chưa phát hiện quy ước đặt tên, kiến trúc ứng dụng, tài nguyên dùng chung, bản dịch hoặc định nghĩa sinh tự động.
- Khi tạo cấu trúc ứng dụng, chốt quy ước ở phạm vi frontend/backend phù hợp và cập nhật `backbone.yml`.
- Ưu tiên users, roles, permissions, profiles và xác thực; xem PRD trước khi mở rộng nghiệp vụ.
- Giải thích level 1 (Junior); dùng nhất quán thuật ngữ trong bảng trên.

## Hệ thống ngoài và môi trường

- MySQL cho dữ liệu; dịch vụ email phục vụ đặt lại mật khẩu và nhắc trả, chưa chọn nhà cung cấp.
- Docker Desktop trên macOS cho local; Ubuntu Server > 24 cho production, chưa chốt phiên bản.
- Mẫu SQL ngoài dự án: `/Users/nhine/Downloads/migrations`; chỉ tham khảo cơ chế, không phải nguồn dữ liệu hay phụ thuộc runtime.
- Vị trí secrets chưa thiết lập; không đưa giá trị secrets vào tài liệu hoặc mã nguồn.

## Điểm dễ nhầm

- Khách được tra cứu không cần thẻ theo yêu cầu bổ sung. Các nghiệp vụ cần thẻ hoặc tài khoản phải kiểm tra riêng.
- Mẫu migration dùng PostgreSQL và không lưu lịch sử đã chạy; MySQL cần cú pháp và cơ chế theo dõi phù hợp.
- Down migration có thể mất dữ liệu; file down không thay thế bản sao lưu.
- Script bên trong bộ kit không phải mã backend của ứng dụng.
- Thông tin chưa có mã/Git trong tài liệu init chỉ mô tả thời điểm khởi tạo. Xác minh hiện trạng bằng source và validation hiện tại.
