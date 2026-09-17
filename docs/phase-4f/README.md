# Fase 4F — Pembayaran, verifikasi, dan pelunasan

Status: **pembayaran manual multi-metode dengan verifikasi admin tersedia.**

## Laporan pendapatan

Admin dapat membuka `/admin/payments/revenue` dari halaman **Pembayaran**. Halaman
ini memakai basis kas operasional: hanya pembayaran berstatus **Terverifikasi** yang
dihitung sebagai dana masuk. Total invoice/order, bukti yang masih menunggu, serta
piutang tidak dicampur sebagai pendapatan.

- Periode memakai **tanggal dana masuk** pada mutasi, bukan tanggal admin
  memverifikasi. Saat mencatat transfer langsung, admin mengisi tanggal tersebut;
  catatan lama dan konfirmasi dari PIC memakai waktu pencatatan sebagai nilai awal.
- Ringkasan memperlihatkan dana masuk, nilai invoice baru, piutang booking aktif,
  dan antrean yang belum diverifikasi secara terpisah.
- Detail transaksi aman untuk laporan internal: invoice, PIC, trip, pax, metode,
  referensi, nominal, serta status order. NIK dan bukti pembayaran tidak ditampilkan.
- Rincian per hari, metode pembayaran, trip, dan 12 bulan terakhir membantu
  pemantauan tanpa mengklaimnya sebagai laba. Biaya operasional, refund, dan
  pengeluaran belum berada dalam sistem.

Migrasi `0013_payment_received_at.sql` diperlukan agar tanggal dana masuk tersimpan.

## Alur

1. PIC membuka halaman publik [`/pembayaran`](/pembayaran), memilih bank,
   e-wallet, atau QRIS, lalu membayar sesuai invoice.
2. PIC mengirim **bukti pembayaran dan nomor invoice** ke WhatsApp LebihJauh.
   Bukti tidak dikirim melalui formulir publik agar proses yang dipakai tim dan
   pelanggan tetap satu: WhatsApp.
3. Admin mencocokkan bukti dengan mutasi, lalu membuka order dan memilih
   **Catat & verifikasi pembayaran**. Admin memilih metode, memasukkan nominal
   yang benar-benar masuk, serta (opsional) referensi mutasi dan gambar bukti.
4. Setelah nilai terverifikasi memenuhi down payment minimum, booking berubah
   menjadi **Terkonfirmasi** dan alokasi kursi berubah dari hold ke committed.
5. Setelah total terpenuhi, status pembayaran menjadi **Lunas**. Pembayaran yang
   ditolak tetap tersimpan sebagai riwayat dan tidak memengaruhi total.

## Mengatur metode pembayaran

Masuk sebagai admin lalu buka `/admin/payments/methods`. Setiap metode disimpan
di database dan dapat berupa transfer bank, e-wallet, atau QRIS. Metode aktif
langsung tampil pada halaman publik `/pembayaran`.

- Bank/e-wallet: isi nama metode, nomor rekening/akun, dan atas nama.
- QRIS: unggah gambar QR ke media publik terlebih dahulu, lalu masukkan URL-nya.
- Arsipkan metode yang tidak lagi dipakai; riwayat transaksi terdahulu tetap
  menyimpan snapshot metode saat pembayaran dicatat.

## Bukti pembayaran opsional

Di dialog **Catat & verifikasi pembayaran**, admin dapat mengunggah JPEG, PNG,
atau WebP maksimal 8 MB. Bukti bersifat opsional karena sumber utama tetap
pencocokan mutasi. Bila diunggah, tautan **Lihat bukti pembayaran** tampil di
detail order dan kolom **Bukti** pada riwayat pembayaran admin.

Jangan gunakan bucket media trip yang publik untuk bukti transfer. Buat bucket R2
terpisah tanpa custom domain publik, lalu tambahkan ke konfigurasi server:

```env
R2_PAYMENT_PROOF_BUCKET_NAME=lebihjauh-payment-proofs-private
```

Server membuat URL unggah dan URL baca sementara; bukti hanya bisa dibuka oleh
admin yang masih login. Bila variabel ini belum diisi, pencatatan tanpa bukti
tetap dapat digunakan.

Tambahkan CORS pada bucket privat agar browser admin dapat melakukan `PUT` ke URL
bertanda tangan (ganti origin produksi bila sudah ada):

```json
[
  {
    "AllowedOrigins": ["http://localhost:4321", "http://172.21.0.1:4321"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 300
  }
]
```

Token S3 yang digunakan server harus memiliki Object Read dan Object Write untuk
bucket privat tersebut. Jangan memasang custom domain publik ke bucket bukti.

## Batas saat ini

- Bukti pembayaran diterima lewat WhatsApp dan diverifikasi manusia; sistem ini
  bukan payment gateway otomatis.
- Refund dan koreksi kelebihan bayar belum termasuk.

## Verifikasi manual

1. Tambahkan sedikitnya satu metode di `/admin/payments/methods`.
2. Buka `/pembayaran` dan pastikan metode aktif serta WhatsApp tampil benar.
3. Dari detail booking di `/admin/orders/{id}`, klik **Catat & verifikasi
   pembayaran** setelah bukti dan mutasi cocok.
4. Masukkan nominal minimal down payment. Pastikan booking berubah menjadi
   **Terkonfirmasi** dan kursi menjadi committed.
5. Catat pembayaran berikutnya sampai total invoice terpenuhi; ringkasan invoice
   otomatis menjadi **Lunas**.
