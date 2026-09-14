# Kiến trúc BE

## 1. Thành phần runtime

| Thành phần | Trách nhiệm | Giao tiếp |
| --- | --- | --- |
| FE | Tra cứu, đọc, gửi yêu cầu và lịch sử cá nhân | `/api/v1` |
| CMS | Quản trị tài khoản, danh mục, lưu thông, yêu cầu mua | Cùng API, kiểm quyền ở server |
| Reverse proxy | HTTPS, intranet, `/` cho FE, `/cms` cho CMS, `/api` cho BE | API không dựa vào tiền tố CMS để xác định quyền |
| API | Xác thực, DTO, nghiệp vụ, transaction, response | MySQL và private file store |
| Worker | Gửi outbox, nhắc hạn, hết hạn giữ chỗ, dọn dữ liệu tạm | MySQL, mail adapter và file store nếu xử lý upload |
| MySQL | Dữ liệu bền vững, ràng buộc, lịch sử migration | API/worker dùng quyền DML riêng với runner |
| Private file store | Bytes của tài liệu điện tử | Key do BE tạo; FE không nhận đường dẫn vật lý |
| Mail adapter | Chuyển email tới sandbox hoặc nhà cung cấp | Worker gọi sau commit |

Xem [sơ đồ](09-diagrams.md). Thiết kế same-origin là đề xuất D03; FE và CMS có thể là hai build độc lập cùng được proxy phục vụ. Local nên dùng proxy tương đương để kiểm cookie/CSRF đúng môi trường.

## 2. Layout sau scaffold, chưa được tạo

```text
BE/
  README.md
  docs/
  planning/
  src/
    main.ts
    app.module.ts
    worker.ts
    worker.module.ts
    config/
    platform/
      database/
      mail/
      storage/
      clock/
    common/
      http/
      errors/
    modules/
      identity/
      auth/
      access/
      audit/
      messaging/
      catalog/
      cards/
      digital/
      circulation/
      purchases/
      reports/
      health/
  test/
    unit/
    integration/
    contract/
    concurrency/
    fixtures/
    support/
  migrations/
  tools/
```

`platform` chứa kết nối kỹ thuật, `modules` chứa nghiệp vụ. Tên này giới hạn trong BE, chưa thiết lập abstraction chung cho toàn repository. `migrations` là đường dẫn được bảo vệ theo backbone; chỉ thêm file ở bước triển khai đã duyệt.

Module đơn giản bắt đầu với `<name>.module.ts`, controller, service, repository, `dto` và `entities`. Chỉ thêm `use-cases` và `policies` khi luồng đủ phức tạp, như mượn/trả hoặc thu hồi admin. Không tạo lớp rỗng cho đủ sơ đồ.

## 3. Module sở hữu nghiệp vụ

| Module | Phạm vi | Hợp đồng xuất ra |
| --- | --- | --- |
| `identity` | Users, hồ sơ, trạng thái và thông tin đăng nhập lưu trữ | Tra cứu identity, thay trạng thái có transaction context |
| `auth` | Password, session, kích hoạt/reset, giới hạn thử | Xác thực request, kiểm password, challenge service |
| `access` | Vai trò, permission registry, gán quyền, bảo vệ admin cuối | Kiểm permission hiện hành; thực hiện thay đổi IAM nhạy cảm |
| `audit` | Ghi nhật ký thao tác đã lọc dữ liệu nhạy cảm | `append(event, tx)` và truy vấn audit có quyền |
| `messaging` | Outbox, lease và retry gửi mail | `enqueue(message, tx)`; worker giao nhận |
| `catalog` | Đầu tài liệu, tác giả, chủ đề, loại, bản sách | Query public/CMS, cập nhật metadata, khóa copy |
| `cards` | Cấp, khóa, hết hạn, thay thẻ | Kiểm thẻ thuộc user và hiệu lực tại một thời điểm |
| `digital` | Metadata file, quarantine, quyền đọc/tải | Upload và cấp stream qua adapter |
| `circulation` | Giữ chỗ, nhận, trả, hủy, mất, nhắc hạn | Loan use cases, query tồn khả dụng và lịch sử |
| `purchases` | Yêu cầu mua và duyệt | Submit, review, query cá nhân/CMS |
| `reports` | Tổng hợp dữ liệu và export có quyền | Query chỉ đọc, không sở hữu thêm bảng nghiệp vụ |
| `health` | Liveness, readiness | Kết quả tối thiểu cho proxy/monitor |

`schema_migrations` thuộc công cụ runner, không thuộc CRUD API. Ánh xạ toàn bộ bảng nằm trong [data model](03-data-model.md).

## 4. Luồng một request

1. Middleware gán `requestId`, giới hạn body và áp dụng log đã lọc.
2. Guard kiểm metadata route. Route phải khai báo public, authenticated-self hoặc permission rõ ràng; thiếu policy thì từ chối.
3. Protected request kiểm session, user, `auth_version`, quyền hiện tại và CSRF nếu có thay đổi.
4. Pipe kiểm DTO, ID, trường lạ và độ dài. DTO là dữ liệu đầu vào/đầu ra đã giới hạn trường.
5. Controller gọi service/use case. Service kiểm ownership, luật nghiệp vụ và mở transaction khi cần.
6. Repository thực hiện truy vấn tham số hóa bằng transaction context đang có.
7. Mapper tạo response công khai; exception filter chuẩn hóa lỗi. Không serialize entity trực tiếp.

