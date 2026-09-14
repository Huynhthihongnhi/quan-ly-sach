   XÂY DỰNG HỆ THỐNG THƯ VIỆN TRỰC TUYẾN
Mô tả bài toán
Để phục vụ cho nhu cầu học tập và tra cứu của cán bộ, giảng viên và sinh viên của trường, nhà trường yêu cầu xây dựng một hệ thống thư viện trực tuyến dựa trên mạng nội bộ intranet, hệ thống được truy cập trong phạm vi trường học, giúp độc giả có thể tìm kiếm các loại sách, báo, tạp chí,… Đối với tài liệu điện tử thì độc giả có thể đọc trực tuyến hoặc tải về, đối với sách trong thư viện thì độc giả có thể đăng ký mượn. Ngoài ra, độc giả cũng có thể yêu cầu mua các loại tài liệu điện tử. 
Hệ thống giúp cho các thủ thư có thể quản lý thông tin mượn và trả sách của độc giả, hệ thống còn có tính năng thông báo nhắc nhở đến hạn trả sách bằng email, tạo báo cáo, thống kê.
Các đối tượng sử dụng tài nguyên của thư viện (giảng viên, sinh viên, nhân viên của trường) đều phải có thẻ thư viện.
Các thành phần 	
Đối với độc giả:
Có thể tìm kiếm tài liệu theo các tiêu chí: loại sách, tên sách, chủ đề, tên tác giả, năm xuất bản,…
Sau khi tìm được tài liệu phù hợp:
Nếu là sách điện tử thì độc giả có thể đọc trực tuyến, nếu muốn tải về thì phải nhập Mã thẻ thư viện.
Nếu là sách trong thư viện, hệ thống hiển thị tình trạng số lượng sách còn trong thư viện để độc giả có thể đăng ký mượn, khi đăng ký, độc giả phải nhập Mã thẻ thư viện.
Độc giả có thể đặt mua, để đặt mua thì độc giả phải có tài khoản trong hệ thống và phải đăng nhập tài khoản để đặt mua, nếu chưa có tài khoản thì phải đăng ký tài khoản trước khi đặt mua.
Khi đặt mua, độc giả phải cung cấp các thông tin: tên sách, tác giả, năm xuất bản
Đối với thủ thư:
Thủ thư có thể thực hiện tất cả các thao tác như một độc giả, ngoài ra thủ thư phải có tài khoản trong hệ thống để thực hiện các chức năng quản lý, sau khi đăng nhập vào hệ thống, thủ thư có thể:
Quản lý thông tin mượn sách, trả sách trong thư viện của các độc giả.
Xem tình trạng của những tài liệu đang được mượn bởi độc giả nào, tình trạng mượn quá hạn, hoặc những thông tin khác liên quan đến một quyển sách cụ thể.
Cập nhật danh mục sách, bao gồm sách trong thư viện và sách điện tử.
Chấp nhận hoặc từ chối yêu cầu đặt mua. 
Hệ thống:
Hệ thống có chức năng gửi mail tự động đến các độc giả trước hạn trả sách 3 ngày, thông báo thời hạn trả sách.
Giai đoạn phân tích (Analysis)
Mục đích của việc phân tích là để hiểu rõ được vấn đề và bắt đầu phát triển một mô hình trực quan về hệ thống đang xây dựng, chuyển những yêu cầu chức năng vào khái niệm phần mềm
Phân tích yêu cầu
Xác định yêu cầu chức năng của hệ thống
Hệ thống giúp độc giả có thể tìm kiếm, đọc trực tuyến, tải, đăng ký mượn, hoặc đặt mua.
Hệ thống giúp thủ thư có thể quản lý thông tin mượn hoặc trả sách của độc giả, quản lý thông tin sách trong thư viện, cập nhật danh mục sách, trả lời yêu cầu đặt mua sách.
Hệ thống có chức năng gửi mail tự động nhắc độc giả đến hạn trả sách.
Xây dựng bảng thuật ngữ của hệ thống
Độc giả: bao gồm giảng viên, các cán bộ nhân viên và sinh viên của trường.
Thủ thư: Người quản lý thư viện và hệ thống thư viện online
Thẻ thư viện: Mỗi độc giả muốn sử dụng hoặc tra cứu tài liệu trên hệ thống thư viện online thì bắt buộc phải có thẻ thư viện.
Sách trong thư viện: sách bản hardcopy, được chứa trong thư viện, danh mục sách được lưu trong hệ thống. Số lượng sách, đầu sách trong thư viện thường xuyên được cập nhật.
Sách điện tử: sách được lưu dưới dạng tập tin và được sao chép hợp pháp.
Mô hình hóa yêu cầu chức năng sử dụng use case model
Xác định các Actor 
Actor chính: Độc giả và thủ thư
Actor phụ: hệ thống thanh toán
Xác định các use case
UC1: Tìm kiếm
UC2: Đọc trực tuyến
UC3: Download tài liệu 
UC4: Đăng ký mượn sách
UC5: Nhập mã thẻ
UC6: Đặt mua
UC7: Đăng nhập
UC8: Tạo tài khoản
UC9: Quản lý mượn sách /trả sách
UC10: Cập nhật danh mục sách
UC11: Trả lời yêu cầu đặt mua sách
UC12: Gửi mail thông báo đến hạn trả sách
Use case model

