# Phase 4I — Revisi Operasional Trip

Status: **implementasi operasional selesai; kebijakan retensi fisik menunggu keputusan pemilik.**
Meeting point berharga, itinerary per pickup, bukti pembeli, review data
keselamatan, manifest darurat, serta biaya dan laporan keuangan telah diterapkan.

Phase ini adalah revisi fondasi setelah kebutuhan operasional proyek diperjelas.
LebihJauh bukan hanya menerima booking, tetapi harus mengelola pickup yang
berbeda harga, data keselamatan peserta, dokumen untuk lapangan, pembayaran dari
pembeli, serta arus kas dan biaya setiap keberangkatan. UI tetap mengikuti
[acuan UI/UX](../ui-ux-guidelines.md).

## Keputusan yang sudah dikunci

1. Open Trip memiliki master **meeting point / zona pickup**. Setiap jadwal
   memilih titik yang tersedia lalu menetapkan harga, instruksi khusus, dan
   rundown variannya. Waktu kumpul bersifat opsional karena waktu final dapat
   disampaikan melalui WhatsApp.
2. Harga pada kartu publik adalah harga tersedia paling rendah dan wajib diberi
   label **“Mulai dari”**. Harga final baru diketahui setelah meeting point
   dipilih.
3. Booking tetap dapat dibuat tanpa foto identitas. Pengumpulan data keselamatan
   dimulai hanya setelah down payment minimum telah diverifikasi admin.
4. Setiap peserta mengisi data keselamatannya sendiri melalui tautan aman yang
   khusus untuk peserta tersebut. PIC tetap dapat membantu mengirim tautan,
   tetapi tidak melihat data peserta lain dari tautan tersebut.
5. Bukti pembayaran diunggah pembeli melalui akses invoice aman, bukan hanya
   dikirim ke WhatsApp. WhatsApp tetap dipakai untuk komunikasi operasional.
6. Tidak ada akun untuk guide/petugas lapangan pada fase ini. Admin mencetak
   dokumen yang diperlukan sebelum berangkat.
7. Rundown perjalanan dan manifest darurat adalah dua dokumen PDF berbeda.
8. Keuangan mencatat pemasukan terverifikasi dan pengeluaran per jadwal.
   Laporan tidak menyebut laba final jika masih ada piutang atau biaya yang belum
   tercatat.
9. Open Trip dan Private Trip terpisah secara alur serta tampilan, tetapi memakai
   mesin peserta, invoice, pembayaran, dan keuangan yang sama.

## Model operasional target

```text
Open Trip
└─ Trip → Jadwal keberangkatan
   ├─ Meeting point A: harga, waktu, peta, instruksi
   ├─ Meeting point B: harga, waktu, peta, instruksi
   └─ Booking: memilih satu meeting point
      ├─ Invoice dan pembayaran
      ├─ Roster peserta
      ├─ Tautan data keselamatan per peserta
      └─ Manifest / rundown

Private Trip
└─ Request → Penawaran → Booking private
   └─ Itinerary, meeting point, peserta, invoice, pembayaran, dan biaya custom

Jadwal keberangkatan
└─ Keuangan trip: invoice, dana masuk, piutang, biaya, posisi kas, margin booking
```

## Progres implementasi

- [x] Tabel meeting point per jadwal, termasuk backfill titik utama untuk
      jadwal lama.
- [x] Quote, total booking, dan snapshot invoice memakai harga meeting point
      yang dipilih, bukan harga yang dikirim browser.
- [x] Katalog/detail menampilkan harga minimum yang tersedia; checkout meminta
      peserta memilih zona sebelum quote dibuat.
- [x] Admin dapat menambah, mengubah, dan menonaktifkan zona pada halaman
      Kelola Open Trip; halaman operasional jadwal memilih master tersebut dan
      menetapkan harga/rundown. Perubahan menaikkan revisi jadwal agar quote lama
      tidak dapat dipakai diam-diam.
- [x] Itinerary terstruktur dan halaman rundown peserta yang siap
      dicetak/disimpan sebagai PDF dari invoice aman.
