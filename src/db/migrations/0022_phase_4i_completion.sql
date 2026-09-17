ALTER TABLE "private_trip_offers" ADD COLUMN "pickup_details" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "private_trip_offers" ADD COLUMN "itinerary_stages" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "private_trip_offers" ADD COLUMN "preparation" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "participant_data_grants" ADD COLUMN "draft_ciphertext" text;
--> statement-breakpoint
ALTER TABLE "participant_data_grants" ADD COLUMN "draft_saved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reported_transfer_at" timestamp with time zone;
