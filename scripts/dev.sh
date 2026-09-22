#!/usr/bin/env bash
# Chay nhieu dich vu dev cung luc, gan tien to log, Ctrl-C tat tat ca.
# Dung: scripts/dev.sh be cms        (chon trong: be, worker, cms, fe)
# Tuong thich bash 3.2 (macOS mac dinh): khong dung wait -n hay mang ket hop.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
: "${ROOT:?ROOT rong}"

if [ "$#" -eq 0 ]; then
  echo "Dung: $0 <be|worker|cms|fe> [thanh phan khac...]" >&2
  exit 2
fi

# Neu can BE hoac worker thi bat ha tang (MySQL) truoc.
need_db=0
for svc in "$@"; do
  case "$svc" in
    be|worker) need_db=1 ;;
  esac
done
if [ "$need_db" -eq 1 ]; then
  bash "$SCRIPT_DIR/ensure-docker.sh" || exit 1
fi

pids=""

# Tat ca tien trinh con nam cung process group -> kill 0 se tat het khi thoat.
cleanup() {
  trap - INT TERM EXIT
  printf '\n[dev] Dang dung cac dich vu...\n'
  kill 0 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# run <ten hien thi> <thu muc con> <lenh...>
run() {
  local name="$1"; shift
  local dir="$1"; shift
  ( cd "$ROOT/$dir" && exec "$@" ) 2>&1 \
    | while IFS= read -r line; do printf '[%s] %s\n' "$name" "$line"; done &
  pids="$pids $!"
}

started=0
for svc in "$@"; do
  case "$svc" in
    be)     run "BE"  "BE"  npm run start:dev;        started=1 ;;
    worker) run "WRK" "BE"  npm run start:worker:dev; started=1 ;;
    cms)    run "CMS" "CMS" npm run dev;              started=1 ;;
    fe)
      if [ -f "$ROOT/FE/package.json" ]; then
        run "FE" "FE" npm run dev; started=1
      else
        echo "[FE] FE chua duoc khoi tao (CMS-11). Bo qua."
      fi
      ;;
    *) echo "[dev] Khong ro dich vu: $svc (chi nhan be|worker|cms|fe)" >&2 ;;
  esac
done

if [ "$started" -eq 0 ]; then
  echo "[dev] Khong co dich vu nao de chay."
  trap - INT TERM EXIT
  exit 0
fi

echo "[dev] Da khoi dong cac dich vu. Nhan Ctrl-C de dung tat ca."

# Neu bat ky dich vu nao thoat, dung phan con lai (bash 3.2 khong co wait -n).
while :; do
  for pid in $pids; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "[dev] Mot dich vu da dung. Dung phan con lai."
      exit 1
    fi
  done
  sleep 2
done
