# LebihJauh — Roadmap Booking dan Admin Panel

Status: **fase 4B–4I tersedia di kode; 4J dalam perbaikan bertahap.** Fondasi PostgreSQL/Drizzle dan login admin,
pengelolaan trip/jadwal/R2, katalog/detail trip publik, booking, pembayaran manual,
Private Trip, serta konten tersedia. Sebelum simulasi Phase 5A, kebutuhan operasional
baru dicatat pada [Phase 4I — Revisi Operasional](phase-4i/README.md). Perbaikan
kontrak itinerary, meeting point, jadwal, dan detail publik dicatat pada
[Phase 4J — Konsolidasi Detail Open Trip](phase-4j/README.md).
Urutan lanjutan hasil audit: **(1) jadwal/harga/ketersediaan → (2)
itinerary/snapshot → (3) penawaran Private Trip → (4) UI/konten/komponen**.

Artefak dan register keputusan fase pertama ada di [paket review 4A](phase-4a/README.md).

Patokan tampilan lintas fase ada di [acuan UI/UX](ui-ux-guidelines.md). Gunakan
dokumen tersebut sebelum membuat halaman/komponen baru; roadmap ini tetap menjadi
acuan scope dan urutan pekerjaan.

Dokumen ini menggantikan roadmap website publik sebelumnya. Nomor 4A dan seterusnya
adalah urutan revisi, bukan fase tambahan yang berjalan bersamaan dengan versi lama.
[Rencana landing page](landing-page-plan.md) menjadi catatan arah visual dan pekerjaan
Home yang sudah dilakukan. Acuan pekerjaan lanjutan adalah dokumen ini.

## Posisi dan kebutuhan yang sudah jelas

- Preview Home tersedia dan arah visualnya diterima pengguna; jadwal, harga, dan
  foto masih contoh/ilustrasi. Admin dan booking operasional belum dibuat.
- Admin membuat trip dan membuka jadwal keberangkatan dengan tanggal mulai–selesai.
- Admin mengatur down payment (DP) dalam persentase atau nominal.
- Private Trip dimulai dari request tanggal dan jumlah pax.
- Form booking mengikuti urutan yang familiar seperti hotel/pesawat.
- Deskripsi Detail Trip memuat informasi perjalanan dan fasilitas yang didapat.
- Booking dilakukan di website; data masuk admin sebelum dilanjutkan ke WhatsApp.
- Open Trip dan booking Private Trip manual memiliki nomor order/invoice.
- Tiga status pembayaran: **Unpaid, DP, Paid**.
- Galeri mendukung foto serta posting Instagram/TikTok.
- “DP by” adalah salah ketik untuk down payment, bukan pilihan metode pembayaran.

Contoh Labuan Bajo mengarah pada perjalanan yang lebih luas dari pendakian.
Usulan: jenis trip fleksibel, misalnya pendakian, camping, atau sailing. Jenis
layanan yang benar-benar dijual masih perlu dikonfirmasi; karakter visual Home tetap.

## Detail Trip: deskripsi dan panel booking

Halaman `/trip/[slug]` memiliki dua area yang saling melengkapi.

**Deskripsi perjalanan**, dikelola admin dengan bagian yang jelas:

1. Tentang trip: lokasi, pengalaman, dan daya tarik.
2. Yang didapat / fasilitas termasuk: misalnya transportasi, penginapan atau kapal,
   makan, pemandu, tiket, dokumentasi; hanya sesuai layanan paket sebenarnya.
3. Tidak termasuk: biaya atau kebutuhan yang menjadi tanggungan peserta.
4. Itinerary: kegiatan dan perpindahan per hari.
5. Meeting point: tempat, waktu, dan petunjuk pertemuan.
6. Persiapan: perlengkapan serta persyaratan peserta yang berlaku.
7. Ketentuan: pembayaran, perubahan jadwal, pembatalan, dan informasi penting lain
   berdasarkan kebijakan pemilik, bukan aturan yang dikarang sistem.

