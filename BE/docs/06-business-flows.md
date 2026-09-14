# Luồng nghiệp vụ và transaction

Các invariant là điều kiện phải luôn đúng dù hai request chạy đồng thời. SQL bảo vệ một phần bằng FK/unique/CHECK; service chịu trách nhiệm lifecycle, quyền và thời gian. Đọc cùng [data model](03-data-model.md), [API](04-api-contract.md) và [test strategy](08-testing.md).

## 1. Transaction và thứ tự khóa

Use case sở hữu transaction, dùng cùng connection/manager cho mọi ghi và audit. Đề xuất isolation `READ COMMITTED` cho các transaction nghiệp vụ được khóa tường minh; chốt sau ca kiểm thử MySQL ở S0-04/S5-06. Không dùng một SELECT snapshot cũ để quyết định phân bổ copy sau khi chờ khóa.

Quy tắc khi một luồng cần nhiều nhóm: singleton IAM trước nếu cần, users theo ID tăng dần (actor và người mượn), cards, books nếu cần kiểm trạng thái công bố, copies, loans, rồi event/challenge/outbox liên quan. Nhiều hàng trong một nhóm lấy theo ID tăng dần. Nhánh không cần một nhóm có thể bỏ qua nhóm đó, nhưng không lấy ngược khi đang giữ khóa sau.

Đọc ID để lập kế hoạch khóa là được phép, nhưng phải kiểm lại liên kết và trạng thái dưới khóa trước ghi. Scheduler hết hạn dùng cùng service như HTTP, không khóa loan trước rồi quay lại khóa user. Outbox claim chỉ khóa outbox và commit ngay; bước kiểm nghiệp vụ trước gửi là transaction khác theo thứ tự tương ứng.

Deadlock/lock timeout: rollback toàn transaction, giới hạn retry đề xuất tối đa 2 lần, thêm jitter và deadline HTTP. Không retry lỗi validation, quyền, transition hoặc key khác payload. Không lặp SMTP cùng cơ chế retry transaction. [MySQL locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html) giải thích FOR UPDATE và giới hạn của SKIP LOCKED; dùng SKIP LOCKED cho queue, không coi tập hàng bị bỏ qua là tồn kho thật.

## 2. Cấp và kiểm thẻ

Cấp thẻ cần `cards.write`. Khóa user mục tiêu, kiểm tồn tại/trạng thái, khóa thẻ hiện có. Thẻ active đã quá expires_at được chuyển expired trước khi tạo active mới. issuedBy lấy từ actor, issuedAt từ clock server; expiresAt phải lớn hơn issuedAt. Unique active_user_id bảo vệ ca cấp đồng thời.

Thẻ đủ điều kiện khi đúng user, state active và `issued_at <= now < expires_at`. Thẻ revoked không mở lại trong v1; suspended có thể về active nếu thời gian hợp lệ và không có thẻ active khác. Thẻ chỉ hết giờ vẫn bị từ chối ngay cả khi job chưa đổi state. User không tự liên kết thẻ chỉ bằng cách biết cardNumber.

Block user/revoke card chặn mượn mới và checkout. Return/lost vẫn được thủ thư thực hiện cho user đã block/thẻ hết hạn để đóng khoản mượn, không bắt reader khôi phục tài khoản trước trả sách.

## 3. Danh mục và bản sách

Create book ghi metadata và author/topic links cùng transaction. Book mới draft. Khi publish, kiểm đủ title/category và metadata theo D08; không bắt book có copy nếu đó là tài liệu điện tử. Archive ẩn khỏi public/search và chặn mượn mới, nhưng vẫn cho thủ thư xử lý loan đã có.

Copy mặc định serviceable. Khi circulation đã có, sửa condition phải khóa copy và kiểm loan reserved/borrowed; muốn báo mất bản đang mượn phải qua loan lost use case. Không dùng endpoint copy để làm loan biến mất. Trước circulation, release S3 chưa có loan và không truy vấn bảng loans; availableCopies là null. S5-01 phải nối cả query tồn và kiểm loan của copy trước khi S5-02 cho tạo reservation. Checkout/reservation luôn kiểm lại tồn dưới transaction.

