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
12. Pilih **Koreksi hasil cetak → Cerah untuk cetak** bila hasil printer biasanya lebih gelap daripada layar. Terang, kontras, dan warna juga dapat disesuaikan manual.
13. Klik **Cetak** untuk membuka dialog printer.
14. Klik **Simpan PDF** untuk membuat dan mengunduh PDF secara otomatis.
    Ekspor otomatis memakai ukuran pratinjau yang sama agar crop, posisi, zoom, dan proporsi foto tidak berubah.

> Foto dan semua edit kini disimpan otomatis di browser menggunakan penyimpanan lokal (IndexedDB). Tidak ada foto yang dikirim ke server. Tunggu status **Tersimpan otomatis** sebelum refresh. Cadangan `.albumku` berisi foto pribadi: simpan di tempat aman.

## Proyek: melanjutkan pekerjaan setelah refresh

1. Isi **Nama proyek**, lalu masukkan foto dan atur album seperti biasa.
2. Foto, urutan, cover, posisi/zoom, koreksi warna, template tiap halaman, dan pengaturan cetak tersimpan otomatis.
3. **Proyek baru** membuat pekerjaan terpisah; proyek sebelumnya tidak dihapus. Pilih proyek di **Buka proyek tersimpan** untuk melanjutkannya.
4. **Cadangan proyek** mengunduh berkas `.albumku`. Gunakan **Buka cadangan** untuk memulihkan sebagai proyek baru tanpa menimpa proyek lama.
5. Jika penyimpanan browser penuh/gagal, unduh cadangan sebelum menutup halaman. Cadangan dapat berukuran lebih besar daripada PDF karena menyertakan seluruh foto yang telah dioptimalkan.

Penyimpanan mengikuti alamat dan browser: `localhost:3000`, `localhost:8088`, alamat IP, dan browser lain mempunyai proyek terpisah. Gunakan cadangan untuk memindahkannya. Mode incognito, penghapusan data situs, atau pembersihan browser bisa menghapus proyek lokal; autosave bukan pengganti cadangan.

## Urutan foto dan template yang dapat diubah

- Default: **Terlama → terbaru**. Tanggal pengambilan EXIF JPEG diprioritaskan, lalu tanggal pada nama file (contoh `IMG_20240131_123456` atau `IMG-20240131-WA0001`), lalu tanggal file.
- Urutan berlaku juga pada foto yang ditambahkan belakangan. Nama memakai urutan angka yang wajar: 1, 2, 10.
- Foto unduhan tanpa tanggal pengambilan/nama bertanggal tidak dapat diketahui umur aslinya; pilih urutan nama atau Manual. Arahkan kursor ke thumbnail untuk melihat sumber tanggal yang dipakai.
- Drag thumbnail/tombol panah mengaktifkan **Manual**. Tombol **Auto sort** mengembalikan urutan terlama dahulu.
- Pilihan template halaman tidak lagi dibatasi jumlah foto saat ini. Mengganti 4 → 5 menarik foto berikutnya; mengganti 8 → 2 memindahkan sisanya ke halaman berikutnya. Bingkai kosong hanya muncul bila koleksi foto memang habis.
- Template utama memulai urutan variasi otomatis. Memilih template utama mereset penyesuaian template per halaman; **Ikuti otomatis** mereset satu halaman saja.
- Zoom foto **50–300%** mengubah hasil cetak; zoom pratinjau **50–200%** hanya mengubah tampilan editor, tidak mengubah PDF atau ukuran cetak.

## Cetak banyak foto di A3+

1. Pilih menu **Cetak foto A3+**. Semua foto koleksi ikut dicetak, termasuk foto yang dijadikan cover di mode album.
2. Lembar kertas **329 × 483 mm**, area aman **310 × 470 mm**, ditempatkan di tengah (margin kiri/kanan 9,5 mm dan atas/bawah 6,5 mm pada orientasi berdiri).
3. Pilih **3R, 4R, 5R, 6R, 8R, 10R, 12R**, atau ukuran sendiri dalam mm. Nilai ukuran R dapat berbeda di tiap percetakan; pastikan ukuran yang diminta lab Anda.
4. Atur jumlah salinan tiap foto dan jarak antar foto. Susunan memakai baris biasa dan diputar otomatis, tanpa memperkecil ukuran fisik foto. Sisa foto masuk lembar berikutnya.
5. Pilih garis potong pendek, border tipis **0,15 mm**, atau tanpa penanda. Garis area aman putus-putus tidak ikut dicetak atau diekspor.
6. Klik foto untuk memilihnya; gunakan **Penuh/Utuh**, Putar, dan Zoom foto pada toolbar bawah bila perlu. Mode Penuh memangkas tepi foto agar memenuhi ukuran R.
7. Klik **Simpan PDF** untuk unduh langsung atau **Cetak** untuk dialog printer. Pilih kertas A3+ dengan **Ukuran sebenarnya / Actual size / skala 100%**, tanpa **Fit to page**. Pastikan printer mendukung ukuran kertas tersebut.