Bagi pengunjung, semuanya menjadi deskripsi detail trip yang utuh. Di admin,
sebaiknya gunakan blok editor terpisah agar isinya mudah dirapikan dan diperbarui.
Konten umum paket disimpan bersama trip. Jika fasilitas suatu keberangkatan berbeda,
perbedaannya ditampilkan eksplisit dan ikut dicatat pada ringkasan pesanan.

**Panel booking**, memakai data operasional terstruktur:

- Pilihan keberangkatan dan tanggal mulai–selesai.
- Jumlah pax, ketersediaan, harga, total, DP minimum, sisa pembayaran, serta tenggat.
- Ringkasan sebelum tombol booking.

Harga, DP, tanggal, dan kuota tidak dihitung dari teks deskripsi. Nilai tersebut
memiliki field tersendiri dan diperiksa kembali oleh server saat order dibuat.

## Alur produk yang diusulkan

### Open Trip

Admin membuat paket → membuka keberangkatan → pelanggan memilih tanggal dan pax →
mengisi PIC → meninjau harga/ketentuan → membuat booking → server menyimpan order,
alokasi kuota, dan invoice → pelanggan melihat invoice → lanjut ke WhatsApp.

WhatsApp membawa nomor order dan ringkasan. Order tetap ada di admin meskipun
pelanggan tidak membuka atau mengirim pesan. Link WhatsApp tidak mengirim otomatis.

Usulan MVP: booking tamu tanpa akun pelanggan. Invoice dapat dibuka ulang melalui
tautan akses khusus; nomor berurutan saja tidak boleh membuka data pribadi.
Cara mengirim ulang tautan dan memberi notifikasi admin masih perlu dipilih.

### Private Trip

Request tujuan, tanggal/rentang, pax, PIC, dan catatan → request tersimpan dengan
nomor referensi → admin berdiskusi → penawaran harga/fasilitas → kesepakatan →
admin mengonversi menjadi booking private dan menerbitkan invoice.

Admin juga dapat membuat booking manual dari kesepakatan WhatsApp dengan mencatat
pelanggan, paket, harga, pax, tanggal, serta persetujuan penawaran. Request tanpa
harga yang disepakati belum menjadi tagihan atau reservasi. Private memakai mesin
invoice dan pembayaran yang sama dengan Open Trip.

### DP, pembayaran, dan invoice

Dasar DP sudah diputuskan (D02): **per total order**, bukan per pax. Total Rp10 juta
berarti DP 30% senilai Rp3 juta untuk keseluruhan booking. Admin juga bisa memasukkan
nominal langsung, misalnya Rp3 juta.

Harga, paket, aturan DP, dan ketentuan saat booking disimpan pada order. Perubahan
paket untuk pelanggan baru tidak diam-diam mengubah invoice lama.

| Status | Definisi yang diusulkan                                        |
| ------ | -------------------------------------------------------------- |
| Unpaid | Belum ada pembayaran terverifikasi                             |
| DP     | Ada pembayaran terverifikasi, tetapi total tagihan belum lunas |
| Paid   | Total tagihan sudah lunas berdasarkan pembayaran terverifikasi |

Status dihitung dari riwayat pembayaran. Satu invoice bisa memiliki pembayaran DP
serta pelunasan. Jika pembayaran belum memenuhi DP minimum, tampilkan kekurangannya;
status DP tidak otomatis berarti kursi terkonfirmasi.

Metode pembayaran **diputuskan pengguna pada review 4A: transfer bank dengan
verifikasi admin**. Bukti masuk menunggu pemeriksaan dan tidak langsung menambah
total terbayar. Payment gateway tidak termasuk implementasi awal.

Status booking dipisahkan dari pembayaran: misalnya menunggu pembayaran,
terkonfirmasi, kedaluwarsa, atau dibatalkan. Refund/koreksi dicatat terpisah,
mengikuti kebijakan pemilik, dan tidak menghapus riwayat pembayaran asli.

