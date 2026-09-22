# Tặng bạn bè và bán kit: bắt đầu từ đây

Bạn đang chuẩn bị bản ứng viên riêng tư 0.6.3. Kit cài đặt được từ file tải xuống. Checkout, coupon thật và dịch vụ kích hoạt chưa được cấu hình. Việc rà soát pháp lý vẫn đang chờ luật sư.

## 1. Hiểu đúng bốn thứ

| Tên | Nghĩa trong luồng này |
| --- | --- |
| Coupon | Mã giảm giá nhập tại trang thanh toán; tự đặt một chuỗi ký tự chưa tạo ra coupon có hiệu lực. |
| Checkout | Trang để người mua xem điều khoản, nhập mã và hoàn tất đơn hàng. |
| Grant | Xác nhận của chủ sở hữu cấp quyền dùng kit cho một người cụ thể, ví dụ một suất tặng. |
| Bản cài đặt | File `.tgz` chứa kit. Sau khi giải nén, người nhận chạy CLI để đưa kit vào dự án của họ. |

Coupon không chứa kit. Coupon không phải khóa kích hoạt. Quyền dùng phần Premium đến từ đơn hàng hoặc grant hợp lệ theo giấy phép đi kèm.

## 2. Tặng một người bạn ngay trong giai đoạn đánh giá

1. Chọn đúng bản và SHA-256 trong [hồ sơ phát hành](PREMIUM_RELEASE.md). Kiểm tra kết quả thử bản đó trong hồ sơ riêng của chủ sở hữu.
2. Gửi giấy phép để bạn đọc; ghi rõ tên người nhận, một suất dùng, phiên bản được cấp, quyền cập nhật và xác nhận chấp nhận. Lưu thông tin này riêng, ngoài repo.
3. Gửi file `.tgz` qua kênh riêng cùng mã SHA-256, hướng dẫn này và grant bằng văn bản.
4. Người nhận kiểm tra file, giải nén vào thư mục công cụ riêng và cài theo mục 4.

Luồng này không cần coupon hoặc tài khoản thanh toán. Grant phải do Bui Van Giang hoặc bên được ủy quyền cấp. Đây là hướng dẫn chuẩn bị việc bàn giao; tài liệu này không tự cấp quyền cho một người chưa được xác định. Trước khi thu tiền, hoàn tất [review pháp lý](PREMIUM_LEGAL_REVIEW.md).

Mẫu tin nhắn, chỉ gửi sau khi điền đủ:

```text
Mình cấp cho [họ tên] một suất dùng MVCK Premium theo License 1.0 đính kèm.
Mã grant: [mã riêng]. Phiên bản: [phiên bản].
File tải: [link riêng]. SHA-256: [đủ 64 ký tự].
Quyền cập nhật: [không kèm cập nhật mới, hoặc phạm vi và ngày hết hạn cụ thể].
Việc tiếp tục dùng bản đã nhận tuân theo giấy phép đính kèm.
Bạn hãy đọc và xác nhận chấp nhận giấy phép trước khi dùng.
Giải nén ra thư mục riêng rồi đọc .vibekit/docs/PREMIUM_DELIVERY.vi.md.
Giữ riêng kit và suất dùng của bạn.
```

## 3. Khi đã có thanh toán và muốn dùng coupon

Khuyến nghị ban đầu là một sản phẩm trả tiền một lần, ghi rõ bản nhận được và chính sách cập nhật. Chốt giá và điều khoản trước khi mở bán. Các gói 12 tháng cập nhật, tháng và năm trong [selling guide](PREMIUM_SELLING.md) hiện là đề xuất, chưa phải dịch vụ đã vận hành.

**Bạn làm:** hoàn tất tài khoản Polar, tạo sản phẩm, gắn File Downloads benefit chứa bản đã kiểm tra, tạo checkout link và coupon trong dashboard. Thử bằng sandbox trước, sau đó tạo riêng các bản ghi production.

**Bạn của bạn làm:** mở link checkout, xem giấy phép và giá, nhập coupon, hoàn tất đơn hàng, nhận quyền tải file, rồi cài đặt. Một đơn hàng miễn phí hợp lệ có thể hoàn tất mà không thu tiền.

