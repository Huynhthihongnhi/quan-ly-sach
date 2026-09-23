#!/usr/bin/env bash
# Chay nhieu dich vu dev cung luc, gan tien to log, Ctrl-C tat tat ca.
# Dung: scripts/dev.sh be cms        (chon trong: be, worker, cms, fe)
# Tuong thich bash 3.2 (macOS mac dinh): khong dung wait -n hay mang ket hop.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)" || exit 1
ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)" || exit 1
: "${ROOT:?ROOT rong}"

if [ "$#" -eq 0 ]; then
  echo "Dung: $0 <be|worker|cms|fe> [thanh phan khac...]" >&2
  exit 2
fi

# Kiem tra tat ca dich vu truoc khi bat Docker hay tien trinh con.
for svc in "$@"; do
  case "$svc" in
    be|worker) dir=BE ;;
    cms) dir=CMS ;;
    fe) continue ;;
    *) echo "[dev] Khong ro dich vu: $svc (chi nhan be|worker|cms|fe)" >&2; exit 2 ;;
  esac
  if [ -L "$ROOT/$dir" ] || [ ! -f "$ROOT/$dir/package.json" ]; then
    echo "[dev] Can thu muc $ROOT/$dir voi package.json, khong dung symlink." >&2
    exit 1
  fi
done

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
set -m

# Moi dich vu co process group rieng; chi dung cac group do script nay tao.
cleanup() {
  trap - INT TERM EXIT
  printf '\n[dev] Dang dung cac dich vu...\n'
  # 1) TERM thang cho tien trinh dich vu (group leader = $pid sau exec) de no
  #    chay trap dung tin cay; TERM ca nhom cung luc de bash mat tin hieu (race).
  for pid in $pids; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  # 2) Cho tung dich vu ket thuc roi moi thoat.
  for pid in $pids; do
    wait "$pid" 2>/dev/null || true
  done
  # 3) Luoi an toan: don tien trinh con con sot lai trong nhom (neu dich vu
  #    khong tu tat het). Chay sau buoc 2 nen khong anh huong trap o buoc 1.
  for pid in $pids; do
    kill -TERM -- "-$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# run <ten hien thi> <thu muc con> <lenh...>
run() {
  local name="$1"; shift
  local dir="$1"; shift
  # Dung exec + process substitution: tien trinh dich vu la truong nhom (group
  # leader = $!), nen no nhan TERM truc tiep va van giu tien to log [ten].
  (
    set +m
    cd "$ROOT/$dir" || exit 1
    exec "$@" > >(while IFS= read -r line; do printf '[%s] %s\n' "$name" "$line"; done) 2>&1
  ) &
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
