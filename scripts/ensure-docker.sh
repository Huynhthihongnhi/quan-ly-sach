#!/usr/bin/env bash
# Bao dam Docker daemon dang chay, roi bat MySQL + Mailpit cho local dev.
# Khong nhan tham so. An toan de goi nhieu lan (idempotent).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
: "${ROOT:?ROOT rong}"
BE_DIR="$ROOT/BE"

if [ ! -d "$BE_DIR" ]; then
  echo "[docker] Khong thay thu muc BE tai: $BE_DIR" >&2
  exit 1
fi

# Kiem tra env can thiet. Khong tu copy vi .env* la duong dan duoc bao ve (backbone.yml).
missing=0
if [ ! -f "$BE_DIR/docker/.env.docker" ]; then
  echo "[docker] Thieu BE/docker/.env.docker. Tao bang:" >&2
  echo "           cp BE/docker/.env.docker.example BE/docker/.env.docker" >&2
  missing=1
fi
if [ ! -f "$BE_DIR/.env" ]; then
  echo "[docker] Thieu BE/.env. Tao bang:" >&2
  echo "           cp BE/.env.example BE/.env" >&2
  missing=1
fi
if [ "$missing" -eq 1 ]; then
  echo "[docker] Tao cac file tren roi chay lai. Luu y: DATABASE_PASSWORD trong BE/.env" >&2
  echo "         phai khop MYSQL_APP_PASSWORD trong BE/docker/.env.docker." >&2
  exit 1
fi

start_docker_desktop() {
  if [ "$(uname -s)" = "Darwin" ]; then
    echo "[docker] Docker daemon chua chay. Dang mo Docker Desktop..."
    open -a Docker || {
      echo "[docker] Khong mo duoc Docker Desktop. Hay mo thu cong roi chay lai." >&2
      return 1
    }
  else
    echo "[docker] Docker daemon chua chay. Hay khoi dong Docker roi chay lai." >&2
    return 1
  fi
}

# 1) Cho daemon san sang (toi da 90 giay).
if ! docker info >/dev/null 2>&1; then
  start_docker_desktop || exit 1
  printf '[docker] Cho daemon san sang'
  waited=0
  timeout=90
  until docker info >/dev/null 2>&1; do
    if [ "$waited" -ge "$timeout" ]; then
      printf '\n'
      echo "[docker] Qua $timeout giay ma daemon chua san sang. Hay kiem tra Docker Desktop." >&2
      exit 1
    fi
    printf '.'
    sleep 2
    waited=$((waited + 2))
  done
  printf ' OK\n'
fi

# 2) Bat MySQL + Mailpit. Script docker:up da co co --wait (cho healthcheck).
echo "[docker] Bat MySQL + Mailpit (docker compose up -d --wait)..."
cd "$BE_DIR"
npm run docker:up
echo "[docker] Ha tang local san sang: MySQL 127.0.0.1:3306, Mailpit UI http://127.0.0.1:8025"
