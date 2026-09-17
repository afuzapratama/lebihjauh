# Phase 4J — Konsolidasi Detail Open Trip

Status: **perbaikan bertahap berjalan setelah audit 15 September 2026.**
Implementasi awal 4J belum menyambungkan seluruh alur. Daftar kerja di bawah
menjadi acuan lanjutan; rancangan awal setelahnya tetap merupakan referensi,
bukan klaim semua fiturnya sudah selesai.

## Daftar kerja hasil audit — urutan 1–4

Kerjakan dan verifikasi satu tahap per giliran agar perubahan mudah direview.

| Tahap | Fokus                                                                                                | Status                                       |
| ----- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1     | Sinkronisasi jadwal, harga, meeting point, dan ketersediaan dari Home/katalog/detail sampai checkout | Selesai dan diverifikasi — 15 September 2026 |
| 2     | Aturan itinerary, rundown peserta, dan snapshot historis Open/Private Trip                           | Selesai dan diverifikasi — 15 September 2026 |
| 3     | Alur penawaran Private Trip, lanjutkan draf, komunikasi ke PIC, detail penawaran, dan label invoice  | Selesai dan diverifikasi — 15 September 2026 |
| 4     | Tampilan responsif, isi konten, serta penyatuan komponen/parser yang berulang                        | Menunggu tahap 3                             |

### Tahap 1 — batas pekerjaan

- Satu pembaca data ketersediaan untuk halaman publik dan checkout: jadwal buka,
  keberangkatan/tenggat belum lewat, DP positif sesuai persyaratan quote,
  kursi gabungan dan kuota pickup tersedia.
- Harga minimum berasal dari pickup yang masih bisa dipesan pada jadwal itu.
- Ringkasan detail, konten paket, daftar pickup, serta CTA mengikuti jadwal
  pilihan. Home/katalog memakai jadwal tersedia terdekat untuk ringkasan awal.
- Tautan ke jadwal yang tidak tersedia memberi penjelasan dan pilihan pengganti.
- Ringkasan checkout serta batas pax mengikuti pickup pilihan; pemeriksaan ulang
  harga dan kuota oleh server saat quote/booking tetap berlaku.
- Verifikasi regresi dengan fixture dan pemeriksaan halaman dari data lokal.
  Tidak perlu membuat order atau mengubah data bisnis untuk pengujian tahap ini.

### Tahap 1 — hasil implementasi dan verifikasi

- `getBookableDepartures()` dipakai Home/katalog/detail dan checkout. Jadwal
  penuh, tenggat lewat, serta pickup penuh tidak lagi menjadi opsi penjualan.
  Harga minimum tidak menghitung pickup yang kuotanya habis.
- Detail memakai konten versi paket, tanggal, harga, dan pickup dari jadwal
  terpilih. Label menjadi “Keberangkatan pilihan”; CTA melanjutkan pemilihan
  titik dan peserta. Tautan jadwal lama menjelaskan penggantian pilihan jika
  masih ada jadwal alternatif; tanpa alternatif, halaman tidak tersedia.
- Checkout memilih default yang tersedia (atau titik tersedia pertama),
  memperbarui harga/peserta, label lokasi, serta batas pax ketika pickup berubah.
  Respons quote terlambat diabaikan setelah pilihan atau jumlah pax berubah.
- Kontrak data publik kini bertipe eksplisit; 17 error pemeriksaan detail dari
  hasil audit sudah teratasi.
- `npm run test:phase-4j-1`: fixture kuota, hold aktif/kedaluwarsa, serta alokasi
  lama tanpa pickup lulus; pemeriksaan baca saja mencocokkan 3 jadwal tersedia
  dan memastikan 3 jadwal lewat tenggat tidak bisa dibuka di checkout.
- `npm run test:phase-4j-ui` (server lokal port 4321, dapat diganti lewat
  `TEST_BASE_URL`): 6 alur jadwal dan 2 pergantian pickup lulus pada 390/1440px.
  Quote memakai respons simulasi dan semua penulisan bisnis jaringan diblokir.
- `npm run check`: 0 error, 0 warning, 0 hint; `npm run build`: lulus.

Angka ketersediaan tetap merupakan kondisi saat halaman dibaca. Server melakukan
pemeriksaan ulang saat quote dan transaksi booking; tahap ini tidak mengubah
aturan pembayaran, alokasi kursi, atau snapshot historis. Tidak ada migrasi atau
perubahan data bisnis yang dilakukan. Lanjutkan tahap **2** pada giliran berikutnya.

### Tahap 2 — masalah yang harus diselesaikan

