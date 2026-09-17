# LebihJauh — Acuan UI/UX

Versi **1.1 · 13 September 2026**. Patokan desain untuk melanjutkan proyek mulai
fase 4C. Dokumen ini mencatat bahasa visual dan komponen yang sudah dipakai, serta
aturan penggunaan untuk halaman berikutnya. Pembuatan dokumen tidak mengubah UI.

## 1. Kedudukan acuan

Baca dokumen ini sebelum membuat atau mengubah halaman, layout, tombol, maupun
interaksi. Tujuannya agar pekerjaan tetap konsisten meskipun dilanjutkan orang atau
agent yang berbeda.

| Acuan                                                                                         | Peran                                                                            |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Dokumen ini**                                                                               | Patokan visual, komponen, dan perilaku UI/UX lintas fase                         |
| [Roadmap](website-roadmap.md)                                                                 | Urutan pengerjaan, batas scope, dan syarat selesai                               |
| [Aturan bisnis 4A](phase-4a/business-rules.md) dan [kontrak data](phase-4a/data-contracts.md) | Kebenaran harga, kuota, pembayaran, status, dan transaksi                        |
| [Rencana Home](landing-page-plan.md)                                                          | Asal arah visual website publik; nilai palet awal merupakan riwayat rancangan    |
| [Prototipe 4A](phase-4a/review.html)                                                          | Referensi komposisi admin, checkout, dan invoice; bukan implementasi operasional |
| [Catatan 4C](phase-4c/README.md)                                                              | Status implementasi, cara menjalankan, bukti uji, dan pekerjaan terbuka          |

Jika angka atau label di prototipe lama berbeda dari keputusan bisnis terbaru,
ikuti keputusan bisnis. Menggunakan desain prototipe tidak berarti menghidupkan
fitur simulasi atau menyalin aturan contoh.

Nilai pada bagian **baseline** di bawah diambil dari kode saat versi ini dibuat.
Bagian **pola fase berikutnya** adalah pedoman implementasi, bukan klaim bahwa
komponen/fiturnya sudah tersedia. Jika kode dan panduan kelak berbeda, telusuri
perubahannya dan perbarui keduanya; jangan menjadikan perbedaan tanpa catatan sebagai
desain baru.

## 2. Karakter dan dua konteks tampilan

Karakter LebihJauh: jurnal perjalanan outdoor, hangat, editorial, rapi, dan mudah
dibaca. Identitas utama berasal dari bidang krem, teks gelap, hijau alam, oranye,
ruang kosong, serta panah kecil sebagai aksen.

| Konteks        | Arah                                                                                | Implementasi acuan                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Website publik | Foto perjalanan dominan, komposisi editorial, judul ekspresif, ajakan menjelajah    | [Layout.astro](../src/layouts/Layout.astro), [global.css](../src/styles/global.css), [Home](../src/pages/index.astro) |
| Admin          | Informasi dan formulir teratur, sidebar hijau gelap, judul besar, panel krem terang | [AdminLayout.astro](../src/layouts/AdminLayout.astro), [admin.css](../src/styles/admin.css)                           |
| Login admin    | Identitas yang sama; bidang cerita hijau di kiri dan form fokus di kanan            | [login.astro](../src/pages/admin/login.astro)                                                                         |

Publik dan admin berbagi identitas, tetapi tidak harus memakai ukuran judul, jenis
font display, atau susunan navigasi yang sama. Jangan memuat `global.css` dan
`admin.css` bersamaan pada satu halaman: keduanya memiliki reset, token `:root`,
serta beberapa nama class yang sama.

## 3. Warna baseline

### Admin

