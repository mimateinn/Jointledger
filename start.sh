#!/usr/bin/env bash
# 本機一鍵試用：5432 已通就 skip compose；否則 Docker Postgres + migrate + next start
set -euo pipefail
cd "$(dirname "$0")"

port_open() {
  local port="$1"
  if (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1; then
    return 0
  fi
  if command -v nc >/dev/null 2>&1 && nc -z -w 1 127.0.0.1 "$port" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

if ! command -v pnpm >/dev/null 2>&1; then
  echo "請先安裝 Node.js 同 pnpm（專案指定 pnpm@10.33.3），再開呢個腳本。"
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "已由 .env.example 複製 .env（API key 可留空）。"
fi

if port_open 5432; then
  echo "localhost:5432 已通，skip compose。"
else
  if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    echo "請先開啟 Docker Desktop，再開呢個腳本。"
    exit 1
  fi
  echo "起 Postgres（docker-compose.yml）…"
  docker compose up -d --wait
fi

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

(
  for _ in {1..90}; do
    if port_open 3000; then
      open_try || true
      echo "開 http://localhost:3000 （開唔到瀏覽器唔當失敗）"
      exit 0
    fi
    sleep 1
  done
) &

pnpm start
