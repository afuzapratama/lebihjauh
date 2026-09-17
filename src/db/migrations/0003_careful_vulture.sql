CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_number" text NOT NULL,
	"departure_id" uuid NOT NULL,
	"trip_version_id" uuid NOT NULL,
	"pax" integer NOT NULL,
	"pic_name" text NOT NULL,
	"pic_whatsapp" text NOT NULL,
	"pic_email" text,
	"pic_is_participant" boolean DEFAULT true NOT NULL,
	"pic_identity_ciphertext" text,
	"pic_identity_hash" text,
	"pic_identity_last4" text,
	"package_snapshot" jsonb NOT NULL,
	"policy_snapshot" jsonb NOT NULL,
	"state" text DEFAULT 'awaiting_payment' NOT NULL,
	"hold_expires_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"participant_consent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_public_number_unique" UNIQUE("public_number"),
	CONSTRAINT "bookings_pax_check" CHECK ("bookings"."pax" > 0),
	CONSTRAINT "bookings_state_check" CHECK ("bookings"."state" in ('awaiting_payment', 'confirmed', 'expired', 'cancelled', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "booking_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"departure_id" uuid NOT NULL,
	"pax" integer NOT NULL,
	"state" text DEFAULT 'held' NOT NULL,
	"expires_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_allocations_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "booking_allocations_pax_check" CHECK ("booking_allocations"."pax" > 0),
	CONSTRAINT "booking_allocations_state_check" CHECK ("booking_allocations"."state" in ('held', 'committed', 'released'))
);
--> statement-breakpoint
CREATE TABLE "booking_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"full_name" text NOT NULL,
	"identity_type" text DEFAULT 'nik' NOT NULL,
	"identity_ciphertext" text NOT NULL,
	"identity_hash" text NOT NULL,
	"identity_last4" text NOT NULL,
	"is_pic" boolean DEFAULT false NOT NULL,
	"checked_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_participants_booking_position_unique" UNIQUE("booking_id","position"),
	CONSTRAINT "booking_participants_position_check" CHECK ("booking_participants"."position" > 0),
	CONSTRAINT "booking_participants_identity_type_check" CHECK ("booking_participants"."identity_type" in ('nik', 'passport', 'kitas'))
);
--> statement-breakpoint
CREATE TABLE "checkout_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_scope_hash" text NOT NULL,
	"departure_id" uuid NOT NULL,
	"departure_revision" integer NOT NULL,
	"pax" integer NOT NULL,
	"unit_price" numeric(14, 0) NOT NULL,
	"total" numeric(14, 0) NOT NULL,
	"minimum_dp" numeric(14, 0) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkout_quotes_pax_check" CHECK ("checkout_quotes"."pax" > 0),
	CONSTRAINT "checkout_quotes_total_check" CHECK ("checkout_quotes"."total" > 0),
	CONSTRAINT "checkout_quotes_dp_check" CHECK ("checkout_quotes"."minimum_dp" > 0)
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_hash" text NOT NULL,
	"operation" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_scope_operation_key_unique" UNIQUE("scope_hash","operation","key")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"number" text NOT NULL,
	"currency" text DEFAULT 'IDR' NOT NULL,
	"total" numeric(14, 0) NOT NULL,
	"minimum_dp" numeric(14, 0) NOT NULL,
	"balance_due_at" timestamp with time zone,
	"issued_at" timestamp with time zone NOT NULL,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_currency_check" CHECK ("invoices"."currency" = 'IDR'),
	CONSTRAINT "invoices_total_check" CHECK ("invoices"."total" > 0),
	CONSTRAINT "invoices_dp_check" CHECK ("invoices"."minimum_dp" > 0)
);
--> statement-breakpoint
CREATE TABLE "invoice_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_access_grants_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_departure_id_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."departures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trip_version_id_trip_versions_id_fk" FOREIGN KEY ("trip_version_id") REFERENCES "public"."trip_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_allocations" ADD CONSTRAINT "booking_allocations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_allocations" ADD CONSTRAINT "booking_allocations_departure_id_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."departures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_quotes" ADD CONSTRAINT "checkout_quotes_departure_id_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."departures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_access_grants" ADD CONSTRAINT "invoice_access_grants_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE SEQUENCE "booking_public_number_seq";
--> statement-breakpoint
CREATE INDEX "booking_allocations_departure_active_idx" ON "booking_allocations" USING btree ("departure_id","state","expires_at");
--> statement-breakpoint
CREATE INDEX "bookings_state_created_idx" ON "bookings" USING btree ("state","created_at");
--> statement-breakpoint
CREATE INDEX "checkout_quotes_scope_idx" ON "checkout_quotes" USING btree ("guest_scope_hash","expires_at");
