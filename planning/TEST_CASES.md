# Kiểm thử theo task

Đây là các ca kiểm thử dự kiến, chưa phải kết quả đã chạy. Mỗi nhóm ca bên dưới thuộc một task có cùng mã sprint. Cách chạy, dữ liệu và gate BE xem [chiến lược kiểm thử BE](../BE/docs/08-testing.md); FE/CMS theo các nhóm component/acceptance tương ứng. Trạng thái thực hiện chỉ lưu ở [PROGRESS.md](PROGRESS.md).

Mỗi gạch đầu dòng là một assertion cần được triển khai thành test hoặc bước nghiệm thu có bằng chứng. Các ca database/concurrency/security phải dùng đúng lớp kiểm tra, không thay bằng snapshot giao diện.

## TST-S0-01

Task: [S0-01](sprints/s0.md#s0-01)

Lớp: `manual`. Chuẩn bị: Đọc PRD và từng quyết định D01-D10 với chủ dự án.

Kết quả cần kiểm chứng:

- Không còn D01-D05 chưa chốt trước khi tạo nền tảng.
- Một thay đổi stack phải chỉ ra task, API, schema, test bị ảnh hưởng.
- Các quyết định nghiệp vụ giai đoạn sau có người phụ trách và hạn chốt theo task.
- Đề xuất chưa được xác nhận không được ghi là quyết định đã duyệt.
- D11 giữ xác nhận dùng ORM; không hỏi lại hướng đã đồng ý và không suy ra framework/phiên bản đã được duyệt theo.

## TST-S0-02

Task: [S0-02](sprints/s0.md#s0-02)

Lớp: `static`. Chuẩn bị: Checkout sạch hoặc thư mục thử nghiệm, không có biến môi trường bí mật.

Kết quả cần kiểm chứng:

- FE và BE typecheck/build độc lập.
- Thiếu cấu hình bắt buộc gây lỗi rõ ràng và không in giá trị nhạy cảm.
- Lint bắt sai import và unused code đã cài làm đối chứng.
- Git ignore bỏ qua secrets, output và dữ liệu local nhưng theo dõi migration đã duyệt.
- Bộ package ORM/module format build được cho API và worker; cấu hình tắt synchronize và migrationsRun. Chưa đòi proof có runner/domain fixture từ task sau.

## TST-S0-03

Task: [S0-03](sprints/s0.md#s0-03)

Lớp: `integration`. Chuẩn bị: Docker Desktop đang hoạt động; cấu hình thử nghiệm riêng.

Kết quả cần kiểm chứng:

- Cold start đưa MySQL healthy trước khi API nhận lưu lượng.
- Restart không làm mất dữ liệu volume.
- DB chậm khởi động dẫn tới retry có giới hạn và lỗi đọc được.
- Mail thử chỉ tới mailbox local, không gửi người thật.
- Stop/start không tự chạy down migration.

## TST-S0-04

Task: [S0-04](sprints/s0.md#s0-04)

Lớp: `integration`. Chuẩn bị: Một test cố ý thất bại và một test đúng; DB test riêng.

Kết quả cần kiểm chứng:

- Test sai trả exit khác 0 và làm job thất bại.
- Hai lần chạy không phụ thuộc thứ tự hoặc dữ liệu trước đó.
- Integration dùng MySQL cùng dòng phiên bản với production, không thay bằng SQLite.
- HTTP test harness có đối chứng allow/deny; auth integration với guard thật được chạy từ S1-02 khi auth tồn tại, không dùng mock luôn cho phép làm bằng chứng chức năng.
- Full e2e chưa được bật tự động khi chưa qua gate.
- Bảng probe SQL cô lập kiểm ORM mà không cần runner S0-06: BIGINT lớn ở insert result/raw/entity, DATETIME(6) giữ microsecond, BINARY(32), generated columns không bị ghi.
- Hai write qua repository dùng chung transaction manager đều rollback khi write sau lỗi; connection khác không thấy dữ liệu một phần.
- Hai update cùng expected version chỉ một thành công; version tự tăng khi save chưa đủ bằng chứng chống ghi đè.

## TST-S0-05

Task: [S0-05](sprints/s0.md#s0-05)

Lớp: `contract`. Chuẩn bị: API mẫu có một route public và một route được bảo vệ.

Kết quả cần kiểm chứng:

- Input lạ và sai kiểu bị từ chối theo contract.
- 401 thiếu phiên, 403 thiếu quyền, 404 tài nguyên không lộ được áp dụng nhất quán.
- Response không có password hash, session digest hoặc trường nội bộ.
- ID BIGINT đi qua JSON dưới dạng chuỗi không mất chính xác.
- Pagination giới hạn 100 phần tử, sort theo allowlist.

## TST-S0-06

Task: [S0-06](sprints/s0.md#s0-06)

Lớp: `database`. Chuẩn bị: DB thử trống; cặp migration hợp lệ, thiếu down, checksum sửa và DDL lỗi ở câu thứ hai.

Kết quả cần kiểm chứng:

- Up lần đầu ghi đúng version/checksum; lần sau không chạy lặp.
- Hai runner đồng thời chỉ một runner thay đổi schema.
- List/dry-run không tạo bảng hoặc ghi history.
- Thiếu phiên bản trước, checksum lệch và target không hợp lệ đều thất bại.
- DDL câu đầu thành công rồi câu hai lỗi để lại failed và chặn phiên bản tiếp theo.
- Down có dữ liệu cần xác nhận; không giả định transaction khôi phục được DDL.
- Sau migration, khởi động ORM không sửa bảng/history; PK/FK/CHECK/unique/generated columns khớp SQL, không sinh junction table hoặc deleted_at ngoài thiết kế.
- Cards/digital là nhóm độc lập; purchases không có phụ thuộc dữ liệu vào circulation. File SQL thực được cấp version liên tiếp theo thứ tự tích hợp, không bỏ qua version để khớp số sprint.

## TST-S1-01

Task: [S1-01](sprints/s1.md#s1-01)

Lớp: `database`. Chuẩn bị: Fixtures admin, librarian, reader A/B và tài khoản blocked.

Kết quả cần kiểm chứng:

- Email khác hoa/thường theo chính sách chuẩn hóa không tạo trùng.
- Gán cùng role/permission hai lần không tạo bản ghi trùng.
- FK từ chối user/role/permission không tồn tại.
- Mỗi user có tối đa một profile.
- Create user ghi profile cùng transaction; fault injection không để user thiếu profile. Bảng nối ORM giữ assigned_by/assigned_at và không tự cascade xóa user/role.
- Policy row và bootstrap một lần tạo admin đúng FK; lần hai không đổi credential, thiếu row khóa thì từ chối. Policy service chặn mất admin cuối trước khi các endpoint mutation được triển khai.
- Xóa role đang được gán phải bị chặn hoặc gỡ bằng luồng có audit.

## TST-S1-02

Task: [S1-02](sprints/s1.md#s1-02)

Lớp: `security`. Chuẩn bị: User active có mật khẩu băm; blocked/invited; đồng hồ giả.

Kết quả cần kiểm chứng:

- Mật khẩu đúng tạo session mới; sai, blocked hoặc invited bị từ chối với thông báo chung.
- Session cũ không tái dùng sau logout hoặc hết idle/absolute TTL.
- Thiếu/sai CSRF và origin không được phép bị từ chối trên POST/PATCH/DELETE.
- Cookie production có Secure, HttpOnly và SameSite đã chốt.
- Login rate limit hoạt động theo tài khoản và nguồn, không lộ email tồn tại.

## TST-S1-03

Task: [S1-03](sprints/s1.md#s1-03)

Lớp: `security`. Chuẩn bị: Admin có users.write, reader A/B và session đang hoạt động.

Kết quả cần kiểm chứng:

- Reader không tạo/chặn user và không đọc danh sách riêng tư.
- Gửi is_admin hoặc role trong payload tạo user không nâng quyền.
- Chặn/archive user làm session hiện có mất hiệu lực ngay lần gọi tiếp theo.
- Thay email đi qua quy trình xác minh hoặc bị loại khỏi patch v1.
- Danh sách phân trang ổn định và không trả credential.
- Block/archive admin cuối bị từ chối bởi policy nền S1-01 ngay ở task này; không chờ S1-05 mới có kiểm.

## TST-S1-04

Task: [S1-04](sprints/s1.md#s1-04)

Lớp: `security`. Chuẩn bị: Các phiên admin/librarian/reader; role chỉ có một permission.

Kết quả cần kiểm chứng:

- Ma trận quyền trong [API BE](../BE/docs/04-api-contract.md) được kiểm tra từng route.
- Role bị gỡ làm request tiếp theo bị từ chối.
- User có nhiều vai trò nhận hợp quyền nhưng không vượt ownership.
- Unknown permission hoặc route chưa cấu hình phải fail closed.
- Reader A thay ID thành reader B không xem/sửa được hồ sơ riêng.
- Gỡ vai trò admin cuối qua endpoint bị chặn; hai sửa cùng version không ghi đè. Tập role/permission và audit rollback chung khi lỗi.

## TST-S1-05

Task: [S1-05](sprints/s1.md#s1-05)

Lớp: `security`. Chuẩn bị: DB thử chưa có admin; sau đó tạo hai admin và hai request revoke đồng thời.

Kết quả cần kiểm chứng:

- Bootstrap lần hai không thay mật khẩu hoặc tự thêm admin.
- Hai request đồng thời không làm mất tất cả admin hoạt động.
- Tự hạ quyền/chặn admin cuối cùng bị từ chối.
- Audit có actor và request ID nhưng không chứa password/session/reset token.
- Runtime DB user không sửa/xóa audit qua API thông thường.

## TST-S1-06

Task: [S1-06](sprints/s1.md#s1-06)

Lớp: `component`. Chuẩn bị: Fixtures HTTP 200/401/403/409/422/500 và mạng chậm.

Kết quả cần kiểm chứng:

- Login thành công điều hướng đúng; hết phiên trở về login giữ đường dẫn nội bộ an toàn.
- Reader không thấy chức năng admin; gọi trực tiếp URL vẫn được xử lý 403.
- Form giữ dữ liệu khi lỗi mạng, không gửi lặp khi đang submit.
- Bàn phím truy cập label, focus và thông báo lỗi.
- Sửa role đồng thời báo conflict thay vì ghi đè im lặng.

## TST-S1-07

Task: [S1-07](sprints/s1.md#s1-07)

Lớp: `acceptance`. Chuẩn bị: MySQL test, seed riêng và guard thật.

Kết quả cần kiểm chứng:

- Admin làm được tác vụ được cấp; librarian/reader bị từ chối đúng phạm vi.
- Bỏ guard trong đối chứng khiến test thất bại.
- Log và response không chứa bí mật trong cả nhánh lỗi.
- Migration IAM up/down/up được thử trên DB có fixture phù hợp.
- Ghi evidence có lệnh, exit code và phạm vi đã kiểm tra.

## TST-S2-01

Task: [S2-01](sprints/s2.md#s2-01)

Lớp: `security`. Chuẩn bị: Email sandbox, fake clock, khóa test và worker bị dừng.

Kết quả cần kiểm chứng:

- Database/log không lưu token dạng rõ; ciphertext chỉ giải mã ở worker.
- Rate limit theo email hash và nguồn hoạt động khi chạy nhiều API instance.
- Worker crash/retry không phát sinh challenge mới hoặc gửi vô hạn.
- Claim outbox có lease và reclaim sau timeout.
- Payload nhạy cảm được xóa sau thành công hoặc expiry, không bị lưu vô hạn.

## TST-S2-02

Task: [S2-02](sprints/s2.md#s2-02)

Lớp: `security`. Chuẩn bị: Email tồn tại/không tồn tại/blocked; nhiều request đồng thời.

Kết quả cần kiểm chứng:

- Các trường hợp email nhận cùng status/body chung, xử lý bất đồng bộ hạn chế khác biệt thời gian.
- Request vượt hạn mức bị giới hạn không gửi thêm email.
- Host giả không thay domain trong email.
- Token activation không dùng cho reset và ngược lại.
- Tạo challenge mới vô hiệu challenge cũ theo cùng purpose trong transaction.

## TST-S2-03

Task: [S2-03](sprints/s2.md#s2-03)

Lớp: `security`. Chuẩn bị: Token đúng/sai/đã dùng/hết hạn; hai yêu cầu dùng cùng token.

Kết quả cần kiểm chứng:

- Chỉ một trong hai request đồng thời thành công; request còn lại bị từ chối.
- Token sai purpose, hết hạn đúng biên hoặc đã dùng không đổi mật khẩu.
- Mật khẩu cũ và toàn bộ session cũ mất hiệu lực sau commit.
- Mật khẩu mới không hợp chính sách không tiêu thụ token.
- Lỗi ghi DB không để password đổi nhưng token còn dùng được.

## TST-S2-04

Task: [S2-04](sprints/s2.md#s2-04)

Lớp: `security`. Chuẩn bị: Reader A/B, librarian và admin có/không có profiles.read.

Kết quả cần kiểm chứng:

- A chỉ sửa được hồ sơ của A; thay user_id không sửa B.
- Gửi email, role, password_hash hoặc status trong profile bị từ chối.
- Chuỗi quá dài, rỗng và HTML được xử lý theo contract.
- Admin xem/sửa hồ sơ chỉ khi có quyền tương ứng, lưu audit.
- Version cũ dẫn tới conflict để tránh mất cập nhật.

## TST-S2-05

Task: [S2-05](sprints/s2.md#s2-05)

Lớp: `component`. Chuẩn bị: Token valid/expired/reused; phản hồi mạng chậm.

Kết quả cần kiểm chứng:

- Email không tồn tại không có thông báo riêng.
- Reset mismatch và chính sách password lỗi hiển thị tại trường.
- Submit hai lần không tạo hai thay đổi.
- Sau reset không tự xác thực; login lại bằng password mới.
- URL điều hướng do client cung cấp không cho redirect ra ngoài.

## TST-S2-06

Task: [S2-06](sprints/s2.md#s2-06)

Lớp: `acceptance`. Chuẩn bị: Admin, librarian, reader A/B; mailbox local và MySQL thật.

Kết quả cần kiểm chứng:

- Admin mời user, user kích hoạt, login, sửa profile và logout thành công.
- Quên/reset qua mailbox local có kiểm tra token một lần và hết hạn.
- Role đổi hoặc user bị chặn có hiệu lực với session đã mở.
- Mọi test bắt buộc S1/S2 đạt; không còn lỗi P0/P1 trong mốc này.
- Chủ dự án xác nhận phạm vi đợt đầu, lưu evidence nghiệm thu.

## TST-S3-01

Task: [S3-01](sprints/s3.md#s3-01)

Lớp: `database`. Chuẩn bị: Sách hai tác giả, hai chủ đề; tạp chí không ISBN; hai copies.

Kết quả cần kiểm chứng:

- FK và bảng nối không nhận trùng quan hệ.
- Barcode của bản vật lý unique.
- Year ngoài phạm vi lưu trữ bị chặn; quy tắc năm tương lai ở service.
- Archive đầu sách không xóa lịch sử copies. Kiểm giữ lịch sử loans khi schema circulation được nối ở TST-S5-01, không tạo fixture bảng tương lai chỉ để test S3 đạt.
- Không dùng tổng số lượng nhập tay làm nguồn tồn kho thứ hai.

## TST-S3-02

Task: [S3-02](sprints/s3.md#s3-02)

Lớp: `security`. Chuẩn bị: Librarian có catalog.write, reader và đầu sách draft.

Kết quả cần kiểm chứng:

- Librarian tạo/sửa/công bố được, reader không được.
- Unknown ID và duplicate ISBN/barcode có lỗi rõ ràng.
- Payload không tùy ý set số sách đang mượn.
- Optimistic version chặn ghi đè giữa hai thủ thư.
- Audit ghi publish/archive và thay đổi copy.

## TST-S3-03

Task: [S3-03](sprints/s3.md#s3-03)

Lớp: `contract`. Chuẩn bị: Bộ dữ liệu tiếng Việt có/không dấu, draft và archived.

Kết quả cần kiểm chứng:

- Không cookie vẫn lấy danh sách, chi tiết và filters.
- Draft/archived không xuất hiện ở list, count, facets hoặc detail.
- Tổ hợp filter, không có kết quả, trang cuối và sort tie hoạt động ổn định.
- Payload SQL injection chỉ được xử lý như dữ liệu.
- %, _, dấu nháy và q quá dài xử lý theo contract, không làm lỗi DB.
- Trên schema tối thiểu S3 chưa có loans/digital_assets, query vẫn chạy; availableCopies null, digitalAssets rỗng, không có eager relation đòi bảng tương lai. FE chỉ mở thao tác mượn ở milestone tương ứng.

## TST-S3-04

Task: [S3-04](sprints/s3.md#s3-04)

Lớp: `component`. Chuẩn bị: HTTP stub trả kết quả khác nhau và đảo thứ tự response.

Kết quả cần kiểm chứng:

- Khách không bị redirect login khi xem/tìm/lọc.
- Reload/back/forward giữ query đã chọn.
- Response cũ tới sau không ghi đè kết quả mới.
- Reset filters đưa về page đầu; không mất thông báo lỗi mạng.
- Keyboard dùng được search/select/pagination; kiểm tra visual theo gate khi thực hiện.

## TST-S3-05

Task: [S3-05](sprints/s3.md#s3-05)

Lớp: `performance`. Chuẩn bị: MySQL đúng phiên bản, warm-up, tải đọc 20 client theo ngân sách đã chốt.

Kết quả cần kiểm chứng:

- Ghi baseline/p95/error rate và cấu hình máy, không công bố SLA khi chưa chốt.
- Page size lớn bị giới hạn.
- Số truy vấn không tăng theo số tác giả của từng sách.
- Tìm contains chậm được ghi nhận và đánh giá trước khi đổi sang FULLTEXT.
- Index phục vụ filter được chứng minh bằng EXPLAIN.

## TST-S3-06

Task: [S3-06](sprints/s3.md#s3-06)

Lớp: `acceptance`. Chuẩn bị: Trình duyệt chưa login, reader và librarian.

Kết quả cần kiểm chứng:

- Khách tìm theo tên/tác giả/chủ đề/năm và mở chi tiết đúng.
- Librarian công bố sách làm public thấy; archive làm public không thấy.
- Kết quả không lộ dữ liệu người mượn hoặc tài khoản.
- Các mốc IAM S1/S2 vẫn đạt sau thay đổi catalog.
- Lưu kết quả và giới hạn tìm kiếm đã chấp nhận.

## TST-S4-01

Task: [S4-01](sprints/s4.md#s4-01)

Lớp: `security`. Chuẩn bị: Reader A/B; thẻ active, expired, suspended, revoked.

Kết quả cần kiểm chứng:

- Mã thẻ unique và không tự chứng minh danh tính.
- A không dùng thẻ B dù biết mã.
- Thẻ tới đúng expires_at bị từ chối.
- Cấp lại thẻ thu hồi thẻ cũ trong transaction.
- Khách tra cứu không bị yêu cầu có thẻ.

## TST-S4-02

Task: [S4-02](sprints/s4.md#s4-02)

Lớp: `database`. Chuẩn bị: Metadata PDF nhỏ, vượt giới hạn, trùng key và book không tồn tại.

Kết quả cần kiểm chứng:

- Metadata có FK tới book và key unique.
- File chưa ready không được phát nội dung.
- Trạng thái read_access và download_requires_card đúng miền giá trị.
- Không trả storage_key vào API public.
- Xóa metadata không để lại file mồ côi không được theo dõi.
- Sau tích hợp S4-02, public catalog có metadata digital đã lọc và không lộ storage_key; kiểm hồi quy catalog với migration digital được chạy thật.

## TST-S4-03

Task: [S4-03](sprints/s4.md#s4-03)

Lớp: `security`. Chuẩn bị: PDF hợp lệ, file giả MIME, đường dẫn traversal, thẻ A/B.

Kết quả cần kiểm chứng:

- File giả, quá lớn, traversal hoặc chưa ready bị từ chối.
- Book draft không được đọc/tải dù biết asset ID.
- Download cần user và thẻ của chính họ khi policy bật.
- Reader A không tái sử dụng quyền cấp cho B.
- HTTP Range hợp lệ trả phần nội dung; range sai trả 416 theo contract.

## TST-S4-04

Task: [S4-04](sprints/s4.md#s4-04)

Lớp: `component`. Chuẩn bị: PDF ready, lỗi mạng, không có thẻ, thẻ hết hạn.

Kết quả cần kiểm chứng:

- Nút tải thể hiện policy nhưng API vẫn tự kiểm tra.
- Lỗi expired card có hướng dẫn phù hợp.
- Đổi sách dừng tải cũ và giải phóng viewer.
- Reader không thấy chức năng upload CMS.
- Viewer không ghi token vào URL analytics.

## TST-S4-05

Task: [S4-05](sprints/s4.md#s4-05)

Lớp: `acceptance`. Chuẩn bị: Các loại user/card và tài liệu ready/quarantine.

Kết quả cần kiểm chứng:

- Tất cả tổ hợp quyền đọc/tải có kết quả mong đợi được ghi.
- URL trực tiếp không bỏ qua kiểm tra quyền.
- Revoke thẻ có hiệu lực với lần tải mới.
- Catalog public vẫn hoạt động không thẻ.
- Không coi preview frontend là cơ chế chống sao chép.

## TST-S5-01

Task: [S5-01](sprints/s5.md#s5-01)

Lớp: `database`. Chuẩn bị: Hai readers và một copy serviceable.

Kết quả cần kiểm chứng:

- DB chặn hai loan reserved/borrowed cùng copy.
- Loan returned/expired không chiếm active slot.
- FK ghép card_id/user_id chặn thẻ sai chủ ở database; service kiểm thêm hiệu lực thẻ. ORM phải giữ FK ghép, không thay bằng hai FK độc lập.
- requested_days chỉ 1-15; checkout mới có due_at.
- Không xóa cứng copy đã có lịch sử.
- Nối availableCopies thực và kiểm active loan trong copy mutation trước mở S5-02; không đổi condition copy đang được giữ/mượn qua CRUD catalog.
- Thiếu schema khi circulation đã bật làm readiness/request thất bại; không trả số giả. Archive book vẫn giữ lịch sử loan/copy.

## TST-S5-02

Task: [S5-02](sprints/s5.md#s5-02)

Lớp: `concurrency`. Chuẩn bị: Một copy còn trống, hai connections riêng và thẻ hợp lệ.

Kết quả cần kiểm chứng:

- Hai người giữ cùng lúc chỉ một thành công; bên kia nhận 409/no-copy.
- Lặp cùng request key trả cùng phiếu; payload khác cùng key trả 409.
- Thời hạn 0/16 ngày bị từ chối, 1/15 ngày hợp lệ.
- Thẻ sai người, blocked user hoặc xác thực lại quá giới hạn bị từ chối.
- Hết hạn giữ chỗ làm copy có thể được chọn lại đúng một lần.

## TST-S5-03

Task: [S5-03](sprints/s5.md#s5-03)

Lớp: `concurrency`. Chuẩn bị: Loan reserved/borrowed/returned và hai request return.

Kết quả cần kiểm chứng:

- Checkout chỉ khi reservation còn hạn và card còn hợp lệ.
- Return lặp không tăng tồn hai lần và giữ audit một transition.
- Return/mark-lost chạy đồng thời chỉ một transition hợp lệ.
- Cancel sau borrowed bị từ chối, không đổi lịch sử.
- Lỗi giữa transaction không để trạng thái copy và loan lệch nhau.

## TST-S5-04

Task: [S5-04](sprints/s5.md#s5-04)

Lớp: `integration`. Chuẩn bị: Fake clock sát mốc due-3days/due; worker restart và mail timeout.

Kết quả cần kiểm chứng:

- Chỉ loan borrowed đúng cửa sổ được nhắc; returned/lost không gửi mới.
- Hai workers không tạo hai delivery cho cùng mốc.
- Restart bắt kịp reminder còn hợp lệ, không gửi bù sau hạn theo policy.
- Timeout sau khi SMTP nhận có thể trùng email; ghi nhận at-least-once, không tuyên bố exactly-once.
- Quá hạn bắt đầu sau due_at, kiểm thử biên timezone.

## TST-S5-05

Task: [S5-05](sprints/s5.md#s5-05)

Lớp: `component`. Chuẩn bị: Copy hết trong lúc submit, loan của A/B, lỗi printer.

Kết quả cần kiểm chứng:

- Đăng ký hết sách trả thông báo và cập nhật tồn.
- A không xem phiếu B qua sửa URL.
- Double click không tạo hai phiếu.
- Print có mã phiếu, đầu sách, ngày và trạng thái rõ ràng.
- Lỗi in không tạo lại loan hoặc hủy loan thành công.

## TST-S5-06

Task: [S5-06](sprints/s5.md#s5-06)

Lớp: `concurrency`. Chuẩn bị: Nhiều connections thật, copy cuối cùng và fault injection sau write đầu.

Kết quả cần kiểm chứng:

- Reserve/reserve, expire/checkout, return/lost không phá active-copy invariant.
- Card revoke/checkout và user block/reserve dùng cùng thứ tự khóa và có kết quả hợp lệ.
- Deadlock retry có giới hạn, không nhân đôi loan/outbox.
- Process bị dừng không để copy bị giữ vô hạn qua TTL.
- SQL đối chiếu không có trạng thái serviceable nhưng lost loan chưa xử lý copy.

## TST-S5-07

Task: [S5-07](sprints/s5.md#s5-07)

Lớp: `acceptance`. Chuẩn bị: Reader/thủ thư; fake dates 15 ngày và mailbox local.

Kết quả cần kiểm chứng:

- Luồng thường hoàn thành với tồn đúng sau trả.
- Luồng hết sách, thẻ hết hạn, overdue và mất sách có hướng xử lý.
- Reminder trước 3 ngày kiểm bằng thời gian giả, không chờ thực tế.
- Thủ thư tra được ai đang mượn; khách không thấy thông tin đó.
- Các lỗi tồn kho và quyền P0/P1 phải được xử lý trước mốc tiếp theo.

## TST-S6-01

Task: [S6-01](sprints/s6.md#s6-01)

Lớp: `security`. Chuẩn bị: Reader A/B, guest và sách chưa tồn tại trong catalog.

Kết quả cần kiểm chứng:

- Guest nhận 401; reader gửi yêu cầu hợp lệ được.
- Thiếu tên/tác giả/năm bị validation theo chính sách.
- A chỉ xem yêu cầu của mình, không sửa người gửi.
- Lặp key không tạo trùng; payload khác báo conflict.
- Không sinh charge/payment khi gửi yêu cầu.

## TST-S6-02

Task: [S6-02](sprints/s6.md#s6-02)

Lớp: `concurrency`. Chuẩn bị: Hai reviewers, một pending request và reader thường.

Kết quả cần kiểm chứng:

- Reader không tự duyệt.
- Hai reviewer approve/reject đồng thời chỉ một kết quả thắng.
- Duyệt lần hai báo trạng thái hiện tại/conflict, không tạo audit trùng.
- Reject cần lý do hợp lệ.
- Audit và trạng thái cùng commit hoặc cùng rollback.

## TST-S6-03

Task: [S6-03](sprints/s6.md#s6-03)

Lớp: `component`. Chuẩn bị: Pending và request vừa được người khác xử lý.

Kết quả cần kiểm chứng:

- Form gửi đúng dữ liệu, không tạo trùng khi double click.
- Guest được hướng dẫn login với return path nội bộ.
- Reader thấy đúng lịch sử của mình.
- Conflict cập nhật trạng thái mới thay vì báo thành công giả.
- Reason được render dạng text an toàn.

## TST-S6-04

Task: [S6-04](sprints/s6.md#s6-04)

Lớp: `integration`. Chuẩn bị: Fixtures tính tay có returned/borrowed/lost, due biên ngày và request rejected.

Kết quả cần kiểm chứng:

- Tổng report khớp SQL và bảng fixture tính tay.
- Khoảng ngày áp timezone nhất quán, không đếm hai lần.
- Reader không truy cập dữ liệu mượn của toàn trường.
- CSV escape dấu phẩy/newline và vô hiệu hóa ô bắt đầu bằng ký tự công thức.
- Export lớn có giới hạn/streaming và không khóa toàn bộ DB.

## TST-S6-05

Task: [S6-05](sprints/s6.md#s6-05)

Lớp: `acceptance`. Chuẩn bị: Kịch bản độc giả/thủ thư xuyên catalog, loan, purchase, report.

Kết quả cần kiểm chứng:

- Mỗi UC trong phạm vi có task và test evidence.
- Danh sách yêu cầu và báo cáo phản ánh cùng dữ liệu.
- Guest chỉ xem catalog, không vượt quyền qua reports/export.
- Không còn lỗi release-blocking trong phạm vi đã chốt.
- Các phần hoãn được Product xác nhận, không đánh dấu done thay cho deferred.

## TST-S7-01

Task: [S7-01](sprints/s7.md#s7-01)

Lớp: `security`. Chuẩn bị: Ma trận tất cả routes và danh sách assets/config runtime.

Kết quả cần kiểm chứng:

- IDOR, mass assignment, CSRF và SQL injection test không vượt được chính sách.
- Private file không lộ qua reverse proxy/static path.
- Reset/session secrets không xuất hiện trong log, export hoặc error.
- Dependency review ghi rõ version, findings và remediation.
- Mọi P0/P1 thật được khắc phục và kiểm lại trước release.

## TST-S7-02

Task: [S7-02](sprints/s7.md#s7-02)

Lớp: `deployment`. Chuẩn bị: Staging sạch cùng dòng OS/DB với production, secrets test.

Kết quả cần kiểm chứng:

- Chỉ cổng dự kiến truy cập được từ đúng mạng.
- DB không truy cập công khai; TLS/session cookie hoạt động.
- Readiness fail khi DB không dùng được; liveness không loop restart do lỗi tạm.
- Không có secret baked vào image hoặc compose đã commit.
- Restart và đổi cấu hình có hướng dẫn phục hồi, không chạy migration theo mỗi API replica.

## TST-S7-03

Task: [S7-03](sprints/s7.md#s7-03)

Lớp: `recovery`. Chuẩn bị: Dataset staging có loans và assets, backup mã hóa, failure giữa DDL.

Kết quả cần kiểm chứng:

- Restore đọc được dữ liệu và file khớp hash/FK.
- Đo RPO/RTO thực tế so với mục tiêu D10.
- Migration failed chặn release, không tiếp tục bằng bỏ qua history.
- App version cũ tương thích schema mới hoặc có kế hoạch roll-forward đã duyệt.
- Không dùng down phá dữ liệu thay cho restore; diễn tập chỉ trong phạm vi được phép.

## TST-S7-04

Task: [S7-04](sprints/s7.md#s7-04)

Lớp: `performance`. Chuẩn bị: Staging, tải và thời lượng được chốt D08/D10.

Kết quả cần kiểm chứng:

- Ghi p50/p95/p99/error rate và không vượt ngân sách đã duyệt.
- Mail down không làm mất request hoặc gửi vô hạn khi phục hồi.
- DB outage không trả thành công giả khi chưa commit.
- Metrics/log không lộ PII/credentials.
- Không tăng memory/connection không giới hạn qua thời gian đo.

## TST-S7-05

Task: [S7-05](sprints/s7.md#s7-05)

Lớp: `acceptance`. Chuẩn bị: Staging, accounts test, checklist trình duyệt đã chốt D10.

Kết quả cần kiểm chứng:

- Admin/librarian/reader/guest thực hiện được luồng phạm vi của mình.
- Keyboard, focus, lỗi form và layout chính được ghi nhận.
- E2E nếu được duyệt có budget, artifact và kết quả từng luồng.
- Lỗi chặn sử dụng hoặc quyền phải sửa và chạy lại ca liên quan.
- UAT có người nghiệm thu và ngoại lệ bằng văn bản.

## TST-S7-06

Task: [S7-06](sprints/s7.md#s7-06)

Lớp: `deployment`. Chuẩn bị: Release candidate đã nghiệm thu; cửa sổ deploy được duyệt.

Kết quả cần kiểm chứng:

- Chỉ deploy đúng artifact/version được duyệt.
- Smoke health, guest catalog, login, quyền, worker và migration version đạt.
- Tiêu chí rollback/roll-forward và người chịu trách nhiệm có sẵn.
- Bàn giao runbook, bằng chứng restore và các giới hạn đã biết.
- Chỉ đánh dấu release done sau bằng chứng deploy và smoke, không sau khi viết hướng dẫn.