| Peran              | Token / nilai               | Penggunaan                            |
| ------------------ | --------------------------- | ------------------------------------- |
| Kertas             | `--paper: #f6f5f0`          | Latar halaman                         |
| Tinta              | `--ink: #20271f`            | Teks utama                            |
| Teks pendukung     | `--muted: #62685d`          | Deskripsi pendek, metadata            |
| Garis              | `--line: #dce0d4`           | Pembatas panel dan baris              |
| Oranye             | `--orange: #ff6600`         | Tombol utama, menu aktif, aksen brand |
| Hijau              | `--green: #394a35`          | Aksen dan tindakan teks               |
| Sidebar            | `#1f291f`                   | Navigasi dan bidang cerita login      |
| Panel              | `#fffef9`                   | Permukaan formulir/kartu              |
| Input              | `#ffffff`, border `#cbd0c0` | Area pengisian                        |
| Teks tombol oranye | `#151d13`                   | Label di atas oranye                  |
| Fokus              | `#4c7994`                   | Outline keyboard                      |

Warna status mengikuti tabel pada bagian 7. Oranye adalah penekanan tindakan dan
identitas; error memakai merah. Hindari mengganti teks tombol oranye menjadi putih
tanpa pemeriksaan kontras.

### Website publik

Pertahankan token yang sudah ada di `global.css`: paper `#f6f5f0`, ink `#191b18`,
orange `#ff6600`, orange-text `#d54e00`, muted `#6b6c63`, line `#ddded5`, dan olive
`#3c4936`. Perbedaan kecil dengan palet admin adalah baseline yang memang ada;
jangan mengambil nilai palet moodboard awal untuk mengganti CSS secara sepihak.

### Navigasi publik dan detail trip

Header website publik hanya memakai
[SiteHeader.astro](../src/components/SiteHeader.astro). Komponen ini dipakai pada
Home, katalog, dan detail trip; prop `active` hanya membedakan halaman yang sedang
dibuka. Jangan menyalin markup header atau skrip menu ke halaman publik baru.

Card open trip pada Home dan katalog memakai pola visual yang sama: foto dengan
overlay, kategori, judul dan nomor, ringkasan, durasi/tanggal, meeting point, lalu
harga dan tautan detail. Home boleh menggunakan data editorial preview, tetapi
katalog hanya boleh mengisi field yang benar-benar tersedia dari trip dan jadwal.
Pada lebar hingga 800px, katalog selalu satu kolom; filter menjadi satu kolom penuh
pada ponsel. Di detail trip mobile, jadwal tampil setelah fakta ringkas dan sebelum
isi panjang. Header menjadi sticky, menu memiliki target sentuh minimal 44px, dan
tautan menu aktif tetap terlihat jelas.

Untuk detail trip, foto hero dan area teks adalah satu grid: foto mengisi tinggi
area tersebut dengan `object-fit: cover`, sehingga teks yang lebih panjang tidak
meninggalkan bidang kosong. Informasi panjang tidak ditampilkan sebagai satu blok
paragraf. Utamakan urutan berikut: tiga fakta penting, kartu “sudah termasuk” dan
“siapkan sendiri”, itinerary bernomor, lalu detail pendukung dengan `<details>`.
Pola ini menjaga halaman tetap mudah dipindai tanpa menyembunyikan informasi penting.
Nomor itinerary mewakili **satu hari atau satu tahap**, bukan setiap baris teks.
Di form admin, awali tahap dengan `Hari 1 — Judul`, lalu tulis uraian pada baris
berikutnya. Renderer publik mengelompokkan judul dan uraiannya, lalu memberi nomor
otomatis.

## 4. Tipografi, bentuk, dan jarak baseline admin

Admin memakai **Inter** lokal, dengan berkas bobot 400, 600, dan 700. Body
`14px/1.6`. Website publik memakai Inter untuk isi, Barlow Condensed untuk display,
dan Caveat sebagai aksen tulisan tangan. Jangan membawa font dekoratif ke angka,
harga, tabel operasional, atau input.

