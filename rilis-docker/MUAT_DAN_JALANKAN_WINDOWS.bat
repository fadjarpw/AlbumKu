@echo off
title AlbumKu 1.0.0
cd /d "%~dp0"

if not exist albumku-1.0.0-linux-amd64.tar (
  echo File image Docker tidak ditemukan.
  echo Pastikan albumku-1.0.0-linux-amd64.tar berada di folder ini.
  pause
  exit /b 1
)

echo Memuat image AlbumKu...
docker load -i albumku-1.0.0-linux-amd64.tar
if errorlevel 1 (
  echo Gagal memuat image. Pastikan Docker Desktop sudah aktif.
  pause
  exit /b 1
)

echo Menyalakan AlbumKu...
docker compose up -d
if errorlevel 1 (
  echo Gagal menyalakan AlbumKu. Periksa apakah port 8088 sudah digunakan.
  pause
  exit /b 1
)

echo.
echo AlbumKu siap di http://localhost:8088
start http://localhost:8088