Pembaca rundown masih menjadikan itinerary pickup pengganti itinerary inti;
override jadwal belum mempunyai editor/API dan belum ikut snapshot booking.
Pembaruan paket masih mengubah versi yang sama. Data lama dan Private Trip
memakai arti itinerary pickup yang berbeda, sehingga perlu migrasi dengan
penanda sumber/versi dan review data, bukan penggantian makna diam-diam.

### Tahap 2 — hasil implementasi dan verifikasi

- Itinerary utama diselesaikan melalui `tripVersion.itineraryStages` atau
  `departure.itineraryOverride`; rundown pickup hanya dibaca dari
  `pickupRundownStages` dan tidak pernah menggantikan itinerary utama.
- Versi itinerary jadwal dapat dipilih secara eksplisit di admin. Perubahan Data
  paket membuat versi baru, sedangkan jadwal/order lama tetap terikat ke versi
  dan snapshot masing-masing.
- Booking Open Trip dan konversi Private Trip menyimpan snapshot v2 yang
  memuat itinerary, konten paket, sumber itinerary, dan pickup terpilih.
  Invoice/rundown v2 membaca snapshot tersebut, bukan data paket live.
- Snapshot lama tetap dibaca melalui fallback kompatibilitas; salinan itinerary
  lama pada pickup hanya ditampilkan bila berbeda dari itinerary utama.
- Migration 0023–0024 sudah mengganti nama kolom menjadi
  `pickup_rundown_stages`, membekukan booking lama ke v2, dan audit lokal tidak
  menemukan rundown pickup yang identik dengan itinerary utama.
- `npm run test:phase-4j-2` lulus (resolver, snapshot v2, kontrak kolom, audit
  booking, dan audit duplikasi); pemeriksaan tipe tetap 0 error.

### Tahap 3 — masalah yang harus diselesaikan

“Simpan & kirim ke PIC” baru menandai terkirim; riwayat draf belum bisa
dilanjutkan dan detail penawaran untuk client belum tersedia. Halaman sukses
permintaan belum menyediakan lanjutan WhatsApp yang dijanjikan. Cetakan invoice
private masih berlabel Open Trip.

### Tahap 3 — hasil implementasi dan verifikasi

- Draf penawaran terakhir otomatis dimuat kembali pada form admin, termasuk
  detail pickup, itinerary, fasilitas, persiapan, dan catatan.
- Penawaran terkirim memiliki halaman detail PIC berbasis tautan UUID yang tidak
  membuka data admin. PIC dapat membaca itinerary, pickup, harga, DP minimum,
  fasilitas, persiapan, dan masa berlaku, lalu menyetujui atau menolak melalui
  endpoint same-origin dengan pemeriksaan status dan kedaluwarsa di server.
- Admin dapat membuka detail PIC langsung dari riwayat offer. Pengiriman pesan
  otomatis tetap di luar scope; tautan WhatsApp manual tersedia untuk
  komunikasi operasional.
- Halaman sukses permintaan menyediakan tautan lanjutan WhatsApp.
- Invoice hasil konversi menampilkan label `INVOICE PRIVATE TRIP`; booking tetap
  memakai `bookingSource: 'private_trip'` dan snapshot v2.
- Verifikasi: `npm run check`, `npm run build`, `npm run test:phase-4j-1`, dan
  `npm run test:phase-4j-2` lulus. `npm run format:check` masih melaporkan
  file-file lama di repository yang tidak terkait perubahan Tahap 3.

### Tahap 4 — masalah yang harus diselesaikan

Harga meeting point di mobile masih berada di tabel geser; overflow tersembunyi
masih menutupi konten di lebar tertentu. Konten contoh (fasilitas, tujuan,
durasi, itinerary) perlu ditinjau pemilik. Editor/parser itinerary dan CSS
berulang perlu disatukan setelah kontrak datanya selesai pada tahap 2.

## Keputusan inti

**Rencana perjalanan tetap dibuat di Data paket dan tetap tampil satu kali di
detail Open Trip.** Ini adalah itinerary inti: apa yang dialami semua peserta
setelah perjalanan dimulai.

Meeting point bukan pemilik itinerary utama. Ia menyimpan lokasi, harga, waktu
kumpul, peta, instruksi, kuota, dan—bila memang berbeda—**rundown penjemputan
tambahan** sebelum peserta bergabung ke perjalanan utama. Jadi ia tidak menyalin
seluruh itinerary paket.

