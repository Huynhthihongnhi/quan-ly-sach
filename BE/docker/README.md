# Docker local (S0-03)

MySQL 8.4.5 và Mailpit chạy trong Compose. API/worker chạy trên host để hot reload trên macOS.

## Chuẩn bị

1. Docker Desktop đang chạy.
2. Sao chép env:

```sh
cp docker/.env.docker.example docker/.env.docker
cp .env.example .env
```

3. Căn `DATABASE_PASSWORD` trong `.env` với `MYSQL_APP_PASSWORD` trong `docker/.env.docker` (mặc định `local-app-change-me`).

## Khởi động

```sh
npm run docker:up
npm run docker:ps
```

MySQL healthy trước khi API kết nối. TypeORM retry tối đa 10 lần, mỗi lần 3 giây.

## Mail sandbox

| Dịch vụ | Port mặc định | Mục đích |
| --- | --- | --- |
| SMTP (Mailpit) | 1025 | Worker gửi mail thử |
| Web UI | 8025 | Xem mail local tại http://127.0.0.1:8025 |

Mail chỉ tới sandbox local; không cấu hình relay ra Internet.

## Database users

| User | Quyền | Dùng cho |
| --- | --- | --- |
| `app` | DML trên dev/test | API và worker runtime |
| `migration` | DDL trên dev/test | Runner S0-06 (chưa triển khai) |
| `root` | Admin | Chỉ vận hành container local |

Database: `quan_ly_sach_dev` (local), `quan_ly_sach_test` (integration test).

## Kiểm tra nhanh

```sh
npm run docker:up
npm run test:integration
npm run start:dev
curl -s http://127.0.0.1:3000/api/v1/health/ready
```

## Dừng và dọn

```sh
npm run docker:down        # giữ volume
npm run docker:down:clean  # xóa volume mysql (chỉ local)
```

Stop/start không chạy migration down. Dữ liệu volume giữ qua restart container.

## Image đã pin

| Image | Tag | Ghi chú |
| --- | --- | --- |
| mysql | 8.4.5 | Baseline D05; kiểm trên arm64 (Apple Silicon) |
| axllent/mailpit | v1.27.1 | SMTP + web UI |