Với Nest, guard chạy trước pipe. Guard không được giả định DTO đã validate, nhất là khi đọc ID hoặc header. Nghiệp vụ quan trọng kiểm lại trạng thái dưới khóa trước ghi, tránh dùng kết quả guard cũ cho một transaction xảy ra sau. [Nest request lifecycle](https://docs.nestjs.com/faq/request-lifecycle).

## 5. Quy tắc phụ thuộc

- Controller không truy cập ORM trực tiếp. Repository không nhận request HTTP hoặc tự kiểm cookie.
- Domain policy là hàm TypeScript kiểm luật như chuyển trạng thái; không gửi email hoặc đọc biến môi trường.
- Một use case sở hữu transaction. Hàm được gọi nhận `tx` tường minh; không tự mở transaction lồng hoặc quay về global repository.
- Module truy cập chéo qua provider được export, không import entity nội bộ để sửa bảng của module khác.
- `AuthModule` có thể đọc identity/access. `AccessModule` không import `AuthModule`; cả hai dùng identity API và thay `auth_version` qua transaction để tránh phụ thuộc vòng.
- Tồn kho là query từ copy và loan. Dùng query chuyên biệt ở circulation, hoặc read model chỉ đọc cho catalog/report; không thêm bộ đếm tồn thứ hai.
- Reporting được join đọc nhiều bảng qua query rõ phạm vi. Đây là ngoại lệ chỉ đọc, không cho report sửa trạng thái nghiệp vụ.
- Common chỉ giữ HTTP/errors dùng chung thật sự. Mail, clock và storage là adapter được inject, giúp test thay bằng bản giả.

Mọi truy vấn trong transaction TypeORM phải dùng manager tương ứng; dùng global manager có thể làm một phần ghi thoát transaction. [TypeORM transactions](https://typeorm.io/docs/transactions/).

### Hợp đồng ORM cần kiểm trong task

ORM quản lý mapping và truy vấn; SQL up/down quản lý schema. Explicit entity registry chỉ đăng ký bảng đã có trong release hiện tại; không khai báo relation tới entity chưa đăng ký hoặc eager-load quan hệ tới module chưa triển khai. Tắt eager loading riêng lẻ không đủ nếu relation metadata vẫn yêu cầu entity của module tương lai.

- `@VersionColumn` tự tăng version khi save không phải bằng chứng đã kiểm version do client gửi. Với update có version, dùng điều kiện id + expectedVersion, tăng version trong cùng câu lệnh và kiểm affected rows; hoặc lock rồi so version trong cùng transaction. Phải có test hai người sửa cùng version chỉ một thành công. Đây là lựa chọn triển khai của dự án, dựa trên hành vi tự tăng được mô tả trong [TypeORM entities](https://typeorm.io/docs/entity/entities/).
- Mỗi repository có đường nhận transaction manager; fault injection sau write đầu phải rollback được cả dữ liệu, bảng nối và audit. Không lấy repository global bên trong use case đang dùng transaction. [TypeORM custom repositories](https://typeorm.io/docs/working-with-entity-manager/custom-repository/).
- Bảng nối có dữ liệu riêng như assigned_by/assigned_at và author_order phải map bằng entity tường minh. Không để ORM tự tạo junction table khác SQL, cascade update/delete quan hệ ngoài ý muốn hoặc tự thêm deleted_at để thay quy trình archive.
- Cột generated chỉ đọc; mapper và truy vấn phải giữ BIGINT, microsecond và BINARY(32). Kiểm cả insert ID, raw query và entity hydration, không chỉ JSON output. Cấu hình driver một mình chưa phải bằng chứng dữ liệu đi qua ORM vẫn chính xác.
- Không dùng schema synchronization để sửa test đang thiếu migration. Tắt cả `synchronize` và `migrationsRun`; dùng runner SQL duy nhất. SQL tham số hóa qua transaction manager được phép cho khóa, aggregate và query cần kiểm soát chính xác.

## 6. Quy ước mã dự kiến

File dùng `kebab-case`; class dùng `PascalCase`; hàm/biến dùng `camelCase`; bảng/cột giữ `snake_case` như SQL. Mapping cột phải tường minh. ID và version BIGINT dùng chuỗi thập phân. Tránh `Number(id)` hoặc `parseInt` cho khóa chính.

DTO request tách DTO response và entity. Update chỉ nhận trường cho phép; không nhận `createdBy`, `assignedBy`, `reviewedBy`, `passwordHash`, `authVersion` từ client. Giá trị do server quản lý lấy từ actor đã xác thực hoặc nghiệp vụ.

OpenAPI sinh từ DTO/controller sau scaffold; FE và CMS dùng client/types sinh từ hợp đồng này. Không import TypeORM entities sang frontend. [Nest OpenAPI](https://docs.nestjs.com/openapi/introduction).

## 7. API và worker cùng codebase

`AppModule` gắn controller HTTP. `WorkerModule` chỉ khởi tạo provider cần cho jobs. API không đăng ký cron gửi mail khi worker đã chạy riêng. Worker không bootstrap một public HTTP server chỉ để lấy dependency injection.

Các job có thể lặp sau restart, nên dùng khóa, lease hoặc unique key trong MySQL. Không dựa vào một biến trong bộ nhớ để bảo đảm chỉ có một worker xử lý. Không gọi SMTP hoặc scan file trong transaction giữ khóa user/copy/loan.

## 8. Khi nào xem lại kiến trúc

Chỉ xem lại khi số đo cho thấy API/worker tranh tài nguyên, báo cáo gây tải lớn, hoặc nhiều host không chia sẻ được kho file. Điểm mở rộng đầu tiên là tách số process, pool connection và storage adapter. Tách database/service cần thiết kế lại transaction và bằng chứng vận hành; chưa thuộc đợt đầu.