| Data                                 | Pemilik                   | Ditampilkan di publik                                                 |
| ------------------------------------ | ------------------------- | --------------------------------------------------------------------- |
| Itinerary inti per hari/tahap        | Data paket / versi trip   | Sekali, untuk jadwal yang dipilih                                     |
| Variasi itinerary satu keberangkatan | Jadwal                    | Menggantikan itinerary inti hanya bila admin sengaja membuat override |
| Lokasi, harga, jam, peta, instruksi  | Meeting point pada jadwal | Hanya milik jadwal yang dipilih                                       |
| Rundown penjemputan tambahan         | Meeting point pada jadwal | Hanya saat titik itu dipilih dan memang ada isinya                    |

Contoh: `Hari 1–3 pendakian Rinjani` adalah itinerary paket. `05.00 kumpul di
Halim → 08.00 berangkat ke bandara` adalah rundown pickup Jakarta. Yang kedua
bukan Hari 1 pendakian dan tidak boleh menggandakan itinerary paket.

## Temuan awal sebelum implementasi (historis)

1. Halaman detail saat ini menampilkan itinerary standar, kemudian berpotensi
   menampilkan rundown yang disalin dari itinerary standar di setiap meeting
   point. Ini membuat isi berulang dan istilahnya membingungkan.
2. Detail publik menggabungkan semua meeting point dari semua jadwal yang masih
   buka. Harga, titik kumpul, dan rundown dapat berasal dari jadwal berbeda.
   Pengunjung belum memilih jadwal ketika data tersebut ditampilkan.
3. `tripVersion` secara konsep adalah snapshot, tetapi pembaruan Data paket
   saat ini mengubah versi terakhir di tempat. Jadwal lama dan baru belum
   dipisahkan tegas saat konten paket berubah.
4. Form admin membuat itinerary paket, lalu saat jadwal dibuat API menyalin
   `itineraryStages` ke meeting point awal. Editor operasional menyebut salinan
   itu sebagai “Rundown titik ini”. Nilai kosong dan nilai “sama dengan paket”
   tidak dapat dibedakan konsisten pada data sekarang.
5. Pada lebar 390px, grid detail sebelumnya mengembang menjadi 614px karena
   track `1fr` mengikuti minimum konten tabel. Hotfix containment CSS telah
   diterapkan: track sekarang `minmax(0, 1fr)`, sehingga tabel saja yang boleh
   scroll horizontal. Hasil ukur: `scrollWidth` kembali dari 634px ke 390px.
6. Katalog/detail masih mengambil fakta awal dari jadwal pertama. Ini valid
   hanya sebagai ringkasan awal, bukan sebagai konteks untuk semua opsi yang
   sedang ditampilkan.

## Target pengalaman

```text
Admin
Data paket: itinerary inti
        ↓
Jadwal: memakai versi paket; opsional override itinerary untuk jadwal ini
        ↓
Meeting point jadwal: harga dan detail pickup; opsional rundown pickup singkat
        ↓
Publik: pilih jadwal → lihat itinerary + titik yang tepat → booking
```

Detail publik memakai satu jadwal aktif pada satu waktu. Jadwal terdekat menjadi
pilihan awal; pengguna dapat memilih jadwal lain dengan kontrol yang jelas. URL
memuat id jadwal yang tervalidasi, misalnya `/trip/rinjani?jadwal=<id>`, agar
tautan, reload, dan CTA booking tetap konsisten.

Urutan desktop dan mobile yang dituju:

1. Hero dan tiga fakta milik jadwal terpilih.
2. Pemilih jadwal ringkas; CTA booking selalu mengarah ke jadwal itu.
3. Fasilitas paket dan itinerary inti/override jadwal, satu kali.
4. Kartu meeting point jadwal terpilih: zona, lokasi, jam, harga, peta, dan
   instruksi. Mobile memakai kartu; tabel tidak menjadi layout utama.
5. Rundown pickup hanya muncul di dalam kartu/tampilan titik yang dipilih dan
   hanya bila ada perjalanan tambahan.
6. Persiapan dan ketentuan, lalu footer.

Jangan tampilkan accordions `Rundown dari …` untuk titik yang tidak dipilih.
Pada detail informasi, tombolnya berbunyi **Pilih jadwal**; di halaman booking
barulah peserta memilih meeting point dan jumlah pax.

## Rancangan data dan migrasi

1. Pertahankan `tripVersion.itineraryStages` sebagai itinerary inti. Kolom teks
   `itinerary` hanya kompatibilitas/migrasi dan tidak lagi menjadi sumber baru.
2. Jadikan versi trip immutable: menyimpan perubahan Data paket membuat versi
   baru. Jadwal lama tetap memakai `tripVersionId` yang sudah terikat. Admin
   diberi aksi eksplisit untuk membuat jadwal dari versi terbaru, bukan perubahan
   diam-diam pada jadwal yang dibuka atau sudah memiliki booking.
