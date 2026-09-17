CREATE TABLE "departures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_version_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"capacity" integer NOT NULL,
	"unit_price" numeric(14, 0) NOT NULL,
	"dp_mode" text NOT NULL,
	"dp_value" numeric(14, 0) NOT NULL,
	"booking_cutoff_at" timestamp with time zone NOT NULL,
	"balance_due_at" timestamp with time zone,
	"publication_state" text DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departures_date_range_check" CHECK ("departures"."start_at" < "departures"."end_at"),
	CONSTRAINT "departures_capacity_check" CHECK ("departures"."capacity" >= 0),
	CONSTRAINT "departures_price_check" CHECK ("departures"."unit_price" > 0),
	CONSTRAINT "departures_dp_mode_check" CHECK ("departures"."dp_mode" in ('percent', 'amount')),
	CONSTRAINT "departures_dp_value_check" CHECK ("departures"."dp_value" >= 0),
	CONSTRAINT "departures_dp_percent_check" CHECK ("departures"."dp_mode" <> 'percent' or "departures"."dp_value" <= 100),
	CONSTRAINT "departures_state_check" CHECK ("departures"."publication_state" in ('draft', 'open', 'closed')),
	CONSTRAINT "departures_cutoff_check" CHECK ("departures"."booking_cutoff_at" <= "departures"."start_at")
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "trip_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"description" text NOT NULL,
	"included" text DEFAULT '' NOT NULL,
	"excluded" text DEFAULT '' NOT NULL,
	"itinerary" text DEFAULT '' NOT NULL,
	"preparation" text DEFAULT '' NOT NULL,
	"meeting_point" text DEFAULT '' NOT NULL,
	"terms" text DEFAULT '' NOT NULL,
	"cover_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_versions_trip_version_unique" UNIQUE("trip_id","version")
);
--> statement-breakpoint
ALTER TABLE "departures" ADD CONSTRAINT "departures_trip_version_id_trip_versions_id_fk" FOREIGN KEY ("trip_version_id") REFERENCES "public"."trip_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_versions" ADD CONSTRAINT "trip_versions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE restrict ON UPDATE no action;