# Scripts dev (Quan-Ly-Sach)

Bo script giup chay moi truong dev local: BE (NestJS), CMS (Vite), FE (khi da khoi tao),
va tunnel Cloudflare. Dieu phoi qua `Makefile` o thu muc goc. Chi dung cho local dev tren
macOS voi Docker Desktop.

CMS frontend chi nam trong `CMS/`, dung Minimal UI/MUI. Entry la `CMS/src/main.tsx`
-> `CMS/src/App.tsx` -> `CMS/src/routes/sections/`. `CMS-old/` da ngung su dung va
duoc dua vao thung rac; khong dung lai cho tinh nang moi. Xem [kien truc CMS](../CMS/docs/architecture.md).

Mo `http://localhost:8081/cms/` sau `make cms` hoac `make dev`. Vite dung `strictPort`:
cong bi chiem thi bao loi, khong chuyen sang cong khac. `CMS_PORT` duoc truyen dong bo
tu Makefile toi Vite; khi doi cong, dung cung gia tri cho dev va tunnel.

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
- `dev.sh` - chay nhieu dich vu cung luc voi tien to log; Ctrl-C chi tat process group do script tao. Kiem tra thu muc truoc khi bat dich vu. Tuong thich bash 3.2.
- `tunnel.sh` - mo `cloudflared tunnel --url http://localhost:<PORT>` (URL dang
  `https://<random>.trycloudflare.com`).
- `test-dev-runtime.py` - kiem tra routing dev/tunnel bang stub, khong bat Docker hay tunnel public: `python3 scripts/test-dev-runtime.py`.

## Luu y ve tunnel (quan trong)

Qua Cloudflare quick tunnel, phan xem va tra cuu chay duoc ngay. Nhung dang nhap va cac thao
tac ghi (POST/PUT/DELETE) se bi tra ve 403 vi guard `mutation-origin` (D03) chi cho phep
`Origin` nam trong `ALLOWED_ORIGINS`.

Muon ghi duoc qua tunnel:

1. Chay `make dev` (hoac `make cms` neu BE da chay), roi `make tunnel-cms` o terminal khac. Script tu choi neu cong chua chay hoac listener khong chay tu `CMS/` trong repo nay.
2. Copy URL `https://<random>.trycloudflare.com`, mo duong dan `/cms/` tren URL do.
3. Them origin do (khong co `/cms/`) vao `ALLOWED_ORIGINS` trong `BE/.env`.
4. Neu can link email qua tunnel, dat `APP_PUBLIC_ORIGIN=https://<random>.trycloudflare.com/cms`. Local dung `http://localhost:8081/cms`.
5. Khoi dong lai BE (va worker neu dang chay).

URL quick tunnel doi moi lan chay. Neu can URL co dinh, dung named tunnel cua Cloudflare thay
cho quick tunnel.

Vi du doi cong: `make dev CMS_PORT=8082`, sau do `make tunnel-cms CMS_PORT=8082`.
Khong chay dong thoi `make cms` va `make dev` vi ca hai deu khoi dong CMS.

## Cong mac dinh

| Dich vu | Cong |
| --- | --- |
| BE API | 3000 |
| CMS (Vite) | 8081 |
| MySQL | 3306 |
| Mailpit UI | 8025 |
| FE | 5173 (mac dinh; doi bang `FE_PORT`) |
