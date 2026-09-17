CREATE TABLE "trip_expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "departure_id" uuid,
  "scope" text DEFAULT 'departure' NOT NULL,
  "category" text NOT NULL,
  "paid_at" timestamp with time zone NOT NULL,
  "vendor" text NOT NULL,
  "amount" numeric(14, 0) NOT NULL,
  "method" text NOT NULL,
  "reference" text,
  "proof_object_key" text,
  "state" text DEFAULT 'active' NOT NULL,
  "void_reason" text,
  "recorded_by_user_id" text NOT NULL,
  "voided_by_user_id" text,
  "voided_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "trip_expenses_scope_check" CHECK ("trip_expenses"."scope" in ('departure', 'general')),
  CONSTRAINT "trip_expenses_amount_check" CHECK ("trip_expenses"."amount" > 0),
  CONSTRAINT "trip_expenses_state_check" CHECK ("trip_expenses"."state" in ('active', 'voided')),
  CONSTRAINT "trip_expenses_departure_scope_check" CHECK (("trip_expenses"."scope" = 'departure' and "trip_expenses"."departure_id" is not null) or ("trip_expenses"."scope" = 'general' and "trip_expenses"."departure_id" is null))
);
--> statement-breakpoint
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_departure_id_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."departures"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_recorded_by_user_id_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trip_expenses" ADD CONSTRAINT "trip_expenses_voided_by_user_id_user_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
