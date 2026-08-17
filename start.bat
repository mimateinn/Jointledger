@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

where pnpm >nul 2>&1
if errorlevel 1 (
  echo 請先安裝 Node.js 同 pnpm（專案指定 pnpm@10.33.3），再開呢個腳本。
  exit /b 1
)

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo 已由 .env.example 複製 .env（API key 可留空）。
)

call :port_open 5432
if not errorlevel 1 (
  echo localhost:5432 已通，skip compose。
  goto :db_ready
)

docker info >nul 2>&1
if errorlevel 1 (
  echo 請先開啟 Docker Desktop，再開呢個腳本。
  exit /b 1
)

echo 起 Postgres（docker-compose.yml）…
docker compose up -d --wait
if errorlevel 1 exit /b 1

:db_ready
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

start "" /b powershell -NoProfile -Command "for ($i=0; $i -lt 90; $i++) { try { (New-Object System.Net.Sockets.TcpClient('127.0.0.1', 3000)).Close(); try { Start-Process 'http://localhost:3000' } catch {}; break } catch { Start-Sleep -Seconds 1 } }"
echo 等 http://localhost:3000 listen 之後先開瀏覽器（開唔到唔當失敗）

call pnpm start
endlocal
exit /b %ERRORLEVEL%

:port_open
powershell -NoProfile -Command "try { (New-Object System.Net.Sockets.TcpClient('127.0.0.1', %~1)).Close(); exit 0 } catch { exit 1 }"
exit /b %ERRORLEVEL%
