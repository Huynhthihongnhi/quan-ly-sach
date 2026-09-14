# Kế hoạch triển khai BE

Đây là phần chi tiết backend của kế hoạch toàn dự án. **S0-01 bắt đầu trước**. Việc tạo bộ tài liệu BE không hoàn thành S0-01 hoặc các task ứng dụng.

## 1. Nguồn tiến độ và phụ thuộc

[PROGRESS gốc](../../planning/PROGRESS.md) là nơi duy nhất lưu status, owner, dependency và evidence. [Backlog BE](BACKLOG.md) định nghĩa phần BE cần giao; không có bảng status riêng. Nhận task phải theo phụ thuộc gốc, không dựa vào việc tài liệu đã viết xong.

Các task tích hợp có FE/CMS chưa thể done chỉ vì API hoàn thành. Đặc biệt S2-01 đang phụ thuộc S1-07, S3-01 phụ thuộc S2-06. Nếu muốn bắt đầu API sớm hơn trong tương lai, phải sửa dependency bằng quyết định có bằng chứng, không bỏ qua mốc nghiệm thu hiện tại.

## 2. Mốc bàn giao

| Mốc | Task BE chính | Kết quả cần quan sát | Phụ thuộc giao diện |
| --- | --- | --- | --- |
| M0: nền tảng | S0-01 đến S0-06 | Stack chốt, app chạy local, test/contract, runner có history | S0-02/S0-04/S0-05 cần thống nhất FE/CMS |
| M1: tài khoản | S1-01 đến S1-05 | Quản lý user/role/permission, session, admin cuối | S1-06 UI và S1-07 nghiệm thu |
| M2: hoàn tất ưu tiên đợt đầu | S2-01 đến S2-04 | Kích hoạt, forgot/reset, profile, worker mail | S2-05 UI và S2-06 nghiệm thu |
| M3: tra cứu | S3-01 đến S3-03, S3-05 | Guest tìm/lọc/xem sách published; CMS metadata | S3-04 UI và S3-06 nghiệm thu |
| M4: thẻ và file | S4-01 đến S4-03 | Thẻ đúng user; upload/read/download đúng policy | S4-04 UI và S4-05 nghiệm thu |
| M5: mượn/trả | S5-01 đến S5-04, S5-06 | Không trùng copy, có lịch sử, nhắc hạn và phục hồi | S5-05 UI và S5-07 nghiệm thu |
| M6: mua và báo cáo | S6-01, S6-02, S6-04 | Gửi/duyệt yêu cầu, số liệu đối chiếu được | S6-03 UI và S6-05 nghiệm thu |
| M7: release | S7-01 đến S7-06 | Staging, phục hồi, UAT, release có bằng chứng | FE/CMS cùng release candidate |

S4-01 và S6-01 có thể đủ phụ thuộc trước phần khác theo PROGRESS, nhưng ưu tiên đợt tài khoản M2 được giữ. Đây là mô tả dependency, không yêu cầu chạy agent song song.

## 3. Trình tự làm một task

1. Đọc task gốc, Dxx cần chốt, phần backlog BE, API/data model liên quan và nhóm test.
2. Xác nhận điều kiện nhận task từ PROGRESS, phạm vi file được sửa và người phụ trách cụ thể.
3. Với code, tạo RED theo [TDD](../docs/08-testing.md); với decision, ghi lựa chọn thực được xác nhận.
4. Triển khai slice nhỏ, chạy test phù hợp, review diff và đối chiếu schema/API.
5. Giao contract/mock và lỗi cho FE/CMS khi có tác động. Evidence ở `planning/evidence/<TASK-ID>.md` theo mẫu gốc, chỉ tạo khi có kết quả thật.
6. Cập nhật một dòng tiến độ gốc khi đủ toàn bộ tiêu chí. Chưa có app thì kết quả runtime phải ghi NOT_RUN.

## 4. Ước lượng và cắt scope

Root plan đề xuất 8 sprint, 2 tuần/sprint; chưa có cam kết nhân sự hoặc deadline. BE giữ mốc và task này để tránh tạo lịch thứ hai. Team ước lượng lại từng slice sau S0-01 và đo năng lực qua sprint đầu; không cộng task BE thành lịch cam kết của toàn hệ thống.

M0-M2 là phần ưu tiên. Redis, microservices, Elasticsearch, thanh toán, fine/gia hạn, self-registration và lịch sử tồn kho tại thời điểm quá khứ chỉ thêm khi có quyết định sản phẩm/kỹ thuật. Nếu thay D03 sang JWT hoặc D04 sang OTP, cập nhật auth/schema/contract/test trước mở task phụ thuộc.

Sau review task: ORM đã được duyệt theo D11; kiểm chứng chia theo S0-02/S0-04/S0-06 để không tạo phụ thuộc vòng vào runner. S1-01 giao bootstrap/policy/audit nền, S1-05 kiểm toàn bộ đường API. S3 chỉ query schema catalog; metadata digital nối ở S4-02 và tồn khả dụng nối ở S5-01 trước khi mở mượn. Nhóm migration cards/digital tách riêng, phiên bản SQL cấp theo thứ tự tích hợp. Chi tiết và bằng chứng ở [TASK_REVIEW](TASK_REVIEW.md).

## 5. Điều kiện kết thúc đợt tài liệu hiện tại

- Tài liệu nằm trong BE, đọc được từ [README](../README.md).
- Có ánh xạ đủ 27 bảng, không có schema trùng nguồn hoặc dữ liệu sản xuất được bịa.
- API, permission, state machine và backlog liên kết được với PRD/task/test.
- Ghi rõ giả định, quyết định ORM đã chốt và các tham chiếu gốc đã sửa.
- Có [biên bản kiểm tra](VALIDATION.md); không nâng trạng thái task triển khai.

Done: thiết kế và kế hoạch BE được thiết lập, xem kết quả kiểm tra tài liệu.
Next: S0-06 migration runner (S0-04 test harness đã xong).
