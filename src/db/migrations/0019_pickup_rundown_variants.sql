ALTER TABLE "departure_pickup_options" ADD COLUMN "itinerary_stages" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
INSERT INTO "trip_pickup_points" ("trip_id", "zone_name", "location_name", "address", "maps_url", "instructions", "sort_order")
SELECT DISTINCT ON (tv."trip_id", dpo."zone_name", dpo."location_name")
 tv."trip_id", dpo."zone_name", dpo."location_name", dpo."address", dpo."maps_url", dpo."instructions", dpo."sort_order"
FROM "departure_pickup_options" dpo
JOIN "departures" d ON d."id" = dpo."departure_id"
JOIN "trip_versions" tv ON tv."id" = d."trip_version_id"
WHERE dpo."master_pickup_point_id" IS NULL
ORDER BY tv."trip_id", dpo."zone_name", dpo."location_name", dpo."created_at";
--> statement-breakpoint
UPDATE "departure_pickup_options" dpo
SET "master_pickup_point_id" = tpp."id"
FROM "departures" d, "trip_versions" tv, "trip_pickup_points" tpp
WHERE d."id" = dpo."departure_id"
  AND tv."id" = d."trip_version_id"
  AND tpp."trip_id" = tv."trip_id"
  AND tpp."zone_name" = dpo."zone_name"
  AND tpp."location_name" = dpo."location_name"
  AND dpo."master_pickup_point_id" IS NULL;
--> statement-breakpoint
UPDATE "departure_pickup_options" dpo
SET "itinerary_stages" = tv."itinerary_stages"
FROM "departures" d, "trip_versions" tv
WHERE d."id" = dpo."departure_id"
  AND tv."id" = d."trip_version_id"
  AND dpo."itinerary_stages" = '[]'::jsonb;