| Elemen admin            | Ukuran / pengaturan                                                    |
| ----------------------- | ---------------------------------------------------------------------- |
| Judul halaman `h1`      | `clamp(32px, 3.5vw, 46px)`, line-height `1.1`, letter-spacing `-1.8px` |
| Judul panel `h2`        | `22px`, line-height `1.3`, letter-spacing `-0.7px`                     |
| Judul item `h3`         | `17px`                                                                 |
| Label form              | `12px`, bobot 600                                                      |
| Isi input               | `13px`                                                                 |
| Teks pendukung `.muted` | `12px`, line-height `1.8`                                              |
| Bantuan field           | `11px`                                                                 |
| Eyebrow                 | `10px`, bobot 600, tracking `1.4px`                                    |
| Status / badge          | `10px`                                                                 |

Bentuk dominan berupa panel persegi dengan border tipis, tanpa bayangan berat.
Panel `.panel` tidak memiliki radius yang ditetapkan; input, tombol utama, badge,
dan tombol sekunder memakai radius **3px**, item navigasi **4px**. Nama `.pill`
pada CSS tidak berarti bentuk kapsul bulat penuh. Aksen titik brand tetap bulat.

Jarak mengikuti fungsi, bukan angka baru pada setiap halaman:

- Panel: padding **26px**, menjadi **20px** di mobile.
- Antarpanel utama: **25px**; grid item tambahan: **16px**.
- Form: gap **18px**, margin atas **25px**.
- Label ke input: **8px**; pasangan field `.two-col`: gap **15px**.
- Kelompok tombol: gap **8px** dan dapat turun baris.
- Judul halaman: margin atas **36px**, bawah **28px**.

Gunakan class bersama untuk memperoleh nilai tersebut. Bila konten butuh susunan
khusus, buat class khusus modul; jangan mengubah `.panel` global untuk satu layar.

## 5. Layout dan navigasi admin

Susunan halaman admin terautentikasi:

```text
AdminLayout
├── Sidebar: brand → navigasi → tautan website
└── Workspace
    ├── Topbar: konteks halaman + nama admin + Keluar
    ├── Main: judul → panel/form → daftar/ringkasan
    └── Footer
```

| Lebar viewport | Perilaku baseline                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Di atas 1120px | Sidebar fixed **245px**; workspace margin kiri **245px**, padding horizontal **42px**, max-width **1600px**; `.layout` dua kolom `1.1fr 1fr`, gap **25px**       |
| 761–1120px     | Sidebar tetap; padding workspace **24px**; `.layout` menjadi satu kolom                                                                                          |
| 760px ke bawah | Sidebar menjadi header sticky dengan tombol **Menu**; navigasi dibuka sesuai kebutuhan, workspace tanpa margin kiri, dan pasangan field/kartu menjadi satu kolom |

Topbar minimal **76px**, menjadi **66px** di mobile. Stamp dekoratif judul,
bagian bawah sidebar, dan menu “Segera hadir” disembunyikan pada mobile. Jangan
menyembunyikan fungsi aktif yang diperlukan pengguna untuk menyelesaikan tugas.

Navigasi aktif menggunakan `aria-current="page"`. Kelompok yang memiliki beberapa
halaman memakai `details/summary`, misalnya **Trip & jadwal** untuk Open/Private
Trip dan **Pembayaran** untuk verifikasi, metode, serta Keuangan. Submenu aktif
terbuka otomatis. Menu belum tersedia berupa teks “Segera hadir”, bukan link
kosong `#`. Nomor menu membantu urutan; nama menu tetap harus menjelaskan
tujuannya.

`AdminLayout` menerima `title`, `active` (`dashboard`, `trips`, `orders`,
`payments`, `paymentMethods`, `finance`, `privateTrips`, atau `content`), serta `guest`. Saat
menambah modul admin, perluas pilihan `active`, label topbar, dan navigasi di
layout bersama. Jangan menyalin sidebar/topbar/logout ke halaman baru. Mode
`guest` dipakai login dan tidak menyertakan kerangka sidebar admin.

