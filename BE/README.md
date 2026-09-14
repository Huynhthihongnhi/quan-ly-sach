# Backend Quan-Ly-Sach

Bộ tài liệu thiết kế và kế hoạch triển khai backend cho thư viện trực tuyến trong intranet. Backend phục vụ hai giao diện React: độc giả tại `FE` và quản trị tại `CMS`. Tài liệu được lập ngày 2026-09-11 theo schema MySQL hiện có.

**Trạng thái:** S0-01 đến S0-06, S1-01 đến S1-07, S2-01 đến S2-02 hoàn thành. S2-03 sẵn sàng.

## Đọc theo thứ tự

| Tài liệu | Nội dung |
| --- | --- |
| [Phạm vi và tech stack](docs/01-scope-stack.md) | Dữ kiện, giới hạn, công nghệ đề xuất và nguồn chính thức |
| [Kiến trúc BE](docs/02-architecture.md) | Thành phần, cấu trúc thư mục, module và quy tắc phụ thuộc |
| [Ánh xạ database](docs/03-data-model.md) | Đủ 27 bảng, kiểu dữ liệu, ràng buộc và phần service phải bảo vệ |
| [Hợp đồng API](docs/04-api-contract.md) | Endpoint, DTO, phân trang, lỗi, phiên bản và chống gửi trùng |
| [Tài khoản và phân quyền](docs/05-access-control.md) | Session, kích hoạt, reset, quyền, dữ liệu của chính mình và admin cuối |
| [Luồng nghiệp vụ](docs/06-business-flows.md) | Thẻ, tài liệu điện tử, mượn/trả, worker, email, yêu cầu mua, báo cáo |
| [Môi trường và vận hành](docs/07-operations.md) | Local, cấu hình, migration runner, triển khai và phục hồi |
| [Chiến lược kiểm thử](docs/08-testing.md) | TDD, fixtures MySQL, ca tranh chấp, hợp đồng với FE/CMS |
| [Sơ đồ BE](docs/09-diagrams.md) | Tổng quan runtime và trạng thái mượn/trả |
| [Lộ trình BE](planning/README.md) | Thứ tự bàn giao và phụ thuộc với kế hoạch toàn dự án |
| [Backlog chi tiết](planning/BACKLOG.md) | Phạm vi sửa, bước làm, tiêu chí đạt và test của từng task BE |
| [Quyết định và điểm cần xử lý](planning/DECISIONS.md) | Liên kết D01-D10 và các chi tiết còn thiếu |
| [Biên bản kiểm tra tài liệu](planning/VALIDATION.md) | Phạm vi kiểm chứng, kết quả và giới hạn |
| [Runbook IAM bootstrap/audit](planning/RUNBOOK-IAM.md) | Bootstrap CLI, admin cuối, truy vấn audit |
| [Kết quả review task](planning/TASK_REVIEW.md) | Điểm lệch đã sửa, phạm vi xác nhận ORM và kiểm tra phụ thuộc |

## Nguồn và cách cập nhật

- [PRD](../.vibekit/docs/PRD.md) quy định phạm vi và ưu tiên tài khoản trước nghiệp vụ thư viện. [CONTEXT](../.vibekit/docs/CONTEXT.md) quy định thuật ngữ.
- [backbone.yml](../backbone.yml) quy định tech stack, quyền sửa và lệnh kiểm tra hiện có.
- [schema.sql](../planning/database/schema.sql) là nguồn cấu trúc database. [Sơ đồ database](../planning/database/schema-diagrams.md) giúp đọc quan hệ. Không sao chép SQL thành một nguồn schema thứ hai trong BE.
- [PROGRESS toàn dự án](../planning/PROGRESS.md) là nơi duy nhất lưu trạng thái triển khai. Các bảng trong BE mô tả việc cần làm, không thay trạng thái ở đó.
- [Quyết định gốc](../planning/DECISIONS.md) vẫn giữ các lựa chọn chưa duyệt. Yêu cầu mới đặt tài liệu tại `BE` được áp dụng trong bộ này; chuyển layout mã nguồn từ `apps/api` sang `BE` cần đồng bộ kế hoạch gốc khi scaffold.

Migration runner dùng user `migration` riêng (xem `.env.example`). Probe migrations nằm trong `BE/migrations/`; schema đầy đủ sẽ được thêm từ S1-01.

## Việc bắt đầu tiếp theo

Chạy backend local với Docker:

```sh
cd BE
cp docker/.env.docker.example docker/.env.docker
cp .env.example .env
npm install
npm run docker:up
npm run build
npm run validate
npm run test:contract
npm run test:integration
npm run test:concurrency
ACCEPTANCE_TESTS=1 npm run test:acceptance
SECURITY_TESTS=1 npm run test:security
npm run openapi:export
npm run db:status
npm run db:preview -- --to 2
npm run db:up -- --to 5
BOOTSTRAP_ADMIN_EMAIL=admin@local.test BOOTSTRAP_ADMIN_PASSWORD='change-me-12chars' npm run bootstrap:admin
npm run start:dev
```

Mail sandbox: http://127.0.0.1:8025. Chi tiết: [docker/README.md](docker/README.md).

Migration CLI (dev DB, user migration):

```sh
npm run db:status
npm run db:preview -- --to 2
npm run db:up -- --to 2
npm run db:down -- --version 2 --confirm
```

Contract fixtures cho FE/CMS: `test/fixtures/contract/`. Swagger local: `/docs`.

Lệnh kit từ gốc repository:

```sh
node .vibekit/scripts/validate-kit.mjs .
```

Lệnh này kiểm bộ kit, không kiểm tính năng BE.

Done: S0-01 đến S0-06, S1-01 đến S1-07, S2-01; xem evidence trong `planning/evidence/`. CMS: `CMS/README.md`. Test layout: `test/README.md`.
Next: S2-03 reset/activation completion theo PROGRESS.