## 4. Upload, đọc và tải tài liệu điện tử

1. Thủ thư gửi file và rightsNote. Giới hạn request ở proxy và API; đề xuất PDF <=20 MiB chờ D06.
2. Kiểm MIME thực, kích thước thực và tên file. Sinh storage_key phía server, không nhận path hoặc URL tải file từ người dùng. File lưu ở vùng private/quarantine.
3. Ghi metadata với hash nội dung, byte_size, uploaded_by, state quarantine. Không đổi ready chỉ vì client khai PDF.
4. Bộ kiểm file thực hiện kiểm định dạng/nội dung và quét theo công cụ được chốt ở S4-03. Chưa có scanner thì giữ quarantine; không tuyên bố file an toàn bằng kiểm extension.
5. Chuyển quarantine sang ready/rejected bằng compare-and-set. Nếu archive xảy ra trong lúc scan, worker không được publish lại.
6. Read/download kiểm book published, asset ready và policy mỗi lần, kể cả request Range. Không trả storage_key hoặc URL private dài hạn trong metadata.

V1 đề xuất stream qua API, cho một byte-range hợp lệ để đọc PDF; sai hoặc nhiều range ngoài hỗ trợ trả 416. Giới hạn stream đồng thời, hủy đọc khi client disconnect. Tên download do server sanitize; `Content-Type`, `Content-Disposition`, `X-Content-Type-Options` và cache policy được kiểm ở contract test.

`read_access` public/authenticated/card được schema cho phép nhưng global policy D06 có thể hạn chế public. `download_requires_card=false` chỉ được bật khi sản phẩm cho phép; baseline vẫn true. Được xem nội dung không bảo đảm ngăn sao chép bytes; tài liệu không hứa DRM.

File store và MySQL không có transaction chung. Nếu ghi file xong nhưng DB lỗi, giữ ở quarantine và job đối soát dọn theo thời gian an toàn. Nếu metadata có mà file mất, trả lỗi phụ thuộc, đánh dấu vận hành và đối soát; không tự phục hồi bytes từ hash. Không xóa file trên dữ liệu thật từ task tài liệu này.

## 5. Đăng ký mượn

Một POST loans là yêu cầu giữ một copy của một book. Giữ chỗ 24 giờ và tối đa 5 loan reserved/borrowed mỗi user là đề xuất D07, chưa phải yêu cầu đã duyệt.

1. Kiểm session và permission. Validate request và Idempotency-Key, chuẩn hóa payload.
2. Kiểm loan đã có theo user/key trước khi xét còn sách. Nếu hash khớp, trả resource hiện tại; khác hash trả 409. Bước này cũng được kiểm lại trong transaction sau khóa user.
3. Với yêu cầu mới, kiểm password tài khoản theo D07 và hạn thử chung trên các instance. Không có password riêng trên bảng thẻ trong schema.
4. Mở transaction, khóa user và kiểm lại status/auth_version/digest chưa đổi. Khóa thẻ và kiểm ownership, thời gian; kiểm số loan active dưới user lock.
5. Kiểm book published dưới book lock nếu cần, chọn copy serviceable theo ID, lấy khóa copy và kiểm không có loan active bằng current read. Nếu copy vừa bị chiếm, thử candidate kế tiếp có giới hạn.
6. Ghi loan reserved, request_key/hash, requested_days 1..15, reserved_at và reservation_expires_at. Ghi loan_events và audit cùng transaction.
7. Commit rồi trả phiếu. Đăng ký thành công làm số khả dụng giảm vì có loan active, không trừ counter độc lập.

