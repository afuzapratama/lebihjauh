# Fase 4D — Katalog dan detail trip publik

Status: **implementasi tersedia; uji penerimaan dengan data admin diperlukan.**

## Yang tersedia

- `/trip` hanya membaca trip yang tidak diarsipkan dan memiliki keberangkatan
  `open` di masa mendatang.
- Filter jenis trip, reset filter, jumlah hasil, dan kondisi kosong.
- `/trip/[slug]` menampilkan deskripsi paket, fasilitas, itinerary, meeting point,
  persiapan, ketentuan, serta jadwal/harga/down payment dari data yang sama.
- Draft, jadwal `closed`, jadwal lampau, dan trip tanpa jadwal terbuka tidak diekspos.
- URL trip yang tidak tersedia memberikan halaman 404 yang jelas.
- CTA Home menuju katalog publik. Tombol booking pada detail menuju alur 4E untuk
  jadwal yang masih tersedia.

## Batas 4D

- Order, alokasi kuota, data PIC, invoice, dan WhatsApp merupakan domain 4E.
- Ketersediaan real-time dari hold/alokasi kursi diterapkan di 4E.
- Bila admin mengubah jadwal ketika pengunjung membuka detail, pengunjung perlu
  memuat ulang halaman. Refresh otomatis dan booking-safe revalidation menjadi
  bagian integrasi 4E.

## Verifikasi

Jalankan `npm run check` dan `npm run build`. Uji penerimaan: buat satu trip melalui
admin, beri jadwal masa depan berstatus **Buka**, lalu buka `/trip` dan detailnya.
Ubah jadwal menjadi Draft/Tutup lalu muat ulang katalog; item harus hilang.
