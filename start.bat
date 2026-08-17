@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul

where node >nul 2>&1
if errorlevel 1 (
  echo 請先安裝 Node.js 同 pnpm（專案指定 pnpm@10.33.3），再開呢個腳本。
  exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  echo 請先安裝 Node.js 同 pnpm（專案指定 pnpm@10.33.3），再開呢個腳本。
  exit /b 1
)

if not exist "node_modules\" (
  echo 安裝依賴…
  call pnpm install
  if errorlevel 1 exit /b 1
)

if not exist "data\" mkdir data

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo 已由 .env.example 複製 .env（API key 可留空）。
)

echo 套用 migrations…
call pnpm db:migrate
if errorlevel 1 exit /b 1

if /I "%JL_DEV%"=="1" (
  echo JL_DEV=1：開發伺服器 pnpm dev
  start "" /b powershell -NoProfile -Command "for ($i=0; $i -lt 90; $i++) { try { (New-Object System.Net.Sockets.TcpClient('127.0.0.1', 3000)).Close(); try { Start-Process 'http://localhost:3000' } catch {}; break } catch { Start-Sleep -Seconds 1 } }"
  echo 等 http://localhost:3000 listen 之後先開瀏覽器（開唔到唔當失敗）
  call pnpm dev
  endlocal
  exit /b %ERRORLEVEL%
)

echo 生產模式：pnpm build ^&^& pnpm start（JL_DEV=1 可行開發伺服器）
call pnpm build
if errorlevel 1 exit /b 1

start "" /b powershell -NoProfile -Command "for ($i=0; $i -lt 90; $i++) { try { (New-Object System.Net.Sockets.TcpClient('127.0.0.1', 3000)).Close(); try { Start-Process 'http://localhost:3000' } catch {}; break } catch { Start-Sleep -Seconds 1 } }"
echo 等 http://localhost:3000 listen 之後先開瀏覽器（開唔到唔當失敗）

call pnpm start
endlocal
exit /b %ERRORLEVEL%