Usulan nomor: `LJ-OT-000123` dan `LJ-PT-000124`; format akhir belum dikunci. Nomor
harus unik dan dibuat server. Untuk MVP, satu booking memakai satu nomor invoice
yang tetap sama selama DP dan pelunasan. Invoice memuat PIC, trip, tanggal, pax,
rincian harga, total, minimum DP, terbayar, saldo, tenggat, serta instruksi pembayaran.
Usulan awal: halaman invoice yang bisa dicetak/disimpan PDF dari browser. PDF otomatis
server menjadi kebutuhan tambahan jika diperlukan.

## Prinsip fondasi dan batas pekerjaan

- Pertahankan Astro dan UI Home. Admin/booking membutuhkan proses server Node dan
  database; deployment dengan menyalin build statis saja tidak memenuhi scope baru.
  Adapter, database, autentikasi, dan penyimpanan media dipilih pada fase 4A dengan
  pemeriksaan dokumentasi/kompatibilitas saat implementasi.
- Pisahkan data trip, keberangkatan, order, invoice, pembayaran, dan request private
  sesuai fungsi. Home, katalog, detail, dan referensi jadwal News memakai sumber sama.
- Login melindungi admin; server membatasi akses invoice/bukti dan menghitung ulang
  harga/DP. Nilai kiriman browser tidak dianggap sebagai harga yang sah.
- Pemeriksaan dan alokasi kuota harus atomik di server. Booking bersamaan tidak boleh
  mengambil kursi yang sama; submit ulang tidak boleh membuat order/invoice ganda.
- Tenggat unpaid dan pelepasan kuota diproses server, bukan hanya countdown browser.
  Pembayaran setelah expiry perlu pemeriksaan ulang dan tidak otomatis mengaktifkan
  kembali kursi yang sudah diberikan kepada pelanggan lain.
- Catat pelaku/waktu perubahan admin dan riwayat pembayaran. Jadwal berbooking tidak
  dihapus sembarangan; perubahan harga/tanggal mengikuti aturan yang disepakati.
- Data contoh dipisahkan dari operasional. Alihkan CTA dan hapus dialog/form demo
  hanya ketika alur pengganti siap; booking publik belum aktif saat masih diuji.
- Akun pelanggan, promo, loyalty, WhatsApp API, serta sinkronisasi feed otomatis
  tidak otomatis termasuk MVP. Kebutuhan tambahan dicatat sebelum dikerjakan.

## Urutan fase revisi

**4A → 4B → 4C → 4D → 4E → 4F → 4G → 4H → 4I → 4J → 4K → 4L → 5A → 5B → 5C**

Catatan status implementasi: panduan operasional dan bukti verifikasi 4C dicatat di
[paket 4C](phase-4c/README.md). Katalog serta detail 4D menggunakan data jadwal
yang dibuka admin; status dan batasnya dicatat di [paket 4D](phase-4d/README.md).

UI admin 4C kini mengikuti prototipe 4A melalui layout bersama untuk dashboard,
trip/jadwal, dan login. Tampilan desktop/mobile dan interaksi form sudah diuji
dengan API fixture; bukti serta batas verifikasinya ada pada paket 4C.

| Fase | Fokus                            | Hasil review                                                         |
| ---- | -------------------------------- | -------------------------------------------------------------------- |
| 4A   | Aturan bisnis dan rancangan data | Alur booking, kuota, DP, invoice, serta pilihan fondasi              |
| 4B   | Server, database, akses admin    | Data persisten dan admin yang dibatasi login                         |
| 4C   | Admin trip dan keberangkatan     | Deskripsi, fasilitas, jadwal, harga, DP, dan kuota dapat dikelola    |
| 4D   | Katalog dan Detail Trip          | Pengunjung membaca paket dan memilih jadwal/pax dari data admin      |
| 4E   | Booking Open Trip dan invoice    | Order tersimpan, terlihat di admin, lalu bisa dilanjutkan ke WA      |
| 4F   | Pembayaran dan verifikasi        | Unpaid/DP/Paid, saldo, dan riwayat transaksi konsisten               |
| 4G   | Private Trip                     | Request, penawaran, booking manual, serta invoice terhubung          |
| 4H   | Galeri, sosial, News             | Konten dikelola admin dan muncul pada halaman publik                 |
| 4I   | Revisi operasional trip          | Pickup berharga, data keselamatan, PDF, bukti pembeli, dan keuangan  |
| 4J   | Konsolidasi Detail Open Trip     | Itinerary, jadwal, pickup, dan detail publik memakai konteks tunggal |
| 4K   | Cek Booking Open Trip            | PIC dapat menemukan booking dan membuka invoice dengan verifikasi    |
| 4L   | Tampilan Home & About            | Foto, kalimat, SEO, FAQ, dan konten unggulan dikelola admin          |
| 5A   | Data asli dan simulasi operasi   | Tim mencoba alur lengkap dengan materi bisnis yang benar             |
| 5B   | Pemeriksaan rilis                | Kandidat rilis dan panduan operasi/server siap                       |
| 5C   | Deployment                       | Website, admin, database, dan proses pendukung berjalan di server    |