- [x] Data keselamatan dan tautan unggah individual setelah DP terverifikasi.
- [x] Admin review data/dokumen peserta serta manifest darurat lengkap.
- [x] Bukti pembayaran pembeli melalui invoice aman.
- [x] Pengeluaran dan laporan keuangan per jadwal.
- [x] Sumber booking tersimpan eksplisit dan daftar order serta Keuangan dapat
      memisahkan Open Trip dari Private Trip.
- [x] Daftar paket admin hanya memuat Open Trip; Private Trip tetap dikelola
      melalui permintaan/penawaran pada submenu tersendiri.
- [x] Penawaran Private Trip memiliki pickup terstruktur, persiapan, serta
      itinerary harian dan membuat snapshot pickup saat dikonversi.
- [x] Form peserta memiliki progress, draf terenkripsi, pemuatan data lama saat
      revisi, dan penerbitan ulang tautan per peserta.
- [x] Rundown peserta memuat fasilitas termasuk/tidak termasuk serta kontak
      operasional tanpa data sensitif.
- [x] Keuangan menerima pengeluaran operasional umum, pembatalan berjejak, serta
      filter jadwal dan meeting point.
- [x] Waktu transfer yang dilaporkan pembeli disimpan terpisah dari tanggal dana
      masuk yang ditetapkan admin berdasarkan mutasi.
- [x] Kuota meeting point bersifat opsional; bila diisi, server memeriksanya
      bersama kuota gabungan saat quote dan pembuatan booking.

### Verifikasi implementasi

- Migrasi database sampai `0022_phase_4i_completion` berhasil diterapkan.
- Query data nyata memastikan harga minimum publik sama dengan harga checkout
  dan setiap jadwal publik memiliki pickup aktif.
- Pemeriksaan Astro bersih tanpa error atau warning dan build produksi berhasil.
- Kontrak parser Private Trip dan filter Keuangan diuji lewat
  `npm run test:phase-4i`.
- Pengujian admin desktop/mobile lulus; 12 skenario E2E publik desktop/mobile
  termasuk navigasi, data trip, galeri, artikel, Private Trip, dan aksesibilitas
  juga lulus.

## 1. Meeting point dan harga per zona

Meeting point bukan lagi teks tunggal. Lokasinya disimpan sebagai master milik
Open Trip, sedangkan harga dan rundown menjadi konfigurasi jadwal untuk master
tersebut.

| Field                       | Keterangan                                                 |
| --------------------------- | ---------------------------------------------------------- |
| Nama zona                   | Contoh: Jakarta, Bandung, Basecamp Senaru.                 |
| Nama lokasi                 | Contoh: Rest Area KM 57 atau Bandara Internasional Lombok. |
| Alamat                      | Petunjuk lokasi yang bisa dipakai peserta.                 |
| Waktu kumpul                | Opsional; waktu final dapat disampaikan melalui WhatsApp.  |
| Harga per pax               | Harga final peserta dari titik tersebut.                   |
| Koordinat / Google Maps URL | Untuk tombol peta dan rundown.                             |
| Instruksi pickup            | Contoh pakaian, bus, nomor kendaraan, atau titik tunggu.   |
| Urutan aktif                | Menentukan urutan di publik dan admin.                     |
| Kuota zona                  | Opsional; dipakai hanya bila kendaraan tiap zona dibatasi. |

Kapasitas jadwal tetap menjadi kuota gabungan. Bila kuota per zona diaktifkan,
server harus mengecek kuota jadwal **dan** kuota zona secara atomik.

### Perilaku publik

1. Kartu trip menampilkan `Mulai dari Rp…/pax`, yakni harga meeting point termurah
   dari jadwal yang benar-benar dapat dipesan.
2. Detail trip menampilkan opsi pickup sebagai daftar/kartu yang mudah dipindai:
   zona, lokasi, waktu, harga, serta tautan peta.
3. Pengunjung memilih jadwal lalu meeting point sebelum quote dan pax dibuat.
4. Ringkasan booking, invoice, WhatsApp, dan rundown menyimpan opsi yang dipilih.
5. Harga, lokasi, waktu, serta instruksi hasil pilihan disimpan dalam snapshot
   booking; perubahan jadwal untuk pelanggan baru tidak mengubah booking lama.

