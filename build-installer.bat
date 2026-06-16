@echo off
setlocal
echo Starting Accountant Windows build...
cd /d "%~dp0"
echo Checking Node.js...
node -v
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not in PATH.
  pause
  exit /b 1
)
echo Installing root dependencies...
call npm install
if errorlevel 1 (
  echo ERROR: npm install failed.
  pause
  exit /b 1
)
echo Installing frontend dependencies...
cd frontend
call npm install
if errorlevel 1 (
  echo ERROR: frontend npm install failed.
  pause
  exit /b 1
)
echo Building frontend...
call npm run build
if errorlevel 1 (
  echo ERROR: frontend build failed.
  pause
  exit /b 1
)
cd ..
echo Building Windows installer...
call npx electron-builder --win nsis
if errorlevel 1 (
  echo ERROR: electron-builder failed.
  pause
  exit /b 1
)
echo Build completed successfully.
echo Check the dist folder for the installer.
pause
exit /b 0
