CREATE TABLE "booking_participant_data_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_grant_id" uuid NOT NULL,
  "booking_participant_id" uuid NOT NULL UNIQUE,
  "draft_ciphertext" text NOT NULL,
  "saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_participant_data_drafts" ADD CONSTRAINT "booking_participant_data_drafts_booking_grant_id_booking_participant_data_grants_id_fk" FOREIGN KEY ("booking_grant_id") REFERENCES "booking_participant_data_grants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "booking_participant_data_drafts" ADD CONSTRAINT "booking_participant_data_drafts_booking_participant_id_booking_participants_id_fk" FOREIGN KEY ("booking_participant_id") REFERENCES "booking_participants"("id") ON DELETE cascade ON UPDATE no action;