Peta fase awal cukup berupa tautan **Buka di Google Maps** dari koordinat atau URL
yang divalidasi. Peta interaktif/provider berbayar tidak diperlukan untuk memulai.

## 2. Itinerary dan rundown perjalanan

Itinerary adalah data resmi perjalanan, bukan catatan bebas PIC. Satu kartu
mewakili satu hari dan dapat memuat banyak kegiatan. Setiap meeting point pada
jadwal dapat memakai rundown standar trip atau rundown khusus, misalnya rute
Jakarta berbeda dengan rute langsung dari basecamp.

Catatan khusus peserta tetap ada sebagai data terpisah bila diperlukan untuk
operasional; catatan tersebut tidak menggantikan itinerary dan tidak otomatis
tampil di rundown seluruh rombongan.

### PDF rundown peserta

PDF ini aman dibagikan kepada PIC/peserta dan memuat:

- Identitas trip, tanggal, dan nomor booking.
- Meeting point yang dipilih, waktu kumpul, instruksi, serta tautan/lokasi peta.
- Itinerary terstruktur.
- Yang termasuk/tidak termasuk, persiapan, ketentuan, dan kontak operasional.

PDF rundown tidak memuat NIK, alamat, kontak darurat, maupun foto identitas.

## 3. Data keselamatan peserta

Data dikumpulkan untuk setiap peserta setelah DP minimum terverifikasi. Nama
peserta dapat dipakai lebih awal untuk roster, tetapi data berikut disimpan dalam
ruang privat dan dienkripsi di server:

- Nama lengkap sesuai dokumen.
- Alamat.
- Nomor WhatsApp peserta bila tersedia.
- Nama, hubungan, dan nomor kontak darurat.
- Jenis dokumen: KTP, SIM, Kartu Pelajar/KIA, Passport, atau KITAS.
- Nomor NIK atau nomor dokumen sesuai jenisnya.
- Foto dokumen identitas.
- Pernyataan kebenaran data dan persetujuan penggunaan untuk keselamatan serta
  operasional perjalanan.

Untuk peserta anak atau warga asing, data tetap mengikuti jenis dokumen yang
sesuai. Sistem tidak boleh mengarang atau menurunkan data lain dari NIK.

### Link data peserta

Setelah pembayaran DP diverifikasi, admin memilih **Buat tautan data peserta**
pada detail order. Alurnya:

1. PIC/admin melengkapi roster minimal nama peserta dan, bila akan dikirim
   langsung, nomor WhatsApp masing-masing peserta.
2. Sistem membuat grant per peserta dengan token acak; token yang tersimpan di
   database hanya hash-nya.
3. Admin menyalin pesan WhatsApp dan mengirim tautan tersebut secara manual.
4. Peserta hanya dapat membuka serta mengubah datanya sendiri, tidak dapat melihat
   roster, invoice, nominal, atau dokumen peserta lain.
5. Admin dapat melihat status `belum dikirim`, `menunggu`, `lengkap`, atau
   `perlu perbaikan`; admin dapat mencabut dan menerbitkan ulang tautan.

Tautan memakai pola akses aman seperti invoice: token tidak ditaruh sebagai data
yang dapat ditebak, masa akses dapat berakhir, tidak dapat diindeks, dan tidak
membuka data bila URL dibagikan tanpa token yang benar. Tautan harus berhenti aktif
paling lambat pada batas administrasi sebelum keberangkatan yang ditentukan admin.

### Dokumen identitas

Foto identitas disimpan pada bucket R2 privat khusus dokumen peserta, terpisah dari
foto media publik serta bukti pembayaran. Tidak ada custom domain publik atau URL
objek permanen. Browser menerima URL unggah sementara; baca dokumen hanya lewat
endpoint admin berotorisasi. Nama object tidak boleh memuat NIK atau nama peserta.

