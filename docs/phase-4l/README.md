# Phase 4L — Pengaturan Tampilan Home & About

Status: **selesai diimplementasikan — 17 September 2026.**

Phase ini memindahkan foto utama dan kalimat pemasaran Home/About dari source
code ke editor admin terstruktur. Konten lama tetap menjadi fallback sampai
admin menerbitkan versi pertama, sehingga migrasi database tidak membuat halaman
publik kosong.

## Alur admin

1. Buka **Tampilan Website → Home** atau **About**.
2. Ubah teks atau pilih foto JPEG/PNG/WebP maksimum 8 MB.
3. Isi alt text; caption/lokasi, kredit, dan URL sumber bersifat opsional.
4. Atur fokus foto agar subjek tidak terpotong pada crop responsif.
5. Simpan draf lalu buka **Preview draf**. Preview hanya dapat dibuka oleh sesi
   admin aktif.
6. Pilih **Terbitkan halaman** untuk mengganti seluruh versi publik secara atomik.

Home juga dapat mendahulukan hingga tiga Open Trip, empat foto Galeri, dan tiga
artikel News. Jika pilihan unggulan kosong atau kontennya tidak lagi publik,
daftar otomatis dilengkapi dari konten terbaru yang masih tersedia.

## Penyimpanan dan keamanan

- `site_pages` menyimpan `draft_content` dan `published_content` terpisah untuk
  key `home` dan `about`.
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
