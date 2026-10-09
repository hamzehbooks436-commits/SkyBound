@echo off
cd /d "%~dp0"
if not exist node_modules call npm.cmd install
if errorlevel 1 (
  echo Dependency installation could not finish. Please check Node.js and your connection.
  pause
  exit /b 1
)
start "Skybound Airworks server" /min cmd /c "npm.cmd run dev"
timeout /t 3 /nobreak >nul
start "" http://127.0.0.1:5273
