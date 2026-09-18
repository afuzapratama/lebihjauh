# Fase 4E — Booking Open Trip, order, dan invoice

> Catatan kebijakan terbaru: Phase 4K membuka pembacaan invoice Open Trip lewat
> nomor invoice biasa. Ketentuan grant khusus di dokumen historis ini tetap
> berlaku untuk aksi pembayaran, bukan lagi untuk membaca invoice.

Status: **implementasi tersedia; jalankan migrasi dan uji penerimaan dengan data jadwal nyata.**

## Alur yang tersedia

1. Pengunjung memilih jadwal terbuka pada detail trip lalu mengisi jumlah pax.
2. Form selalu membuat tepat sejumlah kartu peserta sesuai pax. PIC dapat menjadi
   Peserta 1; bila iya, nama dan NIK pertama mengikuti data PIC agar tidak terjadi
   duplikasi atau peserta fiktif.
3. Server membuat quote berdurasi 15 menit, lalu menghitung ulang harga, down
   payment, revisi jadwal, tenggat, dan kuota saat submit.
4. Booking tersimpan atomik bersama snapshot paket/aturan, invoice bernomor
   `LJ-OT-000001`, dan hold kursi maksimal 24 jam (dipotong tenggat booking).
5. Invoice dapat dibuka langsung memakai nomor invoice. Pencocokan WhatsApp dan
   grant akses tetap diwajibkan sebelum peserta mengirim bukti pembayaran.
6. Admin membuka `/admin/orders` untuk melihat order, lalu mencetak manifest
   lapangan dari detail order.

Invoice memiliki mode cetak A4 tersendiri lewat tombol **Cetak / simpan PDF**:
navigasi dan tindakan hilang, informasi invoice mendapat header LebihJauh, dan
detail perjalanan/pembayaran dipertahankan dalam satu komposisi cetak.

Tombol WhatsApp pada invoice menyiapkan pesan operasional berisi nomor invoice,
trip, jadwal, pax, PIC, total, down payment minimum, batas hold, dan permintaan
arahan pembayaran. NIK atau data identitas peserta tidak pernah dimasukkan ke pesan.

## Ruang Booking & Order admin

- Ringkasan memperlihatkan booking menunggu tindak lanjut, hold kurang dari enam
  jam, booking terkonfirmasi, dan total pax yang sedang di-hold.
- Cari berdasarkan invoice, PIC, WhatsApp, atau trip; filter status dan trip.
- Tombol **WA PIC** selalu membuka pesan yang dapat diedit admin sebelum dikirim.
- Admin dapat membatalkan booking yang masih menunggu pembayaran atas permintaan
  pelanggan; alasan wajib dicatat dan kursi langsung dilepas.
- Booking kedaluwarsa tidak dihapus. Admin dapat membuka ulang hanya bila jadwal
  masih terbuka dan kuota terbaru cukup; hold baru maksimal 24 jam dibuat.
- Tautan invoice pengganti mencabut tautan token sebelumnya, lalu dapat dikirim
  ulang lewat WhatsApp. Riwayat tindakan menyimpan pembatalan, pembukaan ulang,
  dan penerbitan tautan baru.
- Daftar/admin detail memakai snapshot paket saat booking dibuat, sehingga edit
  trip setelahnya tidak mengubah informasi order lama.

## Data peserta dan manifest

- Nama lengkap dan NIK 16 digit wajib untuk PIC dan setiap peserta; tidak ada
  unggahan KTP atau salinan dokumen.
- NIK disimpan dengan AES-256-GCM dan hash HMAC. Tidak ada plaintext NIK di
  response, log aplikasi, invoice, daftar admin, maupun manifest.
- Manifest hanya menampilkan nama, label PIC, dan empat digit akhir NIK. Petugas
  mencocokkan dokumen berfoto + nama + empat digit akhir saat diperlukan.
- PIC menyetujui ketentuan dan menyatakan telah memperoleh persetujuan setiap
  peserta sebelum data disimpan.

