-- Phase 4J tahap 2 — kontrak itinerary, rundown pickup, dan snapshot booking.
--
-- Nama kolom dibuat eksplisit agar rundown pickup tidak lagi dianggap sebagai
-- itinerary utama. Nilai dipertahankan; 0023 sudah mengosongkan salinan yang
-- identik dengan itinerary paket.
ALTER TABLE "departure_pickup_options"
  RENAME COLUMN "itinerary_stages" TO "pickup_rundown_stages";

-- Bekukan informasi perjalanan booking lama pada snapshot. Fallback ke versi
-- trip hanya dipakai sekali selama backfill ini; setelahnya invoice/rundown
-- membaca snapshot dan tidak ikut berubah saat paket mendapat versi baru.
UPDATE "bookings" b
SET "package_snapshot" =
  COALESCE(b.package_snapshot, '{}'::jsonb)
  || jsonb_build_object(
    'snapshotVersion', 2,
    'itineraryStages', COALESCE(d.itinerary_override, tv.itinerary_stages),
    'itinerarySource', CASE
      WHEN d.itinerary_override IS NULL THEN 'trip_version'
      ELSE 'departure_override'
    END,
    'legacyItinerary', tv.itinerary,
    'preparation', tv.preparation,
    'terms', tv.terms
  )
  || jsonb_build_object(
    'pickup',
    (COALESCE(b.package_snapshot->'pickup', '{}'::jsonb) - 'itineraryStages')
    || jsonb_build_object(
      'pickupRundownStages',
      CASE
        WHEN b.package_snapshot->'pickup'->'itineraryStages' IS NULL THEN
          (
            SELECT dpo.pickup_rundown_stages
            FROM departure_pickup_options dpo
            WHERE dpo.id = b.pickup_option_id
          )
        WHEN b.package_snapshot->'pickup'->'itineraryStages'
          = COALESCE(d.itinerary_override, tv.itinerary_stages) THEN NULL
        ELSE b.package_snapshot->'pickup'->'itineraryStages'
      END
    )
  )
FROM "departures" d, "trip_versions" tv
WHERE d.id = b.departure_id
  AND tv.id = b.trip_version_id
  AND (
    COALESCE((b.package_snapshot->>'snapshotVersion')::integer, 0) < 2
    OR NOT (b.package_snapshot ? 'itineraryStages')
  );
