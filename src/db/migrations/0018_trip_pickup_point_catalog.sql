CREATE TABLE "trip_pickup_points" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "trip_id" uuid NOT NULL,
 "zone_name" text NOT NULL,
 "location_name" text NOT NULL,
 "address" text DEFAULT '' NOT NULL,
 "maps_url" text,
 "instructions" text DEFAULT '' NOT NULL,
 "is_active" boolean DEFAULT true NOT NULL,
 "sort_order" integer DEFAULT 0 NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_pickup_points" ADD CONSTRAINT "trip_pickup_points_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "departure_pickup_options" ADD COLUMN "master_pickup_point_id" uuid;
--> statement-breakpoint
ALTER TABLE "departure_pickup_options" ADD CONSTRAINT "departure_pickup_options_master_pickup_point_id_trip_pickup_points_id_fk" FOREIGN KEY ("master_pickup_point_id") REFERENCES "public"."trip_pickup_points"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "departure_pickup_options" ALTER COLUMN "pickup_at" DROP NOT NULL;
