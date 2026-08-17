#!/usr/bin/env bash
# 本機一鍵試用：現有 docker-compose Postgres + pnpm migrate + next start
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "請先開啟 Docker Desktop，再開呢個腳本。"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "請先安裝 Node.js 同 pnpm（專案指定 pnpm@10.33.3），再開呢個腳本。"
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "已由 .env.example 複製 .env（API key 可留空）。"
fi

echo "起 Postgres（docker-compose.yml）…"
docker compose up -d --wait

if [ ! -d node_modules ]; then
  echo "安裝依賴…"
  pnpm install
fi

echo "套用 migrations…"
pnpm db:migrate

if [ ! -f .next/BUILD_ID ]; then
  echo "未建置，行 pnpm build…"
  pnpm build
fi

open_try() {
  if command -v open >/dev/null 2>&1; then
    open "http://localhost:3000" || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:3000" >/dev/null 2>&1 || true
  fi
}
open_try || true
echo "開 http://localhost:3000 （開唔到瀏覽器唔當失敗）"

pnpm start
