ALTER TABLE "trip_versions"
  ADD COLUMN "itinerary_stages" jsonb DEFAULT '[]'::jsonb NOT NULL;