Đặc tả use case : mô tả chi tiết các bước thực hiện của từng use case
Use case: Tìm kiếm tài liệu

Mẫu đặc tả use case
Tên use case: Tìm kiếm tài liệu
Actor: Độc giả, thủ thư
Mô tả: Use case thực hiện việc tìm kiếm tài liệu theo một trong các tiêu chí: tựa sách, tên tácc giả, năm xuất bản, hoặc tìm theo từ khóa.
Tiền điều kiện (Precondition): Không
Hậu điều kiện (Postcondition): Nếu tìm kiếm thành công thì người dùng có thể thực hiện các thao tác tiếp theo: đọc, tải, đăng ký mượn hoặc đặt mua.
Luồng sự kiện chính (Basic flow)
Actor
Hệ thống
Tại giao diện chính của hệ thống, người dùng chọn loại tài liệu cần tìm
Hệ thống hiển thị form nhập thông tin của loại tài liệu cần tìm
Người dùng nhập một hoặc tất cả các tiêu chí : tựa sách, tên tác giả, năm xuất bản hoặc từ khóa và click nút tìm kiếm
Nếu có, hệ thống hiển thị danh sách các sách trong form kết quả.
Luồng sự kiện thay thế (Alternate flow)
Người dùng chọn lại chức năng tìm kiếm để tìm tài liệu khác, lặp lại bước 1 đến 4
Người dùng kết thúc việc tìm kiếm
4.1 Nếu không tìm thấy tài liệu theo yêu cầu thì hệ thống hiển thị thông báo không có tài liệu theo yêu cầu

Từ đặc tả có thể biểu diễn bằng Activity diagram

Use case: Mượn sách


Tên use case: Đăng ký mượn sách
Actor: Độc giả, thủ thư
Mô tả: Use case thực hiện việc đăng ký mượn sách, sau khi tìm kiếm có kết quả, người dùng có thể đăng ký mượn sách. Để thực hiện mượn sách, hệ thống yêu cầu nhập Mã thẻ và Password. Nếu nhập thành công thì hệ thống xuất phiếu mượn sách.
Precondition: Phải nhập Mã thẻ thư viện và Password
Postcondition: Nếu đăng ký mượn sách thành công thì, hệ thống sẽ cập nhật thông tin mượn sách, cập nhất số sách còn lại.
Basic flow
Actor
Hệ thống
Tại form kết quả tìm kiếm của hệ thống, người dùng click nút Đăng ký mượn sách
Hệ thống hiển thị form yêu cầu nhập Mã thẻ, Password và thời hạn mượn.
Người dùng nhập Mã thẻ thư viện, Password và số ngày mượn tối đa 15 ngày. 
Hệ thống kiểm tra Mã thẻ, Password và số ngày mượn<=15
Nếu thông tin chính xác thì hệ thống xuất phiếu mượn sách
Người dùng xác nhận thông tin mượn sách.
Hệ thống in phiếu mượn sách.
Alternate flow
Người dùng nhập lại thông tin


4.1 Nếu thông tin không chính xác thì hệ thống yêu cầu nhập lại.
4.3 Hệ thống thực hiện lại bước 4, số lần lặp tối đa là 3. Hệ thống sẽ tự động kết thúc việc đăng ký mượn sách.


