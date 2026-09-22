# Scripts dev (Quan-Ly-Sach)

Bo script giup chay moi truong dev local: BE (NestJS), CMS (Vite), FE (khi da khoi tao),
va tunnel Cloudflare. Dieu phoi qua `Makefile` o thu muc goc. Chi dung cho local dev tren
macOS voi Docker Desktop.

## Lenh nhanh

Chay tu thu muc goc repo:

| Lenh | Tac dung |
| --- | --- |
| `make help` | Danh sach day du cac lenh |
| `make db-up` | Bat MySQL + Mailpit (Docker); tu mo Docker Desktop neu daemon chua chay |
| `make db-down` | Tat container, giu du lieu |
| `make db-reset` | Tat va xoa volume MySQL (hoi xac nhan, mat du lieu) |
| `make be` | Chay API (bat DB truoc) |
| `make worker` | Chay worker job (bat DB truoc) |
| `make cms` | Chay CMS Vite dev (cong 8081) |
| `make fe` | Chay FE dev (neu FE da khoi tao) |
| `make dev` | Chay cung luc: DB + BE + CMS (Ctrl-C tat het) |
| `make dev-all` | Chay cung luc: DB + BE + worker + CMS + FE |
| `make stop` | Tat BE, worker, CMS, tunnel (Docker van chay) |
| `make create-admin` | Tao admin dau tien (chi khi chua co admin) |
| `make tunnel-cms` | Mo Cloudflare quick tunnel toi CMS |
| `make tunnel-fe` | Mo tunnel toi FE |
| `make tunnel PORT=1234` | Mo tunnel toi mot cong bat ky |
| `make doctor` | Kiem tra docker, cloudflared, cac cong |

## Cac file

- `ensure-docker.sh` - kiem tra Docker daemon, tu mo Docker Desktop tren macOS, cho san sang,
  roi chay `npm run docker:up` (MySQL + Mailpit). Goi lai nhieu lan an toan.
- `dev.sh` - chay nhieu dich vu cung luc voi tien to log; Ctrl-C tat tat ca. Tuong thich bash 3.2.
- `tunnel.sh` - mo `cloudflared tunnel --url http://localhost:<PORT>` (URL dang
  `https://<random>.trycloudflare.com`).

## Luu y ve tunnel (quan trong)

Qua Cloudflare quick tunnel, phan xem va tra cuu chay duoc ngay. Nhung dang nhap va cac thao
tac ghi (POST/PUT/DELETE) se bi tra ve 403 vi guard `mutation-origin` (D03) chi cho phep
`Origin` nam trong `ALLOWED_ORIGINS`.

Muon ghi duoc qua tunnel:

1. Chay `make tunnel-cms`, copy URL `https://<random>.trycloudflare.com` no in ra.
2. Them URL do vao `ALLOWED_ORIGINS` trong `BE/.env`.
3. Khoi dong lai BE.

URL quick tunnel doi moi lan chay. Neu can URL co dinh, dung named tunnel cua Cloudflare thay
cho quick tunnel.

## Cong mac dinh

| Dich vu | Cong |
| --- | --- |
| BE API | 3000 |
| CMS (Vite) | 8081 |
| MySQL | 3306 |
| Mailpit UI | 8025 |
| FE | 5173 (mac dinh; doi bang `FE_PORT`) |
