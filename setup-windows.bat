@echo off
chcp 65001 >nul
title Cashier POS — Setup

echo.
echo ╔═══════════════════════════════════════════════╗
echo ║  Cashier POS — Windows Setup                  ║
echo ║  SQLite Edition (no database server needed)   ║
echo ╚═══════════════════════════════════════════════╝
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Install Node.js v20+ from https://nodejs.org
    pause
    exit /b 1
)
echo ✅ Node.js found

:: Create data directory
if not exist "%~dp0data" mkdir "%~dp0data"
if not exist "%~dp0uploads" mkdir "%~dp0uploads"

:: Install backend dependencies
echo.
echo [1/4] Installing backend dependencies...
cd /d "%~dp0backend"
call npm install --production
if %errorlevel% neq 0 (
    echo ❌ Backend install failed
    pause
    exit /b 1
)
echo ✅ Backend dependencies installed

:: Setup .env if not exists
if not exist "%~dp0backend\.env" (
    copy "%~dp0backend\.env.example" "%~dp0backend\.env"
    echo ✅ Created .env from template
) else (
    echo ✅ .env already exists
)

:: Generate Prisma client + push SQLite schema
echo.
echo [2/4] Setting up SQLite database...
call npx prisma generate
call npx prisma db push --accept-data-loss
if %errorlevel% neq 0 (
    echo ❌ Database setup failed
    pause
    exit /b 1
)
echo ✅ SQLite database ready

:: Build frontend
echo.
echo [3/4] Building frontend...
cd /d "%~dp0frontend"
call npm install
call npx vite build
if %errorlevel% neq 0 (
    echo ❌ Frontend build failed
    pause
    exit /b 1
)
echo ✅ Frontend built

:: Fresh install
echo.
echo [4/4] Initializing fresh store...
cd /d "%~dp0"
set /p STORE_NAME="  Store name (Arabic): "
node scripts/fresh-install.js --store "%STORE_NAME%" --reset-db

echo.
echo ╔═══════════════════════════════════════════════╗
echo ║  ✅ Setup Complete!                            ║
echo ║                                               ║
echo ║  To start: double-click start-windows.bat     ║
echo ║  Customer needs activation code from vendor.  ║
echo ╚═══════════════════════════════════════════════╝
echo.
pause
