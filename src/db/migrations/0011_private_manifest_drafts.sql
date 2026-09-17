CREATE TABLE "private_trip_manifest_drafts" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "offer_id" uuid NOT NULL,
 "participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
 "saved_by_user_id" text NOT NULL,
 "expires_at" timestamp with time zone NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "private_trip_manifest_drafts_offer_id_unique" UNIQUE("offer_id")
);
--> statement-breakpoint
ALTER TABLE "private_trip_manifest_drafts" ADD CONSTRAINT "private_trip_manifest_drafts_offer_id_private_trip_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."private_trip_offers"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "private_trip_manifest_drafts" ADD CONSTRAINT "private_trip_manifest_drafts_saved_by_user_id_user_id_fk" FOREIGN KEY ("saved_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
