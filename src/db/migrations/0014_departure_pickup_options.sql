CREATE TABLE "departure_pickup_options" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "departure_id" uuid NOT NULL,
 "zone_name" text NOT NULL,
 "location_name" text NOT NULL,
 "address" text DEFAULT '' NOT NULL,
 "pickup_at" timestamp with time zone NOT NULL,
 "price_per_pax" numeric(14, 0) NOT NULL,
 "maps_url" text,
 "instructions" text DEFAULT '' NOT NULL,
 "capacity" integer,
 "is_default" boolean DEFAULT false NOT NULL,
 "is_active" boolean DEFAULT true NOT NULL,
 "sort_order" integer DEFAULT 0 NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "departure_pickup_options_price_check" CHECK ("departure_pickup_options"."price_per_pax" > 0),
 CONSTRAINT "departure_pickup_options_capacity_check" CHECK ("departure_pickup_options"."capacity" is null or "departure_pickup_options"."capacity" > 0)
);
--> statement-breakpoint
ALTER TABLE "departure_pickup_options" ADD CONSTRAINT "departure_pickup_options_departure_id_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."departures"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "departure_pickup_options_one_default_per_departure" ON "departure_pickup_options" USING btree ("departure_id") WHERE "is_default" = true;
--> statement-breakpoint
ALTER TABLE "checkout_quotes" ADD COLUMN "pickup_option_id" uuid;
--> statement-breakpoint
ALTER TABLE "checkout_quotes" ADD CONSTRAINT "checkout_quotes_pickup_option_id_departure_pickup_options_id_fk" FOREIGN KEY ("pickup_option_id") REFERENCES "public"."departure_pickup_options"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pickup_option_id" uuid;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pickup_option_id_departure_pickup_options_id_fk" FOREIGN KEY ("pickup_option_id") REFERENCES "public"."departure_pickup_options"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "departure_pickup_options" (
 "departure_id", "zone_name", "location_name", "address", "pickup_at", "price_per_pax", "is_default", "is_active", "sort_order"
)
SELECT
 d."id",
 COALESCE(NULLIF(BTRIM(tv."meeting_point"), ''), 'Meeting point utama'),
 COALESCE(NULLIF(SPLIT_PART(BTRIM(tv."meeting_point"), E'\n', 1), ''), 'Meeting point utama'),
 COALESCE(NULLIF(BTRIM(tv."meeting_point"), ''), ''),
 d."start_at",
 d."unit_price",
 true,
 true,
 0
FROM "departures" d
INNER JOIN "trip_versions" tv ON tv."id" = d."trip_version_id";
