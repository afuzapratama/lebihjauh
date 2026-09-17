# LebihJauh — Rencana Landing Page

Status: preview Home sudah diimplementasikan dan arah visualnya diterima pengguna.
Navigasi saat ini menuju bagian Home, dan detail trip/artikel ditampilkan lewat dialog.
Halaman terpisah serta booking/admin belum diimplementasikan. Scope lanjutan kini
mencakup admin, booking tersimpan, invoice, dan pembayaran. Acuan fase 4–5 telah
diganti oleh [roadmap booking dan admin](website-roadmap.md), untuk review sebelum
implementasi. Batas scope dan deployment statis di dokumen ini adalah catatan
rencana landing page awal, bukan batas kebutuhan sistem lanjutan.

## Tujuan

Membangun website open trip pendakian dengan karakter LebihJauh: real, relatable,
adventurous, open, Indonesian, dan always curious. Pengunjung bisa mengenal brand,
menemukan perjalanan dan harga, serta memahami pilihan open trip atau private trip.
Fokus pertama adalah tampilan landing page. Fitur operasional menyusul setelah
arah visualnya disepakati.

## Rekomendasi stack

- Astro + TypeScript untuk halaman publik, katalog, dan artikel.
- CSS custom dengan design tokens untuk warna, tipografi, jarak, dan komponen.
- JavaScript seperlunya untuk navigasi mobile, filter, dan galeri.
- Data trip terstruktur dan artikel Markdown pada tahap awal, agar mudah diperbarui
  dan dipindahkan ke CMS/API saat dibutuhkan.
- Node.js untuk development/build. Versi dipilih mengikuti persyaratan versi Astro
  stabil yang digunakan saat implementasi.

Landing page awal dibangun statis. Hasil build `dist/` dapat dilayani Nginx pada
VPS atau website statis di aaPanel, tanpa proses Node yang terus berjalan. Jika
fitur berikutnya membutuhkan server rendering, Astro menyediakan adapter Node;
deployment tersebut memakai proses Node di belakang reverse proxy Nginx.
Update konten lokal membutuhkan build dan deploy ulang pada mode statis.

Referensi resmi:

- https://docs.astro.build/en/guides/deploy/
- https://docs.astro.build/en/guides/integrations-guide/node/

## Arah visual

Konsep: jurnal perjalanan outdoor dengan komposisi editorial, ruang kosong cukup,
foto alam yang dominan, dan elemen grafis terasa manusiawi.

Palet kerja dari moodboard, disempurnakan saat preview:

| Warna         | Nilai awal | Peran                                |
| ------------- | ---------- | ------------------------------------ |
| Trail orange  | #FF6600    | CTA, panah, garis penekanan          |
| Charcoal      | #111111    | Teks utama dan beberapa bidang gelap |
| Sand          | #DFD9D0    | Bidang netral hangat                 |
| Outdoor green | #556B2F    | Aksen alam; pendekatan awal          |
| Ocean blue    | #4F788A    | Aksen pendukung; pendekatan awal     |
| Off-white     | #F6F5F0    | Latar baca, tambahan untuk website   |

- Heading sans-serif tebal dan rapat; body Inter atau sans-serif serupa.
- Tulisan tangan dipakai terbatas pada tagline dan penekanan pendek agar mudah dibaca.
- Logo pada moodboard menjadi referensi; wordmark sementara bukan aset logo final.
- Panah, garis sapuan, kontur topografi, dan label seperti tiket perjalanan menjadi
  aksen; tekstur dibuat halus agar tidak mengganggu informasi trip.
- Foto gunung, pendaki, sunrise, dan suasana camp dari Unsplash sebagai placeholder.
  Simpan URL sumber/fotografer; jangan mengklaim foto stok sebagai dokumentasi peserta
  LebihJauh atau sebagai gunung tertentu tanpa verifikasi.
- Layout asimetris yang teratur, kartu trip berfokus pada fotografi, dan galeri kolase.
- Gerak pendek dan seperlunya, dengan dukungan reduced motion.
- Bahasa Indonesia yang akrab, hangat, dan mengajak; tagline Inggris dari moodboard
  dapat menjadi aksen.

## Navigasi dan halaman

Navigasi utama: Home · Trip ▾ · Galeri · News. CTA: Lihat Jadwal.

| Menu/halaman        | URL usulan    | Fungsi                                              |
| ------------------- | ------------- | --------------------------------------------------- |
| Home                | /             | Landing page dan pengenalan brand                   |
| Trip → Open Trip    | /trip         | Jadwal bersama, destinasi, harga                    |
| Detail Open Trip    | /trip/[slug]  | Ringkasan, keberangkatan, itinerary, fasilitas, CTA |
| Trip → Private Trip | /private-trip | Perjalanan dengan rombongan dan tanggal pilihan     |
| Galeri              | /galeri       | Foto perjalanan                                     |
| News                | /news         | Kabar jadwal, cerita, dan informasi pendakian       |
| Detail News         | /news/[slug]  | Artikel atau pengumuman                             |