Form peserta memakai pola upload dari acuan UI/UX: label terlihat, JPEG/PNG/WebP,
validasi ukuran, thumbnail, nama/ukuran berkas, aksi ganti/hapus sebelum simpan,
dan pesan kesalahan yang mempertahankan data form. Pengunggahan bukan pengganti
validasi admin; status dokumen dapat ditandai perlu perbaikan.

## 4. Bukti pembayaran dari pembeli

Link invoice aman menjadi tempat pembeli mengirim konfirmasi pembayaran.

1. PIC membuka invoice melalui grant akses.
2. PIC mengisi metode, nominal, tanggal/waktu transfer menurut pembeli, dan
   referensi transfer. Nilai ini hanya membantu pencarian mutasi.
3. PIC mengunggah bukti pembayaran ke R2 privat.
4. Sistem membuat payment berstatus `submitted`.
5. Admin mencocokkan mutasi lalu memverifikasi atau menolak dengan alasan.

Hanya status `verified` yang menambah dana masuk, mengubah status DP/lunas, dan
menjadi dasar laporan keuangan. Bukti `submitted` tidak dihitung sebagai pemasukan.
Tanggal dana masuk (`received_at`) tetap ditentukan admin dari mutasi rekening,
bukan dari tanggal yang dilaporkan pembeli.

## 5. Manifest darurat lapangan

Petugas lapangan tidak memerlukan akun karena kondisi gunung dapat tanpa internet
atau daya. Admin mencetak **Manifest Darurat Lapangan** dari jadwal keberangkatan.

Manifest ini memuat, per peserta:

- Nomor urut, nama, rombongan/nomor booking, dan pilihan meeting point.
- NIK atau nomor dokumen penuh.
- Alamat.
- Kontak darurat dan hubungan.
- Jenis dokumen dan foto identitas bila diputuskan diperlukan saat cetak.
- Kolom check-in serta catatan lapangan.

Setiap halaman memiliki trip, tanggal, nomor keberangkatan, waktu cetak, nomor
salinan, dan label **Dokumen Operasional Terbatas — jangan disebarluaskan**.
Cetak/download dicatat di audit log. Manifest tidak dikirim lewat WhatsApp dan tidak
ditampilkan pada invoice, daftar order, atau laporan keuangan biasa.

Sebelum produksi, pemilik harus menetapkan prosedur fisik: siapa yang menerima
kertas, bagaimana ia disimpan selama trip, dan kapan dikembalikan/dimusnahkan.

## 6. Keuangan dan pengeluaran

Halaman `/admin/payments/revenue` yang ada menjadi dasar laporan penerimaan, tetapi
modul akhirnya bernama **Keuangan**. Pembayaran dan Keuangan adalah konteks berbeda:

| Area       | Tujuan                                                                  |
| ---------- | ----------------------------------------------------------------------- |
| Pembayaran | Antrean bukti, verifikasi, dan metode pembayaran.                       |
| Keuangan   | Dana masuk, piutang, pengeluaran, posisi kas, dan ringkasan per jadwal. |

### Dua cara membaca angka

- **Arus kas berdasarkan tanggal transaksi:** dana masuk terverifikasi dikurangi
  pengeluaran pada bulan/periode yang dipilih.
- **Keuangan per jadwal keberangkatan:** total invoice, dana masuk, piutang,
  pengeluaran yang terkait jadwal, posisi kas, dan margin booking.

Istilah wajib:

- Dana masuk = pembayaran `verified` berdasarkan `received_at`.
- Piutang = sisa invoice aktif yang belum diterima.
- Pengeluaran = biaya yang tercatat dan belum dibatalkan.
- Posisi kas = dana masuk dikurangi pengeluaran yang telah dibayar.
- Margin booking = nilai invoice dikurangi pengeluaran tercatat.

Jangan menyebut laba final bila piutang, refund, atau pengeluaran belum lengkap.

### Pengeluaran

Biaya awal wajib dapat dicatat dari detail jadwal. Pengeluaran umum kantor dapat
ditambahkan sebagai scope terpisah agar tidak dipaksa masuk ke suatu trip.

