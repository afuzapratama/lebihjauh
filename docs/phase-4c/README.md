# Fase 4C — Admin trip dan keberangkatan

Status: **implementasi selesai di kode, menunggu migrasi database dan uji penerimaan
admin.** Katalog serta detail publik yang membaca jadwal berstatus Buka tersedia pada
[fase 4D](../phase-4d/README.md).

## Penerapan UI/UX 4A — 12 September 2026

Patokan lintas fase untuk warna, tipografi, bentuk, layout, tombol, form, dan
interaksi dicatat terpisah di [acuan UI/UX](../ui-ux-guidelines.md). Gunakan
dokumen tersebut saat melanjutkan atau mengubah tampilan; bagian ini mencatat
implementasi dan verifikasi khusus 4C.

Atas arahan pengguna, bahasa visual prototipe 4A kini diterapkan ke admin 4C:
sidebar hijau gelap, aksen oranye, latar krem, tipografi, panel, dan editor deskripsi
berbagian. `/admin`, `/admin/trips`, serta `/admin/login` memakai layout bersama
`src/layouts/AdminLayout.astro` dan stylesheet `src/styles/admin.css`. Gunakan
keduanya untuk modul admin berikutnya agar tampilan tetap konsisten. Checkout dan
invoice 4A tetap menjadi acuan untuk implementasi pada fase transaksi terkait.

- Dashboard mengarahkan ke pengelolaan trip; modul mendatang diberi label
  “Segera hadir”, tanpa tautan atau statistik operasional palsu.
- Form detail dibagi berurutan menjadi informasi utama, fasilitas paket,
  rencana perjalanan/titik kumpul, serta persiapan/ketentuan peserta dengan
  bagian yang bisa dibuka-tutup.
- Status jadwal ditampilkan sebagai Draft/Buka/Tutup; tombol simpan dinonaktifkan
  selama request berjalan, dan input dipertahankan bila penyimpanan gagal.
- Layout menyesuaikan desktop/mobile; navigasi keyboard, fokus, dan pesan status
  tersedia. Waktu pada input selalu WIB, termasuk bila browser memakai zona lain.

Pratinjau dengan **data fixture, bukan data operasional**:
[trip desktop](previews/trips-desktop.png), [trip mobile](previews/trips-mobile.png),
[dashboard](previews/admin-desktop.png), dan [login](previews/login-desktop.png).

Verifikasi: `npm run check` dan `npm run build` lolos. `npm run test:admin-ui`
memeriksa halaman hasil build menggunakan Astro Container dan API fixture dalam
Chromium desktop/mobile: overflow, aksesibilitas axe WCAG A/AA, error login,
edit/simpan, round-trip WIB di browser zona New York, kondisi kosong/gagal, dan
logout. Seluruh pemeriksaan tersebut lolos. Uji ini tidak menulis database dan
tidak membuktikan login atau persistensi pada database target; uji penerimaan
di bagian berikut tetap diperlukan.

## Login melalui IP LAN