## Operasional per jadwal

Satu jadwal dapat memiliki beberapa booking/invoice dari rombongan berbeda. Buka
**Operasional jadwal** dari daftar jadwal pada halaman kelola trip untuk melihat
seluruh rombongan pada keberangkatan yang sama.

- Ringkasan memisahkan kuota terkonfirmasi, kursi yang masih di-hold, kursi
  tersedia, dan jumlah peserta manifest.
- Nilai booking aktif, uang terverifikasi, sisa tagihan, serta pembayaran yang
  masih menunggu verifikasi ditampilkan terpisah. Nilai invoice bukan pendapatan.
- Tabel order memperlihatkan invoice, PIC/WhatsApp, pax, nilai booking,
  pembayaran terverifikasi, sisa tagihan, dan status setiap rombongan.
- Manifest gabungan dan PDF mencantumkan nomor invoice/PIC untuk setiap peserta
  agar rombongan tidak tercampur di lapangan. NIK tetap hanya empat digit akhir.
- Booking `confirmed` masuk manifest otomatis. Booking yang hanya menahan kursi
  tidak ikut manifest kecuali admin memilih **Izinkan manifest**, mengisi alasan,
  dan sistem mencatat jejak audit. Izin ini tidak mengonfirmasi booking dan tidak
  mengubah pembayaran. Izin dapat dicabut kembali.

Fitur izin manifest memakai migrasi `0010_departure_operations.sql`; jalankan
`npm run db:migrate` setelah memperbarui aplikasi.

## Konfigurasi wajib

Tambahkan ke `.env` lalu restart server:

```env
BOOKING_DATA_ENCRYPTION_KEY=<64 karakter heksadesimal / 32 byte acak>
```

Nomor WhatsApp operasional dikelola dari **Admin → Tampilan Website → Sosial &
Footer**. `BOOKING_WHATSAPP_NUMBER` hanya dipakai sebagai fallback migrasi sampai
pengaturan global pertama kali disimpan ke database.

Gunakan `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
untuk membuat nilai kunci. Jangan menggantinya selama data booking masih aktif
tanpa prosedur rotasi/migrasi; data yang telah terenkripsi memakai kunci tersebut.

## Aturan kuota dan histori

- Quote tidak dapat dibuat jika kursi aktif tidak cukup.
- Transaksi booking mengunci jadwal; submit bersamaan tidak boleh melampaui
  kapasitas. Idempotency key mencegah klik/submit ganda membuat invoice kedua.
- Jadwal atau trip dengan booking terkait tidak dapat dihapus/diarsipkan.
- Kapasitas jadwal tidak dapat diturunkan di bawah kursi yang sedang di-hold.
- Pelepasan hold yang kedaluwarsa dilakukan ketika ada booking baru untuk jadwal
  tersebut atau saat ruang Booking & Order dibuka. Untuk cleanup proaktif di
  server, jadwalkan `npm run booking:expire` setiap 5 menit melalui cron/aaPanel.

## Batas fase

4E membuat invoice dan hold, tetapi belum menerima atau memverifikasi pembayaran.
Pembayaran manual, bukti transfer, konfirmasi kursi, dan pelunasan adalah 4F.

## Verifikasi

1. Jalankan `npm run db:migrate`.
2. Jalankan `npm run check` dan `npm run build`.
3. Buat jadwal masa depan berstatus **Buka**, buka detailnya, dan booking dengan
   pax lebih dari satu. Pastikan jumlah kartu peserta tepat sama dengan pax.
4. Buka invoice dari browser yang sama, lalu coba URL tanpa cookie di browser lain:
   URL biasa harus ditolak; tautan `#access=…` harus dapat ditukar menjadi akses
   invoice tanpa menaruh token di URL akhir.
5. Buka `/admin/orders`, cetak manifest, dan pastikan yang muncul hanya NIK
   bertopeng seperti `••••••••••••1234`.
