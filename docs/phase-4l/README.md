# Phase 4L — Pengaturan Tampilan Website

Status: **selesai diimplementasikan — 17 September 2026.**

Phase ini memindahkan foto utama dan kalimat pemasaran Home/About dari source
code ke editor admin terstruktur. Pengaturan global **Sosial & Footer** juga
menyimpan kanal promosi yang tampil di seluruh halaman. Konten lama tetap
menjadi fallback sampai admin menerbitkan versi pertama, sehingga migrasi
database tidak membuat halaman publik kosong.

## Alur admin

1. Buka **Tampilan Website → Home** atau **About**.
2. Ubah teks atau pilih foto JPEG/PNG/WebP maksimum 8 MB.
3. Isi alt text; caption/lokasi, kredit, dan URL sumber bersifat opsional.
4. Atur fokus foto agar subjek tidak terpotong pada crop responsif.
5. Simpan draf lalu buka **Preview draf**. Preview hanya dapat dibuka oleh sesi
   admin aktif.
6. Pilih **Terbitkan halaman** untuk mengganti seluruh versi publik secara atomik.

Untuk media sosial, buka **Tampilan Website → Sosial & Footer**. Isi nomor
WhatsApp utama sekali untuk floating chat, footer, invoice, rundown, dan tindak
lanjut Private Trip. Nomor menerima format 08, +62, atau 62 lalu disimpan dalam
format 62. URL profil sosial lain bersifat opsional; platform kosong tidak
dirender. Footer menampilkan ikon tanpa nama visual, tetapi setiap tautan tetap
memiliki nama aksesibel dan tooltip.

Home juga dapat mendahulukan hingga tiga Open Trip, empat foto Galeri, dan tiga
artikel News. Jika pilihan unggulan kosong atau kontennya tidak lagi publik,
daftar otomatis dilengkapi dari konten terbaru yang masih tersedia.

## Penyimpanan dan keamanan

- `site_pages` menyimpan `draft_content` dan `published_content` terpisah untuk
  key `home`, `about`, dan `global`.
- Semua payload diperiksa server berdasarkan bentuk konten resmi. URL media dan
  sumber hanya menerima HTTPS; URL aset fallback lokal tetap didukung.
- Upload memakai presigned URL R2 pada prefix `content/home` dan `content/about`.
- Simpan draf dan publikasi masuk ke `admin_audit_logs`.
- Halaman biasa hanya membaca versi publik. Query `?preview=draft` mengharuskan
  autentikasi admin melalui middleware.

## Batas desain yang disengaja

URL navigasi internal, ikon, nomor section, dekorasi, harga, jadwal, dan kuota
tidak dapat diedit dari modul ini. Data operasional tetap berasal dari modul
Trip; Galeri dan News tetap dikelola melalui **Konten & Galeri**.

## Operasional

Jalankan migrasi sebelum membuka editor:

```bash
npm run db:migrate
```

Verifikasi kode dengan `npm run test:phase-4l`, `npm run check`, dan
`npm run build`.