3. Tambahkan override itinerary jadwal yang nullable bila secara bisnis sebuah
   tanggal memang mempunyai rute penuh berbeda. `NULL` berarti memakai
   itinerary versi paket; jangan menyalin JSON yang sama.
4. Tambahkan field/kolom JSON nullable khusus `pickupRundownStages` pada
   `departurePickupOption`. Isinya hanya segmen penjemputan/perbedaan rute.
   Jangan memakai lagi nama `itineraryStages` untuk dua makna berbeda.
5. Migrasikan data lama dengan aman:
   - bila rundown pickup identik dengan itinerary paket, ubah menjadi `NULL`;
   - bila berbeda, pindahkan sebagai rundown pickup dan beri catatan review
     admin karena mungkin sebenarnya itinerary jadwal;
   - pertahankan snapshot booking, invoice, dan rundown peserta yang sudah
     diterbitkan; tidak ada mutasi historis.
6. Public query harus menerima `departureId`, memuat `tripVersion` dari jadwal
   tersebut, lalu hanya mengambil pickup aktif dari jadwal itu. Query katalog
   tetap boleh memilih jadwal terdekat untuk ringkasan kartu, dengan label
   “Mulai dari”.

## Perubahan admin

- **Data paket**: label bagian menjadi `Itinerary inti perjalanan`. Bantuan
  field menjelaskan bahwa ini muncul satu kali di detail dan rundown peserta.
- **Jadwal**: tampilkan versi paket yang dipakai. Tambahkan `Gunakan itinerary
khusus jadwal ini` sebagai aksi eksplisit; default-nya mengikuti paket.
- **Titik jemput**: ubah `Rundown titik ini` menjadi `Rundown sebelum bergabung
ke perjalanan utama (opsional)`. Kosong berarti tidak ada tambahan, bukan
  salinan itinerary paket.
- Ringkasan sebelum membuka jadwal harus memperlihatkan jumlah titik aktif,
  harga minimum, dan versi itinerary agar admin tahu konteks yang ia ubah.

## Tahapan implementasi

### 4J.1 — Fondasi dan migrasi

Perbarui skema, kontrak API, parser, dan query tanpa mengubah tampilan besar.
Siapkan skrip backfill yang idempotent dan laporan item yang perlu review.

### 4J.2 — Admin yang tidak duplikatif

Ubah label/form Data paket, Jadwal, serta Meeting point. Hilangkan penyalinan
otomatis itinerary paket ke pickup baru. Tambahkan peringatan konfirmasi sebelum
menerapkan versi/override pada jadwal yang sudah memiliki order.

### 4J.3 — Detail publik berorientasi jadwal

Buat pemilih jadwal server-rendered dengan URL yang stabil. Render satu konteks
jadwal; ganti tabel meeting point responsif menjadi kartu pada mobile. CTA dan
harga harus menggunakan jadwal serta pickup yang sama dengan checkout.

### 4J.4 — Rundown, regresi, dan konten nyata

Pastikan rundown peserta menyusun itinerary ter-resolve + pickup terpilih tanpa
duplikasi. Bersihkan contoh/data lama, kemudian uji konten panjang, harga berbeda,
dan jadwal dengan versi berbeda.

## Kriteria selesai

- Tidak ada overflow horizontal pada 320, 360, 390, 768, 1024, dan 1440px;
  `document.documentElement.scrollWidth` sama dengan lebar viewport pada detail
  publik (kecuali area tabel yang secara sengaja memiliki scroll internal).
- Detail satu jadwal tidak pernah menampilkan meeting point atau harga milik
  jadwal lain.
- Itinerary inti hanya muncul satu kali. Rundown pickup kosong tidak dirender;
  rundown yang ada jelas merupakan segmen sebelum perjalanan utama.
- Harga minimum katalog, harga detail jadwal, pilihan checkout, quote, invoice,
  dan snapshot booking cocok untuk kombinasi jadwal/titik yang sama.
- Mengubah Data paket untuk penjualan baru tidak mengubah detail, invoice, atau
  rundown milik jadwal/order lama tanpa aksi eksplisit dan audit log.
- Keyboard, fokus, label kontrol, tampilan tanpa JavaScript, dan pembaca layar
  tetap dapat memilih jadwal serta melanjutkan booking.

## Bukan scope Phase 4J

Tidak membuat peta interaktif, integrasi WhatsApp API, akun peserta, perubahan
aturan harga/DP/kuota, atau desain ulang seluruh website. Perubahan tersebut
dipisahkan agar perbaikan detail Open Trip dapat diuji sebagai satu alur utuh.