Open Trip dan Private Trip digabung dalam dropdown untuk merapikan navigasi,
tetapi halaman dipisah karena kebutuhan pengunjung berbeda. Gunakan “Private Trip”
sebagai nama layanan, “Request Trip” sebagai tombol aksinya. Pada mobile, submenu
harus bisa dibuka dengan tap dan keyboard, tanpa bergantung pada hover.

Jadwal pada katalog trip adalah acuan utama keberangkatan. News membahas pengumuman
dan menautkan trip terkait agar informasi jadwal tidak saling berbeda.

## Urutan landing page

1. **Hero:** foto lanskap besar, headline “Pergi. Yang jauh. Pulang.”, pengantar
   singkat, CTA “Lihat Open Trip”, dan link “Rencanakan Private Trip”.
2. **Trip terdekat:** 3–4 kartu berisi tujuan, tanggal, durasi, meeting point, harga
   per orang, dan tombol “Lihat Trip”. Kesulitan pendakian ditambahkan bila datanya ada.
3. **Cerita LebihJauh:** alasan brand mengajak orang bepergian, dengan komposisi foto
   dan teks editorial. Hindari statistik, ulasan, dan klaim layanan yang belum tersedia.
4. **Private Trip:** ajakan merencanakan pendakian dengan teman atau komunitas,
   dengan CTA “Request Trip”.
5. **Galeri:** cuplikan atmosfer perjalanan dan tautan ke halaman galeri.
6. **News terbaru:** tiga artikel/pengumuman dengan kategori dan tanggal publikasi.
7. **FAQ:** pertanyaan dasar seputar cara ikut, pengalaman mendaki, dan perlengkapan;
   jawaban operasional mengikuti kebijakan nyata yang diberikan kemudian.
8. **Penutup dan footer:** ajakan melihat jadwal, identitas brand, kontak, dan sosial
   media yang telah tersedia.

## Fase pengerjaan awal — rincian lanjutan sudah digantikan

Tabel berikut merekam rencana awal. Untuk fase 4–5, gunakan urutan terbaru pada
[roadmap booking dan admin](website-roadmap.md). Admin, invoice, dan pencatatan
pembayaran kini termasuk scope lanjutan; tidak lagi ditunda ke roadmap terpisah.

| Fase                     | Pekerjaan                                                                                      | Hasil dan kriteria selesai                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1 — Arah dan struktur    | Moodboard, palet, tipografi, navigasi, urutan konten                                           | Dokumen ini menjadi acuan preview pertama                                                                         |
| 2 — Preview landing page | Setup Astro; implementasi Home desktop/mobile dengan konten contoh dan foto Unsplash           | Halaman bisa dibuka lokal; hero, kartu trip, dan karakter visual bisa direview; data contoh dikenali sebagai demo |
| 3 — Penyempurnaan Home   | Terapkan feedback pada komposisi, warna, tulisan, foto, dan interaksi                          | Arah landing page diterima sebelum memperluas halaman                                                             |
| 4 — Halaman pendukung    | Open Trip, detail, Private Trip, Galeri, News dan artikel                                      | Navigasi antarahalaman berjalan; harga dan CTA konsisten; tujuan CTA memakai kontak/integrasi yang tersedia       |
| 5 — Siap deploy          | Optimasi foto, metadata, aksesibilitas, pengecekan link dan layout, build, panduan VPS/aaPanel | Build berhasil, alur utama terverifikasi, dan hasil siap dipasang di server                                       |

Pada fase preview, tombol menuju bagian atau halaman yang tersedia. Aksi yang
belum terintegrasi ditandai sebagai demo; tidak menampilkan keberhasilan booking
atau pengiriman request palsu. Preview tetap demikian sampai sistem booking pada
roadmap revisi siap. Admin, database booking, kuota, invoice, serta pencatatan DP
dan pelunasan dibangun sesuai roadmap tersebut. Metode pembayaran masih perlu
dipilih; akun pelanggan belum menjadi kebutuhan MVP yang disepakati.

## Verifikasi implementasi nanti

- Layout mobile, tablet, desktop tidak overflow; harga dan CTA mudah ditemukan.
- Navigasi, dropdown, tautan kartu, dan alur halaman berfungsi dengan keyboard/tap.
- Teks dan tombol memiliki kontras cukup, termasuk kombinasi warna oranye.
- Foto memiliki ukuran responsif, dimensi tetap, dan alt text yang sesuai.
- Metadata halaman dan struktur heading sesuai isi; URL produksi dipasang saat tersedia.
- Build produksi berhasil dan rute hasil build bisa dibuka pada konfigurasi hosting.

## Informasi yang dilengkapi menjelang penggunaan nyata

Logo final, destinasi dan jadwal, harga dan fasilitas, meeting point, itinerary,
kontak bisnis, akun sosial, ketentuan trip, serta dokumentasi asli. Informasi ini
tidak menghambat pembuatan preview visual dengan konten contoh yang diberi penanda.
