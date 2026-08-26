@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js, then run this launcher again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Install Node.js/npm, then run this launcher again.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } exit 1 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo Domain Looker is already running.
  start "" "http://127.0.0.1:5173"
  exit /b 0
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install --cache ".npm-cache"
  if errorlevel 1 (
    echo Dependency install failed.
    pause
    exit /b 1
  )
)

echo Starting Domain Looker...
echo Local URL: http://127.0.0.1:5173
start "" "http://127.0.0.1:5173"

call npm run dev

echo.
echo Domain Looker stopped.
pause