Hai người giành bản cuối: tối đa một thành công; request còn lại kiểm lại sau khi chờ rồi trả `NO_COPY_AVAILABLE`, không phải lỗi 500 từ unique. Cùng user/key song song phải hội tụ về cùng loan. Không trả hết sách trước khi kiểm replay của request đã commit.

## 6. Chuyển trạng thái mượn/trả

| Từ | Hành động | Sang | Điều kiện và thay đổi |
| --- | --- | --- | --- |
| reserved | checkout | borrowed | Thủ thư có quyền, chưa hết giữ chỗ, user/thẻ hợp lệ, copy serviceable; checked_out_at=now, due_at=now + requested_days ngày |
| reserved | cancel | cancelled | Chính người mượn hoặc thủ thư có quyền; closed_at=now |
| reserved | expire | expired | Job khi now >= reservation_expires_at; closed_at=now |
| borrowed | return | returned | Thủ thư; closed_at=now, copy serviceable hoặc repair theo kiểm nhận |
| borrowed | lost | lost | Thủ thư; có reason, closed_at=now, copy condition lost |

V1 không có transition ra khỏi returned/cancelled/expired/lost. Muốn sửa nghiệp vụ đã đóng cần task riêng có audit. Checkout tính hạn từ lúc nhận thực tế; requestedDays do reservation xác định. Client không truyền dueAt hoặc thêm ngày mượn trên checkout.

Mỗi lần chuyển tăng version, ghi event và audit trong transaction. Gửi return hai lần với version cũ trả 409, không ghi event thứ hai. Return và lost chạy đồng thời: chỉ một transition thành công. Mất sách giải phóng unique active_copy_id nhưng condition lost khiến bản đó không trở thành khả dụng.

Job expire quét ID ứng viên theo index, gọi expire use case. Nếu checkout đã thắng trước thì job bỏ qua; nếu expire đã thắng thì checkout trả conflict. Quyền nhận sách có thể bị chặn sau khi reservation tạo; reservation không phải bằng chứng quyền vĩnh viễn.

## 7. Quá hạn và nhắc trước 3 ngày

Quá hạn khi loan borrowed và due_at < now. due_at giữ UTC, UI/báo cáo dùng Asia/Ho_Chi_Minh. D07 phải chốt nhắc theo ngày địa phương hay đúng 72 giờ. Đề xuất kế thừa root plan: ngày địa phương bằng ngày due_at trừ 3 ngày, job chạy định kỳ có khả năng bắt kịp.

Đề xuất vận hành chi tiết: job chạy mỗi 5 phút, mốc gửi 08:00 giờ trường học. Quét loan borrowed có mốc nhắc <= now và due_at > now, chưa có notification theo `(loan_id,due_at_snapshot,kind)`. Loan ngắn 1..3 ngày được tạo sau mốc nhắc sẽ gửi ở lần quét kế tiếp. Cách xử lý loan ngắn này cần D07 xác nhận; không thể hứa gửi trước 3 ngày cho khoản chỉ mượn 1 ngày.

Khóa loan theo quy ước, kiểm lại trạng thái và hạn, tạo email_outbox cùng notification_deliveries trong một transaction. kind đề xuất `loan_due_3_days`, dedupe key biểu diễn ổn định loan ID + timestamp đầy đủ + kind, <=191 ASCII. Worker gửi kiểm lại loan vẫn borrowed, due snapshot còn khớp, chưa quá hạn; nếu không thì cancelled. Nếu user không có email hợp lệ hoặc email bị chặn theo policy thì ghi lỗi có kiểm soát, không mất dấu job.

Sau lần kiểm cuối vẫn có thể return xảy ra ngay trước SMTP; không giữ loan lock trong suốt cuộc gọi mạng. Vì vậy có một cửa sổ race nhỏ giữa kiểm trạng thái và gửi. Email ghi thời điểm dữ liệu được lấy; S5-04 phải kiểm và mô tả giới hạn này thay vì tuyên bố không bao giờ gửi nhắc sai thời điểm.

## 8. Outbox và giao nhận email