### 4A — Aturan bisnis dan rancangan data

Prasyarat: roadmap direview sebelum implementasi lanjutan dimulai.

- Selesaikan keputusan kritis uang/kuota/konfirmasi dari daftar keputusan di bawah.
- Rancang alur admin/checkout dan struktur trip, keberangkatan, PIC/peserta, order,
  invoice, pembayaran, request private, penawaran, serta audit.
- Pilih fondasi server/database, autentikasi, media, backup, dan proses terjadwal.
- Tetapkan format ID, pembulatan rupiah, aturan DP, akses invoice, dan perlakuan
  kekurangan/kelebihan pembayaran serta perpindahan status.

Selesai: rancangan, keputusan MVP, dan hal terbuka dapat diperiksa. Aturan kritis
yang belum disepakati tidak menjadi asumsi tersembunyi dalam implementasi.

### 4B — Fondasi server, database, dan admin

Prasyarat: keputusan fondasi 4A selesai.

- Siapkan aplikasi server, migrasi database, konfigurasi lingkungan, dan seed demo.
- Implementasikan login/logout admin, pembatasan sesi/hak akses, dan kerangka menu.
- Siapkan media/bukti yang tidak mengekspos dokumen pelanggan secara publik, serta
  catatan perubahan penting. Pertahankan Home dan gunakan komponen layout bersama.

Selesai: data bertahan setelah restart, admin tanpa login ditolak, dan migrasi dapat
diulang tanpa menyimpan kredensial di repository. Belum mengerjakan modul bisnis lain.

### 4C — Admin trip, deskripsi, dan jadwal

Prasyarat: 4B selesai.

- Form trip/foto/deskripsi dengan bagian fasilitas, itinerary, meeting point,
  persiapan, dan ketentuan seperti rancangan Detail Trip di atas.
- Kelola banyak keberangkatan, harga/pax, kuota, DP persen/nominal, tenggat,
  serta draft/buka/tutup jadwal.
- Validasi tanggal/harga/DP/kapasitas; kapasitas tidak boleh lebih kecil dari kursi
  teralokasi. Perubahan jadwal berbooking mengikuti aturan 4A.

Status implementasi: **siap diuji setelah migrasi.** Admin dapat membuat/mengubah
trip, URL foto, blok deskripsi, serta banyak jadwal dengan harga/pax, kuota, DP,
tenggat, dan status draft/buka/tutup di `/admin/trips`. Validasi berjalan di server;
riwayat perubahan admin dicatat. Upload file foto belum dibuat karena storage media
produksi belum dipilih, sehingga 4C menerima URL foto HTTP(S) yang tervalidasi.

Selesai: admin dapat menyiapkan contoh Labuan Bajo 18–25 pada bulan/tahun yang
ditentukan dan membuka/menutup jadwal tanpa mengedit kode.

### 4D — Katalog Open Trip dan Detail Trip publik

Prasyarat: 4C selesai; data publik berasal dari jadwal yang dibuka admin.

- Bangun `/trip` dengan filter destinasi, bulan/tahun, jenis, reset, dan hasil kosong.
- Bangun `/trip/[slug]` dengan deskripsi utuh dan panel jadwal/pax/harga/DP.
- Tangani penuh, ditutup, tanpa jadwal, URL 404, dan jadwal yang berubah ketika
  halaman pelanggan masih terbuka.
