@echo off
setlocal EnableDelayedExpansion

set "NODE=C:\tools\node-v22.13.1-win-x64\node.exe"
set "NPM_CLI=C:\tools\node-v22.13.1-win-x64\node_modules\npm\bin\npm-cli.js"
set "ROOT=%~dp0"

echo.
echo ====================================================
echo   Screening Console  ^|  Local Dev Launcher
echo ====================================================
echo.

:: ── 1. Verify Node ────────────────────────────────────
if not exist "%NODE%" (
    echo [ERROR] node.exe not found at %NODE%
    echo Run setup first.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('"%NODE%" --version') do echo [OK] Node %%v

:: ── 2. Install pnpm if needed ─────────────────────────
"%NODE%" "%NPM_CLI%" list -g pnpm --depth=0 >nul 2>&1
if errorlevel 1 (
    echo [..] Installing pnpm...
    "%NODE%" "%NPM_CLI%" install -g pnpm --quiet
    if errorlevel 1 ( echo [ERROR] pnpm install failed & pause & exit /b 1 )
    echo [OK] pnpm installed
) else (
    echo [OK] pnpm already installed
)

:: pnpm.cmd location after global npm install
set "PNPM=%APPDATA%\npm\pnpm.cmd"
if not exist "%PNPM%" (
    echo [ERROR] pnpm.cmd not found at %PNPM%
    pause & exit /b 1
)

:: ── 3. Install workspace deps ─────────────────────────
echo.
echo [..] Installing workspace dependencies (first run: 1-2 min)...
call "%PNPM%" install --no-frozen-lockfile
if errorlevel 1 ( echo [ERROR] pnpm install failed & pause & exit /b 1 )
echo [OK] Dependencies ready

:: ── 4. Build API server ───────────────────────────────
echo.
echo [..] Building API server...
call "%PNPM%" --filter @workspace/api-server run build
if errorlevel 1 ( echo [ERROR] API build failed & pause & exit /b 1 )
echo [OK] API server built

:: ── 5. Launch both servers ────────────────────────────
echo.
echo [..] Starting servers...
echo.

start "API  :8080" cmd /k "title API Server :8080 && set PORT=8080 && set NODE_ENV=development && "%NODE%" --enable-source-maps "%ROOT%artifacts\api-server\dist\index.mjs" || pause"

timeout /t 3 /nobreak >nul

start "UI   :5173" cmd /k "title Frontend :5173 && set PATH=C:\tools\node-v22.13.1-win-x64;%%PATH%% && call "%PNPM%" --filter @workspace/screening-console run dev || pause"

:: ── 6. Open browser ───────────────────────────────────
timeout /t 6 /nobreak >nul
start http://localhost:5173

echo.
echo ====================================================
echo   Frontend  ->  http://localhost:5173
echo   API       ->  http://localhost:8080/api/healthz
echo ====================================================
echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
echo.
pause