Login memakai dua kolom sama lebar, tinggi minimal `100svh`, dan form maksimum
**390px**. Pada mobile, bidang cerita berada di atas form. Input tetap menjadi
fokus tugas; dekorasi tidak boleh menghalangi aksesnya.

## 6. Tombol, tautan, dan ikon

| Kebutuhan                              | Class baseline admin                   | Bentuk dan perilaku                                                                              |
| -------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Tindakan utama                         | `.primary`                             | Oranye, teks gelap, padding `12px 16px`, tinggi minimum **46px**, font **12px**, hover `#f07824` |
| Edit / tindakan pendamping pada daftar | `.actions button`, `.schedules button` | Putih, border tipis, padding `8px 12px`, minimum **40px**, hover `#edf0e7`                       |
| Tindakan ringan                        | `.quiet-button`, `.link-button`        | Teks bergaris bawah, tanpa bidang tombol; contoh Keluar, Trip baru                               |
| Navigasi menuju halaman lain           | Elemen `<a href>`                      | Gunakan `.primary` bila merupakan CTA utama menuju halaman                                       |
| Aksi pada halaman / submit             | Elemen `<button>`                      | `type="button"` untuk aksi biasa; `type="submit"` untuk submit form                              |

Satu tindakan utama per kelompok tugas. Dua form independen boleh masing-masing
memiliki tombol “Simpan”. Tulis kata kerja dan objek yang jelas: **Simpan trip**,
**Simpan jadwal**, **Edit jadwal**, **Tambah jadwal**. Hindari label umum “OK” atau
“Submit” untuk tindakan yang perlu dipahami dampaknya.

Baseline publik memakai `.button` dengan minimum **49px**, padding `15px 23px`,
dan varian `.button-orange`, `.button-dark`, `.button-cream`, serta `.text-button`.
Gunakan keluarga tombol sesuai layout halaman, jangan mencampur class admin/publik.

Panah `↗` adalah aksen kecil, bukan pengganti label. Beri `aria-hidden="true"` pada
ikon yang murni dekoratif. Untuk SVG, gunakan [Icon.astro](../src/components/Icon.astro)
bila ikon yang diperlukan sudah tersedia. Tombol ikon tanpa teks harus memiliki
nama aksesibel yang spesifik. Hindari menambahkan pustaka ikon hanya untuk satu ikon.

## 7. Badge, status, dan umpan balik

| Kondisi        | Class / atribut                            | Tampilan baseline admin                                 |
| -------------- | ------------------------------------------ | ------------------------------------------------------- |
| Jadwal Draft   | `.state.draft`                             | Latar `#f7edcf`, teks `#73520c`                         |
| Jadwal Buka    | `.state.open`                              | Latar `#e4eadb`, teks `#334829`                         |
| Jadwal Tutup   | `.state.closed`                            | Latar `#e7e8df`, teks `#53574f`                         |
| Tersedia       | `.pill.olive`                              | Hijau muda                                              |
| Segera hadir   | `.pill`                                    | Netral; tanpa aksi aktif                                |
| Informasi      | `.notice`                                  | Latar krem, garis kiri oranye                           |
| Berhasil       | `.notice[data-type="success"]`             | Latar hijau muda, garis hijau                           |
| Gagal          | `.notice[data-type="error"]`, `.error-msg` | Latar `#fff0ee`, teks `#a12424`, garis kiri `#b33232`   |
| Catatan aturan | `.policy`                                  | Bidang `#edf0e7`, isi singkat, nilai penting dipertegas |

Selalu sertakan label teks; warna tidak boleh menjadi satu-satunya penanda status.
Status jadwal **Draft/Buka/Tutup** berbeda dari status pembayaran **Unpaid/DP/Paid**
dan status booking. Komponen status pembayaran/booking belum menjadi baseline CSS
operasional; definisikan variannya pada fase terkait tanpa mengubah maknanya.

