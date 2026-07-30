@echo off
title AlbumKu - Generator Album Foto
cd /d "%~dp0"

if not exist node_modules (
  echo Menyiapkan AlbumKu untuk pertama kali...
  call npm install
)

echo.
echo AlbumKu sedang dinyalakan.
echo Browser akan terbuka otomatis...
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3000"
call npm run dev