- Hubungkan Home/header/footer, lalu pindahkan detail trip dari dialog lama.

Selesai: perubahan admin konsisten di Home/katalog/detail; alur desktop/mobile dan
keyboard berfungsi. Booking nyata dilanjutkan pada 4E.

### 4E — Booking Open Trip, daftar order admin, dan invoice

Prasyarat: 4D selesai; aturan kuota, expiry, dan nomor dari 4A sudah jelas.

- Form jadwal/pax → data PIC → ringkasan/ketentuan → buat booking.
- Hitung ulang total di server, simpan paket/harga/DP saat order dibuat, nomor unik,
  invoice, dan alokasi kuota secara konsisten. Tangani submit ganda/koneksi terputus.
- Buat invoice yang dapat dibuka ulang dengan akses khusus serta pencarian/detail
  order di admin berdasarkan nomor dan PIC.
- Sesudah simpan berhasil, tampilkan tautan WA dengan ringkasan. Gunakan kontak uji
  saat demo; WA gagal dibuka tidak menghilangkan order.
- Terapkan expiry dan pelepasan kuota unpaid sesuai keputusan.

Selesai: order dapat ditemukan tanpa pesan WA, booking serentak tidak melebihi kuota,
submit ulang tidak menggandakan tagihan, dan menebak nomor tidak membuka invoice orang lain.

### 4F — Pembayaran, verifikasi, dan pelunasan

Prasyarat: 4E selesai; metode pembayaran telah dipilih.

- Catat nominal, waktu, metode, referensi/bukti, dan status pemeriksaan pembayaran.
- Admin menerima/menolak bukti transfer dengan catatan dan dapat mencatat
  pembayaran dari komunikasi langsung. Bukti pending belum menambah saldo terbayar.
- Gateway otomatis berada di luar scope awal sesuai keputusan pembayaran manual.
- Hitung tiga status pembayaran, DP minimum/kekurangannya, saldo, dan tenggat dari
  riwayat pembayaran; cegah satu pembayaran dihitung dua kali.
- Terapkan konfirmasi booking, pembayaran terlambat, koreksi/kelebihan bayar, dan
  pembatalan/refund menurut kebijakan 4A, dengan riwayat yang tetap tercatat.

Selesai: belum bayar → DP → pelunasan konsisten; bukti ditolak/duplikat tidak mengubah
saldo; status booking dan kuota mengikuti aturan yang sama.

### 4G — Request dan booking Private Trip

Prasyarat: mesin order/invoice/pembayaran 4E–4F selesai.

- `/private-trip`: tujuan, tanggal/rentang, pax, PIC, dan kebutuhan tambahan.
- Request tersimpan sebelum WA, dengan nomor referensi serta status tindak lanjut.
- Admin membuat penawaran harga/fasilitas/DP/masa berlaku dan mencatat persetujuan.
- Konversi ke satu booking/invoice, termasuk entry manual kesepakatan dari WA.
  Konversi ulang tidak menggandakan order; gunakan mesin pembayaran 4F.
- Gantikan form demo unduh-only setelah request persisten tersedia.

Selesai: request tanpa kesepakatan belum ditagih; persetujuan dapat ditelusuri dan
invoice private menerima DP/pelunasan. Kuota private tidak otomatis mengambil kuota
Open Trip kecuali memang dipilih demikian pada aturan bisnis.

### 4H — Galeri, embed sosial, dan News

Prasyarat: pola admin/publik tersedia; dikerjakan setelah alur transaksi utama.

- Admin mengelola album, foto/caption, artikel, kategori, serta draft/publikasi.
- Bangun `/galeri`, `/news`, `/news/[slug]`; teaser Home memakai sumber yang sama.
- Usulan embed MVP: URL posting Instagram/TikTok dari admin, integrasi resmi, dan
  fallback tautan. Jangan menerima HTML/script bebas dari form.
- Periksa dukungan/persyaratan provider sebelum implementasi. Jika embed tidak
  tersedia, konten lokal dan link tetap berfungsi. Sinkronisasi feed belum termasuk.
