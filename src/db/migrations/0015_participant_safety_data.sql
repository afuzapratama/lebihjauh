ALTER TABLE "booking_participants" ALTER COLUMN "identity_ciphertext" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "booking_participants" ALTER COLUMN "identity_hash" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "booking_participants" ALTER COLUMN "identity_last4" DROP NOT NULL;
--> statement-breakpoint
CREATE TABLE "participant_safety_data" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "booking_participant_id" uuid NOT NULL,
 "address_ciphertext" text NOT NULL,
 "whatsapp_ciphertext" text,
 "emergency_name_ciphertext" text NOT NULL,
 "emergency_relationship_ciphertext" text NOT NULL,
 "emergency_whatsapp_ciphertext" text NOT NULL,
 "identity_type" text NOT NULL,
 "identity_ciphertext" text NOT NULL,
 "identity_hash" text NOT NULL,
 "identity_last4" text NOT NULL,
 "document_object_key" text NOT NULL,
 "document_content_type" text NOT NULL,
 "status" text DEFAULT 'complete' NOT NULL,
 "consent_at" timestamp with time zone NOT NULL,
 "reviewed_at" timestamp with time zone,
 "reviewed_by_user_id" text,
 "review_note" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "participant_safety_data_booking_participant_id_unique" UNIQUE("booking_participant_id"),
 CONSTRAINT "participant_safety_data_identity_type_check" CHECK ("participant_safety_data"."identity_type" in ('ktp', 'sim', 'student_card', 'passport', 'kitas')),
 CONSTRAINT "participant_safety_data_status_check" CHECK ("participant_safety_data"."status" in ('complete', 'needs_revision'))
);
--> statement-breakpoint
ALTER TABLE "participant_safety_data" ADD CONSTRAINT "participant_safety_data_booking_participant_id_booking_participants_id_fk" FOREIGN KEY ("booking_participant_id") REFERENCES "public"."booking_participants"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "participant_safety_data" ADD CONSTRAINT "participant_safety_data_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "participant_data_grants" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "booking_participant_id" uuid NOT NULL,
 "token_hash" text NOT NULL,
 "expires_at" timestamp with time zone NOT NULL,
 "sent_at" timestamp with time zone,
 "completed_at" timestamp with time zone,
 "revoked_at" timestamp with time zone,
 "created_by_user_id" text NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "participant_data_grants_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "participant_data_grants" ADD CONSTRAINT "participant_data_grants_booking_participant_id_booking_participants_id_fk" FOREIGN KEY ("booking_participant_id") REFERENCES "public"."booking_participants"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "participant_data_grants" ADD CONSTRAINT "participant_data_grants_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