Origin utama tetap `BETTER_AUTH_URL`. Alamat tambahan yang boleh mengakses auth
diatur eksplisit melalui `BETTER_AUTH_TRUSTED_ORIGINS`, dipisah koma, sesuai
[konfigurasi Better Auth](https://better-auth.com/docs/reference/options#trustedorigins).
Contoh akses `http://172.21.0.1:4321`:

```dotenv
BETTER_AUTH_URL=http://localhost:4321
BETTER_AUTH_TRUSTED_ORIGINS=http://172.21.0.1:4321,http://127.0.0.1:4321
```

Sesuaikan IP, protokol, dan port dengan URL browser. Restart `npm run dev` setelah
mengubah `.env`; konfigurasi auth dibuat sekali per proses. Jangan gunakan wildcard
atau menonaktifkan pemeriksaan origin. Probe handler auth dengan cookie dummy
menunjukkan localhost dan origin LAN di atas diterima (200), sedangkan origin luar
ditolak (403); login dengan kredensial nyata belum diuji pada sesi perubahan UI ini.

## Yang tersedia

- `/admin/trips` adalah daftar trip, `/admin/trips/new` membuat trip, dan
  `/admin/trips/[id]` mengelola detail serta keberangkatan satu trip; semuanya
  dilindungi middleware login admin.
- Daftar trip memuat thumbnail, kategori/slug, jumlah jadwal, keberangkatan
  terdekat, harga mulai, kuota, status, waktu pembaruan, pencarian, dan urutan.
- Pembuatan dan pengubahan trip: nama, slug otomatis dari nama, jenis dari
  daftar kategori atau kategori kustom, foto utama upload R2, deskripsi,
  fasilitas termasuk/tidak termasuk, itinerary, meeting point, persiapan, serta
  ketentuan.
- Banyak jadwal per trip: mulai/selesai, WIB, kuota, harga Rupiah per pax, down
  payment persen atau nominal, tenggat booking/pelunasan, dan status `draft`, `open`,
  atau `closed`.
- API admin hanya dapat dipanggil dengan sesi admin. Nilai harga/down payment/tanggal divalidasi
  kembali di server; browser bukan sumber kebenaran.
- Audit `created`, `updated`, `archived`, dan `deleted` mencatat pelaku, waktu,
  entitas, serta ringkasan perubahan. Tidak ada token/kata sandi/bukti pembayaran
  dalam audit ini.
- Upload foto utama R2: pilih JPEG/PNG/WebP maksimal 8 MB, lihat thumbnail, lalu
  upload langsung memakai URL sementara yang diterbitkan server. Setup Cloudflare,
  CORS, lingkungan, dan batasnya ada di [panduan R2](cloudflare-r2-media.md).

## Batas dan aturan yang sudah diterapkan

- Harga memakai `numeric(14,0)`, bukan float. Masukkan Rupiah bulat tanpa titik/koma.
- `end_at` harus sesudah `start_at`; booking cutoff tidak boleh sesudah keberangkatan.
- Kuota harus 1–10.000; harga harus positif; down payment persen 0–100; down payment nominal tidak boleh
  lebih besar dari harga satu pax.
- Down payment tetap **berdasarkan total order** saat booking 4E dibuat. Field 4C hanya
  menyimpan aturannya untuk jadwal.
- Tombol **Arsipkan** menyembunyikan trip dari daftar/katalog tanpa menghapus data
  atau audit secara permanen. Ini aman untuk salah input dan dapat dipulihkan oleh
  operasi database bila diperlukan.
- Tombol **Hapus jadwal** menghapus jadwal permanen dan menulis audit log. Ini hanya
  aman pada 4C ketika belum ada booking, invoice, atau kursi teralokasi; endpoint
  harus menolak penghapusan jadwal berbooking pada 4E.
- Notifikasi admin global memberi umpan balik untuk aksi create/update/delete/error;
  pesan error tetap terlihat sampai ditutup. Arsip trip dan hapus jadwal memakai
  dialog konfirmasi yang menjelaskan dampaknya. Field `canDelete`/`canArchive` dan
  alasannya sudah dikirim API: pada 4E keduanya wajib dihitung dari order terkait
  sehingga tombol menjadi nonaktif/abu-abu sebelum penghapusan bisa dilakukan.
- Belum ada booking pada fase ini, sehingga belum ada kursi teralokasi. Pada 4E,
  perubahan kapasitas wajib mengunci departure dan ditolak bila di bawah kursi
  `held`/`committed`.
- URL foto HTTP(S) tetap dapat dibaca untuk data lama, tetapi tidak lagi dapat
  dimasukkan dari form admin. Foto baru hanya melalui upload R2 setelah konfigurasi
  lingkungan dan CORS pada [panduan R2](cloudflare-r2-media.md) selesai.
- Input jadwal memakai kalender tanggal dan pilihan jam per 30 menit dalam WIB.
  Saat tanggal mulai dipilih, durasi satu hari, cutoff H-1 pukul 20.00, dan
  pelunasan H-3 pukul 20.00 disiapkan otomatis. Tombol durasi, cutoff H-1/H-2/H-3,
  serta pelunasan saat booking/H-1/H-3/H-7 dapat menggantinya; pilihan yang diedit
  manual tidak ditimpa lagi. Nilai tetap divalidasi server sebagai timestamp.

## Menjalankan dan menguji

1. Salin `.env.example` menjadi `.env`, lalu isi koneksi PostgreSQL dan secret auth.
2. Terapkan migrasi berikut sekali pada database target:

   ```sh
   npm run db:migrate
   ```

3. Buat admin awal bila belum ada:

   ```sh
   ADMIN_EMAIL=admin@contoh.com ADMIN_PASSWORD='password-minimal-8' npm run bootstrap-admin
   ```

4. Jalankan aplikasi (`npm run dev`), login melalui `/admin/login`, lalu buka
   `/admin/trips`. Admin tambahan dapat dibuat oleh admin aktif melalui
   `/admin/accounts`.
5. Buat contoh “Labuan Bajo 18–25” dengan jadwal mulai 18 dan selesai 25 pada
   bulan/tahun yang benar, isi harga/kuota/down payment/tenggat, lalu pilih `Buka`. Ubah ke
   `Tutup`, muat ulang halaman, dan pastikan perubahan tetap tersimpan.

## Migrasi yang diperlukan

- `0001_grey_eddie_brock.sql`: tabel `trips`, `trip_versions`, dan `departures`
  beserta foreign key dan constraint operasional.
- `0002_broken_eddie_brock.sql`: tabel `admin_audit_logs` untuk perubahan admin.

Jangan edit SQL yang sudah diterapkan pada environment mana pun. Perubahan schema
berikutnya harus dibuat sebagai migrasi baru dengan `npm run db:generate`.

## Belum termasuk

- Upload/penyimpanan file media, galeri, dan transformasi foto.
- Halaman katalog/detail publik (4D).
- Alokasi kuota, booking, invoice, WhatsApp, expiry, dan pembayaran (4E–4F).
- Pemulihan trip terarsip dari UI, galeri media, serta penghapusan object R2 yang
  tidak digunakan.