Pesan berhasil hanya tampil setelah respons server menyatakan penyimpanan berhasil.
Gunakan `role="status"` untuk pembaruan biasa dan `role="alert"` untuk kegagalan
yang perlu segera diketahui. Admin memakai notifikasi global di kanan-bawah melalui
`window.adminNotify({ message, type, actionLabel?, onAction? })`; `success`, `info`,
dan `warning` hilang otomatis, sedangkan `error` tetap sampai ditutup. Login memakai
error dekat form. Jangan menampilkan stack trace, secret, atau pesan teknis mentah.

## 8. Form dan interaksi

Setiap input memiliki label terlihat, tipe input yang sesuai, serta bantuan singkat
bila formatnya tidak jelas. Placeholder memberi contoh, bukan menggantikan label.
Baseline input minimum **44px**, padding `11px 12px`; textarea dapat diperbesar
vertikal. Gunakan `.two-col` untuk pasangan field terkait yang tetap turun menjadi
satu kolom di mobile.

Form trip saat ini mengikuti urutan identitas → foto → tentang trip → fasilitas →
itinerary/meeting point → persiapan/ketentuan. Bagian tambahan memakai elemen native
`details`/`summary`. Jangan menyembunyikan field invalid di accordion tertutup:
saat menambah validasi pada bagian tersebut, buka bagian dan arahkan fokus ke field.

Revisi detail Open Trip: gunakan tab **Jadwal / Data paket / Titik jemput**, dengan
Jadwal sebagai tampilan awal. Form jadwal/lokasi dibuka saat Tambah atau Edit;
berpindah tab mempertahankan isian di memori selama halaman masih terbuka.
Kelola jadwal menjadi aksi utama setiap baris, sedangkan Edit/Hapus berada di
“Lainnya”. Pengaturan DP, tenggat, dan status memakai disclosure dengan ringkasan
nilai yang sedang berlaku. Hindari menampilkan semua form sekaligus.

Jadwal baru memilih meeting point tersimpan dan mengisi **harga lokasi tersebut**;
alamat serta rundown disalin dari paket. Tidak ada input harga referensi terpisah.
Edit jadwal mengambil harga dari meeting point di server; perubahan harga dilakukan
di operasional meeting point. Zona waktu WIB ditampilkan sebagai label, bukan
dropdown satu pilihan. Jam menggunakan input waktu per menit, durasi awal mengikuti
jumlah hari/tahap itinerary, tutup booking awal H-1, pelunasan opsional tanpa tanggal
otomatis. Semua waktu dan tenggat tetap dapat diedit.

Perilaku yang harus dipertahankan/dilengkapi saat memperluas form:

1. Saat submit berjalan, nonaktifkan tombol submit untuk mencegah klik berulang.
   Baseline memakai opacity `0.55` dan cursor tunggu; login juga mengubah label
   menjadi “Masuk...”. Disabled karena fitur belum tersedia tidak perlu cursor tunggu.
2. Saat gagal, pertahankan nilai input, tampilkan sebab yang dapat dipahami, dan
   aktifkan kembali tombol. Jangan mereset form pada kegagalan.
3. Saat berhasil, tampilkan konfirmasi, perbarui daftar, dan reset mode form bila
   sesuai tugas. Pilihan trip pada form jadwal tidak boleh hilang hanya karena
   daftar dimuat ulang.
4. Mode edit menampilkan nama trip/jadwal yang diedit dan pilihan kembali membuat
   data baru. Tombol edit berulang perlu konteks aksesibel (trip/tanggal).
5. Pemeriksaan browser membantu pengguna; validasi server tetap menentukan hasil.
   Tombol disabled bukan pengganti perlindungan submit ganda di server.

