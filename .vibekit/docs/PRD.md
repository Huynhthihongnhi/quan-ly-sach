# Quan-Ly-Sach - Yêu cầu sản phẩm

## 1. Tổng quan

Thư viện trực tuyến trong mạng nội bộ trường học, phục vụ sinh viên, giảng viên, nhân viên và thủ thư. Độc giả tra cứu tài liệu; thủ thư quản lý thư viện qua CMS (giao diện quản trị nội dung).

Nguồn: [đề bài gốc](../../temp.md) và yêu cầu bổ sung của người dùng trong phiên init. Quyền xem danh sách, tìm kiếm và lọc không cần tài khoản hoặc thẻ thư viện là yêu cầu bổ sung, thay thế điều kiện phải có thẻ để tra cứu trong phần thuật ngữ của đề bài.

## 2. Vấn đề và mục tiêu

- Tập trung việc tra cứu sách, tài liệu điện tử và quản lý mượn/trả.
- Ưu tiên hiện tại: nền tảng tài khoản, vai trò, quyền thao tác, hồ sơ và xác thực.
- Khách trong phạm vi mạng được phép truy cập được xem danh sách, tìm kiếm và lọc khi chưa đăng ký hoặc đăng nhập.

## 3. Người dùng và tình huống sử dụng

- Khách: xem sách, tìm theo từ khóa, tên sách, tác giả; lọc loại tài liệu, chủ đề và năm xuất bản.
- Độc giả: sinh viên, giảng viên, nhân viên; dùng chức năng thư viện theo tài khoản và thẻ thư viện.
- Thủ thư: thực hiện thao tác của độc giả và quản lý danh mục, mượn/trả, yêu cầu mua theo quyền.
- Người quản trị tài khoản: quản lý người dùng, vai trò và quyền; tên vai trò và ma trận quyền cần chốt khi thiết kế.

## 4. Tiêu chí thành công đề xuất

- Kiểm thử chứng minh quản lý users, roles, permissions và profiles đúng quyền; backend từ chối thao tác không được cấp quyền.
- Đăng nhập hoạt động với thông tin hợp lệ; thông tin sai được xử lý rõ ràng.
- Quên mật khẩu và đặt lại mật khẩu dùng bằng chứng xác minh có hạn dùng, chỉ dùng một lần; phản hồi yêu cầu không tiết lộ tài khoản có tồn tại hay không.
- Mật khẩu được lưu bằng hàm băm phù hợp; không ghi mật khẩu hoặc bí mật đặt lại mật khẩu vào log.
- Đến giai đoạn danh mục, khách tìm kiếm và lọc được mà không bị yêu cầu đăng nhập hoặc nhập thẻ.
- Có hướng dẫn khởi động local bằng Docker Desktop và kiểm tra kết quả trên MySQL.
- TDD có bằng chứng kiểm thử thất bại trước triển khai và đạt sau triển khai; chưa có lệnh kiểm thử ứng dụng ở thời điểm init.

## 5. Phạm vi và thứ tự thực hiện

1. Nền tảng ưu tiên: users, roles, permissions, profiles, đăng nhập, quên mật khẩu, đặt lại mật khẩu; chuẩn bị MySQL, RESTful API và môi trường local.
2. Danh mục và tra cứu: giao diện cho khách xem danh sách, tìm kiếm, lọc; CMS quản lý danh mục theo quyền.
3. Nghiệp vụ thư viện: đọc tài liệu điện tử; tải tài liệu và đăng ký mượn theo thẻ; mượn/trả, tồn kho, yêu cầu mua và chấp nhận/từ chối.
4. Báo cáo, thống kê và email tự động nhắc trả trước hạn 3 ngày; triển khai production khi được duyệt.

Theo đề bài, thời hạn mượn tối đa 15 ngày; đặt mua cần tài khoản và đăng nhập. Tự đăng ký tài khoản có thuộc đợt đầu hay không còn cần xác nhận. Yêu cầu nhập mã thẻ và mật khẩu khi mượn, cùng giới hạn 3 lần nhập sai, sẽ được đối chiếu khi thiết kế luồng mượn.

Init chỉ thiết lập tài liệu và quy tắc dự án. Cổng thanh toán chưa có yêu cầu đủ rõ để triển khai. Thứ tự trên là đề xuất, chưa phải lịch cam kết.

## 6. Ràng buộc và giả định

- Frontend quản trị: `CMS/`, React, TypeScript, Minimal UI/MUI theo [D12](../../planning/DECISIONS.md#d12). `CMS-old/` đã ngừng sử dụng; tính năng mới chỉ phát triển trong `CMS/`. Giao diện độc giả `FE/` chưa scaffold; Tailwind/shadcn là đề xuất ban đầu cho phần đó.
- Backend: người dùng ghi `netjs`; tạm hiểu là NestJS. Xác nhận trước khi tạo mã backend. Dùng RESTful API và TDD.
- Database: MySQL. Đề xuất migrations có số phiên bản, cặp `<version>_<name>.up.sql` / `.down.sql`, xem trước, chọn một phiên bản và lưu lịch sử đã chạy.
- Mẫu tại `/Users/nhine/Downloads/migrations` là PostgreSQL và không theo dõi lịch sử migration. Cần chuyển cú pháp và thiết kế cơ chế chạy phù hợp MySQL; không sao chép bảng nghiệp vụ game. Thư mục mẫu ngoài dự án chỉ dùng để tham khảo, không phải phụ thuộc runtime.
- Local: Docker Desktop trên macOS. Production: Ubuntu Server phiên bản > 24, chưa chốt bản cụ thể.
- Đường dẫn mã nguồn, framework backend, package manager, phiên bản công nghệ và công cụ migration chưa được chốt hoặc cài đặt trong init.
- Mức giải thích mặc định: level 1 (Junior), giải thích lý do và thuật ngữ mới bằng tiếng Việt.
- Chưa có yêu cầu cụ thể về thời hạn, ngân sách, quy mô dữ liệu hoặc mục tiêu hiệu năng.

## 7. Hiện trạng

Tại thời điểm init, repo chưa có mã ứng dụng. Cập nhật 2026-09-23: backend ở `BE/`, frontend quản trị ở `CMS/`. Dev và tunnel CMS dùng cổng 8081, đường dẫn `/cms/`. Xem [hướng dẫn chạy](../../scripts/README.md). Validator kit không chứng minh tính năng ứng dụng; chạy thêm validation BE và CMS. Các màn dashboard mẫu chưa phải tính năng nghiệp vụ đã hoàn thành.

## 8. Điểm cần chốt trước phần triển khai liên quan

- Xác nhận `netjs` là NestJS; chốt tổ chức mã nguồn và package manager khi scaffold.
- Chốt phiên bản Ubuntu Server đáp ứng yêu cầu > 24, MySQL và các thư viện.
- Tạo tài khoản do quản trị viên thực hiện hay cho tự đăng ký ngay trong đợt đầu; vai trò, quyền và trường hồ sơ cần có.
- Cách xác minh đặt lại mật khẩu (đường dẫn qua email hay OTP), dịch vụ email và quan hệ giữa tài khoản với thẻ thư viện.
- Giới hạn intranet khi triển khai production và quyền đọc tài liệu điện tử dành cho khách.

Liên quan: [thuật ngữ dự án](CONTEXT.md), [cấu hình dự án](../../backbone.yml).