Để tặng miễn phí, chọn sản phẩm **trả một lần**, giảm **100%**, thời hạn **Once**, đúng sản phẩm, giới hạn **1 lượt tổng cộng**, **1 lượt mỗi khách** và ngày hết hạn rõ ràng. Mã minh họa `GIFT100-EXAMPLE` chưa hoạt động. Mã một lượt vẫn có thể bị người khác dùng trước nếu bị chuyển tiếp. Xem [cách tạo coupon](PREMIUM_COUPONS.md) và [Polar Discounts](https://polar.sh/docs/features/discounts).

Polar cung cấp [checkout link](https://polar.sh/docs/features/checkout/links) và [File Downloads](https://polar.sh/docs/features/benefits/file-downloads). Kết hợp này cho phép giao file mà chưa cần xây dịch vụ kích hoạt CLI riêng. Đây là đề xuất triển khai dựa trên tài liệu; tài khoản thực tế của bạn chưa được thử trong review này.

Đừng dùng giảm 100% kỳ đầu của gói tháng để thay cho một suất tặng trả một lần: kỳ tiếp theo có thể thu giá thường. Nếu bán định kỳ, phải công bố giá gia hạn, thời điểm thu, cách hủy và thử luồng đó trước.

## 4. Người nhận cài vào dự án

Yêu cầu Node.js 18 trở lên. Kiểm tra SHA-256 theo [hướng dẫn đầy đủ](PREMIUM_FRIEND_HANDOFF.md#2-owner-prepare-the-downloadable-kit). Giải nén file `.tgz` vào thư mục riêng; giữ cả file ẩn. Mở terminal tại thư mục `package/` vừa giải nén. Sao lưu dự án và các thay đổi chưa commit.

Ví dụ dưới đây dùng Codex. Thay đường dẫn bằng dự án có thật; đổi `codex` thành provider bạn dùng, hoặc `all`.

Xem trước khi cài mới:

```sh
node bin/mvck.js install "/duong-dan/toi/du-an" --profile codex --dry-run --json
```

Sau khi kiểm tra đúng thư mục và các file dự kiến, cài:

```sh
node bin/mvck.js install "/duong-dan/toi/du-an" --profile codex
```

Lệnh thứ hai ghi file ngay. Sau đó làm theo prompt khởi tạo mà installer in ra; xem và duyệt `backbone.yml` của chính dự án đó. Nếu dự án đã có cả kit OSS hoặc Premium, dùng `update` thay cho `install` ở cả hai lệnh. Giữ backup mặc định. Nếu chỉ cài từng skill bằng `skill add`, dùng [luồng modular](PREMIUM_FRIEND_HANDOFF.md#5c-update-individual-modular-skills).

Trên Windows, thay đường dẫn bằng dạng `"C:\work\my-project"`. Bản review này chưa chạy thử trên Windows.

Kit sẽ giữ giấy phép riêng tại `.vibekit/docs/licenses/` và giữ nguyên `LICENSE` gốc của dự án người nhận. Không đưa phần kit Premium có thể tái sử dụng lên repo công khai chỉ vì ứng dụng của bạn được phép công khai. Xem [phạm vi giấy phép](PREMIUM_LICENSE.md).

## 5. Cập nhật sau này

Bạn phát hành file có số phiên bản mới. Người còn quyền cập nhật nhận file đó và chạy `update` từ bản mới, trước tiên có `--dry-run`. File đã gửi phải giữ nguyên; không thay nội dung dưới cùng tên phiên bản.

Nếu hứa 12 tháng cập nhật, bạn phải lưu ngày hết hạn cho từng khách và kiểm soát lần giao bản mới, thủ công hoặc qua dịch vụ đã kiểm thử. Việc thêm file vào benefit dùng chung có thể cấp file cho khách hiện có; benefit đó không tự đại diện cho mốc hết hạn riêng của từng người. [Quy tắc File Downloads](https://polar.sh/docs/features/benefits/file-downloads).

`license status` hiện báo `service: not-configured` và `mode: community`. Đây là trạng thái kỹ thuật của dịch vụ; người có grant hoặc đơn hàng hợp lệ vẫn dùng được các workflow đã tải. Không có lệnh nhập coupon vào CLI trong bản này.

## Thứ tự tiếp theo cho chủ sở hữu

1. Hoàn tất [hồ sơ gửi luật sư](PREMIUM_LEGAL_REVIEW.md) cho kế hoạch [bán quốc tế](PREMIUM_GLOBAL_SALES.md).
2. Chốt một offer, giá, quyền cập nhật, hoàn tiền và điều khoản.
3. Thiết lập Polar sandbox; thử mua, tặng, tải, cài và hoàn tiền bằng đúng bản dự kiến giao.
4. Sau khi các điều kiện đã đạt, duyệt file và cấu hình production để mở bán.

Tra cứu tài liệu cần đọc và hồ sơ cũ tại [bản đồ tài liệu](DOCUMENTATION_MAP.md).
