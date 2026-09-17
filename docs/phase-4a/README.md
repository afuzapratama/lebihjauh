# Fase 4A — Rancangan Booking LebihJauh

Untuk implementasi tampilan terbaru dan komponen yang dipakai lintas fase, lihat
[acuan UI/UX](../ui-ux-guidelines.md). Prototipe dalam paket 4A tetap menjadi
referensi rancangan awal; status implementasi terbaru mengikuti roadmap.

Status: **4A selesai — keputusan kritis D01–D03, D05, D08 sudah ditetapkan; prasyarat 4B terpenuhi**.
Fase 4B belum dimulai. Dokumen ini bukan implementasi database atau pembayaran.

## Cara review

1. Buka [simulasi interaktif](review.html). File dapat dibuka langsung di browser;
   JavaScript/CSS lokal harus berada di folder yang sama. Alternatif dari root project:
   `python3 -m http.server 4323 --bind 127.0.0.1 --directory docs/phase-4a`, lalu
   buka `http://localhost:4323/review.html`.
2. Coba tab Admin jadwal → Checkout → Invoice; ubah pax dan aturan DP pada data contoh.
3. Simulasikan bukti masuk, verifikasi DP, dan pelunasan. Semua data hanya ada dalam
   memori tab; refresh menghapus simulasi. Tidak ada rekening, pesan WA, atau order nyata.
4. Review [aturan dan skenario](business-rules.md), [model data dan kontrak](data-contracts.md),
   serta [pilihan arsitektur](architecture.md).

Tujuan prototipe adalah memeriksa urutan, isi, perhitungan, dan label status.
Prototipe bukan desain final admin dan tidak membuktikan transaksi database aman
dari booking serentak. Pembuktian itu dikerjakan pada fase implementasinya.

## Kebutuhan pengguna yang menjadi dasar

- Admin membuka jadwal Open Trip dan mengatur DP persen/nominal.
- Deskripsi Detail Trip memuat fasilitas, itinerary, meeting point, serta ketentuan.
- Pelanggan memilih tanggal/pax dan booking melalui web; order tersimpan sebelum WA.
- Private Trip dimulai dari request tanggal/pax, lalu admin membuat booking/invoice.
- Status pembayaran memakai Unpaid, DP, Paid.
- DP berarti down payment. Pada review 4A pengguna memilih transfer bank yang diverifikasi admin.

## Keputusan teknis untuk rancangan 4B

Astro yang sudah ada dilanjutkan dengan adapter Node standalone. PostgreSQL menjadi
database; Drizzle + postgres.js untuk akses data/migrasi, Better Auth untuk sesi
login admin. Satu deployment aplikasi, tanpa backend terpisah. Penjelasan, sumber,
dan batas verifikasi ada di [arsitektur](architecture.md).

## Register keputusan bisnis

“Usulan” dan angka pada prototipe bukan persetujuan pengguna. Jawaban yang benar-benar
diterima dicatat pada kolom keputusan. Keputusan kritis untuk 4B sudah ditetapkan: D01–D03, D05, D08.

| ID  | Keputusan                   | Usulan untuk review                                                                                     | Status / kebutuhan                                                                                                                                                         |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Metode pembayaran           | Transfer bank, diverifikasi admin                                                                       | **Diputuskan pengguna pada review 4A**                                                                                                                                     |
| D02 | DP nominal berlaku untuk    | Total order; persentase dari total order                                                                | **Diputuskan: per total order. DP Rp3 juta berarti Rp3 juta untuk keseluruhan booking, bukan per pax.**                                                                    |
| D03 | Masa penahanan kuota unpaid | 24 jam, dipotong batas penutupan booking                                                                | **Diputuskan: 24 jam sejak order dibuat, dipotong booking_cutoff_at.**                                                                                                     |
| D04 | Bukti pending saat expiry   | Masa review terbatas, bukan perpanjangan tanpa batas; durasi wajib diatur                               | Terbuka; sebelum logika kuota 4E                                                                                                                                           |
| D05 | Konfirmasi dan pelunasan    | Konfirmasi sesudah DP minimum terverifikasi dan alokasi kursi masih sah; tanggal pelunasan diatur admin | **Diputuskan: booking dikonfirmasi (held → committed) segera setelah DP minimum terverifikasi dan alokasi masih sah. Tanggal batas pelunasan diatur admin per departure.** |
| D06 | Harga                       | Harga tunggal per pax, IDR; tanpa diskon/varian saat MVP bila sesuai bisnis                             | Terbuka; sebelum schema harga 4B                                                                                                                                           |
| D07 | Bayar penuh/cicilan         | Izinkan langsung lunas; total terverifikasi yang memenuhi DP menentukan konfirmasi                      | Terbuka; sebelum 4F                                                                                                                                                        |
| D08 | Batal/reschedule/refund     | Ditangani admin dengan alasan dan catatan; nilai refund mengikuti kebijakan pemilik                     | **Diputuskan: pembatalan dan refund sepenuhnya case-by-case oleh admin. Tidak ada penalti atau jaminan refund yang dikodekan sistem.**                                     |
| D09 | Data checkout               | PIC: nama, WhatsApp; email opsional; pax total. Detail peserta menyusul bila diperlukan                 | Terbuka; sebelum schema peserta 4B                                                                                                                                         |
| D10 | Akses dan notifikasi        | Booking tamu; tautan invoice khusus; admin dapat menerbitkan ulang tautan setelah memeriksa PIC         | Terbuka; kanal pengiriman ulang/notifikasi belum dipilih                                                                                                                   |
| D11 | Admin                       | Satu peran admin operasional, tanpa signup publik                                                       | Usulan teknis; jumlah/perbedaan hak staf perlu dikonfirmasi                                                                                                                |
| D12 | Private Trip                | Request belum menjadi tagihan; satu penawaran versi yang disepakati dikonversi ke invoice               | Usulan; dasar harga paket/per pax dan cara persetujuan perlu dipilih                                                                                                       |
| D13 | Format nomor                | LJ-OT-000123 / LJ-PT-000124, nomor invoice tetap saat DP/pelunasan                                      | Usulan; tidak menjanjikan urutan tanpa celah                                                                                                                               |
| D14 | Jenis trip                  | Jenis fleksibel, mendukung contoh Labuan Bajo dan pendakian                                             | Terbuka untuk jenis layanan aktual                                                                                                                                         |

Tidak semua keputusan menghambat fondasi: model trip, data persisten, login, dan
media dapat disiapkan setelah fondasi diterima. Struktur harga dan data peserta
harus jelas sebelum schema terkait dibuat. Tidak membuka jadwal operasional sebelum
aturan pembayaran/kuota/ketentuan yang diperlukan lengkap.

## Hasil dan batas fase ini

- Rancangan layar admin, checkout, invoice, dan alur Private Trip.
- Model relasi, field inti, constraint, kontrak operasi, urutan transaksi, dan skenario gagal.
- Rumus rupiah/DP dan pemisahan status pembayaran, pemeriksaan bukti, booking, serta kuota.
- Pilihan stack, media persisten, backup, sesi, dan pekerjaan expiry.
- Register keputusan yang belum disepakati.

**Status penutupan 4A: selesai.** Artefak review, rancangan data, kontrak operasi,
dan keputusan kritis (D01–D03, D05, D08) sudah ditetapkan. Keputusan yang tersisa
(D04, D06, D07, D09–D14) tidak memblokir fondasi 4B dan dicatat untuk fase terkait.
Fase 4B dapat dimulai.