| Field              | Keterangan                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| Tanggal biaya      | Dasar arus kas keluar.                                                                                   |
| Scope              | Jadwal keberangkatan atau operasional umum.                                                              |
| Kategori           | Transport, guide, porter, simaksi, logistik, penginapan, sewa alat, dokumentasi, komisi, atau lain-lain. |
| Vendor/penerima    | Pihak yang menerima pembayaran.                                                                          |
| Nominal dan metode | Rupiah bulat dan cara pembayaran.                                                                        |
| Referensi/catatan  | Nomor kuitansi atau penjelasan.                                                                          |
| Bukti biaya        | Foto struk/invoice privat, bila tersedia.                                                                |
| Pencatat/status    | Siapa yang mencatat; pembatalan/koreksi wajib beralasan.                                                 |

Pengeluaran tidak dihapus diam-diam. Bila salah input, buat pembatalan atau koreksi
berjejak audit sehingga nominal lama masih dapat ditelusuri.

## 7. Pemisahan Open Trip dan Private Trip

- Halaman publik Open Trip dan Private Trip tetap berbeda.
- Admin memisahkan daftar/filter Open Trip dan Private Trip.
- Booking diberi sumber eksplisit `open_trip` atau `private_trip`; jangan menyimpulkan
  jenisnya dari nama atau kategori trip.
- Private Trip tetap dapat memakai itinerary, meeting point, peserta, invoice,
  bukti pembayaran, manifest, dan biaya custom dari fondasi bersama.
- Laporan Keuangan dapat difilter menurut sumber booking, trip, jadwal, meeting
  point, atau periode.

## Kontrak data dan migrasi

Struktur berikut sudah menjadi fondasi data yang dipakai aplikasi; pemisahannya
wajib dipertahankan pada revisi berikutnya:

```text
departure_pickup_options
  departure_id, zone_name, location_name, address, pickup_at, price_per_pax,
  latitude, longitude, maps_url, instructions, capacity, is_active

booking_pickup_snapshot
  booking_id, pickup_option_id?, semua detail pickup + harga saat booking

participant_safety_data
  booking_participant_id, encrypted address/contact/emergency/document fields,
  document object key, completion/review state, consent timestamp

participant_data_grants
  booking_participant_id, token_hash, expires_at, revoked_at, sent_at, completed_at

trip_expenses
  departure_id?, scope, category, paid_at, vendor, amount, method, reference,
  proof object key, state, void/reversal reason, recorded_by

bookings.booking_source
  open_trip | private_trip
```

Migrasi harus menjaga histori:

1. Setiap jadwal lama mendapat satu meeting point default dari meeting point dan
   harga yang sudah ada, tanpa mengubah invoice/booking lama.
2. Booking dan invoice lama tetap memakai `packageSnapshot`/`policySnapshot` yang
   lama; tidak dihitung ulang dari opsi baru.
3. NIK yang sudah terenkripsi tetap tidak diubah menjadi plaintext.
4. Laporan lama tetap memakai pembayaran `verified` dan `received_at`; pengeluaran
   baru dimulai dari catatan baru atau impor yang disetujui pemilik.

## UI/UX wajib

### Revisi halaman Kelola Paket

- Tampilan awal daftar jadwal; tab Data paket dan Titik jemput memisahkan tugas.
  Form tambah/edit dibuka sesuai kebutuhan dan isian bertahan saat pindah tab.
- Jadwal baru memilih lokasi master, memasukkan harga jual titik tersebut, dan
  menyimpan jadwal + meeting point pertama dalam satu transaksi. Alamat, peta,
  petunjuk, dan rundown mengambil data paket yang tersimpan.
- Harga referensi tidak ditanyakan lagi. Edit jadwal mengambil harga meeting point
  aktif termurah di server (fallback nilai lama hanya untuk jadwal legacy tanpa
  meeting point). Daftar jadwal menampilkan harga meeting point aktif.
- Aturan pembayaran/publikasi diringkas dalam disclosure; input jam mendukung
  menit bebas. WIB tidak lagi menjadi dropdown satu opsi; pelunasan tetap opsional.