- News jadwal merujuk trip, tanpa menyalin harga/kuota operasional secara manual.

Selesai: admin bisa menerbitkan konten; embed gagal tidak merusak halaman dan foto
stok tetap dikenali sebagai ilustrasi.

### 4I — Revisi operasional trip

Prasyarat: fondasi booking, pembayaran, Private Trip, dan konten sudah tersedia.
Dokumen rinci, keputusan, batas scope, dan syarat selesai ada pada
[Phase 4I](phase-4i/README.md).

- Ubah meeting point tunggal menjadi pilihan pickup per jadwal dengan harga,
  waktu, lokasi, dan instruksi sendiri.
- Kumpulkan data keselamatan serta dokumen peserta melalui tautan aman setelah
  down payment diverifikasi, bukan pada checkout awal.
- Sediakan upload bukti pembayaran pembeli, rundown PDF, dan manifest darurat
  tercetak untuk lapangan.
- Tambahkan biaya per jadwal serta laporan Keuangan yang membedakan dana masuk,
  piutang, pengeluaran, posisi kas, dan margin booking.
- Pisahkan Open Trip/Private Trip pada tampilan serta laporan tanpa menggandakan
  mesin order, invoice, pembayaran, dan peserta.

Selesai: seluruh data/angka historis tetap aman; alur baru dapat diuji dari pickup
hingga manifest dan keuangan per keberangkatan sebelum memakai data pelanggan asli.

### 5A — Data asli dan simulasi operasional

Prasyarat: 4B–4I selesai; materi dan kebijakan bisnis tersedia.

- Lengkapi paket, fasilitas, jadwal, harga, DP, logo, foto, kontak, petunjuk pembayaran,
  identitas invoice, serta ketentuan yang telah diperiksa pemilik.
- Simulasikan admin membuka jadwal → booking → invoice → DP → pelunasan, serta
  request private → kesepakatan → invoice pada lingkungan uji, tanpa transaksi uang nyata.
- Coba bukti salah, pembayaran terlambat, pembatalan, kuota habis, submit ulang,
  dan WA tidak dibuka. Tentukan notifikasi order baru serta pemisahan data demo/produksi.

Selesai: pemilik memahami operasi harian dan memeriksa informasi yang akan dijual.

### 5B — Pemeriksaan rilis dan panduan operasi

Prasyarat: 5A selesai; domain dan lingkungan hosting diketahui.

- Uji rute, login/hak akses, invoice/bukti, manipulasi harga, booking serentak,
  expiry, pembayaran, Private Trip, dan catatan perubahan admin.
- Periksa mobile, keyboard, kontras, formulir, gambar, kondisi error/404, serta SEO.
  Admin dan checkout tidak diindeks; invoice Open Trip dapat dibaca lewat nomor
  invoice, sedangkan aksi pembayaran sensitif tetap dibatasi server.
- Siapkan proses Node, database, media persisten, migrasi, proses expiry terjadwal,
  HTTPS/reverse proxy, backup dan uji pemulihan, serta rollback yang cocok dengan
  perubahan database. Cadangan file aplikasi saja tidak cukup untuk data booking.

Selesai: kandidat rilis teruji tanpa masalah kritis transaksi/akses, dan panduan
operasi serta pemulihan tersedia untuk review sebelum peluncuran.

### 5C — Deploy dan verifikasi live

Prasyarat: kandidat siap, domain/akses tersedia, dan pengguna mengarahkan peluncuran.

- Deploy server aplikasi, database/migrasi, serta media pada VPS/aaPanel tujuan.
- Aktifkan proses terkelola dan pekerjaan terjadwal; restart tidak menghilangkan data.
- Verifikasi HTTPS, rute langsung, login admin, invoice, kontak, dan backup.
- Aktifkan booking publik setelah pemeriksaan live selesai. Data uji tidak menjadi
  order pelanggan atau menahan kuota operasional.

Selesai: domain, admin, serta booking aktif; status siap deploy tidak dilaporkan
sebagai sudah live sebelum pemasangan benar-benar dilakukan.

