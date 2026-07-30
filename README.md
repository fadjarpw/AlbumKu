# AlbumKu — Generator Album Foto Lokal

AlbumKu membantu menyusun banyak foto ke halaman siap cetak tanpa perlu menata satu per satu di CorelDRAW. Semua foto diproses di browser pada komputer Anda dan tidak dikirim ke server.

## Cara paling mudah menjalankan

1. Klik dua kali `MULAI_ALBUMKU.bat`.
2. Tunggu sampai browser terbuka pada `http://localhost:3000`.
3. Klik **Pilih banyak foto**, pilih seluruh foto yang ingin dicetak, lalu klik **Open**.
4. Pilih kualitas **Seimbang** untuk hasil cetak yang bagus dengan PDF lebih kecil.
5. Pilih gaya cover. Klik salah satu foto lalu klik **Jadikan cover** jika ingin mengganti foto utama.
   Aktifkan **Pisahkan foto cover dari halaman isi** agar foto tersebut tidak diulang pada halaman 1.
   Posisi dan zoom cover dapat diatur sendiri dan tidak memengaruhi foto halaman isi.
6. Aktifkan **Variasi otomatis** agar halaman isi memadukan beberapa susunan berbeda.
7. Pilih ukuran kertas, orientasi, margin, dan jarak.
8. Klik foto pada pratinjau bila ingin memutar, menampilkan foto secara utuh, atau menghapusnya.
9. Tarik foto langsung pada halaman untuk mengubah posisi, lalu gunakan slider **Zoom** untuk memperbesar.
10. Ubah **Nama merek pada album** bila album dibuat untuk usaha atau studio Anda.
11. Pilih preset **Jilid kiri**, **Jilid kanan**, atau **Jilid atas**. Margin tiap sisi juga dapat diisi manual dalam milimeter.
12. Klik **Cetak** untuk membuka dialog printer.
13. Klik **Simpan PDF** untuk membuat dan mengunduh PDF secara otomatis.
    Ekspor otomatis memakai ukuran pratinjau yang sama agar crop, posisi, zoom, dan proporsi foto tidak berubah.

> Catatan: browser sengaja tidak menyimpan foto setelah halaman ditutup demi privasi. Pengaturan tampilan terakhir akan tetap diingat.

## Perintah pengembang

- Menjalankan aplikasi: `npm run dev`
- Menjalankan unit test: `npm test`
- Membuat versi produksi: `npm run build`

## Menjalankan dengan Docker

1. Pastikan Docker Desktop sudah aktif.
2. Klik dua kali `MULAI_DOCKER.bat`.
3. Buka `http://localhost:8088`.

Perintah manual:

- Menyalakan atau memperbarui: `docker compose up -d --build`
- Melihat status: `docker compose ps`
- Melihat catatan aplikasi: `docker compose logs -f`
- Menghentikan: `docker compose down`

Port dapat diganti, misalnya di PowerShell:
`$env:ALBUMKU_PORT=8090; docker compose up -d`

Paket image yang siap dipindahkan beserta panduan upload tersedia di folder
`rilis-docker`.

## Fitur utama

- Pilih atau tarik banyak foto sekaligus.
- 6 template otomatis untuk 1, 2, 4, 5, 6, atau 8 foto per halaman.
- 4 template cover: Penuh, Editorial, Klasik, dan Kolase.
- Mode variasi otomatis agar susunan halaman tidak monoton.
- Template dapat diganti khusus untuk setiap halaman melalui kontrol **Susunan halaman ini**.
- 13 varian posisi, termasuk Bertumpuk, Trio Sorotan, Fokus Empat, Strip Empat, Film Strip, dan Mozaik Enam.
- Optimasi resolusi dan JPEG untuk mencegah ukuran PDF membengkak.
- Penyesuaian titik fokus dengan drag langsung dan zoom 100–250%.
- Nama merek yang dapat diganti pada header dan footer album.
- Margin atas, kanan, bawah, dan kiri terpisah dengan preset area jilid.
- Foto serta posisi cover terpisah dari halaman isi.
- Tombol Cetak dan Simpan PDF otomatis tersedia sebagai dua alur berbeda.
- Dukungan kertas A4, A3, dan Letter; orientasi berdiri atau mendatar.
- Ubah urutan dengan drag-and-drop atau tombol panah.
- Putar foto, pilih mode penuh/utuh, dan tampilkan nama file.
- Cetak seluruh halaman atau simpan sebagai PDF.
- Pengaturan disimpan di browser, sedangkan foto tetap hanya berada di sesi lokal.
