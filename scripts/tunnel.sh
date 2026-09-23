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

case "$PORT" in
  *[!0-9]*|??????*) echo "[tunnel] PORT phai la so tu 1 den 65535." >&2; exit 2 ;;
esac
PORT=$((10#$PORT))
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo "[tunnel] PORT phai la so tu 1 den 65535." >&2
  exit 2
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "[tunnel] Chua cai cloudflared. Cai bang: brew install cloudflared" >&2
  exit 1
fi

listener_pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN -n -P)"
if [ -z "$listener_pids" ]; then
  echo "[tunnel] Chua co dich vu nao chay o cong $PORT." >&2
  echo "[tunnel] Hay chay dich vu truoc o mot terminal khac (vi du: make cms), roi mo tunnel." >&2
  exit 1
fi

# Tunnel CMS chi nhan tien trinh khoi dong tu CMS trong repo nay.
if [ "$LABEL" = CMS ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)" || exit 1
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)" || exit 1
  CMS_DIR="$ROOT/CMS"
  if [ -L "$CMS_DIR" ] || [ ! -f "$CMS_DIR/package.json" ]; then
    echo "[tunnel] Can thu muc CMS hop le tai $CMS_DIR." >&2
    exit 1
  fi
  for pid in $listener_pids; do
    listener_dir="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
    if [ "$listener_dir" != "$CMS_DIR" ]; then
      echo "[tunnel] Tu choi cong $PORT: tien trinh $pid khong chay tu $CMS_DIR." >&2
      echo "[tunnel] Dung dich vu chiem cong, chay make cms, roi thu lai." >&2
      exit 1
    fi
  done
fi

cat <<EOF
[tunnel] Mo quick tunnel toi http://localhost:$PORT ($LABEL)
[tunnel] CMS: mo duong dan /cms/ tren URL tunnel.
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
