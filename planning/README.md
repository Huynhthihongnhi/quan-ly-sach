# Kế hoạch Quan-Ly-Sach

Bộ kế hoạch này chuyển [PRD](../.vibekit/docs/PRD.md) thành 8 sprint, 48 task và 48 nhóm ca kiểm thử. Phạm vi lần này là thiết kế và quản lý công việc; chưa có mã ứng dụng, migration được chạy hoặc bằng chứng test tính năng.

## Bắt đầu ở đâu

Frontend quản trị chỉ phát triển trong `CMS/`, theo [D12](DECISIONS.md#d12), [kiến trúc CMS](../CMS/docs/architecture.md) và [cms-roadmap.md](cms-roadmap.md). `CMS-old/` đã ngừng sử dụng và được đưa vào thùng rác. Các evidence sprint cũ là lịch sử, không chứng minh màn Minimal UI hiện tại đã hoàn thành. Hướng dẫn dev/tunnel: [scripts/README.md](../scripts/README.md).

1. Mở [PROGRESS.md](PROGRESS.md), nguồn duy nhất lưu ưu tiên, trạng thái, phụ thuộc, owner và evidence.
2. Task bắt đầu là **S0-01**, chốt các giả định trong [DECISIONS.md](DECISIONS.md).
3. Đọc task trong tài liệu sprint, [kiến trúc BE](../BE/docs/02-architecture.md), [API BE](../BE/docs/04-api-contract.md), [ánh xạ schema](../BE/docs/03-data-model.md) và [SQL gốc](database/schema.sql) trước khi triển khai.
4. Thực hiện TDD theo [chiến lược kiểm thử BE](../BE/docs/08-testing.md), dùng các ca ở [TEST_CASES.md](TEST_CASES.md). Các ca FE/CMS vẫn theo task và nhóm test giao diện tương ứng.
5. Ghi bằng chứng theo [EVIDENCE_TEMPLATE.md](EVIDENCE_TEMPLATE.md), cập nhật một dòng tiến độ rồi chạy lệnh kiểm tra hiện có.

```sh
node .vibekit/scripts/validate-kit.mjs .
```

Hiện chưa có validator riêng của planning. Lệnh trên chỉ kiểm bộ kit. Khi cập nhật kế hoạch phải đối chiếu task, test, phụ thuộc và evidence; kiểm tĩnh không tự chứng minh một task đã hoàn thành. Kết quả review hiện tại nằm trong [biên bản BE](../BE/planning/TASK_REVIEW.md). Việc nối kiểm thử ứng dụng vào CI nằm trong S0-04.

## Lộ trình và mốc bàn giao

| Sprint | Trọng tâm | Mốc ra |
| --- | --- | --- |
| [S0](sprints/s0.md) | Nền tảng, quyết định kỹ thuật, Docker local, TDD, migrations | Có môi trường và lệnh kiểm tra thực |
| [S1](sprints/s1.md) | Users, roles, permissions, login và CMS | Tài khoản được bảo vệ bằng quyền backend |
| [S2](sprints/s2.md) | Quên/reset mật khẩu, kích hoạt, profiles | Hoàn thành bộ tính năng ưu tiên đợt đầu |
| [S3](sprints/s3.md) | Danh mục, tìm kiếm, filters, giao diện khách | Tra cứu không cần đăng nhập/thẻ |
| [S4](sprints/s4.md) | Thẻ thư viện, đọc/tải tài liệu | Nội dung và thẻ được kiểm tra đúng quyền |
| [S5](sprints/s5.md) | Mượn/trả, giữ chỗ, quá hạn, nhắc email | Không mượn trùng bản sách, số liệu nhất quán |
| [S6](sprints/s6.md) | Yêu cầu mua, duyệt và báo cáo | Nghiệp vụ theo đề bài được nghiệm thu |
| [S7](sprints/s7.md) | Bảo mật, phục hồi, UAT, production | Release có bằng chứng vận hành và bàn giao |

Timebox đề xuất là 2 tuần/sprint. Đây chưa phải cam kết 16 tuần: chưa biết số người, năng lực nhóm, lịch làm việc và ngân sách. Review năng lực ở đầu sprint, dành khoảng 20% cho sửa lỗi/review; chia sprint nếu tổng task vượt năng lực. Không bỏ kiểm thử để giữ lịch. Phụ thuộc thực tế nằm trong PROGRESS, một số nhánh S4/S6 có thể bắt đầu sớm khi đủ điều kiện nhưng vẫn phải ưu tiên mốc S2.

Các SP hiện có là ước lượng ban đầu. Review ORM đã làm rõ proof ở S0 và chuyển nền bootstrap/policy/audit từ phần việc S1-05 sang S1-01; cần ước lượng lại S0/S1 trước khi nhận sprint. Không coi tổng SP cũ là dự báo đã được cập nhật theo phạm vi mới.

## Tóm tắt phương pháp và bằng chứng

- ClearThought dùng `implementation_plan`: chia task theo đầu ra, phạm vi, tiêu chí và rủi ro.
- Sequential Thinking dùng chế độ implicit: kiểm tra PRD trước, nối phụ thuộc, đối chiếu task/test/schema, rồi kiểm tra lại kế hoạch. Không coi đây là dịch vụ tự ghi nhớ hoặc tự điều phối.
- Dữ kiện: yêu cầu React/TypeScript/Tailwind/shadcn, MySQL, RESTful API, TDD, Docker Desktop macOS, Ubuntu > 24 và khách được tra cứu.
- Quyết định bổ sung: chủ dự án đã đồng ý dùng ORM, xem [D11](DECISIONS.md#d11); TypeORM + mysql2 là lựa chọn kỹ thuật đang được kế hoạch sử dụng và còn kiểm chứng phiên bản.
- Giả định: backend NestJS, session server-side, reset qua email link, thẻ gắn tài khoản, giữ chỗ trước nhận sách. Các giả định có mã quyết định riêng, chưa được coi là đã duyệt.
- Rủi ro: cấu hình kit gốc còn có thể ảnh hưởng bộ dò; không lấy script của kit làm mã backend. Không dùng SQL PostgreSQL mẫu trực tiếp cho MySQL.

## Truy vết yêu cầu

| Yêu cầu / use case | Task chính | Test |
| --- | --- | --- |
| Users, roles, permissions | S1-01 đến S1-07 | TST-S1-01 đến TST-S1-07 |
| Profiles | S2-04, S2-05 | TST-S2-04, TST-S2-05 |
| UC7 đăng nhập | S1-02, S1-06 | TST-S1-02, TST-S1-06 |
| Quên/reset mật khẩu | S2-01 đến S2-03, S2-05 | TST-S2-01 đến TST-S2-03, TST-S2-05 |
| UC8 tạo tài khoản | S1-03, S2-02, S2-03; D02 chốt tự đăng ký | TST-S1-03, TST-S2-02, TST-S2-03 |
| UC1 tìm kiếm, danh sách và filters cho khách | S3-03 đến S3-06 | TST-S3-03 đến TST-S3-06 |
| UC10 cập nhật danh mục | S3-01, S3-02, S3-04 | TST-S3-01, TST-S3-02, TST-S3-04 |
| UC2 đọc và UC3 tải tài liệu | S4-02 đến S4-05 | TST-S4-02 đến TST-S4-05 |
| UC5 mã thẻ, gắn đúng người | S4-01, S5-02 | TST-S4-01, TST-S5-02 |
| UC4 đăng ký mượn, phiếu, giới hạn 15 ngày | S5-01, S5-02, S5-05 | TST-S5-01, TST-S5-02, TST-S5-05 |
| UC9 mượn/trả, ai đang mượn, quá hạn | S5-03, S5-05 đến S5-07 | TST-S5-03, TST-S5-05 đến TST-S5-07 |
| UC12 email trước hạn 3 ngày | S5-04 | TST-S5-04 |
| UC6 đặt mua và UC11 duyệt/từ chối | S6-01 đến S6-03 | TST-S6-01 đến TST-S6-03 |
| Báo cáo/thống kê | S6-04 | TST-S6-04 |
| Docker local, MySQL migrations, production | S0-03, S0-06, S7-02 đến S7-06 | Nhóm test cùng mã task |

Ánh xạ từng task nằm trong [TASK_TEST_MAP.md](TASK_TEST_MAP.md). Không tự thêm thanh toán, tiền phạt hoặc gia hạn vào scope; các thay đổi cần quyết định sản phẩm và task/test tương ứng.

## Cập nhật kế hoạch

Khi yêu cầu đổi, chỉnh DECISIONS trước, xác định task/API/schema/test bị ảnh hưởng, sửa cùng một thay đổi rồi chạy validator. Trạng thái done chỉ giữ khi evidence còn đúng. Không lưu hai bản PROGRESS hoặc đồng bộ bằng cách sao chép thủ công. Các quy tắc trong bộ planning là kế hoạch được người thực hiện đọc và tuân theo; chưa thay `AGENTS.md` hay `backbone.yml` trong task này.
