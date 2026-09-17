ALTER TABLE "private_trip_offers" ADD COLUMN "converted_booking_id" uuid;
--> statement-breakpoint
ALTER TABLE "private_trip_offers" ADD CONSTRAINT "private_trip_offers_converted_booking_id_bookings_id_fk" FOREIGN KEY ("converted_booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "private_trip_offers" ADD CONSTRAINT "private_trip_offers_converted_booking_id_unique" UNIQUE("converted_booking_id");
