ALTER TABLE "bookings" ADD COLUMN "booking_source" text DEFAULT 'open_trip' NOT NULL;
--> statement-breakpoint
UPDATE "bookings"
SET "booking_source" = 'private_trip'
WHERE "policy_snapshot" ->> 'source' = 'private_trip_offer';
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_source_check" CHECK ("bookings"."booking_source" in ('open_trip', 'private_trip'));
