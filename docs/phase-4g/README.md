# Phase 4G — Private Trip

Private Trip dimulai sebagai **permintaan**, bukan booking. Karena itu request baru tidak membuat invoice dan tidak mengambil kuota Open Trip.

## Alur operasional

1. PIC mengirim `/private-trip`: tujuan/rute, tanggal atau rentang, perkiraan pax, kontak PIC, dan kebutuhan tambahan.
2. Sistem membuat referensi `LJ-PT-xxxxxx`; admin melihatnya di `/admin/private-trips` dan dapat langsung menghubungi PIC lewat WhatsApp.
3. Admin membuat revisi penawaran: waktu perjalanan, pax, harga per pax, down payment, fasilitas termasuk/tidak termasuk, meeting point, catatan, dan masa berlaku.
4. Saat detail disampaikan, pilih **Simpan & kirim ke PIC**. Setelah PIC menyetujui melalui WhatsApp/telepon, tulis ringkasan kesepakatan pada **Catat kesepakatan**.
5. Sebelum membuat invoice, admin melengkapi nama dan NIK seluruh peserta. PIC dapat dipilih ikut sebagai Peserta 01 atau hanya menjadi kontak penanggung jawab; jumlah pax selalu tetap diisi peserta yang benar-benar berangkat. NIK diperlakukan sama seperti booking Open Trip: terenkripsi saat tersimpan dan manifest hanya menampilkan empat digit terakhir.
6. **Buat booking & invoice** menghasilkan order `LJ-OT-xxxxxx` dan invoice reguler. Pembayaran, unggah bukti, verifikasi, invoice PDF, serta manifest menggunakan fondasi Phase 4E–4F yang sama.

## Halaman manifest sebelum konversi

Konversi bukan lagi modal. Dari penawaran yang telah disepakati, tombol **Buat
booking & invoice** membuka halaman khusus manifest agar rombongan besar dapat
diisi tanpa bidang sempit atau risiko modal tertutup.

- Ringkasan penawaran (jadwal, PIC, meeting point, total, dan down payment)
  tetap terlihat di sisi halaman saat admin mengisi peserta.
- PIC ikut sebagai Peserta 01 secara bawaan, tetapi admin dapat mematikannya
  bila PIC hanya partner/panitia/teman yang mendaftarkan rombongan. Saat
  dimatikan, semua baris diisi sebagai peserta biasa dan PIC tetap menjadi
  kontak utama pada booking serta invoice.
- **Simpan draf manifest** menyimpan nama serta NIK terenkripsi di server. Saat
  halaman dibuka kembali, NIK tidak dikirim sebagai plaintext: admin hanya
  melihat penanda empat digit akhir dan dapat membiarkan kolom NIK kosong untuk
  memakai nilai yang telah tersimpan.
- Perubahan yang belum disimpan memunculkan peringatan browser sebelum admin
  meninggalkan halaman. Draf dapat dibuang secara eksplisit dan otomatis dihapus
  saat konversi booking berhasil.
- Dua konfirmasi data wajib dicentang sebelum tombol akhir aktif. Konversi tetap
  atomik; belum ada invoice, booking, maupun hold kursi saat baru menyimpan draf.

Migrasi `0011_private_manifest_drafts.sql` dan
`0012_private_manifest_pic_optional.sql` diperlukan untuk fitur draf ini.

## Batasan yang disengaja

- Hanya satu penawaran yang boleh diterima dan hanya sekali dapat dikonversi menjadi booking.
- Trip internal hasil konversi berstatus tertutup, sehingga tidak muncul sebagai jadwal/kartu Open Trip publik dan tidak mengurangi kapasitas Open Trip lain.
- Masa hold invoice hasil konversi adalah 24 jam atau sampai waktu perjalanan (mana yang lebih dulu). Admin sebaiknya hanya mengonversi setelah peserta dan kesepakatan benar-benar siap.
- Jika perubahan terjadi setelah kesepakatan, jangan mengubah invoice diam-diam: buat permintaan/penawaran baru atau catat penanganannya melalui jejak admin.