## Keputusan yang masih kurang

Tabel memuat keputusan yang sudah diterima dan usulan yang masih terbuka. Register
terbaru beserta statusnya ada pada [paket 4A](phase-4a/README.md).

| Keputusan                  | Usulan awal / dampak                                                                                                            | Dibutuhkan sebelum               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Metode pembayaran          | **Diputuskan: transfer bank, diverifikasi admin**                                                                               | D01 selesai; implementasi 4F     |
| Dasar DP nominal           | **Diputuskan (D02): per total order.** Langsung lunas diizinkan; cicil DP masih terbuka (D07)                                   | D02 selesai; D07 sebelum 4F      |
| Variasi harga              | Harga tunggal/pax jika cocok; tanyakan tarif anak, kamar/kapal, minimum pax, pajak/biaya tambahan                               | Struktur harga 4B/4C             |
| Kuota dan tenggat          | **Diputuskan (D03, D05):** hold 24 jam dipotong cutoff; konfirmasi segera setelah DP terverifikasi; balance_due_at diatur admin | D03/D05 selesai; implementasi 4E |
| Batal, reschedule, refund  | **Diputuskan (D08): case-by-case admin.** Tidak ada penalti atau jaminan refund dikodekan sistem                                | D08 selesai; isi ketentuan 5A    |
| Data peserta               | PIC + pax saat checkout sebagai usulan; kapan dan untuk apa data peserta lain dibutuhkan                                        | Form/data 4A                     |
| Akses invoice/notifikasi   | Tamu dengan tautan khusus; tentukan pengiriman ulang link dan notifikasi order baru ke admin                                    | Alur 4A; integrasi 4E/5A         |
| Petugas admin              | Satu peran dahulu jika cukup; owner/staf dengan hak berbeda membutuhkan aturan                                                  | Login/hak akses 4B               |
| Penawaran private          | Harga paket/per pax, minimum peserta, masa berlaku, durasi, cara mencatat persetujuan                                           | Rancangan 4A; implementasi 4G    |
| Nomor dan keluaran invoice | Prefix OT/PT usulan; identitas bisnis dan kebutuhan cetak/PDF otomatis                                                          | 4E; data asli 5A                 |
| Galeri sosial              | URL posting manual; akun resmi dan posting yang boleh ditampilkan                                                               | 4H                               |
| Jenis perjalanan           | Pendakian saja atau juga sailing/wisata lain; memengaruhi field dan filter                                                      | 4A/4C                            |
| Hosting, media, backup     | Lingkungan dan penanggung jawab operasi                                                                                         | Fondasi 4A; rilis 5B–5C          |

Keputusan kritis untuk fondasi 4B sudah ditetapkan (D01–D03, D05, D08). Yang masih terbuka:
struktur harga/varian (D06), data peserta (D09), akses invoice (D10), peran admin (D11),
penawaran private (D12), format nomor (D13), dan jenis perjalanan (D14). Keputusan ini
tidak memblokir 4B dan dicatat untuk fase terkait. Logo, foto final, dan akun sosial
bisa menyusul tanpa menghambat rancangan sistem.

## Paket pengerjaan dan titik review

1. **4A:** aturan dan alur diperiksa sebelum membangun transaksi.
2. **4B–4D:** admin membuat paket/jadwal dan pengunjung melihatnya di website.
3. **4E–4F:** satu booking Open Trip utuh hingga DP/pelunasan di lingkungan uji.
4. **4G–4H:** Private Trip dan konten publik lengkap.
5. **5A–5B:** simulasi tim serta kandidat rilis; 5C mengikuti arahan peluncuran.

Fase **4A** selesai: rancangan, pilihan arsitektur, model data, kontrak operasi,
prototipe lokal, dan keputusan kritis sudah ditetapkan. Fase **4B** selesai di kode.
Fase **4C** siap diuji setelah migrasi; detail lengkap ada di [paket 4C](phase-4c/README.md).
Fase 4D–5C masih direncanakan. Catat hasil verifikasi, feedback, dan pekerjaan
terbuka pada fase terkait saat implementasi.
