-- Phase 4J — Konsolidasi itinerary Open Trip
--
-- Perubahan:
-- 1. Tambah kolom `itinerary_override` di `departures`:
--    NULL = pakai itinerary paket; non-NULL = override khusus jadwal ini.
-- 2. Kolom `itinerary_stages` di `departure_pickup_options` dibuat nullable:
--    NULL = tidak ada rundown pickup tambahan (tidak menyalin itinerary paket).
-- 3. Backfill: baris pickup yang itinerary_stages-nya == itinerary paket
--    (artinya salinan otomatis dari kode lama) di-reset ke NULL.
--    Deteksi: jika panjang JSON sama persis dengan itinerary_stages dari
--    trip_version-nya, anggap salinan. Ini aman secara konservatif karena
--    rundown pickup yang benar-benar berbeda akan dibedakan oleh admin.

-- 1. Tambah kolom override itinerary pada jadwal
ALTER TABLE "departures"
  ADD COLUMN IF NOT EXISTS "itinerary_override" jsonb;

-- 2. Ubah default itinerary_stages pickup menjadi NULL (hapus default '[]')
ALTER TABLE "departure_pickup_options"
  ALTER COLUMN "itinerary_stages" DROP DEFAULT,
  ALTER COLUMN "itinerary_stages" DROP NOT NULL;

-- 3. Backfill: set NULL pada pickup yang itinerary_stages-nya identik dengan
--    itinerary paket (salinan otomatis dari kode sebelum 4J).
--    Pemeriksaan: bandingkan sebagai text untuk menghindari perbandingan JSONB
--    yang peka terhadap urutan key.
UPDATE "departure_pickup_options" dpo
SET "itinerary_stages" = NULL
FROM "departures" d
JOIN "trip_versions" tv ON d.trip_version_id = tv.id
WHERE dpo.departure_id = d.id
  AND dpo.itinerary_stages IS NOT NULL
  AND dpo.itinerary_stages::text = tv.itinerary_stages::text;

-- 4. Set baris lama yang masih '[]' (array kosong — tidak ada rundown) ke NULL
--    agar tidak membingungkan: NULL dan [] keduanya berarti "tidak ada rundown".
UPDATE "departure_pickup_options"
SET "itinerary_stages" = NULL
WHERE "itinerary_stages"::text = '[]';
