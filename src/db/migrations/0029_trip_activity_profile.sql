ALTER TABLE "trip_versions" ADD COLUMN "difficulty_level" text;
ALTER TABLE "trip_versions" ADD COLUMN "elevation_meters" integer;
ALTER TABLE "trip_versions" ADD COLUMN "trail_distance_km" numeric(6, 2);
ALTER TABLE "trip_versions" ADD COLUMN "elevation_gain_meters" integer;
ALTER TABLE "trip_versions" ADD COLUMN "trek_duration_min_minutes" integer;
ALTER TABLE "trip_versions" ADD COLUMN "trek_duration_max_minutes" integer;
ALTER TABLE "trip_versions" ADD COLUMN "route_name" text;
ALTER TABLE "trip_versions" ADD COLUMN "terrain_summary" text;

ALTER TABLE "trip_versions" ADD CONSTRAINT "trip_versions_difficulty_check"
  CHECK ("difficulty_level" IS NULL OR "difficulty_level" IN ('beginner', 'intermediate', 'advanced', 'expert'));
ALTER TABLE "trip_versions" ADD CONSTRAINT "trip_versions_elevation_check"
  CHECK ("elevation_meters" IS NULL OR "elevation_meters" BETWEEN 1 AND 10000);
ALTER TABLE "trip_versions" ADD CONSTRAINT "trip_versions_trail_distance_check"
  CHECK ("trail_distance_km" IS NULL OR ("trail_distance_km" > 0 AND "trail_distance_km" <= 1000));
ALTER TABLE "trip_versions" ADD CONSTRAINT "trip_versions_elevation_gain_check"
  CHECK ("elevation_gain_meters" IS NULL OR "elevation_gain_meters" BETWEEN 0 AND 20000);
ALTER TABLE "trip_versions" ADD CONSTRAINT "trip_versions_trek_duration_check"
  CHECK (
    ("trek_duration_min_minutes" IS NULL OR "trek_duration_min_minutes" BETWEEN 1 AND 10080)
    AND ("trek_duration_max_minutes" IS NULL OR "trek_duration_max_minutes" BETWEEN 1 AND 10080)
    AND (
      "trek_duration_min_minutes" IS NULL
      OR "trek_duration_max_minutes" IS NULL
      OR "trek_duration_max_minutes" >= "trek_duration_min_minutes"
    )
  );
