#!/usr/bin/env bash
# Mo cloudflared quick tunnel (https://<random>.trycloudflare.com) toi mot cong local.
# Dung: scripts/tunnel.sh <PORT> [ten]
set -uo pipefail

PORT="${1:-}"
LABEL="${2:-local}"

if [ -z "$PORT" ]; then
  echo "Dung: $0 <PORT> [ten]. Vi du: $0 8081 CMS" >&2
  exit 2
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "[tunnel] Chua cai cloudflared. Cai bang: brew install cloudflared" >&2
  exit 1
fi

# Canh bao neu chua co dich vu nao lang nghe o cong nay (tunnel se tro toi cong trong).
if ! lsof -iTCP:"$PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  echo "[tunnel] CANH BAO: chua co dich vu nao chay o cong $PORT." >&2
  echo "[tunnel] Hay chay dich vu truoc o mot terminal khac (vi du: make cms), roi mo tunnel." >&2
fi

cat <<EOF
[tunnel] Mo quick tunnel toi http://localhost:$PORT ($LABEL)
[tunnel] Luu y:
[tunnel]  - GIU terminal nay mo suot thoi gian dung. URL chi song khi tien trinh
[tunnel]    cloudflared con chay; dong no la URL bi xoa (trinh duyet bao DNS_PROBE / khong
[tunnel]    tim thay DNS). Moi lan chay lai la mot URL moi.
[tunnel]  - Mo dung URL https://<random>.trycloudflare.com in ra ngay ben duoi, khong dung URL cu.
[tunnel]  - Xem va tra cuu qua tunnel chay duoc ngay.
[tunnel]  - Dang nhap va thao tac ghi (POST/PUT/DELETE) se bi 403 vi guard
[tunnel]    mutation-origin (D03) chi cho phep Origin nam trong ALLOWED_ORIGINS.
[tunnel]  - Muon ghi duoc qua tunnel: copy URL do, them vao ALLOWED_ORIGINS trong
[tunnel]    BE/.env, roi khoi dong lai BE.
[tunnel] Nhan Ctrl-C de dong tunnel.
EOF

exec cloudflared tunnel --url "http://localhost:$PORT"
