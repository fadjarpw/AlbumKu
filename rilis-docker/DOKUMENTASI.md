# Dokumentasi Docker AlbumKu 1.0.0

Paket ini berisi aplikasi AlbumKu dalam bentuk image Docker siap dipindahkan ke komputer atau server lain.

## Isi paket

| File | Kegunaan |
|---|---|
| `albumku-1.0.0-linux-amd64.tar` | Image Docker AlbumKu untuk Linux/Windows x64 |
| `docker-compose.yml` | Menjalankan AlbumKu pada port 8088 |
| `MUAT_DAN_JALANKAN_WINDOWS.bat` | Cara otomatis untuk Windows |
| `SHA256SUMS.txt` | Sidik jari file untuk memeriksa kerusakan |
| `DOKUMENTASI.md` | Panduan lengkap ini |

Nama image setelah dimuat: `albumku:1.0.0`.

## Persyaratan

- Docker Desktop untuk Windows atau Docker Engine untuk Linux.
- Komputer/server berarsitektur x86-64/AMD64.
- Minimal RAM 512 MB; disarankan 1 GB.
- Port 8088 tersedia, atau ganti port pada `docker-compose.yml`.

## Cara cepat di Windows

1. Salin seluruh folder `rilis-docker` ke komputer tujuan.
2. Pastikan Docker Desktop sudah aktif.
3. Klik dua kali `MUAT_DAN_JALANKAN_WINDOWS.bat`.
4. Buka `http://localhost:8088`.

## Cara manual

Jalankan dari folder paket:

```bash
docker load -i albumku-1.0.0-linux-amd64.tar
docker compose up -d
```

Buka:

```text
http://localhost:8088
```

Periksa status:

```bash
docker compose ps
docker compose logs --tail 100
```

Status yang benar adalah `Up` dan kemudian `healthy`.

Menghentikan aplikasi:

```bash
docker compose down
```

Menyalakan kembali:

```bash
docker compose up -d
```

## Mengubah port

Pada `docker-compose.yml`, ubah:

```yaml
ports:
  - "8088:3000"
```

Contoh agar aplikasi dibuka melalui port 8090:

```yaml
ports:
  - "8090:3000"
```

Setelah mengubahnya, jalankan:

```bash
docker compose up -d --force-recreate
```

## Mengunggah ke Docker Hub

Ganti `NAMA_AKUN` dengan username Docker Hub Anda:

```bash
docker load -i albumku-1.0.0-linux-amd64.tar
docker login
docker tag albumku:1.0.0 NAMA_AKUN/albumku:1.0.0
docker tag albumku:1.0.0 NAMA_AKUN/albumku:latest
docker push NAMA_AKUN/albumku:1.0.0
docker push NAMA_AKUN/albumku:latest
```

Image kemudian dapat dijalankan dari komputer lain:

```bash
docker run -d \
  --name albumku \
  --restart unless-stopped \
  -p 8088:3000 \
  NAMA_AKUN/albumku:1.0.0
```

Untuk Windows PowerShell, tuliskan perintah `docker run` dalam satu baris.

## Mengunggah langsung ke server tanpa Docker Hub

Unggah berkas dengan aplikasi transfer file atau SCP:

```bash
scp albumku-1.0.0-linux-amd64.tar user@alamat-server:/opt/albumku/
scp docker-compose.yml user@alamat-server:/opt/albumku/
```

Masuk ke server, lalu jalankan:

```bash
cd /opt/albumku
docker load -i albumku-1.0.0-linux-amd64.tar
docker compose up -d
```

Jika server memakai firewall, buka port yang dipakai, misalnya 8088. Untuk server publik, disarankan memakai reverse proxy HTTPS seperti Caddy, Nginx, atau Traefik.

## Memeriksa integritas file

Windows PowerShell:

```powershell
Get-FileHash .\albumku-1.0.0-linux-amd64.tar -Algorithm SHA256
```

Linux:

```bash
sha256sum albumku-1.0.0-linux-amd64.tar
```

Hasilnya harus sama dengan nilai di `SHA256SUMS.txt`.

## Privasi dan penyimpanan

- Foto tidak disimpan di dalam container.
- Foto hanya diproses oleh browser pengguna.
- Tidak ada database atau volume yang perlu dicadangkan.
- Menghapus atau membuat ulang container tidak menghapus foto asli pengguna.
- Pengaturan kecil seperti nama merek disimpan di browser pengguna, bukan pada server.

## Pemecahan masalah

### Port sudah digunakan

Ubah port `8088` pada `docker-compose.yml`, kemudian buat ulang container.

### Container tidak sehat

```bash
docker compose logs --tail 200
docker compose restart
```

### Muncul `exec format error`

Paket ini dibuat untuk `linux/amd64`. Pada server ARM64, gunakan emulasi AMD64 atau bangun ulang image khusus ARM64.

### Halaman tidak dapat dibuka dari komputer lain

Periksa firewall server dan pastikan port 8088 diizinkan. Jangan memakai `localhost` dari komputer lain; gunakan alamat IP server, misalnya:

```text
http://192.168.1.10:8088
```

## Informasi image

- Nama: `albumku`
- Versi: `1.0.0`
- Sistem: Linux
- Arsitektur: AMD64
- Port di dalam container: 3000
- Port bawaan di host: 8088
- Kebijakan restart: `unless-stopped`