Nilai Rupiah di input berupa bilangan bulat tanpa pemisah; ringkasan memakai format
Indonesia, misalnya `Rp2.500.000`. Bedakan **harga per peserta** dan **DP per total
pesanan**. Zona waktu harus terlihat. Baseline form jadwal memakai kalender tanggal
native dan pilihan jam, lalu tombol durasi cepat serta cutoff H-1/H-2/H-3. Baseline
saat ini hanya **WIB**; jangan menambah pilihan WITA/WIT tanpa menyesuaikan konversi
input, tampilan, dan uji. Aturan nominal dan tenggat mengikuti dokumen bisnis, bukan
panduan visual ini.

Upload foto memakai area pilih file, thumbnail, nama/ukuran file, serta tindakan
“Ganti foto”. Menerima JPEG/PNG/WebP maksimal 8 MB; URL foto manual tetap tersedia
sebagai fallback. Ikuti [panduan R2 4C](phase-4c/cloudflare-r2-media.md) untuk
perilaku upload dan setup keamanan, bukan menambahkan credential ke client.

## 9. Daftar, kondisi kosong, dan aksesibilitas

Daftar trip memakai `.trip-cards` dan `.trip-card`: thumbnail, nama, metadata,
keberangkatan terdekat, status, kelengkapan, serta tindakan terkait. Halaman detail
memakai `.schedules` dan `.actions` untuk jadwal. Border tipis membagi informasi;
status dan tindakan diletakkan dekat data yang dipengaruhi.

Setiap daftar harus menangani loading, terisi, kosong, dan gagal. Loading memakai
teks serta `aria-busy`; kosong memberi langkah selanjutnya; error tetap memberi
jalan mencoba lagi. Contoh baseline: “Belum ada trip. Buat paket pertama di formulir
di atas.” Jangan menyamarkan error pemuatan sebagai daftar kosong.

Pertahankan skip link ke konten, urutan heading, landmark `main`/`nav`, fokus keyboard
yang terlihat (outline **3px**, offset **3px** pada admin), dan dukungan reduced motion.
Jangan mengandalkan hover untuk fungsi utama. Pastikan nama panjang, harga besar,
dan pesan error dapat membungkus tanpa membuat halaman melebar.

Ukuran tombol sekunder baseline masih minimum 40px; bila memperluas interaksi mobile,
utamakan area sentuh sekurangnya 44px tanpa memperkecil input/tombol utama yang ada.
Angka kecil 9–10px pada baseline untuk metadata/dekorasi, bukan instruksi penting.

## 10. Pola fase berikutnya — belum seluruhnya diimplementasikan

| Fase / kebutuhan  | Patokan lanjutan                                                                                                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4D katalog/detail | Ikuti keluarga layout publik. Kartu berfoto, filter berlabel, hasil kosong/reset jelas. Deskripsi dan panel jadwal memakai data yang sama; booking belum aktif sebelum fasenya siap.                                                                |
| 4E checkout       | Implementasi memakai empat blok bernomor: pax → PIC → peserta → konfirmasi; ringkasan sticky di desktop dan berada sebelum form pada mobile. Harga berubah perlu ditinjau ulang.                                                                    |
| 4E invoice        | Nomor order, trip/tanggal/pax, total, DP, dan batas hold punya hierarki jelas. Versi cetak mengutamakan keterbacaan; manifest admin tidak memuat NIK penuh. Pembayaran/saldo hadir pada 4F.                                                         |
| 4E admin order    | Dahulukan tindakan operasional: metrik hold, cari/filter, status berbahasa manusia, dan CTA WA PIC. Batal/buka ulang memakai konfirmasi, alasan bila batal, notifikasi hasil, serta jejak audit; manifest cetak hanya berisi data minimum lapangan. |
| 4F pembayaran     | Status konfirmasi transfer, pembayaran terverifikasi, dan booking dipisahkan. Tindakan verifikasi/penolakan menunjukkan nominal dan konsekuensi; penolakan wajib memiliki alasan.                                                                   |
| 4G–4H admin baru  | Perluas layout/nav bersama, gunakan panel/form/status yang sama; pilih komponen baru hanya untuk kebutuhan yang belum tercakup.                                                                                                                     |
| Tabel data besar  | Gunakan header kolom yang jelas, filter dan kondisi kosong. Pada mobile, sediakan susunan ringkas atau scroll di dalam wadah tabel, bukan seluruh halaman.                                                                                          |
| Dialog konfirmasi | Untuk aksi yang berdampak nyata seperti arsip/hapus, gunakan `window.adminConfirm({ title, message, confirmLabel, destructive })`. Dialog menyebut objek/dampak, memakai `<dialog>`, menyediakan Batal/Escape, dan fokus awal berada pada Batal.    |
| Aksi destruktif   | Buat varian khusus yang jelas saat dibutuhkan; jangan menyamakan hapus/batal dengan tombol simpan oranye. Ikuti aturan histori/audit dan bisnis.                                                                                                    |