Contoh 4R (101,6 × 152,4 mm): jarak 2 mm memuat 9 foto; jarak 3 mm memuat 8 foto agar tidak melewati lebar aman 310 mm. Lakukan uji satu lembar dan ukur dengan penggaris sebelum mencetak banyak.

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
- 13 template untuk 1, 2, 3, 4, 5, 6, atau 8 foto per halaman.
- 4 template cover: Penuh, Editorial, Klasik, dan Kolase.
- Mode variasi otomatis agar susunan halaman tidak monoton.
- Template dapat diganti khusus untuk setiap halaman melalui kontrol **Susunan halaman ini**.
- 13 varian posisi, termasuk Bertumpuk, Trio Sorotan, Fokus Empat, Strip Empat, Film Strip, dan Mozaik Enam.
- Optimasi resolusi dan JPEG untuk mencegah ukuran PDF membengkak.
- Koreksi hasil cetak dengan preset Asli, Cerah untuk cetak, Cerah & hidup, serta slider terang, kontras, dan warna.
- Penyesuaian titik fokus dengan drag langsung dan zoom 50–300%, ditambah zoom pratinjau terpisah.
- Nama merek yang dapat diganti pada header dan footer album.
- Margin atas, kanan, bawah, dan kiri terpisah dengan preset area jilid.
- Foto serta posisi cover terpisah dari halaman isi.
- Tombol Cetak dan Simpan PDF otomatis tersedia sebagai dua alur berbeda.
- Dukungan kertas A4, A3, dan Letter; orientasi berdiri atau mendatar.
- Ubah urutan dengan drag-and-drop atau tombol panah.
- Putar foto, pilih mode penuh/utuh, dan tampilkan nama file.
- Cetak seluruh halaman atau simpan sebagai PDF.
- Proyek lokal dengan autosave foto dan seluruh pengaturan, serta impor/ekspor cadangan.
- Cetak foto ukuran R otomatis dalam A3+ dengan area aman, salinan, dan penanda potong.

## Perbaikan PDF kosong dan kualitas ekspor

Ekspor menunggu foto selesai dibaca, merender posisi/crop dan koreksi warna ke kanvas, lalu menangkap halaman. Foto tidak lagi diganti sumbernya di tengah proses penyalinan halaman. Kegagalan pembacaan foto membatalkan ekspor dan menampilkan peringatan, bukan mengunduh PDF kosong.

PDF menggunakan gambar JPEG terkompresi per halaman, bukan foto resolusi penuh tanpa batas. Mode album menargetkan tinggi 2.200 piksel (3.000 untuk Kualitas tinggi); lembar cetak A3+ menargetkan 3.600 piksel, sekitar 189 dpi. Ini belum merupakan alur cetak profesional 300 dpi/CMYK/ICC. Untuk warna kritis dan cetak besar, lakukan proof print serta konsultasikan profil warna percetakan.

Unit test mencakup aliran ulang template, konservasi foto, tanggal EXIF/nama file, pengurutan, geometrik ukuran R/area aman, salinan, penyimpanan Blob proyek, dan validasi cadangan. Jalankan `npm test` dan `npx tsc --noEmit`.

## Jika hasil cetak lebih gelap daripada layar

Perbedaan ini biasanya bukan kerusakan file. Monitor memancarkan cahaya, sedangkan
kertas hanya memantulkan cahaya. Hasil juga dipengaruhi tingkat terang monitor,
jenis kertas, tinta, profil warna printer, serta koreksi otomatis pada driver printer.

Saran awal:

1. Pilih preset **Cerah untuk cetak** di AlbumKu. Nilai awalnya dibuat halus: terang
   112%, kontras 98%, dan warna 104%.
2. Lakukan test print satu halaman sebelum mencetak seluruh album.
3. Turunkan kecerahan monitor ke sekitar 30–50% saat menilai foto untuk cetak.
4. Pada driver printer, pilih jenis kertas yang benar dan hindari dua koreksi warna
   sekaligus. Jika aplikasi/percetakan memakai profil ICC, matikan peningkatan warna
   otomatis dari driver.
5. Jika shadow masih terlalu pekat, naikkan **Terang** sedikit demi sedikit, misalnya
   115–120%, dan kurangi **Kontras** ke 94–98%.

Koreksi AlbumKu hanya memengaruhi hasil album dan tidak mengubah file foto asli.
