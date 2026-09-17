CREATE TABLE "departure_manifest_exceptions" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "departure_id" uuid NOT NULL,
 "booking_id" uuid NOT NULL,
 "reason" text NOT NULL,
 "created_by_user_id" text NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "departure_manifest_exceptions_booking_id_unique" UNIQUE("booking_id"),
 CONSTRAINT "departure_manifest_exceptions_reason_check" CHECK (char_length("departure_manifest_exceptions"."reason") between 5 and 500)
);
--> statement-breakpoint
ALTER TABLE "departure_manifest_exceptions" ADD CONSTRAINT "departure_manifest_exceptions_departure_id_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."departures"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "departure_manifest_exceptions" ADD CONSTRAINT "departure_manifest_exceptions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "departure_manifest_exceptions" ADD CONSTRAINT "departure_manifest_exceptions_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