Outbox là bảng công việc bền vững. State: queued -> processing -> sent; lỗi tạm thời về queued với available_at mới; hết retry sang failed; nghiệp vụ hết hiệu lực sang cancelled. Expired không phải state trong schema; dùng expires_at để chọn cancelled và xóa ciphertext theo policy.

Worker claim một batch nhỏ bằng FOR UPDATE SKIP LOCKED, đặt state processing, tăng attempts, ghi **lease_owner mới cho từng lần claim**, leased_until, rồi commit. Gửi mạng ngoài transaction. Finalize dùng điều kiện id + processing + lease_owner + lease còn hiệu lực; worker cũ không ghi đè kết quả sau khi công việc được reclaim. Nếu thời gian gửi dài, gia hạn lease có điều kiện hoặc đặt timeout gửi nhỏ hơn lease.

Reaper đưa lease đã hết về queued nếu còn hạn/retry. Đề xuất retry tối đa 5 lần với backoff có jitter; tham số cụ thể kiểm tại S2-01. SMTP permanent error, payload hỏng hoặc hết hạn không retry vô hạn. Manual retry/reconcile là thao tác vận hành có audit, không xóa lịch sử attempts để che lỗi.

Unique dedupe ngăn enqueue trùng, không bảo đảm provider chỉ gửi một lần. Khi provider nhận email mà worker chết trước ghi sent, retry có thể gửi trùng. Chỉ khi provider có idempotency được kiểm chứng mới giảm được cửa sổ này. SMTP sandbox và production đều phải test tình huống nhận mail nhưng mất ACK.

Challenge token raw nằm trong encrypted_payload, dùng envelope có nonce/tag và encryption_key_id; không lưu plaintext. Xóa encrypted_payload sau sent/cancelled/hết hạn khi phù hợp retention. Giữ key cũ đủ để xử lý payload còn hạn; không trộn key encryption với khóa hash rate limit hoặc CSRF.

## 9. Yêu cầu mua

Reader đăng nhập gửi tên sách, author_text, publication_year và note. Sách chưa có trong catalog vẫn gửi được. User/key và request_hash chống tạo trùng, requester lấy từ session. Tạo request pending và event ban đầu cùng transaction.

Duyệt/từ chối khóa user liên quan rồi request, kiểm permission hiện hành, pending, version và reviewer khác requester. Từ chối cần lý do; ghi reviewed_by/reviewed_at và event trong cùng transaction. Hai thủ thư xử lý đồng thời chỉ một quyết định thành công. Approved không tự tạo book, trừ ngân sách hoặc gọi thanh toán.

## 10. Báo cáo

| Báo cáo | Định nghĩa cần dùng |
| --- | --- |
| Circulation | Lượt checkout theo checked_out_at; lượt return/lost theo closed_at và state; khoản đang mượn/quá hạn tại thời điểm chạy tách khỏi số lượt trong kỳ |
| Inventory | Đầu tài liệu là books; bản vật lý là book_copies; available theo invariant; số reserved/borrowed tách khỏi nhóm condition repair/lost/retired |
| Purchases | Số gửi theo created_at; số xử lý theo reviewed_at và quyết định; không coi approved là đã thanh toán |

from/to là ngày địa phương YYYY-MM-DD, hai đầu bao gồm ngày. BE chuyển thành khoảng UTC `[startOfDay(from), startOfDay(to+1))`; giới hạn phạm vi đề xuất 366 ngày. Nếu cần báo cáo tồn tại một thời điểm quá khứ, schema hiện tại chưa có đủ lịch sử condition copy, phải tạo yêu cầu bổ sung.

CSV dùng cùng permission và bộ lọc với JSON, giới hạn số dòng, escape ký tự và trung hòa cell có tiền tố công thức. Báo cáo tổng hợp mặc định không xuất tên/email/mã thẻ; drill-down cần quyền thích hợp. Đối chiếu bằng fixture tính tay, tránh JOIN loan_events làm nhân số lượt.