Ketentuan di tabel ini bukan otorisasi untuk membangun semua fase sekaligus. Data
contoh di preview harus tetap dikenali sebagai contoh. Foto stok tidak disebut
dokumentasi peserta; sumber foto mengikuti [catatan aset](asset-sources.md).

## 11. Cara memakai acuan saat mengerjakan halaman

1. Tentukan konteks publik/admin dan fase yang diminta; baca dokumen fase terkait.
2. Gunakan layout, class, dan pola interaksi yang sudah tersedia. Untuk admin,
   mulai dari [dashboard](../src/pages/admin/index.astro) atau
   [trip/jadwal](../src/pages/admin/trips.astro).
3. Jika butuh varian bersama, tambahkan di stylesheet/layout yang sesuai dan catat
   peran serta state-nya di dokumen ini. Jangan membuat tema baru per modul.
4. Perubahan arah besar—palet, font utama, bentuk komponen, atau struktur navigasi—
   mengikuti arahan pengguna. Catat alasan dan dampak agar agent berikutnya tidak
   menganggap eksperimen lokal sebagai patokan final. Penyesuaian rutin untuk
   keterbacaan/responsif tidak memerlukan proses persetujuan tambahan.
5. Periksa desktop/mobile, keyboard, focus, label, state loading/kosong/gagal,
   submit berulang, teks panjang, serta konsistensi format angka/waktu.
6. Untuk perubahan kode, jalankan `npm run check` dan `npm run build`; uji UI admin
   dengan `npm run test:admin-ui` bila relevan. Perluas skenario bila menambah modul.
   Pengujian fixture tidak menggantikan uji autentikasi/persistensi database nyata.
7. Perbarui screenshot dan catatan fase jika tampilan berubah material. Catat hasil
   uji aktual dan keterbatasannya; pembaruan dokumen saja tidak memerlukan build ulang.

## 12. Referensi visual dan riwayat

Baseline operasional 4C (screenshot dengan **data fixture**):
[dashboard desktop](phase-4c/previews/admin-desktop.png),
[trip desktop](phase-4c/previews/trips-desktop.png),
[trip mobile](phase-4c/previews/trips-mobile.png),
[login desktop](phase-4c/previews/login-desktop.png),
dan [login mobile](phase-4c/previews/login-mobile.png).

Arah awal: [admin 4A](phase-4a/previews/admin-desktop.png),
[Home desktop](previews/desktop.png), dan [Home mobile](previews/mobile.png).
Screenshot membantu membandingkan komposisi, sedangkan kode dan spesifikasi di
atas menentukan detail implementasi. Jangan memakai screenshot sebagai bukti bahwa
data contoh sudah tersedia pada database.

| Versi | Tanggal           | Perubahan                                                                                                                                     |
| ----- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0   | 12 September 2026 | Acuan tersendiri dibuat atas permintaan pengguna; mencatat baseline Home, admin 4C dari desain 4A, dan pola penggunaan untuk fase berikutnya. |
