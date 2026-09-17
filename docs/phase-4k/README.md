# Phase 4K — Cek Booking & Invoice Open Trip

Status: **selesai diimplementasikan — 17 September 2026.**

## Keputusan pengalaman

`/cek-booking` tidak langsung mengarahkan pengunjung berdasarkan nomor invoice.
Peserta lebih dulu melihat ringkasan booking setelah memasukkan dua data yang
harus cocok:

1. nomor booking `LJ-OT-...`; dan
2. WhatsApp PIC yang dipakai saat booking.

Hasil berisi status booking, trip, keberangkatan, meeting point, jumlah peserta,
status pembayaran, total, dan sisa tagihan. Dari ringkasan tersebut peserta
dapat membuka invoice biasa tanpa URL privat atau fragment hash. Pola ini
memberi konteks kepada peserta dan mencegah salah invoice sebelum pindah
halaman.

Tombol **Cek booking** tersedia tepat di sebelah tombol **Gas, pilih trip!** pada
navigasi publik desktop. Pada mobile, tautan tetap tersedia di menu utama.

## Aturan akses invoice dan pembayaran

- Invoice Open Trip dapat dibaca langsung melalui `/invoice/:number`; URL tidak
  membutuhkan token atau fragment hash.
- Cek Booking tetap mencocokkan nomor booking dan WhatsApp PIC karena halaman
  ini menyajikan ringkasan pencarian peserta.
- Setelah pencocokan berhasil, server memasang cookie HttpOnly dan grant akses
  secara transparan. Peserta tidak melihat atau perlu mengelola token akses.
- Grant hanya dipakai untuk aksi sensitif seperti meminta URL unggah dan
  mengirim bukti pembayaran. Membaca invoice tidak memerlukannya.
- Mekanisme tautan hash lama dari admin tetap kompatibel untuk link yang sudah
  pernah dikirim, tetapi bukan lagi syarat membuka invoice.

## Privasi dan anti-abuse

- WhatsApp menerima variasi `08`, `8`, dan `+62`, kemudian dibandingkan dalam
  bentuk kanonis memakai perbandingan digest constant-time.
- Query database tidak memakai pencarian suffix nomor telepon.
- Respons tidak mengembalikan WhatsApp. Nama PIC dimasking sebelum dikirim ke
  browser.
- Endpoint memakai pemeriksaan same-origin, `Cache-Control: no-store`, dan
  `Referrer-Policy: no-referrer`.
- Pembatas per proses: maksimal 30 percobaan per IP dan 8 percobaan untuk satu
  pasangan IP/nomor booking per 10 menit. Jika aplikasi nanti dijalankan pada
  banyak instance, limiter perlu dipindahkan ke penyimpanan bersama.
- Pesan kegagalan tidak membedakan nomor booking yang tidak ada dengan WhatsApp
  yang tidak cocok.

## Kontrak endpoint

`POST /api/booking-lookup`

```json
{
  "number": "LJ-OT-000123",
  "whatsapp": "081234567890"
}
```

Respons sukses mengembalikan ringkasan dan `invoicePath` biasa. Grant untuk aksi
pembayaran dikirim sebagai cookie HttpOnly; token mentah tidak masuk ke URL.

## Verifikasi

- `npm run test:phase-4k` memeriksa normalisasi WhatsApp, validasi input, sifat
  acak token internal, dan kesesuaian hash grant pembayaran.
- Playwright memeriksa posisi dua CTA navigasi, submit cek booking, tampilan
  ringkasan, dan hand-off ke URL invoice biasa.
- `npm run check` dan `npm run build` menjadi pemeriksaan tipe serta integrasi
  seluruh route Astro.
