@echo off
title AlbumKu Docker
cd /d "%~dp0"

echo Membangun dan menyalakan AlbumKu di Docker...
docker compose up -d --build

if errorlevel 1 (
  echo.
  echo Docker gagal dijalankan. Pastikan Docker Desktop sudah aktif.
  pause
  exit /b 1
)

echo.
echo AlbumKu siap di http://localhost:8088
start http://localhost:8088
