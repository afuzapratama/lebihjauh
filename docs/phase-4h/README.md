# Phase 4H — Konten, Galeri, dan News

Fondasi konten memakai status **draf** dan **terbit**. Hanya konten terbit yang
tampil di `/galeri`, `/news`, dan `/news/[slug]`.

## Alur admin

1. Buka `/admin/content`.
2. Untuk Galeri, unggah foto JPEG/PNG/WebP (maksimum 8 MB), isi caption dan alt
   text, lalu pilih draf atau terbit.
3. Untuk News, cover bersifat opsional; judul otomatis menjadi slug URL, kemudian
   isi kategori, teaser, dan isi artikel.
4. URL sosial opsional hanya menerima URL HTTPS dari Instagram atau TikTok. Sistem
   menyimpan tautan, tidak pernah menerima HTML atau script embed dari form.

Foto konten disimpan di prefix R2 publik `content/gallery` atau `content/news`.
Home masih mempertahankan contoh visual statis sampai konten nyata pertama siap
diterbitkan; langkah berikutnya adalah mengganti teaser Home agar membaca data
terbit yang sama.
