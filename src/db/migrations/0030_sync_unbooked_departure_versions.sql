-- Sebelum fitur propagasi otomatis tersedia, perubahan Data Paket membuat
-- jadwal tanpa booking tetap tertinggal pada versi lama. Sinkronkan satu kali;
-- jadwal yang sudah memiliki booking sengaja dipertahankan pada snapshot lama.
WITH latest_versions AS (
  SELECT DISTINCT ON ("trip_id") "id", "trip_id"
  FROM "trip_versions"
  ORDER BY "trip_id", "version" DESC
), eligible_departures AS (
  SELECT "departures"."id", "latest_versions"."id" AS "latest_version_id"
  FROM "departures"
  INNER JOIN "trip_versions" AS "current_version"
    ON "current_version"."id" = "departures"."trip_version_id"
  INNER JOIN "latest_versions"
    ON "latest_versions"."trip_id" = "current_version"."trip_id"
  WHERE "departures"."trip_version_id" <> "latest_versions"."id"
    AND NOT EXISTS (
      SELECT 1
      FROM "bookings"
      WHERE "bookings"."departure_id" = "departures"."id"
    )
)
UPDATE "departures"
SET
  "trip_version_id" = "eligible_departures"."latest_version_id",
  "updated_at" = now()
FROM "eligible_departures"
WHERE "departures"."id" = "eligible_departures"."id";
