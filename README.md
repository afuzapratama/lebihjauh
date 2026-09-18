# LebihJauh

Preview landing page open trip pendakian, dibangun dengan Astro, TypeScript,
dan CSS custom berdasarkan moodboard LebihJauh.

## Jalankan lokal

Gunakan Node.js 22.12+. Project diuji dengan Node.js 24.11.1.

```sh
npm ci
npm run dev
```

Buka **http://localhost:4321**. Server juga bisa diakses dari perangkat lain
di jaringan yang sama menggunakan alamat IP komputer dan port 4321.

```sh
npm run check         # Pemeriksaan tipe dan komponen Astro
npm run build         # Build server Node ke dist/
npm run preview       # Preview hasil build
```

Untuk pengujian browser setelah build:

```sh
npx playwright install chromium
npm run test:e2e
```

Pengujian memakai hasil build di port 4322. Cakupan desktop dan mobile:
navigasi, overflow, filter trip, modal dan pemulihan fokus, galeri, artikel,
validasi formulir, pengunduhan draft, FAQ, serta aksesibilitas dengan axe.

## Isi preview

- Hero, kartu trip beserta harga, cerita brand, Private Trip, galeri, News, FAQ,
  dan footer responsif.
- Filter Semua Trip / Pendakian / Camping.
- Detail trip dan artikel dibuka dalam dialog pada halaman yang sama.
- Galeri dapat diperbesar; dialog mendukung Escape dan keyboard.
- Formulir Private Trip menyusun draft yang dapat diedit dan diunduh sebagai teks.
  Tidak ada data formulir yang dikirim atau disimpan di server.
- Foto Unsplash disimpan lokal dan dioptimasi ke WebP oleh Astro. Font juga lokal,
  sehingga halaman tidak bergantung pada layanan font atau foto eksternal saat dibuka.

Tanggal, harga, rute, dan artikel adalah **contoh**, bukan penawaran resmi. Foto
trip adalah ilustrasi, bukan bukti lokasi atau dokumentasi peserta. Wordmark
sementara memakai tipografi; ganti dengan aset logo final saat tersedia.

Halaman terpisah `/trip`, detail trip, `/private-trip`, `/galeri`, dan `/news`
merupakan fase lanjutan setelah review Home. Navigasi preview menuju bagian Home.
Pemesanan, pembayaran, WhatsApp bisnis, CMS, dan pengiriman formulir belum terintegrasi.

Scope berikutnya telah diperluas menjadi booking tersimpan, admin jadwal, invoice,
dan pencatatan down payment/pelunasan. Lihat [roadmap booking dan admin](docs/website-roadmap.md).
Fase 4A memiliki [rancangan dan simulasi booking](docs/phase-4a/README.md) untuk
review aturan bisnis. Fondasi 4B (server Node, PostgreSQL/Drizzle, autentikasi admin)
dan admin trip/jadwal 4C sudah ada di kode. Ikuti [panduan 4C](docs/phase-4c/README.md)
untuk migrasi dan uji; halaman publik tetap preview sampai fase 4D.

## Tempat mengubah konten

| File                            | Isi                                       |
| ------------------------------- | ----------------------------------------- |
| `src/data/content.ts`           | Trip, harga, artikel, galeri, FAQ         |
| `src/pages/index.astro`         | Susunan Home dan dialog                   |
| `src/components/Wordmark.astro` | Wordmark sementara                        |
| `src/components/Icon.astro`     | Ikon SVG                                  |
| `src/styles/global.css`         | Token brand, layout, komponen, breakpoint |
| `src/scripts/main.ts`           | Navigasi, filter, modal, draft request    |
| `src/layouts/Layout.astro`      | Font, judul halaman, metadata             |
| `src/assets/`                   | Foto sumber untuk optimasi Astro          |
| `src/pages/admin/trips.astro`   | Admin paket dan keberangkatan (fase 4C)   |
| `src/db/schema.ts`              | Schema auth, trip, jadwal, dan audit      |

## Menjalankan admin dan database (fase 4B–4C)

Fitur admin memerlukan server Node dan PostgreSQL; jangan deploy hasil `dist/` sebagai
website statis bila ingin login atau menyimpan data.

```sh
cp .env.example .env
# isi DATABASE_URL dan BETTER_AUTH_SECRET pada .env
npm run db:migrate
ADMIN_EMAIL=admin@contoh.com ADMIN_PASSWORD='password-minimal-8' npm run bootstrap-admin
npm run dev
```

Login ada di `/admin/login`; akun berikutnya dikelola lewat `/admin/accounts`,
sedangkan ganti password akun sendiri tersedia di `/admin/profile`.
Pengelolaan trip dan jadwal ada di `/admin/trips`.
Panduan batas data dan langkah uji ada di [fase 4C](docs/phase-4c/README.md).

## Deploy preview statis ke VPS / aaPanel

Petunjuk ini hanya berlaku untuk Home preview tanpa admin/database. Sistem
booking/admin memerlukan server Node, database, penyimpanan persisten, serta
konfigurasi operasi tambahan; panduan deployment-nya disusun pada fase rilis sistem.

1. Jalankan `npm ci` dan `npm run build`.
2. Buat website statis di aaPanel atau server block Nginx.
3. Salin **isi** folder `dist/` ke document root website tersebut.
4. Aktifkan HTTPS dari konfigurasi hosting.

Contoh lokasi Nginx:

```nginx
location / {
    try_files $uri $uri/ =404;
}

location /_astro/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

Node hanya diperlukan untuk build pada fase ini; server produksi menyajikan file
statis. Perubahan konten perlu build dan upload ulang. `astro preview` untuk
memeriksa build lokal, bukan server produksi.

Halaman publik utama mengizinkan indeks mesin pencari dan menyertakan canonical,
Open Graph, serta Twitter Card. Halaman transaksi/privat seperti checkout,
invoice, rundown, dan data peserta tetap `noindex`. Sebelum peluncuran, isi
`PUBLIC_SITE_URL` dengan domain produksi agar canonical dan metadata sosial tidak
mengarah ke origin development. Deployment ke server belum dilakukan.

## Referensi project

- [Acuan UI/UX: warna, tipografi, layout, tombol, form, dan interaksi](docs/ui-ux-guidelines.md) — baca sebelum mengubah tampilan atau membuat halaman baru.
- [Rencana dan fase](docs/landing-page-plan.md)
- [Roadmap booking dan admin: fase, keputusan terbuka, dan titik review](docs/website-roadmap.md)
- [Fase 4A: rancangan data, arsitektur, aturan, dan simulasi booking](docs/phase-4a/README.md)
- [Fase 4C: admin trip, jadwal, migrasi, dan batas implementasi](docs/phase-4c/README.md)
- [Cloudflare R2: setup upload foto trip](docs/phase-4c/cloudflare-r2-media.md)
- [Sumber foto](docs/asset-sources.md)
- [Preview desktop](docs/previews/desktop.png)
- [Preview mobile](docs/previews/mobile.png)