- Verifikasi: `npm run check`, `npm run test:admin-ui` (Chromium desktop/mobile,
  fixture API), dan `node --experimental-test-module-mocks --import=tsx/esm
scripts/test-departure-editor.mjs` (kontrak API dengan mock database). Pengujian
  tersebut tidak mengubah data produksi atau membuktikan persistensi database nyata.
- Preview: [daftar desktop](../phase-4c/previews/trip-fixture-desktop.png),
  [daftar mobile](../phase-4c/previews/trip-fixture-mobile.png), dan
  [form jadwal mobile](../phase-4c/previews/schedule-editor-mobile.png).

### Pola bersama

- Gunakan `SiteHeader`/`SiteFooter` untuk halaman publik dan `AdminLayout` untuk
  admin; jangan menggandakan navigasi.
- Pilihan meeting point publik harus berupa kartu/radio yang menunjukkan harga,
  waktu, dan lokasi; bukan dropdown buta bila pilihan lebih dari satu.
- Form data peserta adalah halaman khusus yang mobile-first, bukan modal. Form
  memiliki draf, progress, validasi jelas, dan tidak menghapus input saat gagal.
- Upload dokumen/bukti mengikuti pola thumbnail, nama file, ukuran, aksi ganti,
  dan pesan error dari panduan UI/UX.
- Tindakan sensitif seperti terbit ulang tautan, cetak manifest darurat,
  pembatalan biaya, dan membuka dokumen memakai konfirmasi serta audit.
- Halaman keuangan membedakan dengan teks dan warna: dana masuk, piutang,
  pengeluaran, serta biaya yang dibatalkan. Jangan mengandalkan warna saja.

## Batas fase

Tidak termasuk pada implementasi pertama Phase 4I:

- WhatsApp API/pengiriman pesan otomatis.
- Akun khusus guide/petugas lapangan.
- OCR, validasi otomatis ke Dukcapil, atau pembacaan dokumen otomatis.
- Peta interaktif berbayar.
- Payment gateway otomatis.
- Refund otomatis, approval berlapis, dan akuntansi pajak penuh.

## Syarat selesai

1. Admin dapat membuat beberapa meeting point berharga untuk satu jadwal; publik
   memilihnya sebelum quote dan harga invoice benar.
2. Harga `Mulai dari` publik tidak menyesatkan dan tidak bisa menjadi harga final
   tanpa pilihan pickup.
3. Bukti pembayaran dapat diunggah pembeli melalui akses invoice aman dan tetap
   privat sampai diverifikasi admin.
4. DP terverifikasi membuka alur roster/link data peserta, dan setiap tautan hanya
   dapat mengubah satu peserta.
5. Data keselamatan/dokumen tidak muncul pada invoice, WhatsApp, tabel biasa, atau
   URL publik; akses/cetak yang sensitif tercatat.
6. Rundown dan manifest darurat PDF berbeda isi serta tujuan.
7. Admin dapat mencatat biaya pada jadwal; halaman Keuangan menampilkan dana masuk,
   piutang, biaya, posisi kas, dan margin booking per jadwal tanpa mencampurkan
   tanggal uang masuk dengan tanggal keberangkatan.
8. Open Trip dan Private Trip dapat disaring terpisah tanpa menduplikasi mesin
   invoice/pembayaran/peserta.

## Keputusan pemilik sebelum data nyata

Sebelum data pelanggan asli dimasukkan, pemilik wajib menetapkan:

- Default teknis tautan peserta berakhir paling lambat satu jam sebelum
  keberangkatan atau 30 hari setelah diterbitkan. Pemilik dapat menetapkan batas
  administrasi yang lebih awal.
- Masa retensi data identitas dan dokumen setelah trip selesai.
- Kapan cetakan manifest darurat dikembalikan atau dimusnahkan.
- Bukti biaya saat ini opsional dan pembatalan hanya tersedia untuk admin serta
  selalu memerlukan alasan.
- Kuota per meeting point opsional. Kosong berarti kapasitas gabungan jadwal;
  nilai yang diisi akan ditegakkan server saat quote dan pembuatan booking.
