@echo off
chcp 65001 >nul
title Cashier POS

:: Try Electron first (installed app mode)
if exist "%~dp0node_modules\electron\dist\electron.exe" (
    echo Starting Cashier POS (Electron)...
    cd /d "%~dp0"
    npx electron .
    exit /b
)

:: Fallback: start backend + open browser
echo Starting Cashier POS (Browser Mode)...
echo.

:: Start backend
cd /d "%~dp0backend"
start /min "Cashier Backend" node src/server.js

:: Wait for backend
echo Waiting for backend...
:wait_loop
timeout /t 1 /nobreak >nul
curl -s http://localhost:3001/api/auth/license-status >nul 2>&1
if %errorlevel% neq 0 goto wait_loop

:: Open browser
echo ✅ Backend ready — opening browser...
start http://localhost:3001

echo.
echo Cashier POS is running at http://localhost:3001
echo Close this window to stop the server.
echo.
pause
