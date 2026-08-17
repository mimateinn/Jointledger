@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

docker info >nul 2>&1
if errorlevel 1 (
  echo 請先開啟 Docker Desktop，再開呢個腳本。
  exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  echo 請先安裝 Node.js 同 pnpm（專案指定 pnpm@10.33.3），再開呢個腳本。
  exit /b 1
)

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo 已由 .env.example 複製 .env（API key 可留空）。
)

echo 起 Postgres（docker-compose.yml）…
docker compose up -d --wait
if errorlevel 1 exit /b 1

if not exist "node_modules\" (
  echo 安裝依賴…
  call pnpm install
  if errorlevel 1 exit /b 1
)

echo 套用 migrations…
call pnpm db:migrate
if errorlevel 1 exit /b 1

if not exist ".next\BUILD_ID" (
  echo 未建置，行 pnpm build…
  call pnpm build
  if errorlevel 1 exit /b 1
)

echo 開 http://localhost:3000 （開唔到瀏覽器唔當失敗）
start "" "http://localhost:3000" >nul 2>&1

call pnpm start
endlocal
