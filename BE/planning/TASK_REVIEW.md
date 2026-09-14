# Review task BE sau xác nhận ORM

Ngày: 2026-09-11. Phạm vi: tài liệu BE, 8 sprint, 48 task, 48 nhóm test và phụ thuộc trong planning gốc. Review thực hiện tuần tự bằng đối chiếu tài liệu; chưa có mã ứng dụng để kiểm hành vi runtime.

## Kết quả chính

Đã ghi nhận chủ dự án đồng ý dùng ORM tại [D11](../../planning/DECISIONS.md#d11). TypeORM + mysql2 là lựa chọn kỹ thuật trong kế hoạch hiện tại; phiên bản phải qua kiểm tương thích. Không coi sự đồng ý dùng ORM là sự đồng ý với framework, package manager hoặc mọi giả định sản phẩm.

Phát hiện và sửa 6 vấn đề kế hoạch. Chúng được xếp **P2** vì gây thiếu tiêu chí nghiệm thu hoặc phụ thuộc không thể thực hiện đúng, nhưng hiện chưa có ứng dụng hay sự cố người dùng để xếp P0/P1. Chúng ảnh hưởng khả năng triển khai đúng nên cần xử lý trong đợt review này, không chỉ là chỉnh câu chữ P3.

| Mã | Bằng chứng trước sửa | Tác động | Cách sửa và kiểm tra |
| --- | --- | --- | --- |
| R01 | BE-D01 liệt kê ORM proof nhưng backlog S0 chưa buộc proof cụ thể; decorator version chưa được phân biệt với kiểm expected version | Có thể nghiệm thu build được nhưng mapping mất precision hoặc ghi đè dữ liệu | S0-02/S0-04/S0-06 có acceptance rõ; TST-S0-04 kiểm raw/entity/insert ID, time, bytes, rollback, version race; S1-04 kiểm trên API thật |
| R02 | S0-04 đòi fixture/integration theo migration trong khi S0-06 runner phụ thuộc chính S0-04 | Task nền phải dùng đầu ra chưa tồn tại; dễ chạy synchronize để che thiếu migration | S0-04 dùng SQL probe cô lập; S0-06 kiểm runner; fixture domain bắt đầu từ task schema sau runner. Auth thật kiểm từ S1-02 |
| R03 | S1-03/S1-04 mở block/archive/gỡ role, nhưng bootstrap/policy/audit nền đặt tại S1-05 vốn phụ thuộc chúng | API mutation có thể được đánh dấu done trước khi bảo vệ admin cuối | Chuyển nền sang S1-01; bắt buộc tích hợp ở S1-03/S1-04; S1-05 kiểm lại đầy đủ đường API và tranh chấp |
| R04 | S3 catalog dự tính đọc loans/digital_assets và kiểm copy đang mượn, trong khi bảng nằm ở S4/S5 | Query/entity metadata yêu cầu bảng tương lai, hoặc đếm tồn không đúng | Contract theo mốc: S3 availableCopies null, S4-02 nối file, S5-01 nối tồn và copy guard trước S5-02. Schema tối thiểu được test; không fallback che lỗi sau kích hoạt |
| R05 | Gói migration đánh số cố định ghép cards/assets; purchases nằm sau circulation dù task phụ thuộc IAM | Thẻ phải chờ danh mục/file, yêu cầu mua phải chờ mượn/trả ngoài dependency đã lập | Tách nhóm cards/digital; dùng nhóm logic và cấp version tuyến tính theo thứ tự tích hợp thực; vẫn kiểm FK và không nhảy version |
| R06 | Root README, TEST_CASES và 8 sprint trỏ API/schema/test strategy hoặc validator chưa có | Người nhận task không mở được tài liệu/lệnh nghiệm thu | Link về nguồn BE và SQL có thật; bỏ lệnh planning validator chưa có; kiểm link/anchor cả BE và planning |

Đã làm rõ thêm expire reservation phải có ngay ở S5-02, trước khi task giữ chỗ được nghiệm thu; S5-03 tái dùng job đó khi kiểm checkout cạnh hết hạn. Các thay đổi đều nằm trong tài liệu, không tạo endpoint hoặc migration thực.

## Giữ một nguồn tiến độ

[PROGRESS](../../planning/PROGRESS.md) vẫn là nguồn duy nhất. Bảng task giữ nguyên ID, dependency, status và owner: chỉ S0-01 ready; các task ứng dụng còn lại locked. Sự đồng ý dùng ORM giải quyết D11, không đủ đóng S0-01 vì D01-D05 còn cần chốt những phần khác.

Không thêm task đã done giả, không đổi task tích hợp thành done khi chỉ phần BE được mô tả. S2-01 vẫn chờ S1-07; S3-01 vẫn chờ S2-06. S4-01 và S6-01 giữ phụ thuộc gốc; nhóm migration mới không đặt thêm dependency giả bằng số file cố định.

Ước lượng SP trong root sprint là baseline cũ; người nhận S0/S1 cần ước lượng lại sau thay đổi phạm vi. Không công bố lịch mới hoặc tốc độ triển khai khi chưa có số đo.

## Kiểm tra và giới hạn

Kiểm tự động tài liệu đối chiếu tên bảng/enum/permission, link/anchor, JSON, task/test mapping, chu trình phụ thuộc, trạng thái hợp lệ và bảng tiến độ trước/sau. Kiểm thủ công đối chiếu đầu ra task trước với input task sau và phân kỳ API/schema. Kết quả lệnh thực được ghi trong [VALIDATION](VALIDATION.md).

Schema SQL, sơ đồ database và backbone giữ nguyên. ORM/dependency chưa cài; MySQL, migrations, TDD ứng dụng, full e2e và deploy chưa chạy. Visual gate 0/6: bỏ qua kiểm tra giao diện.

Done: ghi nhận ORM và sửa các khoảng trống kế hoạch đã xác định; xem biên bản kiểm tra.
Next: S0-01 chốt các phần stack còn lại; sau đó S0-02 theo phụ thuộc gốc.
