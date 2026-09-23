# Makefile dieu phoi dev cho Quan-Ly-Sach (BE + CMS; FE khi da khoi tao).
# Chi dung cho local dev tren macOS voi Docker Desktop.
# Xem "make help" de biet danh sach lenh.

SHELL := /bin/bash
ROOT := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
CMS_PORT := 8081
export CMS_PORT
FE_PORT ?= 5173

.DEFAULT_GOAL := help
.PHONY: help install db-up db-down db-reset be worker cms fe dev dev-all stop tunnel tunnel-cms tunnel-fe create-admin doctor

help:
	@echo "Quan-Ly-Sach - lenh dev (dung: make <lenh>)"
	@echo ""
	@echo "  Ha tang (Docker):"
	@echo "    make db-up        Bat MySQL + Mailpit; tu mo Docker Desktop neu can"
	@echo "    make db-down      Tat container, giu du lieu"
	@echo "    make db-reset     Tat va XOA volume MySQL (hoi xac nhan, mat du lieu)"
	@echo ""
	@echo "  Chay tung phan (foreground):"
	@echo "    make be           API NestJS (start:dev); bat DB truoc"
	@echo "    make worker       Worker job (start:worker:dev); bat DB truoc"
	@echo "    make cms          CMS Vite dev, cong $(CMS_PORT)"
	@echo "    make fe           FE dev (neu FE da khoi tao)"
	@echo ""
	@echo "  Chay nhieu phan cung luc (Ctrl-C tat het):"
	@echo "    make dev          DB + BE + CMS"
	@echo "    make dev-all      DB + BE + worker + CMS + FE (neu co)"
	@echo ""
	@echo "  Dung:"
	@echo "    Ctrl-C            Tat cac dich vu dang chay trong terminal do"
	@echo "    make stop         Tat BE, worker, CMS, tunnel (Docker van chay)"
	@echo "    make db-down      Tat Docker MySQL + Mailpit"
	@echo ""
	@echo "  Tai khoan:"
	@echo "    make create-admin Tao admin dau tien (chi khi chua co admin)"
	@echo ""
	@echo "  Tunnel Cloudflare (https://try.cloudflare.com):"
	@echo "    make tunnel-cms       Mo tunnel toi CMS (cong $(CMS_PORT))"
	@echo "    make tunnel-fe        Mo tunnel toi FE (cong $(FE_PORT))"
	@echo "    make tunnel PORT=1234 Mo tunnel toi cong bat ky"
	@echo ""
	@echo "  Khac:"
	@echo "    make install      Cai dependency BE va CMS"
	@echo "    make doctor       Kiem tra docker, cloudflared, cac cong"
	@echo ""
	@echo "  Ghi chu: mail can worker chay; qua tunnel muon dang nhap/ghi thi"
	@echo "  them URL trycloudflare vao ALLOWED_ORIGINS trong BE/.env roi khoi dong lai BE."

install:
	cd "$(ROOT)/BE" && npm ci
	cd "$(ROOT)/CMS" && npm ci --ignore-scripts

db-up:
	bash "$(ROOT)/scripts/ensure-docker.sh"

db-down:
	cd "$(ROOT)/BE" && npm run docker:down

db-reset:
	@echo "CANH BAO: se xoa toan bo du lieu MySQL local (volume quan-ly-sach-local-mysql-data)."
	@read -r -p "Go 'yes' de xac nhan: " ans; \
	if [ "$$ans" = "yes" ]; then \
	  cd "$(ROOT)/BE" && npm run docker:down:clean; \
	else \
	  echo "Da huy."; \
	fi

be: db-up
	cd "$(ROOT)/BE" && npm run start:dev

worker: db-up
	cd "$(ROOT)/BE" && npm run start:worker:dev

cms:
	cd "$(ROOT)/CMS" && npm run dev

fe:
	@if [ -f "$(ROOT)/FE/package.json" ]; then \
	  cd "$(ROOT)/FE" && npm run dev; \
	else \
	  echo "FE chua duoc khoi tao (CMS-11)."; \
	fi

dev:
	bash "$(ROOT)/scripts/dev.sh" be cms

dev-all:
	bash "$(ROOT)/scripts/dev.sh" be worker cms fe

stop:
	@echo "Dung BE, worker, CMS, tunnel (Docker van chay)..."
	@pkill -f "$(ROOT)/BE/node_modules/.bin/[n]est" 2>/dev/null || true
	@pkill -f "$(ROOT)/CMS/node_modules/.bin/[v]ite" 2>/dev/null || true
	@pkill -f "[c]loudflared tunnel" 2>/dev/null || true
	@pkill -f "dist/[m]ain" 2>/dev/null || true
	@pkill -f "dist/[w]orker" 2>/dev/null || true
	@echo "Xong. Dung 'make db-down' de tat Docker MySQL + Mailpit."

create-admin: db-up
	@echo "Tao admin dau tien. Chi tao duoc khi CHUA co admin nao; neu da co se bao created:false."
	@read -r -p "Email admin [admin@local.test]: " email; \
	email="$${email:-admin@local.test}"; \
	read -r -s -p "Mat khau (it nhat 12 ky tu): " pass; echo ""; \
	if [ "$${#pass}" -lt 12 ]; then echo "Mat khau phai it nhat 12 ky tu."; exit 1; fi; \
	cd "$(ROOT)/BE" && BOOTSTRAP_ADMIN_EMAIL="$$email" BOOTSTRAP_ADMIN_PASSWORD="$$pass" BOOTSTRAP_ADMIN_DISPLAY_NAME="System Administrator" npm run bootstrap:admin

tunnel:
	@if [ -z "$(PORT)" ]; then echo "Thieu PORT. Vi du: make tunnel PORT=8081"; exit 2; fi
	bash "$(ROOT)/scripts/tunnel.sh" "$(PORT)" "custom"

tunnel-cms:
	bash "$(ROOT)/scripts/tunnel.sh" "$(CMS_PORT)" "CMS"

tunnel-fe:
	@if [ -f "$(ROOT)/FE/package.json" ]; then \
	  bash "$(ROOT)/scripts/tunnel.sh" "$(FE_PORT)" "FE"; \
	else \
	  echo "FE chua duoc khoi tao (CMS-11). Chua co gi de tunnel."; \
	fi

doctor:
	@echo "ROOT:        $(ROOT)"
	@echo "docker:      $$(command -v docker || echo 'CHUA CAI')"
	@docker info >/dev/null 2>&1 && echo "daemon:      RUNNING" || echo "daemon:      NOT running (chay: make db-up)"
	@echo "cloudflared: $$(command -v cloudflared || echo 'CHUA CAI (brew install cloudflared)')"
	@lsof -iTCP:3306 -sTCP:LISTEN -n -P >/dev/null 2>&1 && echo "3306 (MySQL): dang lang nghe" || echo "3306 (MySQL): trong"
	@lsof -iTCP:3000 -sTCP:LISTEN -n -P >/dev/null 2>&1 && echo "3000 (BE):    dang lang nghe" || echo "3000 (BE):    trong"
	@lsof -iTCP:$(CMS_PORT) -sTCP:LISTEN -n -P >/dev/null 2>&1 && echo "$(CMS_PORT) (CMS):   dang lang nghe" || echo "$(CMS_PORT) (CMS):   trong"
