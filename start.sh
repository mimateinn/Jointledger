#!/usr/bin/env bash
# Local trial: default SQLite. No Docker, no 5432 probe.
# Default production (build + start); JL_DEV=1 uses the dev server.
# Before start, overlay latest official Release. JL_SKIP_UPDATE=1 skips.
set -euo pipefail
cd "$(dirname "$0")"

if [ "${JL_SKIP_UPDATE:-}" != "1" ] && [ -f scripts/overlay-release.mjs ]; then
  echo "檨查官方更新…"
  set +e
  node scripts/overlay-release.mjs
  OVERLAY_EC=$?
  set -e
  if [ "$OVERLAY_EC" -eq 10 ]; then
    echo "已套用官方更新，重新啟動（資料夾同資料庫唔變）…"
    exec env JL_SKIP_UPDATE=1 bash "$0"
  elif [ "$OVERLAY_EC" -ne 0 ]; then
    echo "檨查更新失敗（exit $OVERLAY_EC），繼續用而家呢版。"
  fi
fi

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

if ! command -v node >/dev/null 2>&1 || ! command -v pnpm >/dev/null 2>&1; then
  echo "請先安裝 Node.js 同 pnpm（專案指定 pnpm@10.33.3），再開呢個腳本。"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "安裝依賴…"
  pnpm install
fi

mkdir -p data

if [ ! -f .env ]; then
  cp .env.example .env
  echo "已由 .env.example 複製 .env（API key 可留空）。"
fi

echo "套用 migrations…"
pnpm db:migrate

open_try() {
  if command -v open >/dev/null 2>&1; then
    open "http://localhost:3000" || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:3000" >/dev/null 2>&1 || true
  fi
}

wait_then_open() {
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
}

if [ "${JL_DEV:-}" = "1" ]; then
  echo "JL_DEV=1：開發伺服器 pnpm dev"
  wait_then_open
  pnpm dev
else
  echo "生產模式：pnpm build && pnpm start（JL_DEV=1 可行開發伺服器）"
  pnpm build
  wait_then_open
  pnpm start
fi
